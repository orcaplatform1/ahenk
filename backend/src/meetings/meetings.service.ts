import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { cancellationNotice, initialsOf } from "./cancellation-notice";
import { restoreOneOnOneRights } from "../matching/one-on-one-right";
import { noShowCardWindow, sosWindowEnd } from "./meeting-windows";
import { ASSIGN_QUEUE, enqueueAssign } from "../matching/assign-queue";
import { MeetingStatus, MeetingType, LeaveReason, ParticipantStatus, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";


// Admin ayrı harita linki girmediyse mekan adı + adresle Google Maps araması
function googleMapsUrl(name?: string | null, address?: string | null): string | null {
  const q = [name, address].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

// Değerlendirme penceresi (TR saati, UTC+3): buluşmanın ertesi günü 10:00 → buluşmadan 4 gün sonra 23:59
// Grup (Cumartesi) → Pazar 10:00 – Çarşamba 23:59; Başbaşa (Pazar) → Pazartesi 10:00 – Perşembe 23:59
function reviewWindow(scheduledAt: Date): { opensAt: Date; closesAt: Date } {
  const tr = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);
  const y = tr.getUTCFullYear(), m = tr.getUTCMonth(), d = tr.getUTCDate();
  return {
    opensAt: new Date(Date.UTC(y, m, d + 1, 10 - 3, 0, 0, 0)),
    closesAt: new Date(Date.UTC(y, m, d + 4, 23 - 3, 59, 59, 999)),
  };
}

// Rezervasyon iptalinin son anı: masa gününden 2 gün önce 20:00 (TR, UTC+3)
function cancelDeadline(scheduledAt: Date): Date {
  const tr = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - 2, 20 - 3, 0, 0, 0));
}

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
  ) {}

  // ─── Dashboard endpoint ───────────────────────────────────────────────────────
  // items: [] → SCANNING | items: [{phase:WAITING|REVEALED, meeting}] → aktif masalar
  async getDashboardTable(userId: string) {
    const meetingSelect = {
      id: true, type: true, status: true, scheduledAt: true, maxParticipants: true,
      locationText: true, locationUrl: true, venueAddress: true,
      venuePhotoUrl: true, venuePhoto2Url: true, venuePhoto3Url: true,
      venuePhotoCaption1: true, venuePhotoCaption2: true, venuePhotoCaption3: true,
      participants: {
        select: {
          status: true,
          user: {
            select: {
              isBot: true,
              profile: { select: { firstName: true, lastName: true, gender: true } },
            },
          },
        },
      },
    } as const;

    const parts = await this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        // İptal eden kullanıcı masayı artık görmez
        status: { notIn: [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED] },
        meeting: {
          status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] },
          // Kart masa saatinden sonra da acil yardım süresi bitene (ertesi gün 10:00) kadar kalır
          scheduledAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
      },
      orderBy: [{ meeting: { type: 'asc' } }, { meeting: { scheduledAt: 'asc' } }],
      select: { meeting: { select: meetingSelect } },
    }).then((rows) => rows.filter(({ meeting }) => sosWindowEnd(meeting.scheduledAt) > new Date()));

    if (parts.length === 0) return { items: [] };
    const cancelRightUsed = await this.groupCancelRightUsed(userId);

    const items = await Promise.all(
      parts.map(async ({ meeting: m }) => {
        const sat10UTC = new Date(m.scheduledAt.getTime() - 10 * 60 * 60 * 1000);
        const isRevealed = !!m.locationText && new Date() >= sat10UTC;

        // İptal eden, bildirim gittiği anda ekrandan kalkar: başbaşada hemen, grupta iptal son anında (Perşembe 20:00)
        const hideCancelled = m.type !== MeetingType.GROUP || new Date() >= cancelDeadline(m.scheduledAt);
        const participants = m.participants
          .filter((p) => !(p.status === ParticipantStatus.CANCELLED && hideCancelled))
          .map((p) => {
            const f = p.user.profile?.firstName ?? '';
            const l = p.user.profile?.lastName ?? '';
            return {
              initials: `${(f[0] ?? '?').toUpperCase()}.${(l[0] ?? '?').toUpperCase()}.`,
              gender: p.user.profile?.gender ?? null,
            };
          });

        const photos = [
          { url: m.venuePhotoUrl,  caption: m.venuePhotoCaption1 ?? 'Alan 1' },
          { url: m.venuePhoto2Url, caption: m.venuePhotoCaption2 ?? 'Alan 2' },
          { url: m.venuePhoto3Url, caption: m.venuePhotoCaption3 ?? 'Alan 3' },
        ].filter((p) => !!p.url);

        let aiReport = null;
        if (isRevealed) {
          const report = await this.prisma.meetingAiReport.findUnique({
            where: { meetingId: m.id },
            select: { content: true, uyumSkoru: true, generatedAt: true },
          });
          if (report) aiReport = report;
        }

        return {
          phase: isRevealed ? ('REVEALED' as const) : ('WAITING' as const),
          meeting: {
            id: m.id,
            type: m.type,
            maxParticipants: m.maxParticipants,
            scheduledAt: m.scheduledAt,
            participants,
            sat10UTC,
            // Grup masasında bu abonelik döneminde iptal hakkı kullanıldı mı (kart butonu)
            cancelRightUsed: m.type === MeetingType.GROUP ? cancelRightUsed : false,
            ...(isRevealed && {
              venueName: m.locationText,
              venueAddress: m.venueAddress,
              venueMapsUrl: m.locationUrl ?? googleMapsUrl(m.locationText, m.venueAddress),
              venuePhotos: photos,
              aiReport,
            }),
          },
        };
      }),
    );

    return { items };
  }

  // ─── Geçmiş masalar ─────────────────────────────────────────────────────────

  async getMyHistory(userId: string) {
    const participations = await this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        meeting: { status: MeetingStatus.COMPLETED },
      },
      orderBy: { meeting: { scheduledAt: "desc" } },
      select: {
        matchScore: true,
        meeting: {
          select: {
            id: true,
            scheduledAt: true,
            locationText: true,
            venuePhotoUrl: true,
            cycle: { select: { weekNumber: true, year: true } },
            participants: {
              where: { userId },
              select: {
                user: {
                  select: {
                    oceanScore: {
                      select: {
                        openness: true,
                        conscientiousness: true,
                        extraversion: true,
                        agreeableness: true,
                        neuroticism: true,
                      },
                    },
                    profile: { select: { primaryCity: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Kullanıcının değerlendirdiği masa ID'lerini çek
    const reviewedIds = new Set(
      (await this.prisma.meetingReview.findMany({
        where: { reviewerId: userId },
        select: { meetingId: true },
      })).map((r) => r.meetingId),
    );

    return participations.map((p) => {
      const ocean = p.meeting.participants[0]?.user?.oceanScore;
      const overallCompatibility = ocean
        ? Math.round(
            (ocean.openness +
              ocean.conscientiousness +
              ocean.extraversion +
              ocean.agreeableness +
              (100 - ocean.neuroticism)) /
              5,
          )
        : null;

      return {
        id: p.meeting.id,
        weekNumber: p.meeting.cycle?.weekNumber ?? null,
        date: p.meeting.scheduledAt,
        venueName: p.meeting.locationText ?? null,
        venuePhotoUrl: p.meeting.venuePhotoUrl ?? null,
        city: p.meeting.participants[0]?.user?.profile?.primaryCity ?? null,
        overallCompatibility,
        isReviewed: reviewedIds.has(p.meeting.id),
      };
    });
  }

  // ─── Buluşma değerlendirmesi ──────────────────────────────────────────────

  async submitReview(
    meetingId: string,
    reviewerId: string,
    rating: number,
    blockedUserIds: string[] = [],
    comment: string,
    noShowUserIds: string[] = [],
  ) {
    // Katılımcı kontrolü
    const participation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: reviewerId } },
      select: { meeting: { select: { scheduledAt: true } } },
    });
    if (!participation) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");

    // Değerlendirme penceresi
    const { opensAt, closesAt } = reviewWindow(participation.meeting.scheduledAt);
    const now = new Date();
    if (now < opensAt) throw new BadRequestException("Değerlendirme henüz açılmadı");
    if (now > closesAt) throw new BadRequestException("Değerlendirme süresi doldu");

    // Zaten değerlendirmiş mi? (değerlendirme bir kez yapılır, düzeltilemez)
    const existing = await this.prisma.meetingReview.findUnique({
      where: { meetingId_reviewerId: { meetingId, reviewerId } },
    });
    if (existing) throw new ConflictException("Bu masayı zaten değerlendirdiniz");

    const meetingParticipants = await this.prisma.meetingParticipant.findMany({
      where: { meetingId },
      select: { userId: true },
    });
    const validIds = new Set(meetingParticipants.map((p) => p.userId));
    const onlyOthers = (ids: string[]) => [...new Set(ids)].filter((id) => validIds.has(id) && id !== reviewerId);
    const toBlock = onlyOthers(blockedUserIds);
    const toReport = onlyOthers(noShowUserIds);

    await this.prisma.$transaction([
      this.prisma.meetingReview.create({
        data: { meetingId, reviewerId, rating, comment },
      }),
      // Engelleme (geri alınamaz)
      ...toBlock.map((blockedId) =>
        this.prisma.userBlock.upsert({
          where: { blockerId_blockedId: { blockerId: reviewerId, blockedId } },
          update: {},
          create: { blockerId: reviewerId, blockedId },
        }),
      ),
    ]);
    // Masaya katılmadı bildirimi (kartta önceden işaretlenenler tekrar gelir, çift kayıt olmaz)
    await this.addNoShowReports(meetingId, reviewerId, toReport);

    return { success: true };
  }

  // ─── Masa bilgisi (değerlendirme başlığı) ────────────────────────────────

  async getMeetingInfo(meetingId: string, requesterId: string) {
    const participation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: requesterId } },
      select: { meeting: { select: { locationText: true, scheduledAt: true } } },
    });
    if (!participation) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    const reviewed = await this.prisma.meetingReview.findUnique({
      where: { meetingId_reviewerId: { meetingId, reviewerId: requesterId } },
      select: { id: true },
    });
    const { opensAt, closesAt } = reviewWindow(participation.meeting.scheduledAt);
    const myNoShow = await this.prisma.noShowReport.findMany({
      where: { meetingId, reporterId: requesterId },
      select: { reportedId: true },
    });
    return {
      // Önceden bildirilen gelmeyenler formda dolu ve kilitli gelir (geri alınamaz)
      myNoShowIds: myNoShow.map((r) => r.reportedId),
      locationName: participation.meeting.locationText,
      scheduledAt: participation.meeting.scheduledAt,
      reviewOpensAt: opensAt,
      reviewClosesAt: closesAt,
      reviewed: !!reviewed,
    };
  }

  // ─── Masaya gelmeyen işaretleme ───────────────────────────────────────────
  // Kartta 22:00 → ertesi gün 10:00, sonra değerlendirme formunda. İşaret geri alınamaz.

  async getNoShowMarking(meetingId: string, userId: string) {
    const me = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
      select: { status: true, meeting: { select: { scheduledAt: true, status: true } } },
    });
    if (!me || ["CANCELLED", "DECLINED", "NO_SHOW"].includes(me.status)) {
      throw new ForbiddenException("Bu masanın aktif katılımcısı değilsiniz");
    }
    const { opensAt, closesAt } = noShowCardWindow(me.meeting.scheduledAt);
    const now = new Date();
    const [others, mine] = await Promise.all([
      this.prisma.meetingParticipant.findMany({
        where: { meetingId, userId: { not: userId }, status: { notIn: ["CANCELLED", "DECLINED"] } },
        orderBy: { createdAt: "asc" },
        select: { userId: true, user: { select: { profile: { select: { firstName: true, lastName: true, gender: true } } } } },
      }),
      this.prisma.noShowReport.findMany({ where: { meetingId, reporterId: userId }, select: { reportedId: true } }),
    ]);
    return {
      open: me.meeting.status === MeetingStatus.ACTIVE && now >= opensAt && now < closesAt,
      opensAt,
      closesAt,
      participants: others.map((p) => ({
        userId: p.userId,
        initials: initialsOf(p.user.profile),
        gender: p.user.profile?.gender ?? null,
      })),
      markedIds: mine.map((r) => r.reportedId),
    };
  }

  async markNoShow(meetingId: string, userId: string, reportedIds: string[]) {
    const marking = await this.getNoShowMarking(meetingId, userId);
    if (!marking.open) throw new BadRequestException("Gelmeyen işaretleme şu an açık değil");
    await this.addNoShowReports(meetingId, userId, reportedIds);
    return { success: true };
  }

  private async addNoShowReports(meetingId: string, reporterId: string, reportedIds: string[]) {
    const valid = new Set(
      (await this.prisma.meetingParticipant.findMany({
        where: { meetingId, userId: { not: reporterId }, status: { notIn: ["CANCELLED", "DECLINED"] } },
        select: { userId: true },
      })).map((p) => p.userId),
    );
    const ids = [...new Set(reportedIds)].filter((id) => valid.has(id));
    if (ids.length === 0) return;
    await this.prisma.noShowReport.createMany({
      data: ids.map((reportedId) => ({ meetingId, reporterId, reportedId })),
      skipDuplicates: true,
    });
    await this.applyNoShow(meetingId);
  }

  // Gelmedi kararı: başbaşada tek işaret, grupta masadaki diğer gerçek katılımcıların çoğunluğu → NO_SHOW
  // (konumu alınmaz, admin uyarı kararına veri olur). İşaretler geri alınamadığı için karar da geri dönmez.
  private async applyNoShow(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        type: true,
        participants: { select: { userId: true, status: true, user: { select: { isBot: true } } } },
        noShowReports: { select: { reporterId: true, reportedId: true } },
      },
    });
    if (!meeting) return;
    const present = meeting.participants.filter((p) => !["CANCELLED", "DECLINED", "NO_SHOW"].includes(p.status));
    for (const p of present) {
      const reporters = new Set(meeting.noShowReports.filter((r) => r.reportedId === p.userId).map((r) => r.reporterId));
      if (reporters.size === 0) continue;
      const voters = present.filter((q) => q.userId !== p.userId && !q.user.isBot).length;
      const noShow = meeting.type === MeetingType.ONE_ON_ONE || reporters.size * 2 > voters;
      if (!noShow) continue;
      await this.prisma.meetingParticipant.update({
        where: { meetingId_userId: { meetingId, userId: p.userId } },
        data: { status: ParticipantStatus.NO_SHOW },
      });
    }
  }

  // ─── Katılımcı önizlemesi (baş harfi + cinsiyet) ──────────────────────────

  async getParticipantsPreview(meetingId: string, requesterId: string) {
    const requesterParticipation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: requesterId } },
    });
    if (!requesterParticipation) {
      throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    }

    const participants = await this.prisma.meetingParticipant.findMany({
      where: { meetingId },
      select: {
        userId: true,
        status: true,
        user: {
          select: {
            profile: { select: { firstName: true, lastName: true, gender: true } },
          },
        },
      },
    });

    return participants.map((p) => {
      const first = p.user.profile?.firstName ?? "";
      const last = p.user.profile?.lastName ?? "";
      const initials = `${first[0] ?? "?"}.${last[0] ?? "?"}.`;
      return {
        userId: p.userId,
        initials,
        gender: p.user.profile?.gender ?? null,
        isRequester: p.userId === requesterId,
      };
    });
  }

  // ─── Buluşma sonrası engelleme (grup) ────────────────────────────────────

  async blockUsers(meetingId: string, blockerId: string, blockedUserIds: string[]) {
    // Engelleyen kişi bu masanın katılımcısı olmalı
    const blockerParticipation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: blockerId } },
    });
    if (!blockerParticipation) {
      throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    }

    // Engellenenler de bu masanın katılımcısı olmalı
    const meetingParticipants = await this.prisma.meetingParticipant.findMany({
      where: { meetingId },
      select: { userId: true },
    });
    const validIds = new Set(meetingParticipants.map((p) => p.userId));

    const invalid = blockedUserIds.filter((id) => !validIds.has(id) || id === blockerId);
    if (invalid.length > 0) {
      throw new BadRequestException("Geçersiz kullanıcı ID'leri: " + invalid.join(", "));
    }

    const blocks = await Promise.all(
      blockedUserIds.map((blockedId) =>
        this.prisma.userBlock.upsert({
          where: { blockerId_blockedId: { blockerId, blockedId } },
          update: {},
          create: { blockerId, blockedId },
        }),
      ),
    );

    return { blocked: blocks.length };
  }

  // ─── Başbaşa kalıcı engelleme ─────────────────────────────────────────────

  async rematchBlock(meetingId: string, blockerId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: { select: { userId: true } } },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.type !== MeetingType.ONE_ON_ONE) {
      throw new BadRequestException("Bu endpoint sadece başbaşa buluşmalar için geçerlidir");
    }

    const isParticipant = meeting.participants.some((p) => p.userId === blockerId);
    if (!isParticipant) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");

    const otherId = meeting.participants.find((p) => p.userId !== blockerId)?.userId;
    if (!otherId) throw new BadRequestException("Karşı katılımcı bulunamadı");

    // Çift yönlü kalıcı engel
    await Promise.all([
      this.prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId: otherId } },
        update: {},
        create: { blockerId, blockedId: otherId },
      }),
      this.prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: otherId, blockedId: blockerId } },
        update: {},
        create: { blockerId: otherId, blockedId: blockerId },
      }),
    ]);

    return { rematchBlocked: true, pairedUserId: otherId };
  }

  // ─── Yola Çıktım ─────────────────────────────────────────────────────────────

  async onMyWay(meetingId: string, userId: string) {
    const participant = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
      include: {
        meeting: {
          include: {
            participants: {
              where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
              select: { userId: true },
            },
          },
        },
        user: {
          select: {
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!participant) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    if (participant.status === ParticipantStatus.CANCELLED) {
      throw new ForbiddenException("İptal edilmiş rezervasyon");
    }

    await this.prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { onMyWayAt: new Date() },
    });

    const firstName = participant.user.profile?.firstName ?? '';
    const lastName = participant.user.profile?.lastName ?? '';
    const initials = `${firstName[0] ?? '?'}.${lastName[0] ?? '?'}.`;
    const notifBody = `${initials} yola çıktığını bildirdi.`;

    const otherUserIds = participant.meeting.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);

    await Promise.all(
      otherUserIds.map((uid) =>
        this.notifications.sendToUser(uid, {
          title: 'Yola Çıktı',
          body: notifBody,
          data: { type: 'ON_MY_WAY', meetingId },
        }),
      ),
    );

    return { success: true };
  }

  // ─── Rezervasyon İptali ───────────────────────────────────────────────────────

  // Aktif grup aboneliği (Masada/İçerde) başladıktan sonra bir grup masası iptal edildiyse hak kullanılmıştır
  private async groupCancelRightUsed(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        plan: { in: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE] },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!sub) return false;
    const cancelled = await this.prisma.meetingParticipant.count({
      where: {
        userId,
        status: ParticipantStatus.CANCELLED,
        cancelledAt: { gte: sub.createdAt },
        meeting: { type: MeetingType.GROUP },
      },
    });
    return cancelled > 0;
  }

  async cancelRegistration(
    meetingId: string,
    userId: string,
    reason: LeaveReason,
    note?: string,
  ) {
    const participant = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
      include: {
        meeting: {
          include: {
            participants: {
              where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!participant) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    if (participant.status === ParticipantStatus.CANCELLED) {
      throw new ConflictException("Rezervasyon zaten iptal edilmiş");
    }

    const meeting = participant.meeting;

    // Tamamlanmış veya iptal edilmiş masalarda işlem yapılamaz
    if (meeting.status === MeetingStatus.COMPLETED || meeting.status === MeetingStatus.CANCELLED) {
      throw new ForbiddenException("Bu masa artık aktif değil");
    }

    const isGroup = meeting.type === MeetingType.GROUP;

    // İptal süresi masa tarihinden hesaplanır: masa gününden 2 gün önce 20:00 (TR)
    // Grup (Cumartesi) → Perşembe 20:00, Başbaşa (Pazar) → Cuma 20:00
    const now = new Date();
    const pastDeadline = now >= cancelDeadline(meeting.scheduledAt);

    if (pastDeadline) {
      throw new ForbiddenException(
        isGroup
          ? "Grup masası iptal süresi doldu (Perşembe 20:00)"
          : "Baş başa masası iptal süresi doldu (Cuma 20:00)",
      );
    }

    // Grup: abonelik dönemi başına tek iptal hakkı
    if (isGroup && await this.groupCancelRightUsed(userId)) {
      throw new ForbiddenException("Bu paket için iptal hakkınızı kullandınız");
    }

    await this.prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: {
        status: ParticipantStatus.CANCELLED,
        leaveReason: reason,
        leaveNote: note ?? null,
        cancelledAt: now,
      },
    });

    // Grup: anında bildirim yok, Perşembe 20:00'de toplu gider (MatchingScheduler).
    // Başbaşa: karşı tarafa hemen gider.
    if (!isGroup) {
      const me = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { profile: { select: { firstName: true, lastName: true } } },
      });
      const notice = cancellationNotice([initialsOf(me?.profile)]);
      const others = meeting.participants.map((p) => p.userId).filter((id) => id !== userId);
      await Promise.all(
        others.map((uid) =>
          this.notifications.sendToUser(uid, { ...notice, data: { type: 'PARTICIPANT_LEFT', meetingId } }),
        ),
      );

      // Başbaşa masa tek kişiyle kalmaz: masa iptal, kalanın hakkı geri verilir ve tekrar taramaya girer
      await this.prisma.$transaction(async (tx) => {
        await tx.meeting.update({ where: { id: meetingId }, data: { status: MeetingStatus.CANCELLED } });
        await restoreOneOnOneRights(tx, meeting.createdAt, others);
      });
      for (const uid of others) await enqueueAssign(this.assignQueue, uid);
    }

    return { success: true };
  }
}
