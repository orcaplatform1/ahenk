import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import { createHash, randomUUID } from "crypto";
import { Prisma, SanctionType, SubscriptionStatus, UserRole, UserStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { endKankaLinks } from "../kanka/kanka-links";

// Silinen hesabın masa geçmişini ve değerlendirmelerini taşıyan, kimliksiz yer tutucu satırın e-posta öneki
export const DELETED_PLACEHOLDER_PREFIX = "silinmis-masa-";

export const hashPhone = (phone: string) => createHash("sha256").update(phone).digest("hex");

const ACTIVE_TABLE_MESSAGE = "Bu hafta kurulmuş masan var. Buluşma bitene kadar hesap silme talebi veremezsin.";

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // Kurulmuş (PENDING / ACTIVE) masası olan kişi: buluşma bitene kadar silinemez
  private activeTables(userId: string) {
    return this.prisma.meetingParticipant.count({
      where: {
        userId,
        status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] },
        meeting: { status: { in: ["PENDING", "ACTIVE"] } },
      },
    });
  }

  pendingOf(userId: string) {
    return this.prisma.accountDeletionRequest.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true, status: true, createdAt: true },
    });
  }

  async request(userId: string) {
    if (await this.activeTables(userId)) throw new BadRequestException(ACTIVE_TABLE_MESSAGE);
    try {
      return await this.prisma.accountDeletionRequest.create({
        data: { userId },
        select: { id: true, status: true, createdAt: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bekleyen bir hesap silme talebin var.");
      }
      throw err;
    }
  }

  // ADMIN ve SUPERADMIN görür; saklanan kimlik bilgisini sadece SUPERADMIN görür
  async list(viewerRole: UserRole) {
    const rows = await this.prisma.accountDeletionRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
    });
    return rows.map(({ user, retainedIdentity, ...r }) => ({
      ...r,
      userName: user.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : "Silinmiş kullanıcı",
      ...(viewerRole === UserRole.SUPERADMIN ? { retainedIdentity } : {}),
    }));
  }

  async decide(id: string, status: "APPROVED" | "REJECTED", adminId: string) {
    const request = await this.prisma.accountDeletionRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException("Silme talebi bulunamadı");
    if (request.status !== "PENDING") throw new BadRequestException("Bu talep zaten sonuçlandırılmış");

    if (status === "REJECTED") {
      const { count } = await this.prisma.accountDeletionRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status, decidedAt: new Date(), decidedBy: adminId },
      });
      if (count === 0) throw new BadRequestException("Bu talep zaten sonuçlandırılmış");
      await this.log(adminId, request.userId, "ACCOUNT_DELETION_REJECT", `Hesap silme talebi reddedildi: ${id}`);
      return { ok: true, status };
    }
    return this.approve(request.id, request.userId, adminId);
  }

  private log(adminId: string, targetUserId: string, action: string, description: string, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    return db.adminActionLog.create({ data: { adminId, action, description, targetUserId } });
  }

  private async approve(id: string, userId: string, adminId: string) {
    // Talepten sonra masaya girmişse buluşma bitene kadar silinmez
    if (await this.activeTables(userId)) {
      throw new BadRequestException("Kişinin kurulmuş masası var; buluşma bitince onaylayın.");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true, phone: true, status: true,
        profile: { select: { firstName: true, lastName: true } },
        kyc: { select: { idFrontKey: true, idBackKey: true, livenessKey: true } },
      },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");

    const [sos, snapshotSos, reports, sanctions, banned] = await Promise.all([
      this.prisma.sosReport.count({ where: { userId } }),
      this.prisma.sosReport.count({ where: { participantSnapshot: { array_contains: [{ userId }] } } }),
      this.prisma.report.count({ where: { OR: [{ reporterId: userId }, { reportedId: userId }] } }),
      this.prisma.userSanction.count({ where: { userId } }),
      this.prisma.userSanction.count({
        where: { userId, type: SanctionType.BAN, liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      }),
    ]);
    // SOS, şikâyet ya da yaptırıma karışan kişinin kimlik bilgisi silinmez; talep kaydında kalır, sadece SUPERADMIN görür
    const retained = sos + snapshotSos + reports + sanctions > 0
      ? { firstName: user.profile?.firstName ?? null, lastName: user.profile?.lastName ?? null, email: user.email, phone: user.phone }
      : Prisma.JsonNull;

    const exKankas = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.accountDeletionRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", decidedAt: new Date(), decidedBy: adminId, retainedIdentity: retained },
      });
      if (count === 0) throw new BadRequestException("Bu talep zaten sonuçlandırılmış");

      // Masa geçmişi ve değerlendirmeler kalır, kişiyle bağı kopar: kimliksiz yer tutucu satıra taşınır
      const placeholder = await tx.user.create({
        data: {
          email: `${DELETED_PLACEHOLDER_PREFIX}${randomUUID()}@ahenk.invalid`,
          passwordHash: "silindi",
          status: UserStatus.DELETED,
        },
        select: { id: true },
      });
      await tx.meetingParticipant.updateMany({ where: { kankaPartnerId: userId }, data: { kankaPartnerId: null } });
      await tx.meetingParticipant.updateMany({
        where: { userId },
        data: { userId: placeholder.id, groupRightSubId: null, kankaRightSubId: null, kankaPartnerId: null },
      });
      await tx.meetingReview.updateMany({ where: { reviewerId: userId }, data: { reviewerId: placeholder.id } });

      await tx.profile.deleteMany({ where: { userId } });
      await tx.oceanScore.deleteMany({ where: { userId } });
      await tx.oceanAnswer.deleteMany({ where: { userId } });
      await tx.kycSubmission.deleteMany({ where: { userId } });
      await tx.userIdentity.deleteMany({ where: { userId } });
      await tx.contactBlock.deleteMany({ where: { userId } });
      await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await tx.chatMessage.deleteMany({ where: { senderId: userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.matchingWaitlist.deleteMany({ where: { userId } });
      await tx.winbackOffer.deleteMany({ where: { userId } });
      await tx.referral.updateMany({ where: { referredId: userId }, data: { invitedPhone: null } });

      // Kullanılmamış haklar kullanılamaz hâle gelir (Subscription kaydı saklanır)
      await tx.subscription.updateMany({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.CANCELLED, cancelNote: "Hesap silindi" },
      });
      const kankas = await endKankaLinks(tx, userId, "BAN");

      // Satır anonimleşir: e-posta zorunlu ve benzersiz olduğu için kimliksiz bir değer yazılır
      const isBanned = user.status === UserStatus.BANNED || banned > 0;
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `silinmis-${userId}@ahenk.invalid`,
          phone: null,
          phoneHash: isBanned && user.phone ? hashPhone(user.phone) : null,
          passwordHash: "silindi",
          status: UserStatus.DELETED,
          fcmToken: null,
          activeCity: null,
          occupationSector: "",
          emailVerified: false,
          phoneVerified: false,
          tokenVersion: { increment: 1 },
        },
      });
      await this.log(adminId, userId, "ACCOUNT_DELETION_APPROVE", `Hesap silme talebi onaylandı: ${id}`, tx);
      return kankas;
    });

    // KYC görselleri ve videosu diskten silinir
    for (const file of [user.kyc?.idFrontKey, user.kyc?.idBackKey, user.kyc?.livenessKey]) {
      if (!file) continue;
      try { fs.unlinkSync(file); } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") this.logger.error(`KYC dosyası silinemedi: request=${id} ${err}`);
      }
    }
    for (const kankaId of exKankas) {
      await this.notifications.sendToUser(kankaId, {
        title: "Kankalık sona erdi",
        body: "Kankanın hesabı kapatıldığı için kankalığınız sona erdi. Profilim'den yeni bir kanka davet edebilirsin.",
        data: { type: "KANKA_ENDED" },
      }).catch(() => undefined);
    }
    return { ok: true, status: "APPROVED" as const };
  }
}
