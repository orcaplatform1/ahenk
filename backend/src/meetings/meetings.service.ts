import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MeetingStatus, MeetingType } from "@prisma/client";

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) {}

  // ─── Aktif / bekleyen masa ────────────────────────────────────────────────────

  async getMyCurrent(userId: string) {
    const participation = await this.prisma.meetingParticipant.findFirst({
      where: {
        userId,
        meeting: {
          status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] },
          scheduledAt: { gte: new Date() },
        },
      },
      orderBy: { meeting: { scheduledAt: 'asc' } },
      select: {
        meeting: {
          select: {
            id: true,
            type: true,
            status: true,
            scheduledAt: true,
            maxParticipants: true,
            locationText: true,
            locationUrl: true,
            venuePhotoUrl: true,
            participants: {
              select: {
                user: {
                  select: {
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
        },
      },
    });

    if (!participation) return null;

    const m = participation.meeting;
    return {
      id: m.id,
      type: m.type,
      status: m.status,
      scheduledAt: m.scheduledAt,
      maxParticipants: m.maxParticipants,
      locationName: m.locationText ?? null,
      locationText: m.locationText ?? null,
      venuePhotoUrl: m.venuePhotoUrl ?? null,
      locationMapsUrl: m.locationUrl ?? null,
      participants: m.participants.map((p) => {
        const first = p.user.profile?.firstName ?? '';
        const last = p.user.profile?.lastName ?? '';
        return {
          initials: `${first[0] ?? '?'}.${last[0] ?? '?'}.`,
          gender: p.user.profile?.gender ?? null,
          oceanScore: p.user.oceanScore ?? null,
        };
      }),
    };
  }

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
        meeting: {
          status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] },
          scheduledAt: { gte: new Date() },
        },
      },
      orderBy: [{ meeting: { type: 'asc' } }, { meeting: { scheduledAt: 'asc' } }],
      select: { meeting: { select: meetingSelect } },
    });

    if (parts.length === 0) return { items: [] };

    const items = await Promise.all(
      parts.map(async ({ meeting: m }) => {
        const sat10UTC = new Date(m.scheduledAt.getTime() - 10 * 60 * 60 * 1000);
        const isRevealed = !!m.locationText && new Date() >= sat10UTC;

        const participants = m.participants
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
            ...(isRevealed && {
              venueName: m.locationText,
              venueAddress: m.venueAddress,
              venueMapsUrl: m.locationUrl,
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
    comment?: string,
  ) {
    // Katılımcı kontrolü
    const participation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: reviewerId } },
    });
    if (!participation) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");

    // Zaten değerlendirmiş mi?
    const existing = await this.prisma.meetingReview.findUnique({
      where: { meetingId_reviewerId: { meetingId, reviewerId } },
    });
    if (existing) throw new ConflictException("Bu masayı zaten değerlendirdiniz");

    // Review kaydet
    await this.prisma.meetingReview.create({
      data: { meetingId, reviewerId, rating, comment },
    });

    // Engelleme işlemleri
    if (blockedUserIds.length > 0) {
      const meetingParticipants = await this.prisma.meetingParticipant.findMany({
        where: { meetingId },
        select: { userId: true },
      });
      const validIds = new Set(meetingParticipants.map((p) => p.userId));
      const toBlock = blockedUserIds.filter((id) => validIds.has(id) && id !== reviewerId);

      if (toBlock.length > 0) {
        await Promise.all(
          toBlock.map((blockedId) =>
            this.prisma.userBlock.upsert({
              where: { blockerId_blockedId: { blockerId: reviewerId, blockedId } },
              update: {},
              create: { blockerId: reviewerId, blockedId },
            }),
          ),
        );
      }
    }

    return { success: true };
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
}
