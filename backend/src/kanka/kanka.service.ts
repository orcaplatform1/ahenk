import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { ASSIGN_QUEUE, enqueueAssign } from "../matching/assign-queue";
import { KycStatus, UserStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { initialsOf } from "../meetings/cancellation-notice";
import { OPEN_KANKA_SUB, PACKAGE_CYCLES } from "../payment/package-rights";
import { activeKankaLink, endKankaLinks, kankaLockReason } from "./kanka-links";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
// Davet linkiyle rastgele numaralara WhatsApp gönderilmesin: kişi başına günlük sınır (TR günü)
const DAILY_INVITE_LIMIT = 3;

function trDayStart(now = new Date()): Date {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - 3 * 60 * 60 * 1000);
}

const PERSON_SELECT = {
  id: true,
  status: true,
  phone: true,
  phoneVerified: true,
  profile: { select: { firstName: true, lastName: true, gender: true } },
  kyc: { select: { status: true } },
} as const;

@Injectable()
export class KankaService {
  private readonly logger = new Logger(KankaService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private whatsapp: WhatsappNotifyService,
    private config: ConfigService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
  ) {}

  private inviteLink(token: string) {
    return `${this.config.get<string>("APP_URL") ?? "https://ahenk.co"}/kanka/${token}`;
  }

