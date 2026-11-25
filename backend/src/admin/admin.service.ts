import { approvedPhotoMap, approvedPhotoUrl } from "../profile-photo/profile-photo.util";
import { writeSeatScores } from "../matching/seat-scores";
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
import { SuspendDays, suspendText, suspendUntil } from "../common/suspension";
import {
  UserStatus,
  UserRole,
  SubscriptionPlan,
  SubscriptionStatus,
  MeetingStatus,
  MeetingType,
  MeetingMode,
  Gender,
  VenueCategory,
  VenueType,
  ReferralStatus,
  SanctionType,
  PartnershipStatus,
  CareerStatus,
  KycStatus,
  Prisma,
  AdminAlertType,
  Venue,
} from "../generated/prisma/client";
import { PLAN_CONFIG } from "../payment/payment.constants";
import { vatOfGrossKurus } from "../payment/pricing";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { NotificationService } from "../notification/notification.service";
import { meetingLockAt } from "../meetings/meeting-windows";
import { DELETED_PLACEHOLDER_PREFIX } from "../users/account-deletion.service";
import type { AdminUpdateUserDto, CityStatus } from "./dto/admin.dto";
import { KycService } from "../kyc/kyc.service";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { ASSIGN_QUEUE, enqueueAssign } from "../matching/assign-queue";
import { consumeOneOnOneRights, restoreOneOnOneRights } from "../matching/one-on-one-right";
import { availableBots, recentlyMetBotIds } from "../matching/bot-picker";
import { MatchingService, tableTitle } from "../matching/matching.service";
import { isValidDistrict } from "../common/districts";
import { meetingVenueFields, seatsBookedAt, VENUE_LOCK_LEAD_MS, VenueAssignmentService } from "../venue-panel/venue-assignment.service";
import { assertVenuePhotos, deleteVenuePhotoFile, saveVenuePhotos, VENUE_FORM_PHOTO_MAX_COUNT } from "../venue-panel/venue-media";
import { CAREER_CV_DIR, CAREER_PHOTO_DIR } from "../careers/career-cv";
import { DEFAULT_SANCTION_REASON, NO_SHOW_WARNING_LIMIT, suspensionEndDate } from "./sanction-reasons";
import { activeNoShowWarningsWhere } from "./no-show-warnings";
import { OVERLAPPING_PLANS } from "../payment/plan-overlap";
import { trIsoWeekStart, trWeekStart, WEEK_MS } from "./tr-week";
import { GROUP_PLANS, GROUP_RIGHTS, KANKA_PLANS, ONE_ON_ONE_PLANS, isPrime, livePrimeWhere, kankaRightsOf, restoreGroupRights, restoreKankaRights } from "../payment/package-rights";
import { PrimeService } from "../payment/prime.service";
import { activeKankaLink, endKankaLinks } from "../kanka/kanka-links";

const PIONEER_MAX_QUOTA = 500;

// Mekan fotoğrafları: /root/ahenk/uploads/venues/<meetingId>/ — MediaController ile herkese açık sunulur
export const VENUE_UPLOAD_DIR = path.join(process.cwd(), "..", "uploads", "venues");
export const VENUE_PUBLIC_PREFIX = "/api/v1/media/venues";

