import { Injectable, Logger } from "@nestjs/common";
import { MeetingStatus, ParticipantStatus, Prisma, VenueType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { trWeekStart, WEEK_MS } from "../admin/tr-week";

// Masa kilitleri buluşmadan ~20 saat önce kapanır (Perş/Cuma/Cmt 23:59 → ertesi gün 20:00)
const LOCK_LEAD_MS = 20 * 60 * 60 * 1000;
const LEFT_STATUSES: ParticipantStatus[] = [ParticipantStatus.DECLINED, ParticipantStatus.CANCELLED];
const OPEN_STATUSES: MeetingStatus[] = [MeetingStatus.PENDING, MeetingStatus.ACTIVE];

type VenueCard = { name: string; address: string | null; locationUrl: string | null; photos: string[] };

// Mekân bilgisinin masa kartına yansıyan alanları
export function meetingVenueFields(v: VenueCard) {
  return {
    locationText: v.name,
    venueAddress: v.address,
    locationUrl: v.locationUrl,
    venuePhotoUrl: v.photos[0] ?? null,
    venuePhoto2Url: v.photos[1] ?? null,
    venuePhoto3Url: v.photos[2] ?? null,
  };
}

// Hesabı kapanan mekânın alanları temizlenir; masa bir sonraki taramada başka mekâna atanır
export const CLEARED_MEETING_VENUE: Prisma.MeetingUncheckedUpdateManyInput = {
  venueId: null, locationText: null, venueAddress: null, locationUrl: null,
  venuePhotoUrl: null, venuePhoto2Url: null, venuePhoto3Url: null,
};

@Injectable()
export class VenueAssignmentService {
  private readonly logger = new Logger(VenueAssignmentService.name);

  constructor(private prisma: PrismaService) {}

  // Haftada mekâna atanmış masalardaki toplam kişi
  async usedSeats(venueId: string, weekStart: Date, tx: Prisma.TransactionClient = this.prisma): Promise<number> {
    const meetings = await tx.meeting.findMany({
      where: {
        venueId,
        status: { not: MeetingStatus.CANCELLED },
        scheduledAt: { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_MS) },
      },
      select: { _count: { select: { participants: { where: { status: { notIn: LEFT_STATUSES } } } } } },
    });
    return meetings.reduce((sum, m) => sum + m._count.participants, 0);
  }

  // Hafta için geçerli kontenjan: o haftanın kaydı, yoksa mekânın varsayılanı
  async capacityFor(venue: { id: string; capacity: number | null }, weekStart: Date): Promise<number> {
    const week = await this.prisma.venueWeeklyCapacity.findUnique({
      where: { venueId_weekStart: { venueId: venue.id, weekStart } },
      select: { capacity: true },
    });
    return week?.capacity ?? venue.capacity ?? 0;
  }

  // Kilidi geçmiş ve mekânı olmayan masaları, aktif ortak mekânlara güncel kontenjana göre dağıtır.
  // Uygun mekân yoksa masa boş kalır, admin elle mekân yazabilir.
  async assignLockedMeetings(): Promise<void> {
    const now = new Date();
    const meetings = await this.prisma.meeting.findMany({
      where: {
        status: { in: OPEN_STATUSES },
        venueId: null,
        locationText: null,
        cityId: { not: null },
        scheduledAt: { gt: now, lte: new Date(now.getTime() + LOCK_LEAD_MS) },
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true, cityId: true, scheduledAt: true,
        participants: {
          where: { status: { notIn: LEFT_STATUSES } },
          select: { user: { select: { isBot: true, profile: { select: { venuePreference: true } } } } },
        },
      },
    });

    for (const meeting of meetings) {
      const seats = meeting.participants.length;
      if (seats === 0) continue;
      const venueType = this.requiredVenueType(meeting.participants.map((p) => p.user));
      const venues = await this.prisma.venue.findMany({
        where: {
          cityId: meeting.cityId!, isActive: true,
          account: { status: "ACTIVE" },
          ...(venueType ? { venueType } : {}),
        },
        select: { id: true, name: true, address: true, locationUrl: true, photos: true, capacity: true },
      });

      const weekStart = trWeekStart(meeting.scheduledAt);
      let best: { venue: (typeof venues)[number]; free: number } | null = null;
      for (const venue of venues) {
        const free = (await this.capacityFor(venue, weekStart)) - (await this.usedSeats(venue.id, weekStart));
        if (free >= seats && (!best || free > best.free)) best = { venue, free };
      }
      if (!best) {
        this.logger.warn(`Masa ${meeting.id}: ${seats} kişilik kontenjanı olan uygun mekân yok`);
        continue;
      }

      // Bu arada admin elle mekân yazdıysa üzerine yazılmaz
      await this.prisma.meeting.updateMany({
        where: { id: meeting.id, venueId: null, locationText: null },
        data: { venueId: best.venue.id, ...meetingVenueFields(best.venue) },
      });
    }
  }

  // Tercihler çelişmiyorsa masa o türdeki mekâna gider; "fark etmez" ve karışık masalarda tür şartı yok
  private requiredVenueType(users: { isBot: boolean; profile: { venuePreference: string | null } | null }[]): VenueType | null {
    const prefs = users.filter((u) => !u.isBot).map((u) => u.profile?.venuePreference);
    const alcoholic = prefs.includes(VenueType.ALCOHOLIC);
    const nonAlcoholic = prefs.includes(VenueType.NON_ALCOHOLIC);
    if (alcoholic === nonAlcoholic) return null;
    return alcoholic ? VenueType.ALCOHOLIC : VenueType.NON_ALCOHOLIC;
  }
}
