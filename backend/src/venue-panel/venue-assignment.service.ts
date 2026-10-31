import { Injectable, Logger } from "@nestjs/common";
import { MeetingStatus, ParticipantStatus, Prisma, VenueType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { trWeekStart, WEEK_MS } from "../admin/tr-week";
import { sideOf } from "../common/districts";

// Masa kilitleri buluşmadan ~20 saat önce kapanır: Grup Perş, Baş başa Cuma, Kankamla Cmt 23:59 → ertesi gün 20:00.
// Kart buluşma günü 10:00'da açılır (grup Cuma, baş başa Cumartesi, Kankamla Pazar).
export const VENUE_LOCK_LEAD_MS = 20 * 60 * 60 * 1000;
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const TYPE_LABEL: Record<string, string> = { GROUP: "grup", ONE_ON_ONE: "baş başa", KANKA: "Kankamla" };
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
  venueId: null, venueNotifiedId: null, locationText: null, venueAddress: null, locationUrl: null,
  venuePhotoUrl: null, venuePhoto2Url: null, venuePhoto3Url: null,
};

@Injectable()
export class VenueAssignmentService {
  private readonly logger = new Logger(VenueAssignmentService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
  ) {}

  // Kilidi geçmiş, buluşması gelmemiş, mekânı boş masalar
  private missingWhere(now = new Date()): Prisma.MeetingWhereInput {
    return {
      status: { in: OPEN_STATUSES },
      venueId: null,
      locationText: null,
      scheduledAt: { gt: now, lte: new Date(now.getTime() + VENUE_LOCK_LEAD_MS) },
    };
  }

  countMissing() {
    return this.prisma.meeting.count({ where: this.missingWhere() });
  }

  private trParts(date: Date) {
    const tr = new Date(date.getTime() + TR_OFFSET_MS);
    const pad = (n: number) => String(n).padStart(2, "0");
    return { day: TR_DAYS[tr.getUTCDay()], time: `${pad(tr.getUTCHours())}:${pad(tr.getUTCMinutes())}` };
  }

  private async alertAdmin(meeting: { type: string; scheduledAt: Date; city: { name: string } | null }) {
    const phone = process.env.ADMIN_WHATSAPP_NUMBER;
    if (!phone) {
      this.logger.warn("ADMIN_WHATSAPP_NUMBER boş, mekânsız masa uyarısı gönderilemedi");
      return;
    }
    await this.whatsapp.send(phone, "ahenk_admin_venue_missing", [
      TYPE_LABEL[meeting.type] ?? meeting.type,
      meeting.city?.name ?? "-",
      `${this.trParts(meeting.scheduledAt).day} 10:00`,
    ]).catch((err: unknown) => this.logger.error(`Mekânsız masa uyarısı gönderilemedi: ${err}`));
  }

  // Atama sonrası: her masa için ilk uyarı bir kez gider
  private async alertNewlyMissing(): Promise<void> {
    const meetings = await this.prisma.meeting.findMany({
      where: { ...this.missingWhere(), venueMissingAlertAt: null },
      select: { id: true, type: true, scheduledAt: true, city: { select: { name: true } } },
    });
    for (const meeting of meetings) {
      await this.prisma.meeting.update({ where: { id: meeting.id }, data: { venueMissingAlertAt: new Date() } });
      await this.alertAdmin(meeting);
    }
  }

  // Kart açılışından 2 saat önce (08:00): o gün buluşacak, hâlâ mekânsız masalar için tekrar uyarı
  async remindMissingVenues(): Promise<void> {
    const meetings = await this.prisma.meeting.findMany({
      where: this.missingWhere(),
      select: { type: true, scheduledAt: true, city: { select: { name: true } } },
    });
    for (const meeting of meetings) await this.alertAdmin(meeting);
  }