const SUBSCRIPTION_ROW = {
  id: true, plan: true, status: true, startsAt: true, expiresAt: true, usedAt: true,
  cancelNote: true, missedGroupCycles: true, missedOneonOneCycles: true, createdAt: true, updatedAt: true,
  groupRights: true, groupCycles: true, oneOnOneCycles: true, kankaRights: true, kankaCycles: true,
  user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
  payment: { select: { platform: true, amountKurus: true, paidAt: true } },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
    private notifications: NotificationService,
    private prime: PrimeService,
    private kyc: KycService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
    private matching: MatchingService,
    private venueAssignment: VenueAssignmentService,
  ) {}

  // ─── Dashboard ───────────────────────────────────────────────────────────

  async getDashboard() {
    // Hafta Pazartesi 00:00 (TR) başlar
    const weekStart = trWeekStart();
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);

    const [
      totalUsers,
      kycPending,
      activeMeetingsThisWeek,
      groupThisWeek,
      oneOnOneThisWeek,
      kankaThisWeek,
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
      this.prisma.meeting.count({
        where: { type: "ONE_ON_ONE", status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gte: weekStart, lt: weekEnd } },
      }),
      // Kankamla masaları ayrı sayılır (önceden "toplam − grup" ile başbaşaya karışıyordu)
      this.prisma.meeting.count({
        where: { type: "KANKA", status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gte: weekStart, lt: weekEnd } },
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
      oneOnOneMeetingsThisWeek: oneOnOneThisWeek,
      kankaMeetingsThisWeek: kankaThisWeek,
      pioneer: { count: pioneerCount, remaining: Math.max(0, PIONEER_MAX_QUOTA - pioneerCount) },
      cityDistribution: cityDistribution.map((c) => ({ city: c.city, count: c._count.city })),
    };
  }

  // ─── Kullanıcı listesi ────────────────────────────────────────────────────

  async listUsers(params: { search?: string; status?: string; city?: string; type?: string; page?: number; limit?: number }, viewerRole: UserRole) {
    const isSuper = viewerRole === UserRole.SUPERADMIN;
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    // Silinen hesapların masa geçmişini tutan yer tutucu satırlar listelenmez
    const where: Record<string, unknown> = { isBot: false, NOT: { email: { startsWith: DELETED_PLACEHOLDER_PREFIX } } };
    // SUPERADMIN hesapları yalnızca SUPERADMIN'e listelenir (getUser ile aynı kural)
    if (!isSuper) where.role = { not: UserRole.SUPERADMIN };
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
    else if (params.type === 'SUPERADMIN') {
      if (!isSuper) throw new ForbiddenException("Bu filtre için SUPERADMIN yetkisi gerekli");
      where.role = 'SUPERADMIN';
    }
    else if (params.type === 'MASADA')  where.subscriptions = { some: { plan: 'MASADA', status: SubscriptionStatus.ACTIVE } };
    else if (params.type === 'KARSIMDA') where.subscriptions = { some: { plan: 'KARSIMDA', status: SubscriptionStatus.ACTIVE } };
    else if (params.type === 'ICERDE')  where.subscriptions = { some: { plan: 'ICERDE', status: SubscriptionStatus.ACTIVE } };
    else if (params.type === 'KANKAMLA') where.subscriptions = { some: { plan: 'KANKAMLA', status: SubscriptionStatus.ACTIVE } };
    else if (params.type === 'PRIME_1M')  where.subscriptions = { some: { plan: 'PRIME_1M', status: SubscriptionStatus.ACTIVE } };
    else if (params.type === 'PRIME_3M')  where.subscriptions = { some: { plan: 'PRIME_3M', status: SubscriptionStatus.ACTIVE } };
    else if (params.type === 'PRIME_6M')  where.subscriptions = { some: { plan: 'PRIME_6M', status: SubscriptionStatus.ACTIVE } };
    else if (params.type === 'PRIME_12M') where.subscriptions = { some: { plan: 'PRIME_12M', status: SubscriptionStatus.ACTIVE } };
    else if (params.type === 'NO_PLAN') where.subscriptions = { none: { status: SubscriptionStatus.ACTIVE } };
    if (params.search) {
      where.OR = [
        // E-posta ile arama yalnızca SUPERADMIN'e açık (ADMIN e-postayı göremez)
        ...(isSuper ? [{ email: { contains: params.search, mode: "insensitive" } }] : []),
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
          activeCity: true,
          profile: { select: { firstName: true, lastName: true, city: true, primaryCity: true, isPioneer: true } },
          kyc: { select: { status: true } },
          oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
          // Sadece aktif paketler (Abonelikler sayfasındaki "Aktif" ile aynı kural)
          subscriptions: { where: { status: SubscriptionStatus.ACTIVE }, select: { plan: true }, orderBy: { createdAt: 'desc' as const } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // primaryCity ve activeCity şehir id'si tutar (eski kayıtta ad olabilir): listede ad gösterilir
    const cityKeys = [...new Set(items.flatMap((u) => [u.profile?.primaryCity, u.activeCity]).filter((c): c is string => !!c))];
    const cityRows = cityKeys.length
      ? await this.prisma.city.findMany({ where: { OR: [{ id: { in: cityKeys } }, { name: { in: cityKeys } }] }, select: { id: true, name: true } })
      : [];
    const cityName = (key?: string | null) => (key ? cityRows.find((c) => c.id === key || c.name === key)?.name ?? key : null);
    const data = items.map((u) => ({ ...u, primaryCityName: cityName(u.profile?.primaryCity), activeCityName: cityName(u.activeCity) }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
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
      throw new ForbiddenException("Bu kullanıcıyı görüntüleme yetkin yok");
    }
    // Hassas alanlar admin yanıtına konmaz
    const { passwordHash, fcmToken, phoneHash, isBot, botPhone, ...rest } = user;
    // Botun panel numarası telefon olarak gösterilir (gerçek telefon alanı boştur)
    const safeUser = { ...rest, phone: isBot ? botPhone : rest.phone };
    const [groupCount, oneOnOneCount, kankaCount] = await Promise.all([
      this.prisma.meetingParticipant.count({ where: { userId, meeting: { type: 'GROUP' } } }),
      this.prisma.meetingParticipant.count({ where: { userId, meeting: { type: 'ONE_ON_ONE' } } }),
      this.prisma.meetingParticipant.count({ where: { userId, meeting: { type: 'KANKA' } } }),
    ]);
    // Kalan haklar: aktif aboneliklerden, Abonelikler sayfasındaki değerlerle aynı
    const rights = {
      group: user.subscriptions.filter((s) => GROUP_PLANS.includes(s.plan)).reduce((sum, s) => sum + s.groupRights, 0),
      oneOnOne: user.subscriptions.filter((s) => ONE_ON_ONE_PLANS.includes(s.plan) && !s.usedAt).length,
      kanka: user.subscriptions.filter((s) => KANKA_PLANS.includes(s.plan)).reduce((sum, s) => sum + s.kankaRights, 0),
    };
    const noShowWarnings = await this.noShowWarnings(userId);
    // Aktif kankası (Kankamla)
    const link = await activeKankaLink(this.prisma, userId);
    const kankaUser = link
      ? await this.prisma.user.findUnique({ where: { id: link.kankaId }, select: { id: true, profile: { select: { firstName: true, lastName: true } } } })
      : null;
    const kanka = kankaUser
      ? { userId: kankaUser.id, name: `${kankaUser.profile?.firstName ?? ''} ${kankaUser.profile?.lastName ?? ''}`.trim(), since: link!.createdAt }
      : null;
    // Detay penceresi: onaylı profil fotoğrafı ve şehir adları (primaryCity / activeCity şehir id'si tutar, eski kayıtta ad olabilir)
    const cityKeys = [user.profile?.primaryCity, user.activeCity].filter((c): c is string => !!c);
    const [photoUrl, cityRows] = await Promise.all([
      approvedPhotoUrl(this.prisma, userId),
      cityKeys.length
        ? this.prisma.city.findMany({ where: { OR: [{ id: { in: cityKeys } }, { name: { in: cityKeys } }] }, select: { id: true, name: true } })
        : Promise.resolve([] as { id: string; name: string }[]),
    ]);
    const cityName = (key?: string | null) => (key ? cityRows.find((c) => c.id === key || c.name === key)?.name ?? key : null);
    // Bot bilgisi yalnızca SUPERADMIN'e
    return {
      ...safeUser, ...(viewerRole === UserRole.SUPERADMIN ? { isBot } : {}), groupCount, oneOnOneCount, kankaCount, rights, kanka, noShowWarnings,
      photoUrl, primaryCityName: cityName(user.profile?.primaryCity), activeCityName: cityName(user.activeCity),
    };
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

    // Daha önce gelmedi uyarısı varsa yeni uyarı yok: yalnız askı (uyarılar türe göre ayrı sayılır)
    const { count } = await this.noShowWarnings(userId);
    if (count >= NO_SHOW_WARNING_LIMIT) throw new ConflictException("Kullanıcının önceki gelmedi uyarısı var; yalnız askıya alınabilir");
    const at = report.meeting.scheduledAt;
    const dateTr = at.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
    const dateEn = at.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
    const reason = `Ahenk Ekibi: ${dateTr} tarihli masana gelmediğin bildirildi. Masaya gelmemek diğer katılımcıların akşamını etkiler. Tekrarlanması halinde hesabın askıya alınır.`;
    const reasonEn = `Ahenk Team: You were reported as a no-show for your table on ${dateEn}. Not showing up affects the other participants' evening. If this happens again, your account will be suspended.`;

    await this.prisma.userSanction.create({
      data: { userId, adminId, type: SanctionType.WARNING, reason, meetingId, source: "NO_SHOW" },
    });
    // Hazır şablon push + uygulama içi bildirim
    await this.notifications.sendToUser(userId, { title: "Ahenk", body: reason, data: { type: "NO_SHOW_WARNING", meetingId }, en: { title: "Ahenk", body: reasonEn } }).catch(() => undefined);
    return this.noShowWarnings(userId);
  }

  // ─── Yaptırım yetkisi ────────────────────────────────────────────────────

  // SUPERADMIN ve ADMIN hesaplarına yalnızca SUPERADMIN işlem yapabilir (SUPERADMIN, SUPERADMIN hesaplarını düzenleyebilir)
  private async assertCanSanction(targetId: string, actorId: string) {
    if (targetId === actorId) throw new BadRequestException("Kendi hesabını değiştiremezsin");
    const [target, actor] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: targetId }, select: { role: true } }),
      this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } }),
    ]);
    if (!target) throw new NotFoundException("Kullanıcı bulunamadı");
    if (
      (target.role === UserRole.SUPERADMIN || target.role === UserRole.ADMIN) &&
      actor?.role !== UserRole.SUPERADMIN
    ) {
      throw new ForbiddenException("Bu hesaba işlem yetkin yok");
    }
  }

  private async actorRole(actorId: string): Promise<UserRole | undefined> {
    return (await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } }))?.role;
  }

  // ─── Kişisel bilgi düzenleme ─────────────────────────────────────────────

  // Yetki yaptırımla aynı: SUPERADMIN ve ADMIN hesaplarını yalnızca SUPERADMIN düzenler
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
    // Telefon giriş/şifre sıfırlama kimliğidir: gerçek kullanıcıda yalnızca SUPERADMIN değiştirebilir
    if (dto.phone !== undefined && !target.isBot && role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Telefonu yalnızca süper admin değiştirebilir");
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
    if (status === UserStatus.SUSPENDED) {
      // Askı tek model: durum değişmez, 1 ay askı yaptırımı (giriş açık; masaya katılma / satın alma kapalı)
      await this.suspend(targetId, actorId, 30, reason ?? DEFAULT_SANCTION_REASON);
      return { id: targetId, status: UserStatus.ACTIVE };
    }
    if (status === UserStatus.BANNED) {
      await this.createSanction(targetId, actorId, SanctionType.BAN, reason ?? DEFAULT_SANCTION_REASON);
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
    if (target.id === actorId) throw new BadRequestException("Kendi rolünü değiştiremezsin");

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

    // Tek seferlik paket: haklar kullanılana kadar (package-rights.ts); admin isterse ayrıca son tarih verebilir.
    // Prime (ücretsiz, ödeme alınmaz): 1/3/6/12 ay; verildiği anda 1+1+1 hak, 30 günde bir yenilenir, devretmez;
    // otomatik yenileme yok, süre bitince kendiliğinden biter (prime.service.ts). Aktif Prime'ı olana ikinci Prime verilmez.
    const expiry: Date | null = expiresAt ? new Date(expiresAt) : null;
    // Kişinin satırı kilitlenir: eşzamanlı iki istek sırayla işlenir, ikincisi ilk verilen Prime'ı görür (iki Prime oluşmaz)
    let oldIds: string[] = [];
    const sub = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${targetId} FOR UPDATE`;
      if (isPrime(plan)) {
        const active = await tx.subscription.count({ where: { userId: targetId, ...livePrimeWhere() } });
        if (active > 0) throw new ConflictException("Bu kullanıcının aktif Premium'u var; ikinci bir Premium verilemez.");
      }
      // İçeriği çakışan aktif paketler (ücretli dahil) iade yapılmadan iptal edilir.
      // Çakışmayan paket kalır: Masada + Karşımda birlikte olabilir; İçerde ikisini de kapsar.
      const oldSubs = await tx.subscription.findMany({
        where: { userId: targetId, status: SubscriptionStatus.ACTIVE, plan: { in: OVERLAPPING_PLANS[plan] } },
        select: { id: true },
      });
      oldIds = oldSubs.map((s) => s.id);
      await tx.subscription.updateMany({
        where: { id: { in: oldIds } },
        data: { status: SubscriptionStatus.CANCELLED, cancelNote: `Admin yeni paket verdi: ${PLAN_CONFIG[plan].nametr}` },
      });
      const created = isPrime(plan)
        ? await this.prime.createPrime(tx, targetId, plan, { autoRenew: false })
        : await tx.subscription.create({
            data: { userId: targetId, plan, status: "ACTIVE", expiresAt: expiry, groupRights: GROUP_RIGHTS[plan], kankaRights: kankaRightsOf(plan) },
          });
      return { id: created.id, plan: created.plan, status: created.status, expiresAt: created.expiresAt };
    });
    // İptal edilen paketlerin iyzico aboneliği de iptal edilir (hata loglanır, işlem sürer)
    await this.prime.cancelAtIyzico(oldIds, "admin yeni paket verdi");

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
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId }, select: { type: true, createdAt: true, status: true } });
    if (meeting?.status === MeetingStatus.COMPLETED || meeting?.status === MeetingStatus.CANCELLED) {
      throw new BadRequestException("Tamamlanmış veya iptal edilmiş masadan katılımcı çıkarılamaz.");
    }
    // Hak iadesi cancelMeeting ile aynı kural: iptal eden / reddeden / gelmeyen iade almaz
    const restore = !["CANCELLED", "DECLINED", "NO_SHOW"].includes(participant.status);
    await this.prisma.$transaction(async (tx) => {
      // Admin çıkarırsa başbaşa hakkı yanmaz (kendi iptal etmediyse)
      if (meeting?.type === MeetingType.ONE_ON_ONE && restore) {
        await restoreOneOnOneRights(tx, meeting.createdAt, [userId]);
      }
      // Grup: kilitte düşülen grup hakkı geri verilir (kendi iptal etmediyse)
      if (meeting?.type === MeetingType.GROUP && restore) {
        await restoreGroupRights(tx, meetingId, [userId]);
      }
      // Kankamla: kilitte düşülen hak geri verilir (kendi iptal etmediyse)
      if (meeting?.type === MeetingType.KANKA && restore) {
        await restoreKankaRights(tx, meetingId, [userId]);
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

  async listMeetings(params: { status?: string; city?: string; week?: number; page?: number; limit?: number; type?: string; cityId?: string; order?: string }) {
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

    // Masa türü filtresi (admin Masalar: Tip)
    if (params.type) {
      if (!Object.values(MeetingType).includes(params.type as MeetingType)) {
        throw new BadRequestException("Geçersiz masa türü");
      }
      where.type = params.type;
    }

    // Şehir filtresi: cityId (admin Masalar: Şehir) ya da ada göre arama
    if (params.cityId) {
      where.cityId = params.cityId;
    } else if (params.city?.trim()) {
      where.city = { name: { contains: params.city.trim(), mode: "insensitive" } };
    }

    // Hafta filtresi
    if (params.week) {
      // ISO hafta: Pazartesi 00:00 (TR) – sonraki Pazartesi
      const startOfWeek = trIsoWeekStart(params.week);
      const endOfWeek = new Date(startOfWeek.getTime() + WEEK_MS);
      where.scheduledAt = { gte: startOfWeek, lt: endOfWeek };
    }

    const [items, total] = await Promise.all([
      this.prisma.meeting.findMany({
        where,
        skip,
        take: limit,
        // Bekleyen / Aktif sekmeleri en yakın tarihi üstte ister (asc); varsayılan en yeni üstte
        orderBy: { scheduledAt: params.order === "asc" ? "asc" : "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          scheduledAt: true,
          maxParticipants: true,
          locationText: true,
          city: { select: { name: true } },
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.meeting.count({ where }),
    ]);

    const now = Date.now();
    const leadMs = VENUE_LOCK_LEAD_MS;
    return {
      items: items.map((m) => ({
        ...m,
        venueMissing: !m.locationText && (m.status === "PENDING" || m.status === "ACTIVE")
          && m.scheduledAt.getTime() > now && m.scheduledAt.getTime() - now <= leadMs,
      })),
      total, page, totalPages: Math.ceil(total / limit),
    };
  }

  // Kilidi geçmiş ama mekânı boş masa sayısı (masalar sayfası sayacı)
  async countMeetingsWithoutVenue() {
    return { count: await this.venueAssignment.countMissing() };
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
                phone: true,
                isBot: true,
                profile: { select: { firstName: true, lastName: true, city: true, gender: true } },
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

    // Katılımcı kartı: onaylı profil fotoğrafı (admin büyütür, "Sil" ile silebilir)
    const photos = await approvedPhotoMap(this.prisma, participantIds);
    const withPhotos = meeting.participants.map((p) => ({ ...p, photoUrl: photos.get(p.userId) ?? null }));
    // Bot bilgisi yalnızca SUPERADMIN'e
    const participants = viewerRole === UserRole.SUPERADMIN
      ? withPhotos
      : withPhotos.map(({ user: { isBot, ...user }, ...p }) => ({ ...p, user }));
    return { ...meeting, participants, blocks };
  }

  // ─── Manuel masa kur ─────────────────────────────────────────────────────

  async createManualMeeting(data: {
    title: string;
    scheduledAt: string;
    participantIds: string[];
    cityId: string;
    locationText?: string;
    locationUrl?: string;
  }) {
    const city = await this.prisma.city.findUnique({ where: { id: data.cityId }, select: { id: true } });
    if (!city) throw new BadRequestException("Şehir bulunamadı");
    const users = await this.prisma.user.findMany({
      where: { id: { in: data.participantIds }, status: "ACTIVE" },
      select: { id: true, isBot: true },
    });
    if (users.length !== data.participantIds.length) {
      throw new BadRequestException("Bazı kullanıcılar bulunamadı veya aktif değil");
    }

    const type = data.participantIds.length === 2 ? MeetingType.ONE_ON_ONE : MeetingType.GROUP;
    const created = await this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.create({
        data: {
          type,
          // Elle kurulan masa da otomatik masalarla aynı sayaçtan sıradaki numarayı ve aynı başlık biçimini alır
          title: await tableTitle(tx, data.cityId, type, new Date(data.scheduledAt)),
          scheduledAt: new Date(data.scheduledAt),
          maxParticipants: data.participantIds.length,
          cityId: data.cityId,
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
      if (type === MeetingType.ONE_ON_ONE) await consumeOneOnOneRights(tx, data.participantIds, meeting.createdAt);
      return meeting;
    });
    await writeSeatScores(this.prisma, created.id).catch(() => undefined);
    await this.matching.botAssigned(created.id, users.filter((u) => u.isBot).map((u) => u.id));
    return created;
  }

  // ─── Masa mekan/saat güncelle ─────────────────────────────────────────────

  async updateMeetingVenue(
    meetingId: string,
    data: { locationText?: string; locationUrl?: string; scheduledAt?: string },
  ) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId }, select: { id: true, locationText: true, cityId: true, scheduledAt: true, venueId: true } });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");

    // Admin farklı mekân yazarsa otomatik atama bağı kalkar (mekânın masa listesinden ve kontenjanından düşer)
    // Yazılan ad o şehirdeki panel hesaplı mekânla aynıysa masa o mekâna bağlanır (kontenjan + bildirim)
    const locationText = data.locationText === undefined ? undefined : data.locationText.trim() || null;
    const manualVenue = locationText !== undefined && locationText !== meeting.locationText;
    const partner = manualVenue && locationText && meeting.cityId
      ? await this.prisma.venue.findFirst({
          where: { cityId: meeting.cityId, name: locationText, isActive: true, account: { status: "ACTIVE" } },
          select: { id: true, seatCapacity: true },
        })
      : null;
    // Etkin saat (yeni, yoksa eski) ve etkin mekân (yeni bağ, yoksa mevcut); biri değişirse çakışma/kapasite kontrolü
    const effectiveAt = data.scheduledAt ? new Date(data.scheduledAt) : meeting.scheduledAt;
    const effectiveVenueId = manualVenue ? partner?.id ?? null : meeting.venueId;
    const venueChanged = effectiveVenueId !== meeting.venueId;
    const timeChanged = effectiveAt.getTime() !== meeting.scheduledAt.getTime();
    if (effectiveVenueId && (venueChanged || timeChanged)) {
      const seatCapacity = partner
        ? partner.seatCapacity
        : (await this.prisma.venue.findUnique({ where: { id: effectiveVenueId }, select: { seatCapacity: true } }))?.seatCapacity ?? null;
      await this.assertVenueFits(meetingId, effectiveVenueId, seatCapacity, effectiveAt);
    }
    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...(manualVenue ? { venueId: partner?.id ?? null } : {}),
        locationText,
        locationUrl: data.locationUrl,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
      select: { id: true, locationText: true, locationUrl: true, scheduledAt: true, type: true },
    });

    await this.venueAssignment.syncVenueNotice(meetingId);
    return updated;
  }

  // Elle atama kuralı: aynı mekânda aynı tarih-saatteki masaların maxParticipants toplamı + bu masanın
  // maxParticipants değeri mekân kapasitesini aşamaz (kapasite boşsa kontrol yok)
  private async assertVenueFits(meetingId: string, venueId: string, seatCapacity: number | null, scheduledAt: Date) {
    if (seatCapacity === null) return;
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId }, select: { maxParticipants: true } });
    const booked = await seatsBookedAt(this.prisma, venueId, scheduledAt, meetingId);
    if (booked + (meeting?.maxParticipants ?? 0) > seatCapacity) {
      throw new BadRequestException(`Mekan kapasitesi yetersiz: bu saatte ${booked}/${seatCapacity} kişilik masa atanmış.`);
    }
  }

  // Masa detayındaki mekân listesi: masanın şehrindeki aktif mekânlar, az kullanılan önce
  async getMeetingVenueOptions(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        cityId: true,
        scheduledAt: true,
        venueId: true,
        maxParticipants: true,
      },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (!meeting.cityId) return { venueId: meeting.venueId, options: [] };

    const venues = await this.prisma.venue.findMany({
      where: { cityId: meeting.cityId, isActive: true },
      select: { id: true, name: true, category: true, seatCapacity: true },
    });
    const assigned = await this.prisma.meeting.findMany({
      where: { venueId: { in: venues.map((v) => v.id) }, status: { not: MeetingStatus.CANCELLED } },
      select: { venueId: true, scheduledAt: true },
    });
    const weekStart = trWeekStart(meeting.scheduledAt).getTime();
    const now = Date.now();
    const booked = new Map(
      await Promise.all(venues.map(async (v) => [v.id, await seatsBookedAt(this.prisma, v.id, meeting.scheduledAt, meetingId)] as const)),
    );
    const options = venues.map((v) => {
      const dates = assigned.filter((m) => m.venueId === v.id).map((m) => m.scheduledAt.getTime());
      const lastAt = dates.length ? Math.max(...dates) : null;
      return {
        id: v.id,
        name: v.name,
        category: v.category,
        weekCount: dates.filter((t) => t >= weekStart && t < weekStart + WEEK_MS).length,
        lastAt,
        // Masa tarihi ileride olabilir: gün sayısı 0'ın altına inmez
        lastDaysAgo: lastAt === null ? null : Math.max(0, Math.floor((now - lastAt) / 86_400_000)),
        capacityShort: v.seatCapacity !== null && (booked.get(v.id) ?? 0) + meeting.maxParticipants > v.seatCapacity,
      };
    });
    options.sort((a, b) => a.weekCount - b.weekCount || (a.lastAt ?? 0) - (b.lastAt ?? 0));
    return { venueId: meeting.venueId, options: options.map(({ lastAt: _lastAt, ...o }) => o) };
  }

  // Seçilen mekân masaya atanır; adres, fotoğraf ve harita linki mekân kaydından gelir
  async assignMeetingVenue(meetingId: string, venueId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { status: true, cityId: true, scheduledAt: true, venueId: true },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.status === MeetingStatus.CANCELLED || meeting.status === MeetingStatus.COMPLETED) {
      throw new BadRequestException("Bu masaya mekan atanamaz");
    }
    const venue = await this.prisma.venue.findFirst({ where: { id: venueId, cityId: meeting.cityId ?? undefined, isActive: true } });
    if (!venue || !meeting.cityId) throw new BadRequestException("Mekan bu masanın şehrinde aktif değil");
    if (meeting.venueId === venueId) return { id: meetingId, venueId, locationText: venue.name };

    await this.assertVenueFits(meetingId, venueId, venue.seatCapacity, meeting.scheduledAt);
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        venueId,
        ...meetingVenueFields(venue),
        // Önceki mekâna yazılmış fotoğraf başlıkları kalmaz
        venuePhotoCaption1: null, venuePhotoCaption2: null, venuePhotoCaption3: null,
      },
    });
    await this.venueAssignment.syncVenueNotice(meetingId);
    return { id: meetingId, venueId, locationText: venue.name };
  }

  // ─── Mekan fotoğrafı yükle (sunucu diski) ─────────────────────────────────

  // ─── Masa iptal ──────────────────────────────────────────────────────────

  async cancelMeeting(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: { select: { userId: true, status: true, user: { select: { isBot: true } } } } },
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
    const cancelled = await this.prisma.$transaction(async (tx) => {
      // İptal atomik alınır: eşzamanlı ikinci iptal count=0 görür ve hak iadesi yapmaz
      const claimed = await tx.meeting.updateMany({
        where: { id: meetingId, status: { notIn: [MeetingStatus.CANCELLED, MeetingStatus.COMPLETED] } },
        data: { status: MeetingStatus.CANCELLED, cancelledAt: new Date() },
      });
      if (claimed.count === 0) return null;
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
      // Kankamla: kilitte düşülen hak geri verilir (rezervasyonunu iptal eden çiftin hakkı geri verilmez)
      if (meeting.type === MeetingType.KANKA) {
        await restoreKankaRights(tx, meetingId, stillIn);
      }
      return { id: meetingId, status: MeetingStatus.CANCELLED };
    });
    if (!cancelled) return { id: meetingId, status: MeetingStatus.CANCELLED };
    await this.venueAssignment.noticeMeetingCancelled(meetingId);
    // Kurulmuş (kilitli) masa iptal edildiyse masadaki gerçek kullanıcılara bildirim
    if (Date.now() >= meetingLockAt(meeting.scheduledAt)) {
      const realUsers = meeting.participants
        .filter((p) => !p.user.isBot && !["CANCELLED", "DECLINED", "NO_SHOW"].includes(p.status))
        .map((p) => p.userId);
      for (const uid of realUsers) {
        await this.notifications.sendToUser(uid, {
          title: "Masan iptal edildi",
          body: "Masan iptal edildi. Masa hakkın hesabına iade edildi.",
          data: { type: "MEETING_CANCELLED_BY_ADMIN", meetingId },
          en: { title: "Your table was cancelled", body: "Your table was cancelled. Your table credit has been returned to your account." },
        }).catch(() => undefined);
      }
    }
    return cancelled;
  }

  // ─── Mekan CRUD ──────────────────────────────────────────────────────────

  async listVenues(cityId?: string, viewerRole?: UserRole) {
    const venues = await this.prisma.venue.findMany({
      where: cityId ? { cityId } : undefined,
      include: {
        city: { select: { id: true, name: true } },
        account: { select: { email: true, phone: true, status: true, application: { select: { contactName: true } } } },
      },
      orderBy: { name: "asc" },
    });
    // Panel hesabının iletişim bilgileri yalnızca SUPERADMIN'e
    return viewerRole === UserRole.SUPERADMIN ? venues : venues.map(({ account: _account, ...v }) => v);
  }

  async createVenue(data: {
    name: string;
    description?: string;
    category: VenueCategory;
    venueType?: VenueType;
    cityId: string;
    address?: string;
    district?: string;
    locationUrl?: string | null;
    websiteOrSocial?: string | null;
    seatCapacity?: number | null;
    venueKind?: string | null;
  }) {
    const city = await this.prisma.city.findUnique({ where: { id: data.cityId } });
    if (!city) throw new NotFoundException("Şehir bulunamadı");
    if (data.district && !isValidDistrict(city.name, data.district)) throw new BadRequestException("Geçerli bir ilçe seç");
    return this.prisma.venue.create({ data, include: { city: { select: { name: true } } } });
  }

  async updateVenue(venueId: string, adminId: string, data: {
    name?: string;
    description?: string;
    category?: VenueCategory;
    venueType?: VenueType;
    address?: string | null;
    district?: string | null;
    isActive?: boolean;
    cityId?: string;
    locationUrl?: string | null;
    websiteOrSocial?: string | null;
    seatCapacity?: number | null;
    venueKind?: string | null;
  }) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException("Mekan bulunamadı");
    if (data.cityId && data.cityId !== venue.cityId) {
      const city = await this.prisma.city.findUnique({ where: { id: data.cityId }, select: { id: true } });
      if (!city) throw new BadRequestException("Şehir bulunamadı");
    }
    if (data.district) {
      const city = await this.prisma.city.findUniqueOrThrow({ where: { id: data.cityId ?? venue.cityId }, select: { name: true } });
      if (!isValidDistrict(city.name, data.district)) throw new BadRequestException("Geçerli bir ilçe seç");
    }
    const updated = await this.prisma.venue.update({ where: { id: venueId }, data });
    await this.syncVenueMeetings(updated);
    await this.markVenueEdited(venueId, adminId);
    return updated;
  }

  // Yaklaşan masalar mekânın güncel bilgisini gösterir (mekân panelindeki kuralla aynı)
  private async syncVenueMeetings(venue: Venue) {
    await this.prisma.meeting.updateMany({
      where: { venueId: venue.id, scheduledAt: { gt: new Date() }, status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] } },
      data: meetingVenueFields(venue),
    });
  }

  async addVenuePhotos(venueId: string, adminId: string, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException("Fotoğraf seç");
    assertVenuePhotos(files);
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException("Mekan bulunamadı");
    if (files.length > VENUE_FORM_PHOTO_MAX_COUNT) {
      throw new BadRequestException(`En fazla ${VENUE_FORM_PHOTO_MAX_COUNT} fotoğraf eklenebilir`);
    }
    // Tek fotoğraf: yeni fotoğraf ilk fotoğrafın yerine geçer (eski kayıtlardaki diğer fotoğraflara dokunulmaz).
    // Eski dosya yalnız yükleme ve kayıt başarılı olduktan sonra silinir.
    const [url] = await saveVenuePhotos(venue.id, files);
    const old = venue.photos[0];
    let updated;
    try {
      updated = await this.prisma.venue.update({ where: { id: venueId }, data: { photos: [url, ...venue.photos.slice(1)] } });
    } catch (e) {
      deleteVenuePhotoFile(url);
      throw e;
    }
    if (old) {
      try { deleteVenuePhotoFile(old); } catch (e) { console.error(`Eski mekân fotoğrafı silinemedi: ${old} — ${(e as Error).message}`); }
    }
    await this.syncVenueMeetings(updated);
    await this.markVenueEdited(venueId, adminId);
    return { photos: updated.photos };
  }

  // Dosya diskte kalır: başvuru kaydı ve geçmiş masalar aynı adresi kullanır
  async removeVenuePhoto(venueId: string, adminId: string, url: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException("Mekan bulunamadı");
    if (!venue.photos.includes(url)) throw new NotFoundException("Fotoğraf bulunamadı");
    if (venue.photos.length === 1) throw new BadRequestException("En az 1 fotoğraf kalmalı");
    const updated = await this.prisma.venue.update({ where: { id: venueId }, data: { photos: venue.photos.filter((p) => p !== url) } });
    await this.syncVenueMeetings(updated);
    await this.markVenueEdited(venueId, adminId);
    return { photos: updated.photos };
  }

  async deleteVenue(venueId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException("Mekan bulunamadı");
    // Masalar mekân adını/adresini kendi kaydında tutar, bağ boşa düşer (venueId SetNull). Panel hesabı kapanır, oturumu düşer.
    await this.prisma.$transaction(async (tx) => {
      await tx.venueAccount.updateMany({
        where: { venueId },
        data: { status: "DEACTIVATED", deactivatedAt: new Date(), tokenVersion: { increment: 1 } },
      });
      await tx.venue.delete({ where: { id: venueId } });
    });
    return { deleted: true, id: venueId };
  }

  // ─── Şehir CRUD ──────────────────────────────────────────────────────────

  // Sıra: İstanbul, Ankara, İzmir, Antalya (sabit) → diğer aktif şehirler A-Z → pasif şehirler A-Z (Türkçe alfabe)
  async listCities() {
    const cities = await this.prisma.city.findMany({
      include: { _count: { select: { venues: true, districts: true } } },
    });
    const pinned = ["İstanbul", "Ankara", "İzmir", "Antalya"];
    const rank = (c: { name: string; isActive: boolean }) => {
      const i = pinned.indexOf(c.name);
      return i >= 0 ? i : c.isActive ? pinned.length : pinned.length + 1;
    };
    return cities.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "tr"));
  }

  // Şehir silme: bağlı ilçeler de silinir; mekânı veya masası olan şehir silinmez
  async deleteCity(cityId: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: { _count: { select: { venues: true, meetings: true } } },
    });
    if (!city) throw new NotFoundException("Şehir bulunamadı");
    if (city._count.venues || city._count.meetings) throw new BadRequestException("Bu şehre bağlı mekân/masa var, önce pasifleştir");
    await this.prisma.city.delete({ where: { id: cityId } });
    return { deleted: true, name: city.name };
  }

  // ─── Şehir ilçeleri (statik yoğunluk / tarama listesi) ─────────────────────

  async listCityDistricts(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) throw new NotFoundException("Şehir bulunamadı");
    return this.prisma.cityDistrict.findMany({
      where: { cityId },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, level: true },
    });
  }

  async addCityDistrict(cityId: string, name: string, level: number) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { name: true } });
    if (!city) throw new NotFoundException("Şehir bulunamadı");
    const clean = name.trim();
    if (!clean) throw new BadRequestException("İlçe adı gir");
    const exists = await this.prisma.cityDistrict.findUnique({ where: { cityId_name: { cityId, name: clean } } });
    if (exists) throw new ConflictException("Bu ilçe zaten ekli");
    const row = await this.prisma.cityDistrict.create({ data: { cityId, name: clean, level }, select: { id: true, name: true, level: true } });
    return { ...row, cityName: city.name };
  }

  async updateCityDistrict(districtId: string, level: number) {
    const row = await this.prisma.cityDistrict.findUnique({ where: { id: districtId }, include: { city: { select: { name: true } } } });
    if (!row) throw new NotFoundException("İlçe bulunamadı");
    const updated = await this.prisma.cityDistrict.update({ where: { id: districtId }, data: { level }, select: { id: true, name: true, level: true } });
    return { ...updated, cityName: row.city.name, oldLevel: row.level };
  }

  async deleteCityDistrict(districtId: string) {
    const row = await this.prisma.cityDistrict.findUnique({ where: { id: districtId }, include: { city: { select: { name: true } } } });
    if (!row) throw new NotFoundException("İlçe bulunamadı");
    await this.prisma.cityDistrict.delete({ where: { id: districtId } });
    return { deleted: true, name: row.name, cityName: row.city.name };
  }

  // ─── Bölgeler ─────────────────────────────────────────────────────────────
  // Liste: Türkiye'nin 4 ana şehri + aktif bölgeler + Türkiye dışı bölgeler (pasif Türkiye illeri Şehirler sayfasında kalır)
  async listRegions() {
    const rows = await this.prisma.city.findMany({
      where: { OR: [{ isActive: true }, { isComingSoon: true }, { countryCode: { not: "TR" } }, { name: { in: ["İstanbul", "Ankara", "İzmir", "Antalya"] } }] },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return rows;
  }

  async updateRegion(cityId: string, input: { name?: string; countryCode?: string; timezone?: string; currency?: string; defaultLanguage?: string; phoneCountryCode?: string; idTypes?: ("ID_CARD" | "DRIVER_LICENSE" | "PASSPORT" | "RESIDENCE_PERMIT")[]; isActive?: boolean; status?: CityStatus; sortOrder?: number }) {
    const { status, ...rest } = input;
    const dto = { ...rest, ...cityStatusData(status, rest.isActive) };
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException("Bölge bulunamadı");
    if (dto.timezone) {
      try { new Intl.DateTimeFormat("en", { timeZone: dto.timezone }); } catch { throw new BadRequestException("Geçersiz saat dilimi (IANA, ör. Europe/Istanbul)"); }
    }
    if (dto.idTypes && dto.idTypes.length === 0) throw new BadRequestException("En az bir kimlik türü seç");
    if (dto.name && dto.name !== city.name && (await this.prisma.city.findUnique({ where: { name: dto.name } }))) throw new ConflictException("Bu ad başka bir bölgede kayıtlı");
    return this.prisma.city.update({ where: { id: cityId }, data: dto });
  }

  // Yeni şehir varsayılan Pasif
  async createCity(name: string, status: CityStatus = "PASSIVE", extra: CitySeasonCountry = {}) {
    const exists = await this.prisma.city.findUnique({ where: { name } });
    if (exists) throw new ConflictException("Bu şehir zaten kayıtlı");
    return this.prisma.city.create({ data: { name, ...cityStatusData(status), ...citySeasonCountryData(extra) } });
  }

  // Ad değişikliği yalnız City.name'i günceller; id aynı kalır, ilçe / mekân / kullanıcı bağları korunur
  async updateCity(cityId: string, dto: { isActive?: boolean; status?: CityStatus; name?: string } & CitySeasonCountry) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException("Şehir bulunamadı");
    const data: { name?: string; isActive?: boolean; isComingSoon?: boolean } & CitySeasonCountry = { ...cityStatusData(dto.status, dto.isActive), ...citySeasonCountryData(dto) };
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 2) throw new BadRequestException("Şehir adı en az 2 karakter olmalı");
      if (name !== city.name && (await this.prisma.city.findUnique({ where: { name } }))) throw new ConflictException("Bu şehir zaten kayıtlı");
      data.name = name;
    }
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

  private subscriptionWhere(params: { status?: string; plan?: string; search?: string }, viewerRole: UserRole) {
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
          ...(viewerRole === UserRole.SUPERADMIN ? [{ email: { contains: q, mode: "insensitive" as const } }] : []),
          { phone: { contains: q } },
          { profile: { firstName: { contains: q, mode: "insensitive" } } },
          { profile: { lastName: { contains: q, mode: "insensitive" } } },
        ],
      };
    }
    return where;
  }

  async listSubscriptions(params: { status?: string; plan?: string; search?: string; page?: number; limit?: number }, viewerRole: UserRole) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 25), 100);
    const where = this.subscriptionWhere(params, viewerRole);

    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: SUBSCRIPTION_ROW,
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // Kişi başına tek kart: filtreye uyan aboneliği olan kişiler sayfalanır, kartta o sekmedeki tüm abonelikleri gelir
  async listSubscriptionsByUser(params: { status?: string; plan?: string; search?: string; page?: number; limit?: number }, viewerRole: UserRole) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 25), 100);
    const where = this.subscriptionWhere(params, viewerRole);
    const people = await this.prisma.subscription.groupBy({
      by: ["userId"],
      where,
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
    });
    const userIds = people.slice((page - 1) * limit, page * limit).map((p) => p.userId);
    const subs = await this.prisma.subscription.findMany({
      where: { userId: { in: userIds }, ...(where.status ? { status: where.status } : {}) },
      orderBy: { createdAt: "desc" },
      select: SUBSCRIPTION_ROW,
    });
    const items = userIds.map((id) => {
      const subscriptions = subs.filter((s) => s.user.id === id);
      return { user: subscriptions[0].user, subscriptions };
    });
    return { items, total: people.length, page, totalPages: Math.ceil(people.length / limit) };
  }

  async cancelSubscription(subscriptionId: string, cancelNote?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException("Abonelik bulunamadı");
    if (sub.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException("Abonelik zaten iptal edilmiş");
    }
    const cancelled = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED, cancelNote: cancelNote ?? null },
      select: { id: true, status: true, cancelNote: true },
    });
    // iyzico aboneliği de iptal edilir (hata loglanır, işlem sürer)
    await this.prime.cancelAtIyzico([subscriptionId], "admin iptali");
    return cancelled;
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
      liveDistrictSource: map['LIVE_DISTRICT_SOURCE'] === 'real' ? 'real' : 'static',
      // Eşleştirme Kriterleri (app-settings.ts oceanCriteria ile aynı varsayılanlar)
      oceanGroup: map['OCEAN_GROUP'] !== 'false',
      oceanOneOnOne: map['OCEAN_ONE_ON_ONE'] === 'true',
      oceanKanka: map['OCEAN_KANKA'] === 'true',
    };
  }

  async updateSettings(data: { matchingEnabled?: boolean; botSystemActive?: boolean; maintenanceMode?: boolean; liveDistrictSource?: "static" | "real"; oceanGroup?: boolean; oceanOneOnOne?: boolean; oceanKanka?: boolean }, viewerRole: UserRole) {
    if (data.botSystemActive !== undefined && viewerRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Bu ayarı değiştirme yetkin yok");
    }
    const updates: Array<{ key: string; value: string }> = [];
    if (data.matchingEnabled !== undefined) updates.push({ key: "MATCHING_ENABLED", value: String(data.matchingEnabled) });
    if (data.botSystemActive !== undefined) updates.push({ key: "BOT_SYSTEM_ACTIVE", value: String(data.botSystemActive) });
    if (data.maintenanceMode !== undefined) updates.push({ key: "MAINTENANCE_MODE", value: String(data.maintenanceMode) });
    if (data.liveDistrictSource !== undefined) updates.push({ key: "LIVE_DISTRICT_SOURCE", value: data.liveDistrictSource });
    if (data.oceanGroup !== undefined) updates.push({ key: "OCEAN_GROUP", value: String(data.oceanGroup) });
    if (data.oceanOneOnOne !== undefined) updates.push({ key: "OCEAN_ONE_ON_ONE", value: String(data.oceanOneOnOne) });
    if (data.oceanKanka !== undefined) updates.push({ key: "OCEAN_KANKA", value: String(data.oceanKanka) });
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

  // Masaya eklenebilecek botlar: sadece eksik cinsiyet, o buluşma saatinde başka masada olmayan aktif botlar
  async getBotsForMeeting(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        status: true, type: true, scheduledAt: true, maxParticipants: true, cityId: true,
        participants: {
          where: { status: { notIn: ['CANCELLED', 'DECLINED', 'NO_SHOW'] } },
          select: { userId: true, user: { select: { isBot: true, profile: { select: { gender: true } } } } },
        },
      },
    });
    if (!meeting) throw new NotFoundException('Masa bulunamadı');
    // Admin elle eklemede sayı sınırı yok: Grup, Baş Başa ve Kankamla masası botla doldurulabilir (cinsiyet dengesi ve kapasite aynen)
    if (meeting.status !== MeetingStatus.PENDING && meeting.status !== MeetingStatus.ACTIVE) return [];
    if (meeting.participants.length >= meeting.maxParticipants) return [];
    const males = meeting.participants.filter((p) => p.user.profile?.gender === Gender.MALE).length;
    const females = meeting.participants.length - males;
    const half = meeting.type === MeetingType.ONE_ON_ONE ? 1 : meeting.maxParticipants / 2;
    const genders = [
      ...(males < half ? [Gender.MALE] : []),
      ...(females < half ? [Gender.FEMALE] : []),
    ];
    // Masadaki gerçek kullanıcılardan biriyle son 28 günde aynı masada bulunmuş botlar listelenmez
    const recentBots = await recentlyMetBotIds(this.prisma, meeting.participants.filter((p) => !p.user.isBot).map((p) => p.userId));
    const lists = await Promise.all(genders.map((gender) => availableBots(this.prisma, { gender, scheduledAt: meeting.scheduledAt, cityId: meeting.cityId, excludeIds: recentBots })));
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
    const realIds = (await this.prisma.meetingParticipant.findMany({
      where: { meetingId, status: { notIn: ['CANCELLED', 'DECLINED', 'NO_SHOW'] }, user: { isBot: false } },
      select: { userId: true },
    })).map((p) => p.userId);
    if ((await recentlyMetBotIds(this.prisma, realIds)).includes(botUserId)) {
      throw new BadRequestException('Bu bot son 4 hafta içinde masadaki bir kullanıcıyla eşleşti.');
    }
    const allowed = await this.getBotsForMeeting(meetingId);
    // Yanlış cinsiyet, dolu masa ya da aynı saatte başka masadaki bot ASLA eklenmez
    if (!allowed.some((b) => b.id === botUserId)) {
      throw new BadRequestException('Bu bot eklenemez (eksik cinsiyet değil, masa dolu ya da aynı saatte başka masada)');
    }
    const botGender = allowed.find((b) => b.id === botUserId)?.gender ?? null;
    await this.prisma.$transaction(async (tx) => {
      // Masa satırı kilitlenir; kapasite ve cinsiyet dengesi eklemeyle aynı transaction'da yeniden sayılır
      await tx.$queryRaw`SELECT id FROM "Meeting" WHERE id = ${meetingId} FOR UPDATE`;
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
        select: {
          type: true, mode: true, createdAt: true, maxParticipants: true,
          participants: {
            where: { status: { notIn: ['CANCELLED', 'DECLINED', 'NO_SHOW'] } },
            select: { userId: true, user: { select: { profile: { select: { gender: true } } } } },
          },
        },
      });
      if (!meeting) throw new NotFoundException('Masa bulunamadı');
      if (meeting.participants.length >= meeting.maxParticipants) {
        throw new BadRequestException('Masa dolu, bot eklenemez');
      }
      const half = meeting.type === MeetingType.ONE_ON_ONE ? 1 : meeting.maxParticipants / 2;
      const sameGender = meeting.participants.filter((p) => p.user.profile?.gender === botGender).length;
      if (botGender && sameGender >= half) {
        throw new BadRequestException('Cinsiyet dengesi bozulacağı için bot eklenemez');
      }
      await tx.meetingParticipant.create({
        data: { meetingId, userId: botUserId, status: 'INVITED' },
      });
      // Planlı başbaşa hakkı iki kişi oturduğu anda harcanır (Yarın'da 23:59 kilidinde)
      if (meeting.type === MeetingType.ONE_ON_ONE && meeting.mode === MeetingMode.PLANNED) {
        await consumeOneOnOneRights(tx, meeting.participants.map((p) => p.userId), meeting.createdAt);
      }
    });
    await writeSeatScores(this.prisma, meetingId).catch(() => undefined);
    await this.matching.botAssigned(meetingId, [botUserId]);
    return { placed: true, botUserId, meetingId };
  }

  // ─── Yarın / Planlı Buluşma istatistiği ──────────────────────────────────
  // Kurulan masa: iptal edilmemiş ve kilidi geçmiş (buluşmadan önceki gün 23:59) masa; Bu Hafta = buluşması bu hafta
  // (Pazartesi 00:00 – Pazar 23:59 TR). Talep: katılım kaydı (iptal edilen kayıt silinir, sayılmaz); Yarın talebi Planlı'ya
  // aktarılsa da Yarın talebi sayılır. Aktarılan: 23:59 kilidinde kurulamayıp Planlı'ya aktarılan Yarın kaydı.
  private async meetingModeStats() {
    const weekStart = trWeekStart();
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
    const lockedBefore = new Date(Date.now() + 20 * 60 * 60 * 1000 + 60 * 1000);
    const tables = async (mode: MeetingMode, week: boolean) => {
      const where = (type: MeetingType): Prisma.MeetingWhereInput => ({
        mode, type, status: { not: MeetingStatus.CANCELLED },
        scheduledAt: week ? { gte: weekStart, lt: weekEnd, lte: lockedBefore } : { lte: lockedBefore },
      });
      const [group, oneOnOne, kanka] = await Promise.all([
        this.prisma.meeting.count({ where: where(MeetingType.GROUP) }),
        this.prisma.meeting.count({ where: where(MeetingType.ONE_ON_ONE) }),
        this.prisma.meeting.count({ where: where(MeetingType.KANKA) }),
      ]);
      return { group, oneOnOne, kanka, total: group + oneOnOne + kanka };
    };
    const created = (week: boolean) => (week ? { createdAt: { gte: weekStart, lt: weekEnd } } : {});
    const period = async (week: boolean) => {
      const [tomorrowTables, plannedTables, tomorrowRequests, plannedRequests, transferred] = await Promise.all([
        tables(MeetingMode.TOMORROW, week),
        tables(MeetingMode.PLANNED, week),
        this.prisma.weeklySelection.count({ where: { ...created(week), OR: [{ mode: MeetingMode.TOMORROW }, { transferredAt: { not: null } }] } }),
        this.prisma.weeklySelection.count({ where: { ...created(week), mode: MeetingMode.PLANNED, transferredAt: null } }),
        this.prisma.weeklySelection.count({ where: { transferredAt: week ? { gte: weekStart, lt: weekEnd } : { not: null } } }),
      ]);
      return {
        tomorrow: { requests: tomorrowRequests, tables: tomorrowTables, transferred },
        planned: { requests: plannedRequests, tables: plannedTables },
      };
    };
    const [thisWeek, allTime] = await Promise.all([period(true), period(false)]);
    return {
      tomorrow: { thisWeek: thisWeek.tomorrow, allTime: allTime.tomorrow },
      planned: { thisWeek: thisWeek.planned, allTime: allTime.planned },
    };
  }

  // ─── Stats overview ───────────────────────────────────────────────────────

  async getStatsOverview() {
    // Bu hafta / geçen hafta: Pazartesi 00:00 (TR)
    const now = new Date();
    const weekStart = trWeekStart(now);
    const prevWeekStart = new Date(weekStart.getTime() - WEEK_MS);

    const [
      activeUsers,
      kycPending,
      thisWeekMeetings,
      prevWeekMeetings,
      referralRegisteredCount,
      groupMeetings,
      oneOnOneMeetings,
      kankaMeetings,
      completedMeetings,
      cancelledMeetings,
      subMasada,
      subKarsimda,
      subIcerde,
      subKankamla,
      subPrime1m,
      subPrime3m,
      subPrime6m,
      subPrime12m,
    ] = await Promise.all([
      // Bot dahil tüm aktif kullanıcılar
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.COMPLETED, scheduledAt: { gte: weekStart } } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.COMPLETED, scheduledAt: { gte: prevWeekStart, lt: weekStart } } }),
      this.prisma.referral.count({ where: { status: { in: [ReferralStatus.KYC_APPROVED, ReferralStatus.DISCOUNT_USED] } } }),
      this.prisma.meeting.count({ where: { type: MeetingType.GROUP } }),
      this.prisma.meeting.count({ where: { type: MeetingType.ONE_ON_ONE } }),
      this.prisma.meeting.count({ where: { type: MeetingType.KANKA } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.COMPLETED } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.CANCELLED } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.MASADA, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.KARSIMDA, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.ICERDE, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.KANKAMLA, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.PRIME_1M, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.PRIME_3M, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.PRIME_6M, status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { plan: SubscriptionPlan.PRIME_12M, status: SubscriptionStatus.ACTIVE } }),
    ]);

    // Ciro: gerçek başarılı ödemeler (ücretsiz paket ve bot hariç), indirim düşülmüş
    const finance = await this.financeTotals({ isBot: false });
    const totalRevenue = finance.grossTL;
    const netCommission = finance.commissionTL;

    const matchRateThisWeek =
      prevWeekMeetings > 0
        ? Math.round(((thisWeekMeetings - prevWeekMeetings) / prevWeekMeetings) * 100)
        : thisWeekMeetings > 0 ? 100 : 0;

    const totalMeetings = groupMeetings + oneOnOneMeetings + kankaMeetings;
    const algorithmSuccessRate =
      (completedMeetings + cancelledMeetings) > 0
        ? Math.round((completedMeetings / (completedMeetings + cancelledMeetings)) * 100)
        : 0;

    const activePrime = subPrime1m + subPrime3m + subPrime6m + subPrime12m;
    const totalSubs = subMasada + subKarsimda + subIcerde + subKankamla + activePrime;
    const packageDistribution = totalSubs > 0 ? {
      masadaPct: Math.round((subMasada / totalSubs) * 100),
      karsimdaPct: Math.round((subKarsimda / totalSubs) * 100),
      icerdePct: Math.round((subIcerde / totalSubs) * 100),
      kankamlaPct: Math.round((subKankamla / totalSubs) * 100),
      prime1mPct: Math.round((subPrime1m / totalSubs) * 100),
      prime3mPct: Math.round((subPrime3m / totalSubs) * 100),
      prime6mPct: Math.round((subPrime6m / totalSubs) * 100),
      prime12mPct: Math.round((subPrime12m / totalSubs) * 100),
      masadaCount: subMasada,
      karsimdaCount: subKarsimda,
      icerdeCount: subIcerde,
      kankamlaCount: subKankamla,
      prime1mCount: subPrime1m,
      prime3mCount: subPrime3m,
      prime6mCount: subPrime6m,
      prime12mCount: subPrime12m,
    } : {
      masadaPct: 0, karsimdaPct: 0, icerdePct: 0, kankamlaPct: 0,
      prime1mPct: 0, prime3mPct: 0, prime6mPct: 0, prime12mPct: 0,
      masadaCount: 0, karsimdaCount: 0, icerdeCount: 0, kankamlaCount: 0,
      prime1mCount: 0, prime3mCount: 0, prime6mCount: 0, prime12mCount: 0,
    };

    return {
      totalRevenue,
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
      kankaMeetings,
      algorithmSuccessRate,
      packageDistribution,
      meetingModes: await this.meetingModeStats(),
      activePrime,
    };
  }

  // Brüt (ödenen, indirim düşülmüş), indirim ve net tutarlar — TL
  private async financeTotals(userWhere: Prisma.UserWhereInput) {
    const payments = await this.prisma.payment.findMany({
      where: { status: "SUCCESS", user: userWhere },
      select: { plan: true, amountKurus: true, discountType: true, listKurus: true, platform: true },
    });
    // Platform komisyonu (CLAUDE.md): PLATFORM_FEE_WEB / PLATFORM_FEE_GOOGLE / PLATFORM_FEE_APPLE
    const feeOf = (name: string, fallback: number) => {
      const v = Number(process.env[name]);
      return Number.isFinite(v) ? v : fallback;
    };
    const fees: Record<string, number> = {
      WEB: feeOf("PLATFORM_FEE_WEB", 0),
      ANDROID: feeOf("PLATFORM_FEE_GOOGLE", 0.15),
      IOS: feeOf("PLATFORM_FEE_APPLE", 0.15),
    };
    let grossKurus = 0;
    let discountKurus = 0;
    let commissionKurus = 0;
    for (const p of payments) {
      grossKurus += p.amountKurus;
      commissionKurus += p.amountKurus * (fees[p.platform] ?? 0);
      // Liste fiyatı kaydı olmayan eski indirimli ödemelerde liste = tutar ÷ 0,90
      if (p.discountType) discountKurus += (p.listKurus ?? Math.round(p.amountKurus / 0.9)) - p.amountKurus;
    }
    const tl = (k: number) => Math.round(k) / 100;
    const netKurus = grossKurus;
    // Net ciro KDV dahil: içindeki %20 KDV payı ayrıca gösterilir
    return { commissionTL: tl(commissionKurus), grossTL: tl(grossKurus), discountTL: tl(discountKurus), netTL: tl(netKurus), vatTL: tl(vatOfGrossKurus(netKurus)) };
  }

  // ─── Stats cities ─────────────────────────────────────────────────────────

  async getStatsCities() {
    // Bu hafta / geçen hafta: Pazartesi 00:00 (TR)
    const now = new Date();
    const weekStart = trWeekStart(now);
    const prevWeekStart = new Date(weekStart.getTime() - WEEK_MS);

    const cities = await this.prisma.city.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
    });

    const results = await Promise.all(
      cities.map(async (city) => {
        const [totalTables, kankaTables, activeMembers, finance, thisWeekSubs, prevWeekSubs] = await Promise.all([
          this.prisma.meeting.count({
            where: { status: MeetingStatus.COMPLETED, cityId: city.id },
          }),
          // Toplam masa sayısının içindeki Kankamla masaları
          this.prisma.meeting.count({
            where: { status: MeetingStatus.COMPLETED, cityId: city.id, type: MeetingType.KANKA },
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
          kankaTables,
          activeMembers,
          revenue: finance.grossTL,
          discount: finance.discountTL,
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

    // Askı tek model: 1 ay; kullanıcıya şablon push (giriş açık, masaya katılma / satın alma kapalı)
    const s = await this.suspend(userId, adminId, 30, reason ?? DEFAULT_SANCTION_REASON);
    await this.prisma.user.update({ where: { id: userId }, data: { quarantineUntil: s.expiresAt } });
    return { quarantinedUntil: s.expiresAt };
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

  // ─── Uyarılar ─────────────────────────────────────────────────────────────

  async getAlerts(viewerRole: UserRole) {
    // Bot uyarıları (bulunamadı, atandı) sadece SUPERADMIN'e (bot gizliliği)
    const alertWhere: Prisma.AdminAlertWhereInput =
      viewerRole === UserRole.SUPERADMIN ? {} : { alertType: { notIn: [AdminAlertType.BOT_NOT_FOUND, AdminAlertType.BOT_ASSIGNED] } };
    const [alerts, unreadCount] = await Promise.all([
      this.prisma.adminAlert.findMany({
        where: alertWhere,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, phone: true, profile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.adminAlert.count({ where: { ...alertWhere, isRead: false } }),
    ]);
    return { alerts, unreadCount };
  }

  async markAlertRead(id: string, viewerRole: UserRole) {
    const alert = await this.prisma.adminAlert.findUnique({ where: { id }, select: { alertType: true } });
    const superadminOnly: AdminAlertType[] = [AdminAlertType.BOT_NOT_FOUND, AdminAlertType.BOT_ASSIGNED];
    if (!alert || (superadminOnly.includes(alert.alertType) && viewerRole !== UserRole.SUPERADMIN)) {
      throw new NotFoundException('Uyarı bulunamadı');
    }
    await this.prisma.adminAlert.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  }

  // Onaylanıp mekân kaydı oluşmuş başvuruda fotoğraf, başvuruya kopyalanan eski adresten değil mekânın kayıtlı güncel ilk
  // fotoğrafından gelir (mekânın fotoğrafı yoksa boş). Mekânı olmayan başvuruda başvurunun kendi fotoğrafları (ekranda yalnız ilki).
  async listPartnerships() {
    const rows = await this.prisma.partnershipApplication.findMany({
      orderBy: { createdAt: 'desc' },
      include: { account: { select: { status: true, registeredAt: true, approvedAt: true, deactivatedAt: true, venueId: true, venue: { select: { photos: true } } } } },
    });
    return rows.map(({ account, ...app }) => {
      if (!account) return { ...app, account };
      const { venueId, venue, ...acc } = account;
      const photos = venueId ? (venue?.photos[0] ? [venue.photos[0]] : []) : app.photos;
      return { ...app, photos, account: acc };
    });
  }

  private async adminName(adminId: string) {
    const p = await this.prisma.profile.findUnique({ where: { userId: adminId }, select: { firstName: true, lastName: true } });
    return `${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim() || "Admin";
  }

  // Mekân kaydı değişince başvuru detayındaki "Son güncelleme"
  private async markVenueEdited(venueId: string, adminId: string) {
    await this.prisma.partnershipApplication.updateMany({
      where: { account: { venueId } },
      data: { lastEditedAt: new Date(), lastEditedByName: await this.adminName(adminId) },
    });
  }

  async updatePartnership(id: string, adminId: string, data: { status?: PartnershipStatus; adminNote?: string; cityId?: string }) {
    const application = await this.prisma.partnershipApplication.findUnique({
      where: { id },
      include: { account: { select: { id: true } } },
    });
    if (!application) throw new NotFoundException("Başvuru bulunamadı");

    if (data.status === PartnershipStatus.APPROVED && !application.account) {
      throw new BadRequestException("Bu başvurunun panel hesabı yok (eski form)");
    }
    const name = await this.adminName(adminId);
    const edited = {
      lastEditedAt: new Date(),
      lastEditedByName: name,
      ...(data.adminNote ? { adminNoteById: adminId, adminNoteByName: name } : {}),
    };
    if (application.account && data.status) {
      if (data.status === PartnershipStatus.APPROVED) return this.approvePartnership(application, data, edited);
      if (data.status === PartnershipStatus.REJECTED) return this.rejectPartnership(application, data.adminNote, edited);
      throw new BadRequestException("Hesaplı başvuru sadece onaylanabilir veya reddedilebilir");
    }

    return this.prisma.partnershipApplication.update({
      where: { id },
      data: { status: data.status, adminNote: data.adminNote, ...edited },
    });
  }

  // Başvurudaki şehir adı ("Balıkesir (Ayvalık-Akçay)" gibi) şehir kaydıyla eşleştirilir
  private async partnershipCityId(cityName: string, cityId?: string) {
    const city = await this.prisma.city.findFirst({
      where: cityId ? { id: cityId } : { name: cityName.split(" (")[0].trim() },
      select: { id: true },
    });
    if (!city) throw new BadRequestException("Şehir bulunamadı, onay için şehir seç");
    return city.id;
  }

  private async approvePartnership(
    app: Prisma.PartnershipApplicationGetPayload<{ include: { account: { select: { id: true } } } }>,
    data: { adminNote?: string; cityId?: string },
    edited: Prisma.PartnershipApplicationUpdateManyMutationInput,
  ) {
    const cityId = await this.partnershipCityId(app.city, data.cityId);
    const updated = await this.prisma.$transaction(async (tx) => {
      // Çift tıklamada ikinci mekân oluşmasın
      const claimed = await tx.partnershipApplication.updateMany({
        where: { id: app.id, status: PartnershipStatus.PENDING },
        data: { status: PartnershipStatus.APPROVED, adminNote: data.adminNote, ...edited },
      });
      if (claimed.count === 0) throw new BadRequestException("Başvuru zaten sonuçlanmış");
      const venue = await tx.venue.create({
        data: {
          name: app.businessName,
          description: app.description,
          category: VenueCategory.ORTA,
          venueType: app.alcoholStatus ?? VenueType.NON_ALCOHOLIC,
          venueKind: app.venueTypeOther || app.venueType,
          cityId,
          address: app.address,
          district: app.district,
          locationUrl: app.locationUrl,
          websiteOrSocial: app.websiteOrSocial,
          photos: app.photos,
          seatCapacity: app.capacity,
        },
      });
      await tx.venueAccount.update({
        where: { id: app.account!.id },
        data: { status: "ACTIVE", approvedAt: new Date(), venueId: venue.id },
      });
      return tx.partnershipApplication.findUniqueOrThrow({ where: { id: app.id } });
    });

    const loginUrl = `${process.env.APP_URL ?? "https://ahenk.co"}/mekan/giris`;
    await this.whatsapp.send(app.phone, "ahenk_venue_approved", [app.businessName, loginUrl])
      .catch((err: unknown) => console.error(`Mekân onay mesajı gönderilemedi: ${err}`));
    return updated;
  }

  private async rejectPartnership(
    app: Prisma.PartnershipApplicationGetPayload<{ include: { account: { select: { id: true } } } }>,
    adminNote: string | undefined,
    edited: Prisma.PartnershipApplicationUpdateManyMutationInput,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.partnershipApplication.updateMany({
        where: { id: app.id, status: PartnershipStatus.PENDING },
        data: { status: PartnershipStatus.REJECTED, adminNote, ...edited },
      });
      if (claimed.count === 0) throw new BadRequestException("Başvuru zaten sonuçlanmış");
      await tx.venueAccount.update({
        where: { id: app.account!.id },
        data: { status: "REJECTED", tokenVersion: { increment: 1 } },
      });
      return tx.partnershipApplication.findUniqueOrThrow({ where: { id: app.id } });
    });

    await this.whatsapp.send(app.phone, "ahenk_venue_rejected", [app.businessName])
      .catch((err: unknown) => console.error(`Mekân red mesajı gönderilemedi: ${err}`));
    return updated;
  }

  async listCareers() {
    return this.prisma.careerApplication.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateCareer(id: string, data: { status?: CareerStatus; adminNote?: string }) {
    const exists = await this.prisma.careerApplication.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException("Başvuru bulunamadı");
    return this.prisma.careerApplication.update({
      where: { id },
      data: { status: data.status, adminNote: data.adminNote },
    });
  }

  // Başvuru fotoğrafı yalnızca bu uçtan, SUPERADMIN'e sunulur
  async careerPhotoPath(id: string) {
    const c = await this.prisma.careerApplication.findUnique({ where: { id }, select: { photoFile: true } });
    if (!c?.photoFile) throw new NotFoundException("Fotoğraf bulunamadı");
    const filePath = path.join(CAREER_PHOTO_DIR, path.basename(c.photoFile));
    if (!fs.existsSync(filePath)) throw new NotFoundException("Fotoğraf bulunamadı");
    return filePath;
  }

  // CV yalnızca bu uçtan, SUPERADMIN'e sunulur
  async careerCvPath(id: string) {
    const c = await this.prisma.careerApplication.findUnique({ where: { id }, select: { cvFile: true, cvOriginalName: true } });
    if (!c?.cvFile) throw new NotFoundException("CV bulunamadı");
    const filePath = path.join(CAREER_CV_DIR, path.basename(c.cvFile));
    if (!fs.existsSync(filePath)) throw new NotFoundException("CV bulunamadı");
    return { filePath, name: c.cvOriginalName ?? c.cvFile };
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
      select: { id: true, status: true, isBot: true },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    // Ban/karantina/yaptırım uçlarının hepsi buradan geçer: updateUserStatus'taki bot kuralı burada da geçerli
    if (user.isBot) throw new BadRequestException("Bu hesabın durumu buradan değiştirilemez");
    await this.assertCanSanction(userId, adminId);
    // Silinmiş hesaba askı/ban verilmez (askı bitince hesap yeniden aktifleşirdi)
    if (user.status === UserStatus.DELETED && type !== SanctionType.WARNING) {
      throw new BadRequestException("Silinmiş hesaba yaptırım uygulanamaz");
    }

    const sanction = await this.prisma.userSanction.create({
      data: { userId, adminId, type, reason, expiresAt: expiresAt ?? null },
    });

    // Askı (yeni model): giriş, oturum, paket hakları, abonelik ve iyzico / mağaza aboneliği etkilenmez; kişi yalnız masaya
    // katılamaz (common/suspension.ts): yapılmamış masalardan ve Kankamla eşleşmesinden çıkar
    if (type === SanctionType.SUSPENSION) {
      await this.matching.dropKankaPair(userId, "Askıya alındı");
      const cancelled = await this.matching.dropFromTables(userId, "Askıya alındı");
      for (const meetingId of cancelled) {
        await this.venueAssignment.noticeMeetingCancelled(meetingId)
          .catch((err: unknown) => console.error(`Mekân iptal bildirimi gönderilemedi: ${err}`));
      }
    }

    if (type === SanctionType.BAN) {
      const isBan = true;
      // Ban: kişinin bütün oturumları kapanır
      await this.prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
      await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.BANNED } });
      // Abonelik iptal edilir, iade yapılmaz; iyzico aboneliği de iptal edilir (hata loglanır, işlem sürer)
      const activeSubs = await this.prisma.subscription.findMany({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        select: { id: true },
      });
      await this.prisma.subscription.updateMany({
        where: { id: { in: activeSubs.map((s) => s.id) }, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.CANCELLED, cancelNote: `${isBan ? "Banlama" : "Askı"}: ${reason}` },
      });
      await this.prime.cancelAtIyzico(activeSubs.map((s) => s.id), isBan ? "ban" : "askı");
      // Kankamla: kişi bu haftaki masasından kankasıyla düşer (karşı çift yeniden taramaya girer); ban → kankalık biter
      await this.matching.dropKankaPair(userId, isBan ? "Banlandı" : "Askıya alındı");
      // Grup ve başbaşa: kişi yapılmamış masalardan çıkar; iptal olan başbaşa masası mekâna bildirilir
      const cancelledTables = await this.matching.dropFromTables(userId, isBan ? "Banlandı" : "Askıya alındı");
      for (const meetingId of cancelledTables) {
        await this.venueAssignment.noticeMeetingCancelled(meetingId)
          .catch((err: unknown) => console.error(`Mekân iptal bildirimi gönderilemedi: ${err}`));
      }
      if (isBan) {
        const exKankas = await endKankaLinks(this.prisma, userId, "BAN");
        for (const id of exKankas) {
          await this.notifications.sendToUser(id, {
            title: "Kankalık sona erdi",
            body: "Kankanın hesabı kapatıldığı için kankalığınız sona erdi. Profilim'den yeni bir kanka davet edebilirsin.",
            data: { type: "KANKA_ENDED" },
            en: { title: "Your Kanka link has ended", body: "Your Kanka's account was closed, so your link has ended. You can invite a new Kanka from My Profile." },
          }).catch(() => undefined);
        }
      }
    }

    return sanction;
  }

  // Askıya al (tek model): 3 gün / 15 gün / 1 ay; kullanıcıya hazır şablon push ("İhlal: …" ile)
  async suspend(userId: string, adminId: string, days: SuspendDays, reason: string, label?: { tr: string; en: string }, source?: string) {
    const s = await this.createSanction(userId, adminId, SanctionType.SUSPENSION, reason, suspendUntil(days));
    if (source) await this.prisma.userSanction.update({ where: { id: s.id }, data: { source } });
    const text = suspendText(days);
    const v = label ?? { tr: reason, en: reason };
    await this.notifications.sendToUser(userId, {
      title: "Ahenk", body: `${text.tr} İhlal: ${v.tr}`, data: { type: "SUSPENDED" }, en: { title: "Ahenk", body: `${text.en} Violation: ${v.en}` },
    }).catch(() => undefined);
    return s;
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

    // Yalnızca askı/ban kaldırıldıysa ve kullanıcı hâlâ askıda/banlıysa aktifleşir (DELETED vb. dokunulmaz)
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    const wasHard = sanction.type === SanctionType.BAN || sanction.type === SanctionType.SUSPENSION;
    const isHardStatus = target?.status === UserStatus.SUSPENDED || target?.status === UserStatus.BANNED;
    if (!remaining && wasHard && isHardStatus) {
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
      throw new ForbiddenException("Bu kullanıcıyı görüntüleme yetkin yok");
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

// Şehir sezonu (gün + ay, yıl yok), isteğe bağlı: dört alanla birlikte girilir ya da hepsi boş bırakılır; gün ayın gün sayısını
// aşamaz (Şubat 29). Gönderilmeyen alan değişmez, null temizler. Ülke: zorunlu countryCode (ISO 3166-1 alpha-2), gönderilirse güncellenir.
type CitySeasonCountry = { seasonStartDay?: number | null; seasonStartMonth?: number | null; seasonEndDay?: number | null; seasonEndMonth?: number | null; countryCode?: string };
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function citySeasonCountryData(dto: CitySeasonCountry): CitySeasonCountry {
  const out: CitySeasonCountry = {};
  const keys = ["seasonStartDay", "seasonStartMonth", "seasonEndDay", "seasonEndMonth"] as const;
  if (keys.some((k) => dto[k] !== undefined)) {
    const vals = keys.map((k) => dto[k] ?? null);
    if (vals.some((v) => v === null) && vals.some((v) => v !== null)) throw new BadRequestException("Sezon başlangıcı ve bitişinin gün ve ayı birlikte seçilmeli");
    const [sd, sm, ed, em] = vals;
    if (sd !== null && sm !== null && ed !== null && em !== null && (sd > MONTH_DAYS[sm - 1] || ed > MONTH_DAYS[em - 1])) throw new BadRequestException("Geçersiz sezon tarihi");
    keys.forEach((k, i) => { out[k] = vals[i]; });
  }
  if (dto.countryCode) out.countryCode = dto.countryCode;
  return out;
}

// Durum → alanlar: Aktif = isActive; Yakında = !isActive && isComingSoon; Pasif = ikisi de false
// status yoksa yalnız isActive verildiyse eski davranış (aktif yapılınca Yakında bayrağı kalkar)
function cityStatusData(status?: CityStatus, isActive?: boolean): { isActive?: boolean; isComingSoon?: boolean } {
  if (status === "ACTIVE") return { isActive: true, isComingSoon: false };
  if (status === "COMING_SOON") return { isActive: false, isComingSoon: true };
  if (status === "PASSIVE") return { isActive: false, isComingSoon: false };
  if (isActive === true) return { isActive: true, isComingSoon: false };
  if (isActive === false) return { isActive: false };
  return {};
}
