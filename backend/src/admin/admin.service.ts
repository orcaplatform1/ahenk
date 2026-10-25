import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import {
  UserStatus,
  UserRole,
  SubscriptionPlan,
  SubscriptionStatus,
  MeetingStatus,
  MeetingType,
  Gender,
  VenueCategory,
  VenueType,
  RefundStatus,
  ReferralStatus,
  SanctionType,
  PartnershipStatus,
  CareerStatus,
  KycStatus,
  Prisma,
  AdminAlertType,
} from "@prisma/client";
import { PLAN_CONFIG } from "../payment/payment.constants";
import { vatOfGrossKurus } from "../payment/pricing";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { NotificationService } from "../notification/notification.service";
import { PaymentService } from "../payment/payment.service";
import type { AdminUpdateUserDto } from "./dto/admin.dto";
import { KycService } from "../kyc/kyc.service";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { ASSIGN_QUEUE, enqueueAssign } from "../matching/assign-queue";
import { consumeOneOnOneRights, restoreOneOnOneRights } from "../matching/one-on-one-right";
import { availableBots } from "../matching/bot-picker";
import { MatchingService } from "../matching/matching.service";
import { DEFAULT_SANCTION_REASON, NO_SHOW_WARNING_LIMIT, suspensionEndDate } from "./sanction-reasons";
import { activeNoShowWarningsWhere } from "./no-show-warnings";
import { OVERLAPPING_PLANS } from "../payment/plan-overlap";
import { GROUP_RIGHTS, restoreGroupRights } from "../payment/package-rights";

const PIONEER_MAX_QUOTA = 500;