  // Masanın güncel mekânıyla haber verilen mekân farklıysa: eskisine iptal, yenisine masa mesajı.
  // venueNotifiedId koşullu güncellendiği için aynı masa için ikinci bildirim gitmez.
  async syncVenueNotice(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        venueId: true, venueNotifiedId: true, type: true, scheduledAt: true,
        _count: { select: { participants: { where: { status: { notIn: LEFT_STATUSES } } } } },
      },
    });
    if (!meeting || meeting.venueId === meeting.venueNotifiedId) return;
    const claimed = await this.prisma.meeting.updateMany({
      where: { id: meetingId, venueNotifiedId: meeting.venueNotifiedId, venueId: meeting.venueId },
      data: { venueNotifiedId: meeting.venueId },
    });
    if (claimed.count === 0) return;

    const { day, time } = this.trParts(meeting.scheduledAt);
    const type = TYPE_LABEL[meeting.type] ?? meeting.type;
    const phoneOf = async (venueId: string) =>
      (await this.prisma.venueAccount.findUnique({ where: { venueId }, select: { phone: true } }))?.phone;
    const send = (phone: string, template: string, params: string[]) =>
      this.whatsapp.send(phone, template, params).catch((err: unknown) => this.logger.error(`Mekân bildirimi gönderilemedi: ${err}`));

    if (meeting.venueNotifiedId) {
      const phone = await phoneOf(meeting.venueNotifiedId);
      if (phone) await send(phone, "ahenk_venue_table_cancelled", [day, time, type]);
    }
    if (meeting.venueId) {
      const phone = await phoneOf(meeting.venueId);
      if (phone) await send(phone, "ahenk_venue_table", [day, time, String(meeting._count.participants), type]);
    }
  }

  // Admin masayı iptal etti: haber verilmiş mekâna iptal mesajı (birleştirmede çağrılmaz)
  async noticeMeetingCancelled(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { venueNotifiedId: true, type: true, scheduledAt: true },
    });
    if (!meeting?.venueNotifiedId) return;
    const claimed = await this.prisma.meeting.updateMany({
      where: { id: meetingId, venueNotifiedId: meeting.venueNotifiedId },
      data: { venueNotifiedId: null },
    });
    if (claimed.count === 0) return;
    const account = await this.prisma.venueAccount.findUnique({ where: { venueId: meeting.venueNotifiedId }, select: { phone: true } });
    if (!account) return;
    const { day, time } = this.trParts(meeting.scheduledAt);
    await this.whatsapp.send(account.phone, "ahenk_venue_table_cancelled", [day, time, TYPE_LABEL[meeting.type] ?? meeting.type])
      .catch((err: unknown) => this.logger.error(`Mekân iptal bildirimi gönderilemedi: ${err}`));
  }

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
    const meetings = await this.prisma.meeting.findMany({
      where: { ...this.missingWhere(), cityId: { not: null } },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true, cityId: true, scheduledAt: true,
        city: { select: { name: true } },
        participants: {
          where: { status: { notIn: LEFT_STATUSES } },
          select: { user: { select: { isBot: true, profile: { select: { venuePreference: true, district: true } } } } },
        },
      },
    });

    for (const meeting of meetings) {
      const seats = meeting.participants.length;
      if (seats === 0) continue;
      const users = meeting.participants.map((p) => p.user);
      const venueType = this.requiredVenueType(users);
      // Şehir şartı sorgunun parçası: başka şehrin mekânı aday olamaz
      const venues = await this.prisma.venue.findMany({
        where: {
          cityId: meeting.cityId!, isActive: true,
          account: { status: "ACTIVE" },
          ...(venueType ? { venueType } : {}),
        },
        select: { id: true, name: true, address: true, district: true, locationUrl: true, photos: true, capacity: true },
      });

      const cityName = meeting.city?.name ?? "";
      const homeDistrict = this.topDistrict(users);
      const homeSide = sideOf(cityName, homeDistrict);
      // 0: aynı ilçe, 1: aynı yaka, 2: şehirdeki diğer mekân
      const proximity = (district: string | null) => {
        if (homeDistrict && district === homeDistrict) return 0;
        if (homeSide && sideOf(cityName, district) === homeSide) return 1;
        return 2;
      };

      const weekStart = trWeekStart(meeting.scheduledAt);
      let best: { venue: (typeof venues)[number]; free: number; rank: number } | null = null;
      for (const venue of venues) {
        const free = (await this.capacityFor(venue, weekStart)) - (await this.usedSeats(venue.id, weekStart));
        if (free < seats) continue;
        const rank = proximity(venue.district);
        if (!best || rank < best.rank || (rank === best.rank && free > best.free)) best = { venue, free, rank };
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
      await this.syncVenueNotice(meeting.id);
    }

    await this.alertNewlyMissing();
  }

  // Masadaki gerçek kullanıcıların en çok yaşadığı ilçe
  private topDistrict(users: { isBot: boolean; profile: { district: string | null } | null }[]): string | null {
    const counts = new Map<string, number>();
    for (const u of users) {
      const d = u.profile?.district;
      if (!u.isBot && d) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
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