  private async person(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: PERSON_SELECT });
    if (!u) throw new NotFoundException("Kullanıcı bulunamadı");
    return u;
  }

  // ─── Profilim "Aktif Kankanız" durumu ───────────────────────────────────────

  async getMine(userId: string) {
    const me = await this.person(userId);
    const now = new Date();
    const link = await activeKankaLink(this.prisma, userId);

    let kanka = null;
    if (link) {
      const k = await this.person(link.kankaId);
      const lockReason = await kankaLockReason(this.prisma, link, now);
      kanka = {
        initials: initialsOf(k.profile),
        gender: k.profile?.gender ?? null,
        since: link.createdAt,
        locked: !!lockReason,
        lockReason,
      };
    }

    // Davet ettiğim (son davet): bekliyorsa link, süresi dolduysa "tekrar gönder"
    const outgoing = await this.prisma.kankaInvite.findFirst({
      where: { inviterId: userId, status: { in: ["PENDING", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
      select: { token: true, status: true, expiresAt: true },
    });
    const outgoingInvite = outgoing && !link
      ? {
          link: this.inviteLink(outgoing.token),
          expiresAt: outgoing.expiresAt,
          expired: outgoing.status === "EXPIRED" || outgoing.expiresAt <= now,
        }
      : null;

    // Bana gelen davetler: numaramı WhatsApp koduyla doğruladıysam
    const incoming = me.phone && me.phoneVerified && !link
      ? await this.prisma.kankaInvite.findMany({
          where: { invitedPhone: me.phone, status: "PENDING", expiresAt: { gt: now }, inviterId: { not: userId } },
          orderBy: { createdAt: "desc" },
          select: { id: true, expiresAt: true, inviter: { select: { profile: { select: { firstName: true, lastName: true, gender: true } } } } },
        })
      : [];

    // Çiftin Kankamla paketi (alıcı ya da kanka olarak)
    const pairIds = link ? [userId, link.kankaId] : [userId];
    const sub = await this.prisma.subscription.findFirst({
      where: { userId: { in: pairIds }, ...OPEN_KANKA_SUB },
      orderBy: { createdAt: "asc" },
      select: { userId: true, kankaRights: true, kankaCycles: true },
    });

    return {
      kanka,
      outgoingInvite,
      incomingInvites: incoming.map((i) => ({
        id: i.id,
        inviterInitials: initialsOf(i.inviter.profile),
        inviterGender: i.inviter.profile?.gender ?? null,
        expiresAt: i.expiresAt,
      })),
      kankamla: sub
        ? { role: sub.userId === userId ? "BUYER" : "KANKA", rightsLeft: sub.kankaRights, cycles: sub.kankaCycles, packageCycles: PACKAGE_CYCLES }
        : null,
      canInvite: !link && me.kyc?.status === KycStatus.APPROVED,
      kycApproved: me.kyc?.status === KycStatus.APPROVED,
    };
  }

  // ─── Davet gönder ───────────────────────────────────────────────────────────
  // Link her durumda döner (numaranın kayıtlı olup olmadığı ele verilmez). WhatsApp gönderilemese de davet
  // geçerlidir; davet eden linki kopyalayıp kendisi iletebilir.

  async invite(userId: string, phone: string) {
    const me = await this.person(userId);
    if (me.status !== UserStatus.ACTIVE) throw new ForbiddenException("Hesabın aktif değil.");
    if (me.kyc?.status !== KycStatus.APPROVED) {
      throw new ForbiddenException("Kanka davet etmek için önce kimlik doğrulamanı (KYC) tamamlamalısın.");
    }
    if (!me.profile?.gender) throw new BadRequestException("Profilinde cinsiyet bilgisi eksik.");
    if (me.phone === phone) throw new BadRequestException("Kendi numaranı davet edemezsin.");
    if (await activeKankaLink(this.prisma, userId)) {
      throw new ConflictException("Zaten bir kankan var. Yeni kanka için önce kankalıktan çıkmalısın.");
    }
    const today = await this.prisma.kankaInvite.count({ where: { inviterId: userId, createdAt: { gte: trDayStart() } } });
    if (today >= DAILY_INVITE_LIMIT) {
      throw new BadRequestException(`Günlük kanka daveti sınırına ulaştın (${DAILY_INVITE_LIMIT}). Yarın tekrar deneyebilirsin.`);
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    // Tek bekleyen davet: önceki bekleyen davet geri çekilir
    await this.prisma.$transaction([
      this.prisma.kankaInvite.updateMany({ where: { inviterId: userId, status: "PENDING" }, data: { status: "CANCELLED" } }),
      this.prisma.kankaInvite.create({ data: { inviterId: userId, invitedPhone: phone, token, expiresAt } }),
    ]);

    const link = this.inviteLink(token);
    const name = `${me.profile?.firstName ?? ""} ${(me.profile?.lastName ?? "").charAt(0)}.`.trim();
    await this.whatsapp.send(phone, "ahenk_kanka_invite", [name, link])
      .catch((err) => this.logger.warn(`Kanka daveti WhatsApp gönderilemedi: ${err}`));

    // Kayıtlı ve numarası doğrulanmış kişiye uygulama içi bildirim (davet edene bilgi dönmez)
    const target = await this.prisma.user.findFirst({ where: { phone, phoneVerified: true }, select: { id: true } });
    if (target) {
      await this.notifications.sendToUser(target.id, {
        title: "Kanka davetin var",
        body: `${initialsOf(me.profile)} seni Kankamla için kanka olmaya davet etti. Profilim'den yanıtlayabilirsin.`,
        data: { type: "KANKA_INVITE" },
      }).catch(() => undefined);
    }

    return { link, expiresAt };
  }

  // ─── Davete yanıt ───────────────────────────────────────────────────────────

  private async incomingInvite(userId: string, inviteId: string) {
    const me = await this.person(userId);
    const invite = await this.prisma.kankaInvite.findUnique({ where: { id: inviteId } });
    // Davet sadece davet edilen (doğrulanmış) numaranın sahibine görünür
    if (!invite || !me.phone || !me.phoneVerified || invite.invitedPhone !== me.phone || invite.inviterId === userId) {
      throw new NotFoundException("Davet bulunamadı.");
    }
    if (invite.status !== "PENDING") throw new ConflictException("Bu davet artık geçerli değil.");
    if (invite.expiresAt <= new Date()) {
      await this.prisma.kankaInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
      throw new ConflictException("Davetin süresi doldu. Davet edenden tekrar göndermesini isteyebilirsin.");
    }
    return { me, invite };
  }

  async accept(userId: string, inviteId: string) {
    const { me, invite } = await this.incomingInvite(userId, inviteId);
    const inviter = await this.person(invite.inviterId);

    if (me.status !== UserStatus.ACTIVE) throw new ForbiddenException("Hesabın aktif değil.");
    if (me.kyc?.status !== KycStatus.APPROVED) {
      throw new ForbiddenException("Kanka olmak için önce kimlik doğrulamanı (KYC) tamamlamalısın.");
    }
    if (inviter.status !== UserStatus.ACTIVE || inviter.kyc?.status !== KycStatus.APPROVED) {
      throw new ConflictException("Davet eden kişinin hesabı şu an kanka eklemeye uygun değil.");
    }
    if (!me.profile?.gender || me.profile.gender !== inviter.profile?.gender) {
      throw new BadRequestException("Kanka aynı cinsiyetten olmalı.");
    }
    if (await activeKankaLink(this.prisma, userId)) throw new ConflictException("Zaten bir kankan var.");
    if (await activeKankaLink(this.prisma, inviter.id)) throw new ConflictException("Davet eden kişinin artık bir kankası var.");

    await this.prisma.$transaction(async (tx) => {
      await tx.kankaLink.create({ data: { userAId: inviter.id, userBId: userId } });
      await tx.kankaInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedById: userId, respondedAt: new Date() },
      });
      // İki kişinin de bekleyen davetleri (gönderdiği) geri çekilir
      await tx.kankaInvite.updateMany({
        where: { inviterId: { in: [inviter.id, userId] }, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    });

    await this.notifications.sendToUser(inviter.id, {
      title: "Kanka davetin kabul edildi",
      body: `${initialsOf(me.profile)} artık kankan. Kankamla paketiyle birlikte masaya oturabilirsiniz.`,
      data: { type: "KANKA_ACCEPTED" },
    }).catch(() => undefined);
    // Çiftte açık Kankamla paketi varsa hemen taramaya girer
    await enqueueAssign(this.assignQueue, inviter.id).catch(() => undefined);
    return { ok: true };
  }

  async decline(userId: string, inviteId: string) {
    const { invite } = await this.incomingInvite(userId, inviteId);
    await this.prisma.kankaInvite.update({ where: { id: invite.id }, data: { status: "DECLINED", respondedAt: new Date() } });
    return { ok: true };
  }

  // ─── Kankalıktan çık ────────────────────────────────────────────────────────

  async unlink(userId: string) {
    const link = await activeKankaLink(this.prisma, userId);
    if (!link) throw new NotFoundException("Aktif kankan yok.");
    const lock = await kankaLockReason(this.prisma, link);
    if (lock) throw new ForbiddenException(lock);

    const me = await this.person(userId);
    await endKankaLinks(this.prisma, userId, "USER");
    await this.notifications.sendToUser(link.kankaId, {
      title: "Kankalık sona erdi",
      body: `${initialsOf(me.profile)} kankalıktan çıktı. Profilim'den yeni bir kanka davet edebilirsin.`,
      data: { type: "KANKA_ENDED" },
    }).catch(() => undefined);
    return { ok: true };
  }

  // ─── Linkle açılan sayfa (oturum gerekmez) ──────────────────────────────────
  // Sadece davet edenin baş harfleri döner; davet kabulü Profilim'den, doğrulanmış numarayla yapılır.

  async inviteByToken(token: string) {
    const invite = await this.prisma.kankaInvite.findUnique({
      where: { token },
      select: { status: true, expiresAt: true, inviter: { select: { profile: { select: { firstName: true, lastName: true, gender: true } } } } },
    });
    const valid = !!invite && invite.status === "PENDING" && invite.expiresAt > new Date();
    return {
      valid,
      inviterInitials: valid ? initialsOf(invite!.inviter.profile) : null,
      inviterGender: valid ? invite!.inviter.profile?.gender ?? null : null,
    };
  }
}