// Mekan fotoğrafları: /root/ahenk/uploads/venues/<meetingId>/ — MediaController ile herkese açık sunulur
export const VENUE_UPLOAD_DIR = path.join(process.cwd(), "..", "uploads", "venues");
export const VENUE_PUBLIC_PREFIX = "/api/v1/media/venues";
const VENUE_PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
    private notifications: NotificationService,
    private payment: PaymentService,
    private kyc: KycService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
    private matching: MatchingService,
  ) {}

  // ─── Dashboard ───────────────────────────────────────────────────────────

  async getDashboard() {
    // Hafta Pazartesi 00:00'da başlar
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      kycPending,
      activeMeetingsThisWeek,
      groupThisWeek,
      pioneerCount,
      cityDistribution,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isBot: false, status: { not: "DELETED" } } }),
      this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      // Bu hafta buluşacak kurulmuş masalar (bekleyen + onaylı)
      this.prisma.meeting.count({
        where: { status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gte: weekStart, lt: weekEnd } },
      }),
      this.prisma.meeting.count({
        where: { type: "GROUP", status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gte: weekStart, lt: weekEnd } },
      }),
      this.prisma.profile.count({ where: { isPioneer: true } }),
      this.prisma.profile.groupBy({
        by: ["city"],
        where: { city: { not: null }, user: { isBot: false } },
        _count: { city: true },
        orderBy: { _count: { city: "desc" } },
        take: 10,
      }),
    ]);

    return {
      totalUsers,
      kycPending,
      activeMeetingsThisWeek,
      groupMeetingsThisWeek: groupThisWeek,
      oneOnOneMeetingsThisWeek: activeMeetingsThisWeek - groupThisWeek,
      pioneer: { count: pioneerCount, remaining: Math.max(0, PIONEER_MAX_QUOTA - pioneerCount) },
      cityDistribution: cityDistribution.map((c) => ({ city: c.city, count: c._count.city })),
    };
  }

  // ─── Kullanıcı listesi ────────────────────────────────────────────────────

  async listUsers(params: { search?: string; status?: string; city?: string; type?: string; page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isBot: false };
    if (params.status) {
      if (!Object.values(UserStatus).includes(params.status as UserStatus)) {
        throw new BadRequestException("Geçersiz kullanıcı durumu");
      }
      where.status = params.status;
    }

    // Şehir filtresi — ikamet şehri veya katılım şehri
    if (params.city?.trim()) {
      const c = params.city.trim();
      // primaryCity şehir ID'si tutar → adı eşleşen şehirlerin ID'leri
      const cityIds = (await this.prisma.city.findMany({
        where: { name: { contains: c, mode: "insensitive" } },
        select: { id: true },
      })).map((x) => x.id);
      where.AND = [{
        OR: [
          { profile: { city: { contains: c, mode: "insensitive" } } },
          { profile: { primaryCity: { in: cityIds } } },
        ],
      }];
    }

    // Rol / paket tipi filtresi
    if (params.type === 'ADMIN')       where.role = 'ADMIN';
    else if (params.type === 'SUPERADMIN') where.role = 'SUPERADMIN';
    else if (params.type === 'MASADA')  where.subscriptions = { some: { plan: 'MASADA' } };
    else if (params.type === 'KARSIMDA') where.subscriptions = { some: { plan: 'KARSIMDA' } };
    else if (params.type === 'ICERDE')  where.subscriptions = { some: { plan: 'ICERDE' } };
    else if (params.type === 'NO_PLAN') where.subscriptions = { none: {} };
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: "insensitive" } },
        { profile: { firstName: { contains: params.search, mode: "insensitive" } } },
        { profile: { lastName: { contains: params.search, mode: "insensitive" } } },
        { phone: { contains: params.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          profile: { select: { firstName: true, lastName: true, city: true, isPioneer: true } },
          kyc: { select: { status: true } },
          oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
          // Sadece aktif paketler (Abonelikler sayfasındaki "Aktif" ile aynı kural)
          subscriptions: { where: { status: SubscriptionStatus.ACTIVE }, select: { plan: true }, orderBy: { createdAt: 'desc' as const } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Kullanıcı detay ──────────────────────────────────────────────────────

  async getUser(userId: string, viewerRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        kyc: true,
        oceanScore: true,
        subscriptions: { where: { status: SubscriptionStatus.ACTIVE }, orderBy: { createdAt: "desc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 10 },
        participations: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { meeting: { select: { id: true, title: true, scheduledAt: true, status: true, type: true } } },
        },
        // Değerlendirmelerde "masaya katılmadı" bildirimleri
        noShowReportsReceived: {
          orderBy: { createdAt: "desc" },
          select: {
            createdAt: true,
            meeting: { select: { id: true, scheduledAt: true, type: true, locationText: true, cycleId: true } },
            reporter: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    if (user.role === UserRole.SUPERADMIN && viewerRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Bu kullanıcıyı görüntüleme yetkiniz yok");
    }
    // Hassas alanlar admin yanıtına konmaz
    const { passwordHash, fcmToken, phoneHash, isBot, botPhone, ...rest } = user;
    // Botun panel numarası telefon olarak gösterilir (gerçek telefon alanı boştur)
    const safeUser = { ...rest, phone: isBot ? botPhone : rest.phone };
    const [groupCount, oneOnOneCount] = await Promise.all([
      this.prisma.meetingParticipant.count({ where: { userId, meeting: { type: 'GROUP' } } }),
      this.prisma.meetingParticipant.count({ where: { userId, meeting: { type: 'ONE_ON_ONE' } } }),
    ]);
    const noShowWarnings = await this.noShowWarnings(userId);
    // Bot bilgisi yalnızca SUPERADMIN'e
    return { ...safeUser, ...(viewerRole === UserRole.SUPERADMIN ? { isBot } : {}), groupCount, oneOnOneCount, noShowWarnings };
  }

  // ─── Gelmedi uyarısı ──────────────────────────────────────────────────────

  // Sayaç son askıdan sonra verilen (kaldırılmamış) gelmedi uyarılarıdır; askı sayacı sıfırlar
  private async noShowWarnings(userId: string) {
    const where = await activeNoShowWarningsWhere(this.prisma, userId);
    const [active, warnedMeetings] = await Promise.all([
      this.prisma.userSanction.count({ where }),
      // Daha önce uyarı verilmiş masalar (sayaç sıfırlansa da aynı masaya ikinci uyarı yok)
      this.prisma.userSanction.findMany({
        where: { userId, type: SanctionType.WARNING, meetingId: { not: null } },
        select: { meetingId: true, meeting: { select: { cycleId: true } } },
      }),
    ]);
    return {
      count: active,
      limit: NO_SHOW_WARNING_LIMIT,
      warnedMeetingIds: warnedMeetings.map((w) => w.meetingId as string),
      // Aynı hafta (İçerde: grup + başbaşa) tek uyarı; ikincisi tekerrür sayılmaz
      warnedCycleIds: [...new Set(warnedMeetings.map((w) => w.meeting?.cycleId).filter((c): c is string => !!c))],
    };
  }

  async giveNoShowWarning(userId: string, meetingId: string, adminId: string) {
    await this.assertCanSanction(userId, adminId);

    const report = await this.prisma.noShowReport.findFirst({
      where: { meetingId, reportedId: userId },
      select: { meeting: { select: { scheduledAt: true, cycleId: true } } },
    });
    if (!report) throw new BadRequestException("Bu masa için kullanıcı hakkında gelmedi bildirimi yok");

    // Aynı hafta ikinci uyarı yok (İçerde: grup + başbaşa gelmeme tek uyarı sayılır)
    if (report.meeting.cycleId) {
      const sameWeek = await this.prisma.userSanction.findFirst({
        where: { userId, type: SanctionType.WARNING, meeting: { cycleId: report.meeting.cycleId } },
        select: { id: true },
      });
      if (sameWeek) throw new ConflictException("Bu hafta için zaten uyarı verilmiş");
    }

    const already = await this.prisma.userSanction.findUnique({
      where: { userId_meetingId: { userId, meetingId } },
      select: { id: true },
    });
    if (already) throw new ConflictException("Bu masa için zaten uyarı verilmiş");

    const { count } = await this.noShowWarnings(userId);
    const remaining = Math.max(NO_SHOW_WARNING_LIMIT - (count + 1), 0);
    const dateStr = report.meeting.scheduledAt.toLocaleDateString("tr-TR", {
      day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul",
    });
    const reason =
      `${dateStr} tarihli masa etkinliğine masa kurulduktan sonra katılmadığınız tespit edilmiştir. ` +
      `${NO_SHOW_WARNING_LIMIT} uyarı hesabın 1 ay askıya alınmasına neden olur. Kalan uyarı hakkı: ${remaining}`;

    await this.prisma.userSanction.create({
      data: { userId, adminId, type: SanctionType.WARNING, reason, meetingId },
    });
    // Otomatik askı yok: 3'e ulaşınca admin panelde askıya alma seçeneği görünür
    return this.noShowWarnings(userId);
  }

  // ─── Yaptırım yetkisi ────────────────────────────────────────────────────

  // SUPERADMIN'e kimse işlem yapamaz; ADMIN'e sadece SUPERADMIN işlem yapabilir
  private async assertCanSanction(targetId: string, actorId: string) {
    if (targetId === actorId) throw new BadRequestException("Kendi hesabınızı değiştiremezsiniz");
    const [target, actor] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: targetId }, select: { role: true } }),
      this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } }),
    ]);
    if (!target) throw new NotFoundException("Kullanıcı bulunamadı");
    if (
      target.role === UserRole.SUPERADMIN ||
      (target.role === UserRole.ADMIN && actor?.role !== UserRole.SUPERADMIN)
    ) {
      throw new ForbiddenException("Bu hesaba işlem yetkiniz yok");
    }
  }

  private async actorRole(actorId: string): Promise<UserRole | undefined> {
    return (await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } }))?.role;
  }

  // ─── Kişisel bilgi düzenleme ─────────────────────────────────────────────

  // Yetki yaptırımla aynı: SUPERADMIN düzenlenemez, ADMIN'i yalnızca SUPERADMIN düzenler
  async adminUpdateUser(targetId: string, actorId: string, dto: AdminUpdateUserDto) {
    await this.assertCanSanction(targetId, actorId);
    const role = await this.actorRole(actorId);
    if (dto.email !== undefined && role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("E-postayı yalnızca süper admin değiştirebilir");
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { isBot: true } });
    if (!target) throw new NotFoundException("Kullanıcı bulunamadı");

    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({ where: { id: dto.cityId }, select: { isActive: true } });
      if (!city?.isActive) throw new BadRequestException("Seçilen şehir aktif değil");
    }
    // Bot numarası ayrı alanda tutulur (bildirim/kayıt sistemleri kullanmaz)
    if (dto.phone && !target.isBot) {
      const other = await this.prisma.user.findFirst({ where: { phone: dto.phone, id: { not: targetId } }, select: { id: true } });
      if (other) throw new ConflictException("Bu telefon numarası başka bir hesapta kayıtlı");
    }
    if (dto.email) {
      const other = await this.prisma.user.findFirst({ where: { email: dto.email, id: { not: targetId } }, select: { id: true } });
      if (other) throw new ConflictException("Bu e-posta başka bir hesapta kayıtlı");
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.phone !== undefined) {
      if (target.isBot) userData.botPhone = dto.phone;
      else userData.phone = dto.phone;
    }
    if (dto.email !== undefined) userData.email = dto.email;
    if (dto.occupationSector !== undefined) userData.occupationSector = dto.occupationSector;

    const profileData: Prisma.ProfileUpdateInput = {};
    if (dto.firstName !== undefined) profileData.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) profileData.lastName = dto.lastName.trim();
    if (dto.gender !== undefined) profileData.gender = dto.gender;
    if (dto.birthDate !== undefined) profileData.birthDate = new Date(dto.birthDate);
    if (dto.cityId !== undefined) profileData.primaryCity = dto.cityId;

    try {
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: targetId }, data: userData }),
        ...(Object.keys(profileData).length
          ? [this.prisma.profile.update({ where: { userId: targetId }, data: profileData })]
          : []),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Telefon veya e-posta başka bir hesapta kayıtlı");
      }
      throw e;
    }
    return { ok: true };
  }

  // ─── Hesap askıya al/aktifleştir ─────────────────────────────────────────

  async updateUserStatus(targetId: string, actorId: string, status: UserStatus, reason?: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException("Kullanıcı bulunamadı");
    await this.assertCanSanction(targetId, actorId);
    if (target.isBot) throw new BadRequestException("Bu hesabın durumu buradan değiştirilemez");
    if (status === UserStatus.ACTIVE && (await this.actorRole(actorId)) !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Yaptırımı yalnızca süper admin kaldırabilir");
    }

    // Askı / ban yaptırım kaydıyla uygulanır; aksi halde girişte otomatik kalkar
    if (status === UserStatus.SUSPENDED || status === UserStatus.BANNED) {
      const isBan = status === UserStatus.BANNED;
      await this.createSanction(
        targetId,
        actorId,
        isBan ? SanctionType.BAN : SanctionType.SUSPENSION,
        reason ?? DEFAULT_SANCTION_REASON,
        isBan ? undefined : suspensionEndDate(),
      );
      return { id: targetId, status };
    }

    // Aktifleştirme: aktif askı / ban kayıtları kaldırılır
    if (status === UserStatus.ACTIVE) {
      await this.prisma.userSanction.updateMany({
        where: {
          userId: targetId,
          liftedAt: null,
          type: { in: [SanctionType.BAN, SanctionType.SUSPENSION] },
        },
        data: { liftedAt: new Date() },
      });
    }

    return this.prisma.user.update({
      where: { id: targetId },
      data: { status },
      select: { id: true, status: true },
    });
  }

  // ─── Rol değiştir (sadece SUPERADMIN) ────────────────────────────────────

  async updateUserRole(targetId: string, actorId: string, role: UserRole) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    if (actor?.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Rol değişikliği için SUPERADMIN yetkisi gerekli");
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException("Kullanıcı bulunamadı");
    if (target.id === actorId) throw new BadRequestException("Kendi rolünüzü değiştiremezsiniz");

    return this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: { id: true, role: true },
    });
  }

  // ─── Öncü rozeti aç/kapat (500 kota) ─────────────────────────────────────

  async togglePioneerBadge(targetId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId: targetId } });
    if (!profile) throw new NotFoundException("Kullanıcı profili bulunamadı");

    if (!profile.isPioneer) {
      const currentCount = await this.prisma.profile.count({ where: { isPioneer: true } });
      if (currentCount >= PIONEER_MAX_QUOTA) {
        throw new ConflictException(
          `Öncü kotası doldu (${PIONEER_MAX_QUOTA}/${PIONEER_MAX_QUOTA}). Yeni Öncü atanamaz.`,
        );
      }
    }

    return this.prisma.profile.update({
      where: { userId: targetId },
      data: { isPioneer: !profile.isPioneer },
      select: { userId: true, isPioneer: true },
    });
  }

  // ─── Öncü kota durumu ─────────────────────────────────────────────────────

  async getPioneerQuota() {
    const count = await this.prisma.profile.count({ where: { isPioneer: true } });
    return {
      max: PIONEER_MAX_QUOTA,
      used: count,
      remaining: Math.max(0, PIONEER_MAX_QUOTA - count),
      full: count >= PIONEER_MAX_QUOTA,
    };
  }

  // ─── Ücretsiz abonelik ver ────────────────────────────────────────────────

  async grantFreeSubscription(targetId: string, plan: SubscriptionPlan, expiresAt?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");

    // Tek seferlik paket: haklar + 4 döngü (package-rights.ts); admin isterse ayrıca son tarih verebilir
    const expiry: Date | null = expiresAt ? new Date(expiresAt) : null;

    // İçeriği çakışan aktif paketler (ücretli dahil) iade yapılmadan iptal edilir; bekleyen iade talepleri reddedilir.
    // Çakışmayan paket kalır: Masada + Karşımda birlikte olabilir; İçerde ikisini de kapsar.
    const oldSubs = await this.prisma.subscription.findMany({
      where: { userId: targetId, status: SubscriptionStatus.ACTIVE, plan: { in: OVERLAPPING_PLANS[plan] } },
      select: { id: true },
    });
    const oldIds = oldSubs.map((s) => s.id);
    const [, , sub] = await this.prisma.$transaction([
      this.prisma.subscription.updateMany({
        where: { id: { in: oldIds } },
        data: { status: SubscriptionStatus.CANCELLED, cancelNote: `Admin yeni paket verdi: ${PLAN_CONFIG[plan].nametr}` },
      }),
      this.prisma.refundRequest.updateMany({
        where: { subscriptionId: { in: oldIds }, status: RefundStatus.PENDING },
        data: { status: RefundStatus.REJECTED, adminNote: "Paket admin tarafından değiştirildi" },
      }),
      this.prisma.subscription.create({
        data: { userId: targetId, plan, status: "ACTIVE", expiresAt: expiry, groupRights: GROUP_RIGHTS[plan] },
        select: { id: true, plan: true, status: true, expiresAt: true },
      }),
    ]);

    // Kişi havuza girdi: anında masaya atanır
    await enqueueAssign(this.assignQueue, targetId);

    return { subscription: sub, planLabel: PLAN_CONFIG[plan].nametr };
  }

  // ─── Katılımcı çıkart ────────────────────────────────────────────────────

  async removeParticipant(meetingId: string, userId: string) {
    const participant = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    });
    if (!participant) throw new NotFoundException('Katılımcı bu masada yok');
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId }, select: { type: true, createdAt: true } });
    await this.prisma.$transaction(async (tx) => {
      // Admin çıkarırsa başbaşa hakkı yanmaz (kendi iptal etmediyse)
      if (meeting?.type === MeetingType.ONE_ON_ONE && participant.status !== "CANCELLED") {
        await restoreOneOnOneRights(tx, meeting.createdAt, [userId]);
      }
      // Grup: kilitte düşülen grup hakkı geri verilir (kendi iptal etmediyse)
      if (meeting?.type === MeetingType.GROUP && participant.status !== "CANCELLED") {
        await restoreGroupRights(tx, meetingId, [userId]);
      }
      await tx.meetingParticipant.delete({
        where: { meetingId_userId: { meetingId, userId } },
      });
    });
    return { removed: true, meetingId, userId };
  }

  // ─── KYC hızlı onayla ────────────────────────────────────────────────────

  async quickApproveKyc(userId: string, reviewerId: string) {
    const kyc = await this.prisma.kycSubmission.findUnique({ where: { userId } });
    if (!kyc) throw new NotFoundException('KYC başvurusu bulunamadı');
    if (kyc.status === 'APPROVED') throw new BadRequestException('KYC zaten onaylı');
    // Normal onayla aynı akış: bildirim + referral güncellemesi
    const updated = await this.kyc.adminReview(kyc.id, reviewerId, { status: KycStatus.APPROVED });
    return { id: updated.id, status: updated.status };
  }

  // ─── Test kilidi sıfırla ─────────────────────────────────────────────────

  async resetTestLock(targetId: string) {
    const score = await this.prisma.oceanScore.findUnique({ where: { userId: targetId } });
    if (!score) throw new NotFoundException("Bu kullanıcının test skoru bulunamadı");

    return this.prisma.oceanScore.update({
      where: { userId: targetId },
      data: { adminCanReset: true },
      select: { userId: true, adminCanReset: true, completedAt: true },
    });
  }

  // ─── Masa listesi ─────────────────────────────────────────────────────────

  async listMeetings(params: { status?: string; city?: string; week?: number; page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params.status) {
      if (!Object.values(MeetingStatus).includes(params.status as MeetingStatus)) {
        throw new BadRequestException("Geçersiz masa durumu");
      }
      where.status = params.status;
    }

    // Şehir filtresi
    if (params.city?.trim()) {
      where.city = { name: { contains: params.city.trim(), mode: "insensitive" } };
    }

    // Hafta filtresi
    if (params.week) {
      const year = new Date().getFullYear();
      const jan4 = new Date(year, 0, 4);
      const startOfWeek = new Date(jan4.getTime() + (params.week - 1) * 7 * 24 * 60 * 60 * 1000);
      const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
      where.scheduledAt = { gte: startOfWeek, lt: endOfWeek };
    }

    const [items, total] = await Promise.all([
      this.prisma.meeting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          scheduledAt: true,
          maxParticipants: true,
          locationText: true,
          registrationDeadline: true,
          city: { select: { name: true } },
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.meeting.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Masa detay ──────────────────────────────────────────────────────────

  async getMeeting(meetingId: string, viewerRole: UserRole) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isBot: true,
                profile: { select: { firstName: true, lastName: true, city: true } },
                oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
                subscriptions: { select: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, profile: { select: { firstName: true, lastName: true } } },
            },
          },
        },
        noShowReports: { select: { reporterId: true, reportedId: true, createdAt: true } },
      },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");

    // Bu masanın katılımcıları arasındaki UserBlock'lar
    const participantIds = meeting.participants.map((p) => p.userId);
    const blocks = await this.prisma.userBlock.findMany({
      where: {
        blockerId: { in: participantIds },
        blockedId: { in: participantIds },
      },
      select: {
        blockerId: true,
        blockedId: true,
        createdAt: true,
      },
    });

    // Bot bilgisi yalnızca SUPERADMIN'e
    const participants = viewerRole === UserRole.SUPERADMIN
      ? meeting.participants
      : meeting.participants.map(({ user: { isBot, ...user }, ...p }) => ({ ...p, user }));
    return { ...meeting, participants, blocks };
  }

  // ─── Manuel masa kur ─────────────────────────────────────────────────────

  async createManualMeeting(data: {
    title: string;
    scheduledAt: string;
    participantIds: string[];
    locationText?: string;
    locationUrl?: string;
  }) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: data.participantIds }, status: "ACTIVE" },
      select: { id: true },
    });
    if (users.length !== data.participantIds.length) {
      throw new BadRequestException("Bazı kullanıcılar bulunamadı veya aktif değil");
    }

    const type = data.participantIds.length === 2 ? MeetingType.ONE_ON_ONE : MeetingType.GROUP;
    return this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          type,
          title: data.title,
          scheduledAt: new Date(data.scheduledAt),
          maxParticipants: data.participantIds.length,
          locationText: data.locationText,
          locationUrl: data.locationUrl,
          status: MeetingStatus.ACTIVE,
          participants: {
            createMany: {
              data: data.participantIds.map((id) => ({ userId: id, status: "INVITED" })),
            },
          },
        },
        include: { participants: { select: { userId: true, status: true } } },
      });
      // Başbaşa hakkı masa kurulduğu anda harcanır
      if (type === MeetingType.ONE_ON_ONE) await consumeOneOnOneRights(tx, data.participantIds);
      return meeting;
    });
  }

  // ─── Masa mekan/saat güncelle ─────────────────────────────────────────────

  async updateMeetingVenue(
    meetingId: string,
    data: { locationText?: string; locationUrl?: string; scheduledAt?: string },
  ) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId }, select: { id: true } });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        locationText: data.locationText,
        locationUrl: data.locationUrl,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
      select: { id: true, locationText: true, locationUrl: true, scheduledAt: true, type: true },
    });

    return updated;
  }

  async updateMeetingVenuePhotos(
    meetingId: string,
    data: {
      venueAddress?: string;
      venuePhotoUrl?: string;  venuePhotoCaption1?: string;
      venuePhoto2Url?: string; venuePhotoCaption2?: string;
      venuePhoto3Url?: string; venuePhotoCaption3?: string;
    },
  ) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    // undefined → dokunma, boş string → temizle
    const v = (x?: string) => (x === undefined ? undefined : x.trim() === "" ? null : x.trim());
    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        venueAddress:       v(data.venueAddress),
        venuePhotoUrl:      v(data.venuePhotoUrl),
        venuePhotoCaption1: v(data.venuePhotoCaption1),
        venuePhoto2Url:     v(data.venuePhoto2Url),
        venuePhotoCaption2: v(data.venuePhotoCaption2),
        venuePhoto3Url:     v(data.venuePhoto3Url),
        venuePhotoCaption3: v(data.venuePhotoCaption3),
      },
      select: {
        id: true, venueAddress: true,
        venuePhotoUrl: true, venuePhotoCaption1: true,
        venuePhoto2Url: true, venuePhotoCaption2: true,
        venuePhoto3Url: true, venuePhotoCaption3: true,
      },
    });
  }

  // ─── Mekan fotoğrafı yükle (sunucu diski) ─────────────────────────────────

  async saveVenuePhoto(meetingId: string, slot: number, file?: Express.Multer.File) {
    if (![1, 2, 3].includes(slot)) throw new BadRequestException("Geçersiz fotoğraf alanı (1, 2 veya 3)");
    if (!file) throw new BadRequestException("Fotoğraf dosyası gerekli");
    const ext = VENUE_PHOTO_TYPES[file.mimetype];
    if (!ext) throw new BadRequestException("JPEG, PNG veya WebP yükleyin");

    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");

    const field = (["venuePhotoUrl", "venuePhoto2Url", "venuePhoto3Url"] as const)[slot - 1];
    const dir = path.join(VENUE_UPLOAD_DIR, meetingId);
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `photo${slot}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, fileName), file.buffer);

    // Aynı alandaki eski yerel dosyayı sil
    const old = meeting[field];
    if (old?.startsWith(`${VENUE_PUBLIC_PREFIX}/${meetingId}/`)) {
      try { fs.unlinkSync(path.join(dir, path.basename(old))); } catch {}
    }

    const url = `${VENUE_PUBLIC_PREFIX}/${meetingId}/${fileName}`;
    await this.prisma.meeting.update({ where: { id: meetingId }, data: { [field]: url } });
    return { slot, url };
  }

  // ─── Kapanış süresini uzat ────────────────────────────────────────────────

  async extendMeetingDeadline(meetingId: string, extraHours: number) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (!meeting.registrationDeadline) throw new BadRequestException("Bu masanın kapanış tarihi yok");
    if (meeting.status !== "PENDING") throw new BadRequestException("Sadece PENDING masaların süresi uzatılabilir");

    const newDeadline = new Date(meeting.registrationDeadline.getTime() + extraHours * 60 * 60 * 1000);
    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: { registrationDeadline: newDeadline },
      select: { id: true, registrationDeadline: true },
    });
  }

  // ─── Masa iptal ──────────────────────────────────────────────────────────

  async cancelMeeting(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: { select: { userId: true, status: true } } },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.status === MeetingStatus.COMPLETED) {
      throw new BadRequestException("Tamamlanmış masa iptal edilemez");
    }
    if (meeting.status === MeetingStatus.CANCELLED) {
      throw new BadRequestException("Masa zaten iptal edilmiş");
    }
    // Admin iptalinde paket hakkı yanmaz: başbaşa hakkı ve (kilitte düşüldüyse) grup hakkı, kendi iptal etmemiş
    // olanlara geri verilir. Grup: katılımcı kaydı iptal sayılmadığı için o hafta tekrar eşleşebilir.
    return this.prisma.$transaction(async (tx) => {
      const stillIn = meeting.participants
        .filter((p) => !["CANCELLED", "DECLINED", "NO_SHOW"].includes(p.status))
        .map((p) => p.userId);
      if (meeting.type === MeetingType.ONE_ON_ONE) {
        await restoreOneOnOneRights(tx, meeting.createdAt, stillIn);
      }
      // Grup: kilitten sonra iptal edilirse düşülen grup hakkı geri verilir
      if (meeting.type === MeetingType.GROUP) {
        await restoreGroupRights(tx, meetingId, stillIn);
      }
      return tx.meeting.update({
        where: { id: meetingId },
        data: { status: MeetingStatus.CANCELLED },
        select: { id: true, status: true },
      });
    });
  }

  // ─── Mekan CRUD ──────────────────────────────────────────────────────────

  async listVenues(cityId?: string) {
    return this.prisma.venue.findMany({
      where: cityId ? { cityId } : undefined,
      include: { city: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }

  async createVenue(data: {
    name: string;
    description?: string;
    category: VenueCategory;
    venueType?: VenueType;
    cityId: string;
    address?: string;
  }) {
    const city = await this.prisma.city.findUnique({ where: { id: data.cityId } });
    if (!city) throw new NotFoundException("Şehir bulunamadı");
    return this.prisma.venue.create({ data, include: { city: { select: { name: true } } } });
  }

  async updateVenue(venueId: string, data: {
    name?: string;
    description?: string;
    category?: VenueCategory;
    venueType?: VenueType;
    address?: string;
    isActive?: boolean;
    cityId?: string;
  }) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException("Mekan bulunamadı");
    if (data.cityId && data.cityId !== venue.cityId) {
      const city = await this.prisma.city.findUnique({ where: { id: data.cityId }, select: { id: true } });
      if (!city) throw new BadRequestException("Şehir bulunamadı");
    }
    return this.prisma.venue.update({ where: { id: venueId }, data });
  }

  async deleteVenue(venueId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException("Mekan bulunamadı");
    await this.prisma.venue.delete({ where: { id: venueId } });
    return { deleted: true, id: venueId };
  }

  // ─── Şehir CRUD ──────────────────────────────────────────────────────────

  async listCities() {
    return this.prisma.city.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { venues: true } } },
    });
  }

  async createCity(name: string) {
    const exists = await this.prisma.city.findUnique({ where: { name } });
    if (exists) throw new ConflictException("Bu şehir zaten kayıtlı");
    return this.prisma.city.create({ data: { name } });
  }

  async updateCity(cityId: string, data: { isActive?: boolean }) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException("Şehir bulunamadı");
    return this.prisma.city.update({ where: { id: cityId }, data });
  }

  // ─── Abonelik yönetimi ────────────────────────────────────────────────────

  async getUserSubscriptions(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    return this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { payment: { select: { amountKurus: true, paidAt: true, platform: true } } },
    });
  }

  async listSubscriptions(params: { status?: string; plan?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 25), 100);
    const where: Prisma.SubscriptionWhereInput = {};
    if (params.status) {
      if (!Object.values(SubscriptionStatus).includes(params.status as SubscriptionStatus)) {
        throw new BadRequestException("Geçersiz abonelik durumu");
      }
      where.status = params.status as SubscriptionStatus;
    }
    if (params.plan) {
      if (!Object.values(SubscriptionPlan).includes(params.plan as SubscriptionPlan)) {
        throw new BadRequestException("Geçersiz paket");
      }
      where.plan = params.plan as SubscriptionPlan;
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.user = {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { profile: { firstName: { contains: q, mode: "insensitive" } } },
          { profile: { lastName: { contains: q, mode: "insensitive" } } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, plan: true, status: true, startsAt: true, expiresAt: true, usedAt: true,
          cancelNote: true, missedGroupCycles: true, missedOneonOneCycles: true, createdAt: true, updatedAt: true,
          groupRights: true, groupCycles: true, oneOnOneCycles: true,
          user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
          payment: { select: { platform: true, amountKurus: true, paidAt: true } },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async cancelSubscription(subscriptionId: string, cancelNote?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException("Abonelik bulunamadı");
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException("Abonelik zaten iptal edilmiş");
    }
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED, cancelNote: cancelNote ?? null },
      select: { id: true, status: true, cancelNote: true },
    });
  }

  // ─── Sistem ayarları ─────────────────────────────────────────────────────

  async getSettings(viewerRole: UserRole) {
    const configs = await this.prisma.appConfig.findMany();
    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    return {
      matchingEnabled: map['MATCHING_ENABLED'] !== 'false',
      // Bot ayarı yalnızca SUPERADMIN'e
      ...(viewerRole === UserRole.SUPERADMIN ? { botSystemActive: map['BOT_SYSTEM_ACTIVE'] !== 'false' } : {}),
      maintenanceMode: map['MAINTENANCE_MODE'] === 'true',
    };
  }

  async updateSettings(data: { matchingEnabled?: boolean; botSystemActive?: boolean; maintenanceMode?: boolean }, viewerRole: UserRole) {
    if (data.botSystemActive !== undefined && viewerRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Bu ayarı değiştirme yetkiniz yok");
    }
    const updates: Array<{ key: string; value: string }> = [];
    if (data.matchingEnabled !== undefined) updates.push({ key: "MATCHING_ENABLED", value: String(data.matchingEnabled) });
    if (data.botSystemActive !== undefined) updates.push({ key: "BOT_SYSTEM_ACTIVE", value: String(data.botSystemActive) });
    if (data.maintenanceMode !== undefined) updates.push({ key: "MAINTENANCE_MODE", value: String(data.maintenanceMode) });
    for (const u of updates) {
      await this.prisma.appConfig.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      });
    }
    return this.getSettings(viewerRole);
  }

  // ─── Admin matches ───────────────────────────────────────────────────────

  async getPendingMatches(viewerRole: UserRole) {
    const meetings = await this.prisma.meeting.findMany({
      where: { status: MeetingStatus.PENDING },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        scheduledAt: true,
        maxParticipants: true,
        locationText: true,
        venuePhotoUrl: true,
        participants: {
          select: {
            matchScore: true,
            user: {
              select: {
                id: true,
                isBot: true,
                profile: { select: { firstName: true, lastName: true, gender: true } },
                oceanScore: {
                  select: {
                    openness: true,
                    conscientiousness: true,
                    extraversion: true,
                    agreeableness: true,
                    neuroticism: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return meetings.map((m) => {
      const scores = m.participants
        .map((p) => p.matchScore)
        .filter((s): s is number => s !== null);
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

      const seats = Array.from({ length: m.maxParticipants }, (_, i) => {
        const p = m.participants[i];
        if (!p) return { type: 'EMPTY' as const };
        const first = p.user.profile?.firstName ?? '';
        const last = p.user.profile?.lastName ?? '';
        return {
          // Bot bilgisi yalnızca SUPERADMIN'e
          type: p.user.isBot && viewerRole === UserRole.SUPERADMIN ? ('BOT' as const) : ('REAL' as const),
          userId: p.user.id,
          initials: `${first[0] ?? '?'}.${last[0] ?? '?'}.`,
          gender: p.user.profile?.gender ?? null,
          matchScore: p.matchScore,
          oceanScore: p.user.oceanScore,
        };
      });

      return {
        id: m.id,
        scheduledAt: m.scheduledAt,
        locationName: m.locationText ?? null,
        avgCompatibilityScore: avgScore,
        seats,
      };
    });
  }

  async approveMatch(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true },
    });
    if (!meeting) throw new NotFoundException('Masa bulunamadı');
    if (meeting.status !== MeetingStatus.PENDING) {
      throw new BadRequestException('Sadece PENDING masalar onaylanabilir');
    }
    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.ACTIVE },
      select: { id: true, status: true },
    });
  }

  // ─── Açık masalar (bu haftanın kapanmamış masaları) ──────────────────────
  // Bot bilgisi (isBot) ve eşi bekleyenlerdeki bot işlemleri sadece SUPERADMIN

  async getOpenTables(viewerRole: UserRole) {
    const meetings = await this.prisma.meeting.findMany({
      where: { status: MeetingStatus.PENDING, scheduledAt: { gte: new Date() } },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, type: true, scheduledAt: true, maxParticipants: true,
        city: { select: { name: true } },
        participants: {
          where: { status: { notIn: ['CANCELLED', 'DECLINED', 'NO_SHOW'] } },
          orderBy: { createdAt: 'asc' },
          select: { user: { select: { id: true, isBot: true, profile: { select: { firstName: true, lastName: true, gender: true, birthDate: true } } } } },
        },
      },
    });
    const isSuperadmin = viewerRole === UserRole.SUPERADMIN;
    const tables = meetings.map((m) => {
      const males = m.participants.filter((p) => p.user.profile?.gender === Gender.MALE).length;
      const females = m.participants.length - males;
      const half = m.type === MeetingType.GROUP ? m.maxParticipants / 2 : 1;
      return {
        id: m.id,
        type: m.type,
        scheduledAt: m.scheduledAt,
        city: m.city?.name ?? null,
        maxParticipants: m.maxParticipants,
        males,
        females,
        emptySeats: Math.max(0, m.maxParticipants - m.participants.length),
        missing: { male: Math.max(0, half - males), female: Math.max(0, half - females) },
        participants: m.participants.map((p) => ({
          userId: p.user.id,
          initials: `${p.user.profile?.firstName?.[0] ?? '?'}.${p.user.profile?.lastName?.[0] ?? '?'}.`,
          gender: p.user.profile?.gender ?? null,
          age: p.user.profile?.birthDate
            ? Math.floor((Date.now() - p.user.profile.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000))
            : null,
          ...(isSuperadmin ? { isBot: p.user.isBot } : {}),
        })),
      };
    });
    return {
      group: tables.filter((t) => t.type === MeetingType.GROUP),
      oneOnOne: tables.filter((t) => t.type === MeetingType.ONE_ON_ONE),
      waiting: await this.matching.getOneOnOneWaiting(),
    };
  }

  // Masaya eklenebilecek botlar: sadece eksik cinsiyet, o buluşma saatinde başka masada olmayan aktif botlar
  async getBotsForMeeting(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        status: true, type: true, scheduledAt: true, maxParticipants: true,
        participants: {
          where: { status: { notIn: ['CANCELLED', 'DECLINED', 'NO_SHOW'] } },
          select: { user: { select: { profile: { select: { gender: true } } } } },
        },
      },
    });
    if (!meeting) throw new NotFoundException('Masa bulunamadı');
    if (meeting.status !== MeetingStatus.PENDING && meeting.status !== MeetingStatus.ACTIVE) return [];
    if (meeting.participants.length >= meeting.maxParticipants) return [];
    const males = meeting.participants.filter((p) => p.user.profile?.gender === Gender.MALE).length;
    const females = meeting.participants.length - males;
    const half = meeting.type === MeetingType.GROUP ? meeting.maxParticipants / 2 : 1;
    const genders = [
      ...(males < half ? [Gender.MALE] : []),
      ...(females < half ? [Gender.FEMALE] : []),
    ];
    const lists = await Promise.all(genders.map((gender) => availableBots(this.prisma, { gender, scheduledAt: meeting.scheduledAt })));
    return lists.flat().map((b) => ({
      id: b.id,
      name: `${b.profile?.firstName ?? ''} ${b.profile?.lastName ?? ''}`.trim(),
      gender: b.profile?.gender ?? null,
      age: b.profile?.birthDate
        ? Math.floor((Date.now() - b.profile.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000))
        : null,
    }));
  }

  async placeBot(meetingId: string, botUserId: string) {
    const allowed = await this.getBotsForMeeting(meetingId);
    // Yanlış cinsiyet, dolu masa ya da aynı saatte başka masadaki bot ASLA eklenmez
    if (!allowed.some((b) => b.id === botUserId)) {
      throw new BadRequestException('Bu bot eklenemez (eksik cinsiyet değil, masa dolu ya da aynı saatte başka masada)');
    }
    await this.prisma.meetingParticipant.create({
      data: { meetingId, userId: botUserId, status: 'INVITED' },
    });
    return { placed: true, botUserId, meetingId };
  }

  getBotsForWaiting(userId: string) {
    return this.matching.botsForWaiting(userId);
  }

  placeOneOnOneBot(userId: string, botUserId: string) {
    return this.matching.addOneOnOneBotManual(userId, botUserId);
  }

  // ─── Stats overview ───────────────────────────────────────────────────────

  async getStatsOverview() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const [
      activeUsers,
      kycPending,
      thisWeekMeetings,
      prevWeekMeetings,
      referralRegisteredCount,
      groupMeetings,
      oneOnOneMeetings,
      completedMeetings,
      cancelledMeetings,
      subMasada,
      subKarsimda,
      subIcerde,
    ] = await Promise.all([
      // Bot dahil tüm aktif kullanıcılar
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.COMPLETED, scheduledAt: { gte: weekStart } } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.COMPLETED, scheduledAt: { gte: prevWeekStart, lt: weekStart } } }),
      this.prisma.referral.count({ where: { status: { in: [ReferralStatus.KYC_APPROVED, ReferralStatus.DISCOUNT_USED] } } }),
      this.prisma.meeting.count({ where: { type: MeetingType.GROUP } }),
      this.prisma.meeting.count({ where: { type: MeetingType.ONE_ON_ONE } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.COMPLETED } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.CANCELLED } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.MASADA, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.KARSIMDA, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.ICERDE, status: SubscriptionStatus.ACTIVE } }),
    ]);

    // Ciro: gerçek başarılı ödemeler (ücretsiz paket ve bot hariç), indirim düşülmüş
    const finance = await this.financeTotals({ isBot: false });
    const totalRevenue = finance.grossTL;
    const netCommission = Math.round(totalRevenue * 0.15 * 100) / 100;

    const matchRateThisWeek =
      prevWeekMeetings > 0
        ? Math.round(((thisWeekMeetings - prevWeekMeetings) / prevWeekMeetings) * 100)
        : thisWeekMeetings > 0 ? 100 : 0;

    const totalMeetings = groupMeetings + oneOnOneMeetings;
    const algorithmSuccessRate =
      (completedMeetings + cancelledMeetings) > 0
        ? Math.round((completedMeetings / (completedMeetings + cancelledMeetings)) * 100)
        : 0;

    const totalSubs = subMasada + subKarsimda + subIcerde;
    const packageDistribution = totalSubs > 0 ? {
      masadaPct: Math.round((subMasada / totalSubs) * 100),
      karsimdaPct: Math.round((subKarsimda / totalSubs) * 100),
      icerdePct: Math.round((subIcerde / totalSubs) * 100),
      masadaCount: subMasada,
      karsimdaCount: subKarsimda,
      icerdeCount: subIcerde,
    } : {
      masadaPct: 0, karsimdaPct: 0, icerdePct: 0,
      masadaCount: 0, karsimdaCount: 0, icerdeCount: 0,
    };

    return {
      totalRevenue,
      totalRefund: finance.refundTL,
      netRevenue: finance.netTL,
      vatAmount: finance.vatTL,
      netCommission,
      activeUsers,
      kycPending,
      matchRateThisWeek,
      referralRegisteredCount,
      referralTotalDiscountTL: finance.discountTL,
      totalMeetings,
      groupMeetings,
      oneOnOneMeetings,
      algorithmSuccessRate,
      packageDistribution,
    };
  }

  // Brüt (ödenen, indirim düşülmüş), indirim, onaylanan iade ve net tutarlar — TL
  private async financeTotals(userWhere: Prisma.UserWhereInput) {
    const [payments, refunds] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: "SUCCESS", user: userWhere },
        select: { plan: true, amountKurus: true, discountType: true, listKurus: true },
      }),
      this.prisma.refundRequest.aggregate({
        where: { status: RefundStatus.APPROVED, user: userWhere },
        _sum: { refundedKurus: true },
      }),
    ]);
    let grossKurus = 0;
    let discountKurus = 0;
    for (const p of payments) {
      grossKurus += p.amountKurus;
      // Liste fiyatı kaydı olmayan eski indirimli ödemelerde liste = tutar ÷ 0,90
      if (p.discountType) discountKurus += (p.listKurus ?? Math.round(p.amountKurus / 0.9)) - p.amountKurus;
    }
    const refundKurus = refunds._sum.refundedKurus ?? 0;
    const tl = (k: number) => Math.round(k) / 100;
    const netKurus = grossKurus - refundKurus;
    // Net ciro KDV dahil: içindeki %20 KDV payı ayrıca gösterilir
    return { grossTL: tl(grossKurus), discountTL: tl(discountKurus), refundTL: tl(refundKurus), netTL: tl(netKurus), vatTL: tl(vatOfGrossKurus(netKurus)) };
  }

  // ─── Stats cities ─────────────────────────────────────────────────────────

  async getStatsCities() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const cities = await this.prisma.city.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
    });

    const results = await Promise.all(
      cities.map(async (city) => {
        const [totalTables, activeMembers, finance, thisWeekSubs, prevWeekSubs] = await Promise.all([
          this.prisma.meeting.count({
            where: { status: MeetingStatus.COMPLETED, cityId: city.id },
          }),
          this.prisma.profile.count({
            // primaryCity şehir ID'si tutar
            where: { primaryCity: city.id, user: { status: UserStatus.ACTIVE, isBot: false } },
          }),
          this.financeTotals({ isBot: false, profile: { primaryCity: city.id } }),
          this.prisma.subscription.count({
            where: {
              createdAt: { gte: weekStart },
              user: { profile: { primaryCity: city.id }, isBot: false },
            },
          }),
          this.prisma.subscription.count({
            where: {
              createdAt: { gte: prevWeekStart, lt: weekStart },
              user: { profile: { primaryCity: city.id }, isBot: false },
            },
          }),
        ]);

        const trend =
          prevWeekSubs > 0
            ? `${Math.round(((thisWeekSubs - prevWeekSubs) / prevWeekSubs) * 100)}%`
            : thisWeekSubs > 0 ? "+100%" : "0%";

        return {
          city: city.name,
          totalTables,
          activeMembers,
          revenue: finance.grossTL,
          discount: finance.discountTL,
          refund: finance.refundTL,
          net: finance.netTL,
          vat: finance.vatTL,
          trend,
        };
      }),
    );

    return results;
  }

  // ─── Pending reports ─────────────────────────────────────────────────────

  async getPendingReports() {
    const reports = await this.prisma.report.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        reason: true,
        detail: true,
        createdAt: true,
        reported: {
          select: {
            id: true,
            _count: { select: { reportsReceived: { where: { status: "PENDING" } } } },
          },
        },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      userId: r.reported.id,
      userName: "Gizli Üye",
      reason: r.reason,
      detail: r.detail ?? undefined,
      createdAt: r.createdAt.toISOString(),
      riskLevel: r.reported._count.reportsReceived >= 2 ? ("CRITICAL" as const) : ("MEDIUM" as const),
    }));
  }

  // ─── Karantina ───────────────────────────────────────────────────────────

  async quarantineUser(userId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, status: true },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    if (user.status === UserStatus.BANNED) {
      throw new BadRequestException("Kullanıcı zaten banlı");
    }

    const quarantineUntil = suspensionEndDate();

    // Yaptırım kaydı (askı: 1 ay) — status'u SUSPENDED yapar
    await this.createSanction(userId, adminId, SanctionType.SUSPENSION, reason ?? DEFAULT_SANCTION_REASON, quarantineUntil);
    await this.prisma.user.update({
      where: { id: userId },
      data: { quarantineUntil },
    });

    if (user.phone) {
      await this.whatsapp.send(user.phone, "ahenk_quarantine_warning", [
        quarantineUntil.toLocaleDateString("tr-TR"),
      ]).catch(() => {});
    }

    return { quarantinedUntil: quarantineUntil };
  }

  // ─── Ban ─────────────────────────────────────────────────────────────────

  async banUser(userId: string, adminId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, subscriptions: { where: { status: SubscriptionStatus.ACTIVE }, select: { id: true } } },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    if (user.status === UserStatus.BANNED) {
      throw new BadRequestException("Kullanıcı zaten banlı");
    }

    // Süresiz BAN yaptırım kaydı — status'u BANNED yapar, aktif abonelikleri DB'de iptal eder
    // TODO: iyzico abonelik iptali entegrasyonu
    await this.createSanction(userId, adminId, SanctionType.BAN, reason ?? DEFAULT_SANCTION_REASON);

    return { banned: true, cancelledSubscriptions: user.subscriptions.length };
  }

  // ─── Uyarılar & İade Talepleri ────────────────────────────────────────────

  async getAlerts(viewerRole: UserRole) {
    // Bot uyarıları sadece SUPERADMIN'e (bot gizliliği)
    const alertWhere: Prisma.AdminAlertWhereInput =
      viewerRole === UserRole.SUPERADMIN ? {} : { alertType: { not: AdminAlertType.BOT_NOT_FOUND } };
    const [alerts, refunds, unreadCount] = await Promise.all([
      this.prisma.adminAlert.findMany({
        where: alertWhere,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.refundRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
          subscription: { select: { plan: true, createdAt: true, payment: { select: { amountKurus: true, status: true } } } },
        },
      }),
      this.prisma.adminAlert.count({ where: { ...alertWhere, isRead: false } }),
    ]);
    // Onaylananlarda iade edilen, bekleyenlerde iade edilecek tutar
    const refundsWithAmount = refunds.map(({ subscription, ...r }) => {
      const paid = subscription.payment?.status === "SUCCESS" ? subscription.payment.amountKurus : null;
      return {
        ...r,
        subscription: { plan: subscription.plan, createdAt: subscription.createdAt },
        refundAmountKurus: r.refundedKurus ?? (paid !== null ? PaymentService.refundAmountKurus(subscription.plan, r.refundType, paid) : null),
      };
    });
    // İadeler sadece SUPERADMIN yetkisinde
    return { alerts, refunds: viewerRole === UserRole.SUPERADMIN ? refundsWithAmount : [], unreadCount };
  }

  async markAlertRead(id: string, viewerRole: UserRole) {
    const alert = await this.prisma.adminAlert.findUnique({ where: { id }, select: { alertType: true } });
    if (!alert || (alert.alertType === AdminAlertType.BOT_NOT_FOUND && viewerRole !== UserRole.SUPERADMIN)) {
      throw new NotFoundException('Uyarı bulunamadı');
    }
    await this.prisma.adminAlert.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  }

  async updateRefundStatus(id: string, status: RefundStatus, ip: string, adminNote?: string) {
    if (status === RefundStatus.APPROVED) {
      return this.payment.approveRefund(id, ip, adminNote);
    }
    const refund = await this.prisma.refundRequest.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException("İade talebi bulunamadı.");
    if (refund.status !== RefundStatus.PENDING) throw new BadRequestException("Bu iade talebi zaten sonuçlandırılmış.");
    await this.prisma.refundRequest.update({
      where: { id },
      data: { status, adminNote: adminNote ?? refund.adminNote },
    });
    return { ok: true };
  }

  async listPartnerships() {
    return this.prisma.partnershipApplication.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updatePartnership(id: string, data: { status?: PartnershipStatus; adminNote?: string }) {
    return this.prisma.partnershipApplication.update({
      where: { id },
      data: { status: data.status, adminNote: data.adminNote },
    });
  }

  async listCareers() {
    return this.prisma.careerApplication.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateCareer(id: string, data: { status?: CareerStatus; adminNote?: string }) {
    return this.prisma.careerApplication.update({
      where: { id },
      data: { status: data.status, adminNote: data.adminNote },
    });
  }

  // ─── Kullanıcı Yaptırım Sistemi ───────────────────────────────────────────

  async createSanction(
    userId: string,
    adminId: string,
    type: SanctionType,
    reason: string,
    expiresAt?: Date,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    await this.assertCanSanction(userId, adminId);

    const sanction = await this.prisma.userSanction.create({
      data: { userId, adminId, type, reason, expiresAt: expiresAt ?? null },
    });

    if (type === SanctionType.BAN || type === SanctionType.SUSPENSION) {
      const isBan = type === SanctionType.BAN;
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: isBan ? UserStatus.BANNED : UserStatus.SUSPENDED },
      });
      // Abonelik iptal edilir, iade yapılmaz; bekleyen iade talepleri reddedilir
      await this.prisma.subscription.updateMany({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.CANCELLED, cancelNote: `${isBan ? "Banlama" : "Askı"}: ${reason}` },
      });
      await this.prisma.refundRequest.updateMany({
        where: { userId, status: RefundStatus.PENDING },
        data: { status: RefundStatus.REJECTED, adminNote: "Yaptırım nedeniyle iade yapılmaz" },
      });
    }

    return sanction;
  }

  async liftSanction(userId: string, sanctionId: string, actorId: string) {
    await this.assertCanSanction(userId, actorId);
    if ((await this.actorRole(actorId)) !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Yaptırımı yalnızca süper admin kaldırabilir");
    }
    const sanction = await this.prisma.userSanction.findUnique({
      where: { id: sanctionId },
      select: { userId: true, type: true, liftedAt: true },
    });
    if (!sanction) throw new NotFoundException("Yaptırım bulunamadı");
    if (sanction.userId !== userId) throw new ForbiddenException("Kullanıcı eşleşmiyor");
    if (sanction.liftedAt) throw new BadRequestException("Yaptırım zaten kaldırılmış");

    await this.prisma.userSanction.update({
      where: { id: sanctionId },
      data: { liftedAt: new Date() },
    });

    const remaining = await this.prisma.userSanction.findFirst({
      where: {
        userId,
        id: { not: sanctionId },
        liftedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        type: { in: [SanctionType.BAN, SanctionType.SUSPENSION] },
      },
    });

    if (!remaining) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.ACTIVE },
      });
    }

    return { lifted: true };
  }

  async getUserSanctions(userId: string, viewerRole: UserRole) {
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) throw new NotFoundException("Kullanıcı bulunamadı");
    if (target.role === UserRole.SUPERADMIN && viewerRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Bu kullanıcıyı görüntüleme yetkiniz yok");
    }
    return this.prisma.userSanction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, reason: true,
        expiresAt: true, liftedAt: true, createdAt: true,
        meetingId: true,
        admin: { select: { profile: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  // ─── ADMIN işlem kayıtları (sadece SUPERADMIN) ────────────────────────────

  async listActionLogs(params: { adminId?: string; from?: string; to?: string; q?: string; page: number }) {
    const limit = 50;
    const page = Math.max(1, params.page || 1);
    const where: Prisma.AdminActionLogWhereInput = {
      ...(params.adminId ? { adminId: params.adminId } : {}),
      ...(params.q ? { description: { contains: params.q, mode: "insensitive" } } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              // Tarihler TR gününe göre: from günün başı, to günün sonu
              ...(params.from ? { gte: new Date(`${params.from}T00:00:00+03:00`) } : {}),
              ...(params.to ? { lte: new Date(`${params.to}T23:59:59.999+03:00`) } : {}),
            },
          }
        : {}),
    };
    const [items, total, admins] = await Promise.all([
      this.prisma.adminActionLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, action: true, description: true, createdAt: true,
          admin: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.adminActionLog.count({ where }),
      this.prisma.user.findMany({
        where: { role: UserRole.ADMIN },
        select: { id: true, profile: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit), admins };
  }

}
