import { approvedPhotoMap } from "../profile-photo/profile-photo.util";
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
import { initialsOf } from "./cancellation-notice";
import { tableDisplayNames, tableInitials } from "./table-initials";
import { cancelDeadline, meetingLockAt, meetingCardEnd, noShowCardWindow, sosWindowEnd, reviewWindow } from "./meeting-windows";
import { trWeekStart, WEEK_MS } from "../admin/tr-week";
import { ASSIGN_QUEUE } from "../matching/assign-queue";
import { cancelSelection } from "../matching/selection-cancel";
import { activeKankaLink } from "../kanka/kanka-links";
import { MeetingStatus, MeetingType, ParticipantStatus, SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/client";

// Yola Çıktım: buluşmadan 1 saat önce açılır
export const ON_MY_WAY_OPEN_MS = 60 * 60 * 1000;


// Admin ayrı harita linki girmediyse mekan adı + adresle Google Maps araması
function googleMapsUrl(name?: string | null, address?: string | null): string | null {
  const q = [name, address].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

// Fisher–Yates karıştırma
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
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
      venue: { select: { district: true } }, // Masa detay kartında yalnız ilçe adı
      venuePhotoUrl: true, venuePhoto2Url: true, venuePhoto3Url: true,
      venuePhotoCaption1: true, venuePhotoCaption2: true, venuePhotoCaption3: true,
      participants: {
        select: {
          status: true,
          userId: true,
          kankaPartnerId: true,
          createdAt: true,
          user: {
            select: {
              isBot: true,
              occupationSector: true,
              profile: { select: { firstName: true, lastName: true, gender: true } },
            },
          },
        },
      },
    } as const;

    // Birbirinden bağımsız dört sorgu paralel çalışır (önceden sırayla bekleniyordu; sayfa 15 sn'de bir yoklanıyor)
    const weekStart = trWeekStart();
    const partsQ = this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        // İptal eden kullanıcı masayı artık görmez
        status: { notIn: [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED] },
        meeting: {
          status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] },
          // Kart masa saatinden sonra da ertesi gün 10:00'a kadar kalır
          scheduledAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        },
      },
      orderBy: [{ meeting: { type: 'asc' } }, { meeting: { scheduledAt: 'asc' } }],
      select: { meeting: { select: meetingSelect } },
    }).then((rows) => rows.filter(({ meeting }) => meetingCardEnd(meeting.scheduledAt) > new Date()));

    // Bu hafta masası olan türler: buluşma bitip kart kalksa da /dashboard sekmesi "Masa Kuruldu" kalır
    const weekRowsQ = this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        status: { notIn: [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED] },
        meeting: {
          status: { not: MeetingStatus.CANCELLED },
          scheduledAt: { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_MS) },
        },
      },
      select: { meeting: { select: { type: true } } },
    });

    // Bu hafta kendisi rezervasyonunu iptal ettiği türler (sekmede "Rez. İptal")
    const cancelledRowsQ = this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        status: ParticipantStatus.CANCELLED,
        leaveReason: { not: null },
        meeting: { scheduledAt: { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_MS) } },
      },
      select: { meeting: { select: { type: true } } },
    });

    // Bu hafta kurulmuş (kilitli) iken admin tarafından iptal edilen masaların türleri
    const adminCancelledRowsQ = this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        status: { notIn: [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED, ParticipantStatus.NO_SHOW] },
        meeting: { status: MeetingStatus.CANCELLED, scheduledAt: { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_MS) } },
      },
      select: { meeting: { select: { type: true, scheduledAt: true, updatedAt: true, cancelledAt: true } } },
    });
    const [parts, weekRows, cancelledRows, adminCancelledRows] = await Promise.all([partsQ, weekRowsQ, cancelledRowsQ, adminCancelledRowsQ]);
    const weekTableTypes = [...new Set(weekRows.map((r) => r.meeting.type))];
    const weekCancelledTypes = [...new Set(cancelledRows.map((r) => r.meeting.type))];
    const weekAdminCancelledTypes = [...new Set(adminCancelledRows
      // İptal anı (cancelledAt); alan boş olan eski kayıtlarda son güncellenme zamanı
      .filter((r) => (r.meeting.cancelledAt ?? r.meeting.updatedAt).getTime() >= meetingLockAt(r.meeting.scheduledAt))
      .map((r) => r.meeting.type))];

    if (parts.length === 0) return { items: [], weekTableTypes, weekCancelledTypes, weekAdminCancelledTypes };
    // İptal hakları ve masa detay kartındaki katılımcıların onaylı profil fotoğrafları (paralel)
    const [cancelRightUsed, kankaCancelUsed, photos] = await Promise.all([
      this.groupCancelRightUsed(userId),
      parts.some(({ meeting }) => meeting.type === MeetingType.KANKA) ? this.kankaCancelRightUsed(userId) : Promise.resolve(false),
      approvedPhotoMap(this.prisma, parts.flatMap(({ meeting }) => meeting.participants.map((p) => p.userId))),
    ]);

    const items = await Promise.all(
      parts.map(async ({ meeting: m }) => {
        const sat10UTC = new Date(m.scheduledAt.getTime() - 10 * 60 * 60 * 1000);
        const isRevealed = !!m.locationText && new Date() >= sat10UTC;

        // İptal eden, bildirim gittiği anda ekrandan kalkar: başbaşada hemen, grupta iptal son anında (Perşembe 20:00)
        const hideCancelled = m.type !== MeetingType.GROUP || new Date() >= cancelDeadline(m.scheduledAt);
        // Kankamla: kişinin kendi çifti (kendisi + kankası) "MINE", karşı çift "OTHER" — kartta kim kimin kankası
        const myKankaId = m.participants.find((p) => p.userId === userId)?.kankaPartnerId ?? null;
        // Masa içi rozet: aynı baş harfte katılım sırasına göre üst simge numara (tek kaynak)
        const people = m.participants.map((p) => ({ userId: p.userId, createdAt: p.createdAt, profile: p.user.profile }));
        const badges = tableInitials(people);
        // Görünen ad ("Ahmet Y.") yalnız masa detay kartı açıldıktan sonra (isRevealed); tarama / masa kuruldu yanıtında yok
        const names = isRevealed ? tableDisplayNames(people) : null;
        const participants = m.participants
          .filter((p) => !(p.status === ParticipantStatus.CANCELLED && hideCancelled))
          .map((p) => {
            return {
              initials: badges.get(p.userId)?.label ?? '?.?.',
              ...(names && { displayName: names.get(p.userId) ?? null }),
              gender: p.user.profile?.gender ?? null,
              photoUrl: photos.get(p.userId) ?? null,
              joinedAt: p.createdAt, // Katılım listesi giriş sırası
              ...(p.userId === userId && { isSelf: true }),
              ...(p.status === ParticipantStatus.CANCELLED && { cancelled: true }), // Grupta iptal son anına kadar listede kalır
              ...(m.type === MeetingType.KANKA && {
                pair: p.userId === userId || p.userId === myKankaId ? ('MINE' as const) : ('OTHER' as const),
              }),
            };
          });

        // Meslekler: kime ait olduğu belli olmasın diye her istekte karışık sıra, kişiyle eşleşme bilgisi yok
        const occupations = shuffled(m.participants
          .filter((p) => !(p.status === ParticipantStatus.CANCELLED && hideCancelled))
          .map((p) => p.user.occupationSector)
          .filter((o): o is string => !!o));

        const venuePhotos = [
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
            sosEndsAt: sosWindowEnd(m.scheduledAt),
            // Bu pakette iptal hakkı kullanıldı mı (bekleme ekranındaki iptal butonu): grup ve Kankamla
            cancelRightUsed: m.type === MeetingType.GROUP ? cancelRightUsed : m.type === MeetingType.KANKA ? kankaCancelUsed : false,
            ...(isRevealed && {
              venueName: m.locationText,
              venueAddress: m.venueAddress,
              venueDistrict: m.venue?.district ?? null,
              venueMapsUrl: m.locationUrl ?? googleMapsUrl(m.locationText, m.venueAddress),
              venuePhotos,
              occupations,
              aiReport,
            }),
          },
        };
      }),
    );

    return { items, weekTableTypes, weekCancelledTypes, weekAdminCancelledTypes };
  }

  // ─── Geçmiş masalar ─────────────────────────────────────────────────────────

  async getMyHistory(userId: string) {
    const LEFT = [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED];
    const participations = await this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        status: { notIn: LEFT },
        meeting: { status: MeetingStatus.COMPLETED },
      },
      orderBy: { meeting: { scheduledAt: "desc" } },
      select: {
        matchScore: true,
        meeting: {
          select: {
            id: true,
            type: true,
            scheduledAt: true,
            maxParticipants: true,
            locationText: true,
            locationUrl: true,
            venueAddress: true,
            venue: { select: { district: true } },
            venuePhotoUrl: true,
            venuePhoto2Url: true,
            venuePhoto3Url: true,
            venuePhotoCaption1: true,
            venuePhotoCaption2: true,
            venuePhotoCaption3: true,
            city: { select: { name: true } },
            cycle: { select: { weekNumber: true, year: true } },
            aiReport: { select: { content: true, uyumSkoru: true, generatedAt: true } },
            participants: {
              where: { status: { notIn: LEFT } },
              select: {
                userId: true,
                kankaPartnerId: true,
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
                    occupationSector: true,
                    profile: { select: { primaryCity: true, firstName: true, lastName: true, gender: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const pastPhotos = await approvedPhotoMap(this.prisma, participations.flatMap((p) => p.meeting.participants.map((x) => x.userId)));

    const reviews = await this.prisma.meetingReview.findMany({
      where: { reviewerId: userId },
      select: { meetingId: true, rating: true, comment: true },
    });
    const reviewOf = new Map(reviews.map((r) => [r.meetingId, r]));
    const blockedIds = new Set(
      (await this.prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } })).map((b) => b.blockedId),
    );

    // Rozet numarası iptal edenler dahil masanın tüm katılımcılarına göre hesaplanır
    const allParts = await this.prisma.meetingParticipant.findMany({
      where: { meetingId: { in: participations.map((p) => p.meeting.id) } },
      select: { meetingId: true, userId: true, createdAt: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
    });
    const peopleOf = (meetingId: string) =>
      allParts.filter((a) => a.meetingId === meetingId).map((a) => ({ userId: a.userId, createdAt: a.createdAt, profile: a.user.profile }));
    const badgesOf = (meetingId: string) => tableInitials(peopleOf(meetingId));

    return participations.map((p) => {
      const me = p.meeting.participants.find((x) => x.userId === userId);
      const ocean = me?.user?.oceanScore;
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
      const m = p.meeting;
      // Diğer katılımcılardan baş harf + cinsiyet; tamamlanmış masa (kart açılmış) olduğu için görünen ad da döner
      const badges = badgesOf(m.id);
      const names = tableDisplayNames(peopleOf(m.id));
      const person = (x: (typeof m.participants)[number]) => ({
        initials: badges.get(x.userId)?.label ?? '?.?.',
        displayName: names.get(x.userId) ?? null,
        gender: x.user.profile?.gender ?? null,
      });
      const review = reviewOf.get(m.id);

      return {
        id: m.id,
        weekNumber: m.cycle?.weekNumber ?? null,
        date: m.scheduledAt,
        venueName: m.locationText ?? null,
        venuePhotoUrl: m.venuePhotoUrl ?? null,
        city: me?.user?.profile?.primaryCity ?? null,
        overallCompatibility,
        isReviewed: !!review,
        // Masalarım > Geçmiş Masaların kartı
        type: m.type,
        cityName: m.city?.name ?? null,
        maxParticipants: m.maxParticipants,
        venueAddress: m.venueAddress ?? null,
        venueDistrict: m.venue?.district ?? null,
        venueMapsUrl: m.locationUrl ?? (m.locationText ? googleMapsUrl(m.locationText, m.venueAddress) : null),
        venuePhotos: [
          { url: m.venuePhotoUrl, caption: m.venuePhotoCaption1 ?? 'Alan 1' },
          { url: m.venuePhoto2Url, caption: m.venuePhotoCaption2 ?? 'Alan 2' },
          { url: m.venuePhoto3Url, caption: m.venuePhotoCaption3 ?? 'Alan 3' },
        ].filter((x) => !!x.url),
        aiReport: m.aiReport ?? null,
        // Meslekler: her istekte karışık sıra, kişiyle eşleşme bilgisi yok
        occupations: shuffled(m.participants.map((x) => x.user.occupationSector).filter((o): o is string => !!o)),
        participants: m.participants.map((x) => ({
          ...person(x),
          photoUrl: pastPhotos.get(x.userId) ?? null,
          ...(x.userId === userId && { isSelf: true }),
          ...(m.type === MeetingType.KANKA && {
            pair: x.userId === userId || x.userId === me?.kankaPartnerId ? ('MINE' as const) : ('OTHER' as const),
          }),
        })),
        review: review ? { rating: review.rating, comment: review.comment } : null,
        blocked: m.participants.filter((x) => blockedIds.has(x.userId)).map(person),
      };
    });
  }

  // İptal eden, reddeden ve gelmeyen kişi masayı değerlendiremez, masadan kimseyi engelleyemez
  private assertTookPart(status: ParticipantStatus) {
    const out: ParticipantStatus[] = [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED, ParticipantStatus.NO_SHOW];
    if (out.includes(status)) throw new ForbiddenException("Bu masanın aktif katılımcısı değilsiniz");
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
      select: { status: true, meeting: { select: { scheduledAt: true } } },
    });
    if (!participation) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    this.assertTookPart(participation.status);

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
    // Mekân adı kart açılmadan (masa günü 10:00 TR) dönmez
    const cardOpen = new Date() >= new Date(participation.meeting.scheduledAt.getTime() - 10 * 60 * 60 * 1000);
    return {
      // Önceden bildirilen gelmeyenler formda dolu ve kilitli gelir (geri alınamaz)
      myNoShowIds: myNoShow.map((r) => r.reportedId),
      locationName: cardOpen ? participation.meeting.locationText : null,
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
    const badges = tableInitials(await this.prisma.meetingParticipant.findMany({
      where: { meetingId },
      select: { userId: true, createdAt: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
    }).then((rows) => rows.map((r) => ({ userId: r.userId, createdAt: r.createdAt, profile: r.user.profile }))));
    return {
      open: me.meeting.status === MeetingStatus.ACTIVE && now >= opensAt && now < closesAt,
      opensAt,
      closesAt,
      participants: others.map((p) => ({
        userId: p.userId,
        initials: badges.get(p.userId)?.label ?? initialsOf(p.user.profile),
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
    this.assertTookPart(blockerParticipation.status);

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
      include: { participants: { select: { userId: true, status: true } } },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.type !== MeetingType.ONE_ON_ONE) {
      throw new BadRequestException("Bu endpoint sadece baş başa buluşmalar için geçerlidir");
    }

    const blocker = meeting.participants.find((p) => p.userId === blockerId);
    if (!blocker) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    this.assertTookPart(blocker.status);

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
    // Buluşmaya 1 saatten fazla varken yola çıkış bildirimi kabul edilmez
    if (Date.now() < participant.meeting.scheduledAt.getTime() - ON_MY_WAY_OPEN_MS) {
      throw new BadRequestException("Yola çıkış bildirimi, buluşma saatinden 1 saat önce kullanıma açılır.");
    }

    await this.prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { onMyWayAt: new Date() },
    });

    const firstName = participant.user.profile?.firstName ?? '';
    const lastName = participant.user.profile?.lastName ?? '';
    const initials = `${firstName[0] ?? '?'}.${lastName[0] ?? '?'}.`;
    const notifBody = `${initials} yola çıktığını bildirdi.`;
    const notifEn = { title: 'On the way', body: `${initials} is on the way.` };

    const otherUserIds = participant.meeting.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);

    await Promise.all(
      otherUserIds.map((uid) =>
        this.notifications.sendToUser(uid, {
          title: 'Yola Çıktı',
          body: notifBody,
          data: { type: 'ON_MY_WAY', meetingId },
          en: notifEn,
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

  // Kankamla: çiftin paketi başladıktan sonra çiftten biri bir Kankamla rezervasyonunu kendisi iptal ettiyse hak kullanılmıştır
  private async kankaCancelRightUsed(userId: string): Promise<boolean> {
    const link = await activeKankaLink(this.prisma, userId);
    const pairIds = link ? [userId, link.kankaId] : [userId];
    const sub = await this.prisma.subscription.findFirst({
      where: { userId: { in: pairIds }, plan: SubscriptionPlan.KANKAMLA, status: SubscriptionStatus.ACTIVE },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (!sub) return false;
    const cancelled = await this.prisma.meetingParticipant.count({
      where: {
        userId: { in: pairIds },
        status: ParticipantStatus.CANCELLED,
        leaveReason: { not: null }, // kendisi iptal etti (kankası yüzünden düşen değil)
        cancelledAt: { gte: sub.createdAt },
        meeting: { type: MeetingType.KANKA },
      },
    });
    return cancelled > 0;
  }

  async cancelRegistration(
    meetingId: string,
    userId: string,
    note: string,
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

    // Seçim iptaliyle aynı: masa kilitlenmeden önce; kullanım hakkı yanmaz, kişi yalnız bu seçime ait tarama kaydını ve
    // masadaki eşleşmesini kaybeder (matching/selection-cancel.ts)
    await cancelSelection({ prisma: this.prisma, notifications: this.notifications, assignQueue: this.assignQueue }, userId, meeting.type, note);
    return { success: true };
  }

}
