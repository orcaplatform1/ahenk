import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  UserStatus,
  UserRole,
  SubscriptionPlan,
  SubscriptionStatus,
  MeetingStatus,
  MeetingType,
  VenueCategory,
  VenueType,
  RefundStatus,
} from "@prisma/client";
import { PLAN_CONFIG, MASADA_DURATION_DAYS } from "../payment/payment.constants";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { NotificationService } from "../notification/notification.service";
import { StorageService } from "../storage/storage.service";

const PIONEER_MAX_QUOTA = 500;

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
    public storage: StorageService,
    private notifications: NotificationService,
  ) {}

  // ─── Dashboard ───────────────────────────────────────────────────────────

  async getDashboard() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      kycPending,
      activeMeetingsThisWeek,
      pioneerCount,
      cityDistribution,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isBot: false, status: { not: "DELETED" } } }),
      this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      this.prisma.meeting.count({
        where: { status: "ACTIVE", scheduledAt: { gte: weekStart } },
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
      pioneer: { count: pioneerCount, remaining: Math.max(0, PIONEER_MAX_QUOTA - pioneerCount) },
      cityDistribution: cityDistribution.map((c) => ({ city: c.city, count: c._count.city })),
    };
  }

  // ─── Kullanıcı listesi ────────────────────────────────────────────────────

  async listUsers(params: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isBot: false };
    if (params.status) where.status = params.status;
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
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          profile: { select: { firstName: true, lastName: true, city: true, isPioneer: true } },
          kyc: { select: { status: true } },
          oceanScore: { select: { completedAt: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Kullanıcı detay ──────────────────────────────────────────────────────

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        kyc: true,
        oceanScore: true,
        subscriptions: { orderBy: { createdAt: "desc" }, take: 5 },
        payments: { orderBy: { createdAt: "desc" }, take: 10 },
        participations: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { meeting: { select: { id: true, title: true, scheduledAt: true, status: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    return user;
  }

  // ─── Hesap askıya al/aktifleştir ─────────────────────────────────────────

  async updateUserStatus(targetId: string, actorId: string, status: UserStatus) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException("Kullanıcı bulunamadı");
    if (target.id === actorId) throw new BadRequestException("Kendi hesabınızı değiştiremezsiniz");
    if (target.isBot) throw new BadRequestException("Bot durumunu /matching/admin/bots/:id/status kullanın");

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

    let expiry: Date | null = null;
    if (plan === SubscriptionPlan.MASADA || plan === SubscriptionPlan.ICERDE) {
      expiry = expiresAt
        ? new Date(expiresAt)
        : new Date(Date.now() + MASADA_DURATION_DAYS * 24 * 60 * 60 * 1000);
    }

    const sub = await this.prisma.subscription.create({
      data: { userId: targetId, plan, status: "ACTIVE", expiresAt: expiry },
      select: { id: true, plan: true, status: true, expiresAt: true },
    });

    return { subscription: sub, planLabel: PLAN_CONFIG[plan].nametr };
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
    if (params.status) where.status = params.status;

    // Şehir filtresi — katılımcı profilleri üzerinden
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
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.meeting.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Masa detay ──────────────────────────────────────────────────────────

  async getMeeting(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
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

    return { ...meeting, blocks };
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

    return this.prisma.meeting.create({
      data: {
        type: data.participantIds.length === 2 ? MeetingType.ONE_ON_ONE : MeetingType.GROUP,
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
  }

  // ─── Masa mekan/saat güncelle ─────────────────────────────────────────────

  async updateMeetingVenue(
    meetingId: string,
    data: { locationText?: string; locationUrl?: string; scheduledAt?: string },
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: { select: { userId: true } } },
    });
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

    if (data.locationText && updated.locationText) {
      const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : meeting.scheduledAt;
      for (const p of meeting.participants) {
        await this.notifications.notifyMeetingVenueSet(p.userId, meetingId, updated.locationText, scheduledAt);
      }
    }

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
    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        venueAddress:       data.venueAddress,
        venuePhotoUrl:      data.venuePhotoUrl,
        venuePhotoCaption1: data.venuePhotoCaption1,
        venuePhoto2Url:     data.venuePhoto2Url,
        venuePhotoCaption2: data.venuePhotoCaption2,
        venuePhoto3Url:     data.venuePhoto3Url,
        venuePhotoCaption3: data.venuePhotoCaption3,
      },
      select: {
        id: true, venueAddress: true,
        venuePhotoUrl: true, venuePhotoCaption1: true,
        venuePhoto2Url: true, venuePhotoCaption2: true,
        venuePhoto3Url: true, venuePhotoCaption3: true,
      },
    });
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
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.status === MeetingStatus.COMPLETED) {
      throw new BadRequestException("Tamamlanmış masa iptal edilemez");
    }
    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.CANCELLED },
      select: { id: true, status: true },
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
  }) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException("Mekan bulunamadı");
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

  async updateCity(cityId: string, data: { isActive?: boolean; weeklyTableLimit?: number }) {
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

  async getSettings() {
    const configs = await this.prisma.appConfig.findMany();
    return Object.fromEntries(configs.map((c) => [c.key, c.value]));
  }

  async updateSettings(data: { weeklyTableLimit?: number; matchingEnabled?: boolean }) {
    const updates: Array<{ key: string; value: string }> = [];
    if (data.weeklyTableLimit !== undefined) {
      updates.push({ key: "WEEKLY_TABLE_LIMIT", value: String(data.weeklyTableLimit) });
    }
    if (data.matchingEnabled !== undefined) {
      updates.push({ key: "MATCHING_ENABLED", value: String(data.matchingEnabled) });
    }
    for (const u of updates) {
      await this.prisma.appConfig.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      });
    }
    return this.getSettings();
  }

  // ─── Admin matches ───────────────────────────────────────────────────────

  async getPendingMatches() {
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
          type: p.user.isBot ? ('BOT' as const) : ('REAL' as const),
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

  async placeBot(meetingId: string, botUserId: string) {
    const [meeting, bot] = await Promise.all([
      this.prisma.meeting.findUnique({
        where: { id: meetingId },
        include: { participants: { select: { userId: true } } },
      }),
      this.prisma.user.findUnique({ where: { id: botUserId, isBot: true }, select: { id: true } }),
    ]);
    if (!meeting) throw new NotFoundException('Masa bulunamadı');
    if (!bot) throw new NotFoundException('Bot bulunamadı');
    if (meeting.participants.length >= meeting.maxParticipants) {
      throw new BadRequestException('Masada boş koltuk yok');
    }
    const alreadyIn = meeting.participants.some((p) => p.userId === botUserId);
    if (alreadyIn) throw new BadRequestException('Bot zaten bu masada');

    await this.prisma.meetingParticipant.create({
      data: { meetingId, userId: botUserId, status: 'ACCEPTED' },
    });
    return { placed: true, botUserId, meetingId };
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
      thisWeekRevenue,
      prevWeekRevenue,
      thisWeekMeetings,
      prevWeekMeetings,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isBot: false, status: UserStatus.ACTIVE } }),
      this.prisma.kycSubmission.count({ where: { status: "PENDING" } }),
      this.prisma.payment.aggregate({
        where: { status: "SUCCESS", paidAt: { gte: weekStart } },
        _sum: { amountKurus: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: "SUCCESS", paidAt: { gte: prevWeekStart, lt: weekStart } },
        _sum: { amountKurus: true },
      }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.COMPLETED, scheduledAt: { gte: weekStart } } }),
      this.prisma.meeting.count({ where: { status: MeetingStatus.COMPLETED, scheduledAt: { gte: prevWeekStart, lt: weekStart } } }),
    ]);

    const totalRevenue = (thisWeekRevenue._sum.amountKurus ?? 0) / 100;
    const netCommission = totalRevenue * 0.15;

    const matchRateThisWeek =
      prevWeekMeetings > 0
        ? Math.round(((thisWeekMeetings - prevWeekMeetings) / prevWeekMeetings) * 100)
        : 0;

    return {
      totalRevenue,
      netCommission: Math.round(netCommission * 100) / 100,
      activeUsers,
      kycPending,
      matchRateThisWeek,
    };
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
        const [totalTables, activeMembers, thisWeekRev, prevWeekRev] = await Promise.all([
          this.prisma.meeting.count({
            where: { status: MeetingStatus.COMPLETED, locationText: { contains: city.name } },
          }),
          this.prisma.profile.count({
            where: { primaryCity: city.name, user: { status: UserStatus.ACTIVE, isBot: false } },
          }),
          this.prisma.payment.aggregate({
            where: {
              status: "SUCCESS",
              paidAt: { gte: weekStart },
              user: { profile: { primaryCity: city.name } },
            },
            _sum: { amountKurus: true },
          }),
          this.prisma.payment.aggregate({
            where: {
              status: "SUCCESS",
              paidAt: { gte: prevWeekStart, lt: weekStart },
              user: { profile: { primaryCity: city.name } },
            },
            _sum: { amountKurus: true },
          }),
        ]);

        const thisRev = (thisWeekRev._sum.amountKurus ?? 0) / 100;
        const prevRev = (prevWeekRev._sum.amountKurus ?? 0) / 100;
        const trend =
          prevRev > 0
            ? `${Math.round(((thisRev - prevRev) / prevRev) * 100)}%`
            : "0%";

        return {
          city: city.name,
          totalTables,
          activeMembers,
          revenue: thisRev,
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

  async quarantineUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, status: true },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    if (user.status === UserStatus.BANNED) {
      throw new BadRequestException("Kullanıcı zaten banlı");
    }

    const quarantineUntil = new Date();
    quarantineUntil.setDate(quarantineUntil.getDate() + 30);

    await this.prisma.user.update({
      where: { id: userId },
      data: { quarantineUntil, status: UserStatus.SUSPENDED },
    });

    if (user.phone) {
      await this.whatsapp.send(user.phone, "ahenk_quarantine_warning", [
        quarantineUntil.toLocaleDateString("tr-TR"),
      ]).catch(() => {});
    }

    return { quarantinedUntil: quarantineUntil };
  }

  // ─── Ban ─────────────────────────────────────────────────────────────────

  async banUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, subscriptions: { where: { status: SubscriptionStatus.ACTIVE }, select: { id: true } } },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    if (user.status === UserStatus.BANNED) {
      throw new BadRequestException("Kullanıcı zaten banlı");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.BANNED },
    });

    // TODO: iyzico abonelik iptali entegrasyonu
    // Aktif abonelikler DB'de iptal edilir
    if (user.subscriptions.length > 0) {
      await this.prisma.subscription.updateMany({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.CANCELLED, cancelNote: "Admin tarafından banlama sebebiyle iptal edildi" },
      });
    }

    return { banned: true, cancelledSubscriptions: user.subscriptions.length };
  }

  // ─── Uyarılar & İade Talepleri ────────────────────────────────────────────

  async getAlerts() {
    const [alerts, refunds, unreadCount] = await Promise.all([
      this.prisma.adminAlert.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { include: { profile: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.refundRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { include: { profile: { select: { firstName: true, lastName: true } } } },
          subscription: { select: { plan: true, createdAt: true } },
        },
      }),
      this.prisma.adminAlert.count({ where: { isRead: false } }),
    ]);
    return { alerts, refunds, unreadCount };
  }

  async markAlertRead(id: string) {
    await this.prisma.adminAlert.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  }

  async updateRefundStatus(id: string, status: RefundStatus, adminNote?: string) {
    const refund = await this.prisma.refundRequest.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException("İade talebi bulunamadı.");
    await this.prisma.refundRequest.update({
      where: { id },
      data: { status, adminNote: adminNote ?? refund.adminNote },
    });
    return { ok: true };
  }
}
