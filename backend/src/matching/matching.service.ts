import { matchScore, tomorrowScore } from "./match-score";
import { writeSeatScores } from "./seat-scores";
import { normalizePhone } from "../common/phone";
import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import type { BotDto } from "./dto/update-bot.dto";
import { PrismaService } from "../prisma/prisma.service";
import { isBotSystemActive, isMaintenanceMode, oceanCriteria } from "../admin/app-settings";
import { NotificationService } from "../notification/notification.service";
import {
  TABLE_SIZE_LARGE,
  TABLE_SIZE_SMALL,
} from "./matching.constants";
import { cancelDeadline, groupMeetingAt, kankaMeetingAt, nextDayMeetingAt, oneOnOneMeetingAt, todayMeetingAt, tomorrowMeetingAt } from "../meetings/meeting-windows";
import { cancellationNotice } from "../meetings/cancellation-notice";
import { trWeekStart, WEEK_MS } from "../admin/tr-week";
import { Gender, MeetingMode, MeetingType, ParticipantStatus, UserStatus, SubscriptionPlan, KycStatus, Prisma } from "../generated/prisma/client";
import { pickBot, alertBotNotFound, recentlyMetBotIds, notifyBotAssigned } from "./bot-picker";
import { consumeOneOnOneRights, restoreOneOnOneRights } from "./one-on-one-right";
import { plannedTargetWeek, selectedThisWeek, selectedTomorrow } from "./selection-cancel";
import { chargeKankaRight, GROUP_PLANS, ONE_ON_ONE_PLANS, OPEN_GROUP_SUB, OPEN_KANKA_SUB, OPEN_ONE_ON_ONE_SUB, pairKankaSub, syncPackageStatus } from "../payment/package-rights";
import { activeKankaLink } from "../kanka/kanka-links";
import { approvedPhotoMap, PROFILE_PHOTO_DIR } from "../profile-photo/profile-photo.util";
import * as fs from "fs";
import * as path from "path";
import { ASSIGN_QUEUE, JOB_SCAN_POOL, JOB_GROUP_BOTS, JOB_TOMORROW_LOCK, enqueueAssign, randomBotDelayMs } from "./assign-queue";

type OceanScoreData = {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
};

type EligibleUser = {
  id: string;
  isBot: boolean;
  status: UserStatus;
  phone: string | null;
  speaksEnglish: boolean;
  speaksTurkish: boolean;
  activeCity: string | null;
  occupationSector: string | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    gender: Gender | null;
    city: string | null;
    district: string | null;
    primaryCity: string | null;
    venueCategories: string[];
    venuePreference: 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE' | null;
    birthDate: string | null;
  } | null;
  oceanScore: OceanScoreData | null;
  contactBlocks: { hashedPhone: string }[];
};

// mode PLANNED: haftalık döngü (cycleId); TOMORROW: Yarın Buluşma (meetingAt = buluşma günü 20:00, cycleId boş).
// Yarın'da saat filtreleri hep açık: ALCOHOLIC / NON_ALCOHOLIC zorunlu, sıralama puanı yaş %50 + mekân kategorisi %50.
type AssignContext = {
  mode: MeetingMode;
  cycleId: string | null;
  meetingAt: Date | null;
  weekNumber: number;
  groupOpen: boolean;
  oneOnOneOpen: boolean;
  // Eşleştirme Kriterleri: masa türüne göre OCEAN sıralaması (yalnız Planlı; Yarın'da hep kapalı)
  ocean: Record<MeetingType, boolean>;
  groupVenue: boolean;   // Perşembe 18:00'e kadar mekan uyumu
  oneOnOneSoft: boolean; // Cuma 10:00'a kadar mekan uyumu
  kankaOpen: boolean;    // Kankamla Pazartesi – Cumartesi 23:44
  kankaSoft: boolean;    // Cumartesi 12:00'ye kadar mekan uyumu (iki alıcı arasında)
};

// Tek kişilik başbaşa masası: oturan kişi eş bekliyor
type LoneTable = { id: string; cityId: string | null; createdAt: Date; participantId: string; user: EligibleUser };

// Kankamla çifti: paketi olan alıcı + aynı cinsiyetteki kankası (ücretsiz)
type KankaPair = { buyer: EligibleUser; kanka: EligibleUser; subId: string };

// Havuz kapsamı: masaların ait olduğu döngü / gün ve kişinin bu türdeki kaydı
type PoolScope = { meeting: Prisma.MeetingWhereInput; selected: (type: MeetingType) => Prisma.UserWhereInput };

// Kendisi iptal etmemiş (admin çıkarması, askı / ban, kankasının düşmesi) katılım: o hafta / gün aynı türün havuzuna girmez.
// Kişinin kendi seçim iptali (leaveReason dolu) yeniden kayıt olmasını engellemez.
const notSelfCancelled = { status: "CANCELLED" as const, leaveReason: null };

// Atama son anı 23:44 (TR); 23:45'ten itibaren sadece kapanış botları
const ASSIGN_CUTOFF_MIN = 23 * 60 + 45;
// Başbaşa yaş farkı sınırı — hiçbir saatte kalkmaz
const MAX_AGE_GAP_YEARS = 8;

const ELIGIBLE_SELECT = {
  id: true,
  isBot: true,
  status: true,
  phone: true,
  speaksEnglish: true,
  speaksTurkish: true,
  activeCity: true,
  occupationSector: true,
  profile: { select: { firstName: true, lastName: true, gender: true, city: true, district: true, primaryCity: true, venueCategories: true, venuePreference: true, birthDate: true } },
  oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
  contactBlocks: { select: { hashedPhone: true } },
} as const;

function getISOWeekNumber(date: Date): { week: number; year: number } {
  // Hafta TR saatine (UTC+3) göre hesaplanır; sunucunun saat diliminden bağımsız
  const tr = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const d = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}


// TR saatiyle gün (0=Pazar … 6=Cumartesi) ve gün içindeki dakika
function trClock(date: Date): { day: number; minutes: number } {
  const tr = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return { day: tr.getUTCDay(), minutes: tr.getUTCHours() * 60 + tr.getUTCMinutes() };
}

// Kullanıcının eşleştirme şehri: aktif şehir seçtiyse o, yoksa ana şehir. Şehri olmayan eşleştirmeye alınmaz.
// ─── DİL KURALI (zorunlu; bütün masa türlerinde diğer kurallardan önce) ────────────────────────────
// a) Türkçe bilmeyen (speaksTurkish = false) kişi yalnız herkesin İngilizce bildiği masaya oturur.
// b) Türkçe bilmeyenler önce birbirleriyle eşleşir (masa seçiminde Türkçe bilmeyen olan masa öne alınır).
// c) Böyle bir masanın boş yerleri yalnız telefon kodu +90 olan ve İngilizce bilen kişilerle dolar.
// d) Dil kuralından sonra cinsiyet dengesi ve diğer kurallar aynen uygulanır.
// e) Botlar dil kuralına girmez (grup masasındaki bot kuralı aynen).
const noTurkish = (u: EligibleUser) => !u.isBot && u.speaksTurkish === false;
const englishFiller = (u: EligibleUser) => !u.isBot && u.speaksTurkish !== false && u.speaksEnglish === true && (u.phone ?? "").startsWith("+90");
// Kişiler aynı masada oturabilir mi: masada Türkçe bilmeyen yoksa serbest; varsa herkes ya Türkçe bilmeyen ya da +90 İngilizce bilen
export function languageCompatible(people: EligibleUser[]): boolean {
  const humans = people.filter((u) => !u.isBot);
  if (!humans.some(noTurkish)) return true;
  return humans.every((u) => noTurkish(u) || englishFiller(u));
}
// Masadaki Türkçe bilmeyen sayısı (b: Türkçe bilmeyen kişi bu sayısı yüksek masayı önce seçer)
const noTurkishCount = (people: EligibleUser[]) => people.filter(noTurkish).length;

function matchCity(user: EligibleUser): string | null {
  return user.activeCity ?? user.profile?.primaryCity ?? null;
}

function ageYears(birthDate: string | Date | null | undefined): number | null {
  if (!birthDate) return null;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
}

// Masa adı: "İstanbul Grup 44" = o şehirdeki 44. grup masası (haftalık değil, şehir + türe göre sıra).
// Atamalar kuyrukta tek tek çalıştığı için sıra numarası çakışmaz.
// Masa numarası şehir + tür + hafta bazındadır. Hafta: buluşma tarihinin ait olduğu Pazartesi 00:00 – Pazar 23:59 (TR).
// Yeni numara = o şehir, tür ve haftadaki masaların (iptal edilenler dahil) en büyük numarası + 1; iptal edilen numara tekrar kullanılmaz.
export async function tableTitle(
  db: Pick<PrismaService, "city" | "meeting"> | Prisma.TransactionClient,
  cityId: string,
  type: MeetingType,
  scheduledAt: Date,
): Promise<string> {
  const weekStart = trWeekStart(scheduledAt);
  const [city, weekTitles] = await Promise.all([
    db.city.findUnique({ where: { id: cityId }, select: { name: true } }),
    db.meeting.findMany({
      where: { cityId, type, scheduledAt: { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_MS) } },
      select: { title: true },
    }),
  ]);
  const maxNo = weekTitles.reduce((max, m) => {
    const hit = /(\d+)\s*$/.exec(m.title);
    return hit ? Math.max(max, Number(hit[1])) : max;
  }, 0);
  const label = type === MeetingType.GROUP ? "Grup" : type === MeetingType.KANKA ? "Kankamla" : "Baş Başa";
  return `${city?.name ?? ""} ${label} ${maxNo + 1}`.trim();
}

// Grup bot kuralı (Planlı ve Yarın aynı): masaya en fazla 1 bot. 3 kişilik masa 1 botla 4'e (2E+1K → 1 K),
// 5 kişilik masa 1 botla 6'ya (3E+2K → 1 K) tamamlanır. Dengeli 4 / 6 masa bot istemez ({0,0}); diğer durumlar bot almaz (null).
function groupBotNeed(males: number, females: number): { male: number; female: number } | null {
  const count = males + females;
  if (count === TABLE_SIZE_SMALL || count === TABLE_SIZE_LARGE) return males === females ? { male: 0, female: 0 } : null;
  if (count === TABLE_SIZE_SMALL - 1 || count === TABLE_SIZE_LARGE - 1) {
    const half = (count + 1) / 2;
    if (males <= half && females <= half) return { male: half - males, female: half - females };
  }
  return null;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
  ) {}

  // ─── Gerçek zamanlı masa atama ────────────────────────────────────────────
  // Kişi havuza girdiği an atanır (ödeme, admin paketi, KYC onayı, başbaşa iptali); saat başı tarama
  // kaçanları ve saatle gevşeyen filtreleri yakalar. Hepsi assign kuyruğunda tek tek çalışır.

  async requestScan(): Promise<{ queued: true }> {
    await this.assignQueue.add(JOB_SCAN_POOL, {}, { removeOnComplete: true, removeOnFail: 100 });
    return { queued: true };
  }

  // Yarın Buluşma 23:59 kilidi kuyruğa eklenir (atamalarla sırayla çalışır)
  async requestTomorrowLock(): Promise<void> {
    await this.assignQueue.add(JOB_TOMORROW_LOCK, {}, { removeOnComplete: true, removeOnFail: 100 });
  }

  async assignUser(userId: string): Promise<void> {
    for (const ctx of await this.contexts()) {
      const scope = this.poolScope(ctx);
      if (ctx.groupOpen) {
        const [user] = await this.eligible(scope, GROUP_PLANS, false, [userId]);
        if (user) await this.assignGroup(ctx, user);
      }
      if (ctx.oneOnOneOpen) {
        const [user] = await this.eligible(scope, ONE_ON_ONE_PLANS, true, [userId]);
        if (user) await this.assignOneOnOne(ctx, user);
      }
      if (ctx.kankaOpen) {
        const [pair] = await this.kankaPairs(scope, [userId]);
        if (pair) await this.assignKanka(ctx, pair);
      }
    }
  }

  async scanPool(): Promise<void> {
    for (const ctx of await this.contexts()) {
      const scope = this.poolScope(ctx);
      if (ctx.groupOpen) {
        for (const user of await this.eligible(scope, GROUP_PLANS, false)) {
          await this.assignGroup(ctx, user);
        }
        await this.mergeGroupTables(ctx);
      }
      if (ctx.oneOnOneOpen) {
        for (const user of await this.eligible(scope, ONE_ON_ONE_PLANS, true)) {
          await this.assignOneOnOne(ctx, user);
        }
        // Saatle gevşeyen filtreler: tek başına oturanlar birbirinin masasına geçebilir
        const filled = new Set<string>();
        for (const table of await this.loneOneOnOneTables(scope.meeting)) {
          if (filled.has(table.id)) continue;
          const target = await this.assignOneOnOne(ctx, table.user, table);
          if (target) filled.add(target);
        }
      }
      if (ctx.kankaOpen) {
        let pairs = await this.kankaPairs(scope);
        for (const pair of [...pairs]) {
          if (!pairs.some((p) => p.subId === pair.subId)) continue;
          const otherSubId = await this.assignKanka(ctx, pair, pairs);
          if (otherSubId) pairs = pairs.filter((p) => p.subId !== pair.subId && p.subId !== otherSubId);
        }
      }
    }
  }

  // Açık atama bağlamları: Planlı (saat penceresi açıksa) ve Yarın Buluşma (her gün)
  private async contexts(): Promise<AssignContext[]> {
    if (!(await this.matchingAllowed())) return [];
    const planned = await this.assignContext();
    return [...(planned ? [planned] : []), this.tomorrowContext()];
  }

  // "Eşleştirme Aktif" kapalıysa ya da bakım modunda atama yapılmaz
  private async matchingAllowed(): Promise<boolean> {
    const matchingEnabled = await this.prisma.appConfig.findUnique({ where: { key: "MATCHING_ENABLED" } });
    if (matchingEnabled?.value === "false") return false;
    return !(await isMaintenanceMode(this.prisma));
  }

  // Yarın Buluşma: ertesi gün 20:00 masaları (23:59'dan sonra bir sonraki günün masaları); bütün filtreler açık
  private tomorrowContext(): AssignContext {
    const meetingAt = tomorrowMeetingAt();
    return {
      mode: MeetingMode.TOMORROW, cycleId: null, meetingAt, weekNumber: getISOWeekNumber(meetingAt).week,
      groupOpen: true, oneOnOneOpen: true, kankaOpen: true,
      ocean: { GROUP: false, ONE_ON_ONE: false, KANKA: false }, groupVenue: true, oneOnOneSoft: true, kankaSoft: true,
    };
  }

  private poolScope(ctx: AssignContext): PoolScope {
    if (ctx.mode === MeetingMode.TOMORROW) {
      const meetingAt = ctx.meetingAt!;
      return { meeting: { mode: MeetingMode.TOMORROW, scheduledAt: meetingAt }, selected: (t) => selectedTomorrow(t, meetingAt) };
    }
    return { meeting: { cycleId: ctx.cycleId!, mode: MeetingMode.PLANNED }, selected: (t) => selectedThisWeek(t) };
  }

  // Planlı havuz kapsamı (kapanış ve hatırlatma işleri)
  private plannedScope(cycleId: string): PoolScope {
    return { meeting: { cycleId, mode: MeetingMode.PLANNED }, selected: (t) => selectedThisWeek(t) };
  }

  // Yeni masanın buluşma anı
  private meetingAtFor(ctx: AssignContext, type: MeetingType): Date {
    if (ctx.mode === MeetingMode.TOMORROW) return ctx.meetingAt!;
    return type === MeetingType.GROUP ? groupMeetingAt() : type === MeetingType.KANKA ? kankaMeetingAt() : oneOnOneMeetingAt();
  }

  // Sıralama puanı (kimseyi dışlamaz): masa türünün OCEAN anahtarı açıksa (yalnız Planlı) OCEAN %100; kapalıysa ve Yarın'da
  // yaş yakınlığı %50 + mekân kategori tercihi %50. Meslek kullanılmaz.
  private pairScore(ctx: AssignContext, type: MeetingType, a: EligibleUser, b: EligibleUser): number {
    return ctx.ocean[type] ? this.scoreTwo(a, b) : tomorrowScore(a, b);
  }

  // Planlı: atama açık mı + saate göre hangi filtreler geçerli (TR saati)
  private async assignContext(): Promise<AssignContext | null> {
    const now = new Date();
    const { day, minutes } = trClock(now);
    // Grup Pazartesi – Perşembe 23:44, Başbaşa Pazartesi – Cuma 23:44
    const groupOpen = (day >= 1 && day <= 3) || (day === 4 && minutes < ASSIGN_CUTOFF_MIN);
    const oneOnOneOpen = (day >= 1 && day <= 4) || (day === 5 && minutes < ASSIGN_CUTOFF_MIN);
    const kankaOpen = (day >= 1 && day <= 5) || (day === 6 && minutes < ASSIGN_CUTOFF_MIN);
    if (!groupOpen && !oneOnOneOpen && !kankaOpen) return null;

    const { week: weekNumber, year } = getISOWeekNumber(now);
    const cycle = await this.prisma.matchingCycle.upsert({
      where: { weekNumber_year: { weekNumber, year } },
      update: {},
      create: { weekNumber, year, status: "RUNNING" },
    });

    return {
      mode: MeetingMode.PLANNED,
      cycleId: cycle.id,
      meetingAt: null,
      weekNumber,
      groupOpen,
      oneOnOneOpen,
      ocean: await oceanCriteria(this.prisma),
      groupVenue: !(day === 4 && minutes >= 18 * 60),
      oneOnOneSoft: !(day === 5 && minutes >= 10 * 60),
      kankaOpen,
      kankaSoft: !(day === 6 && minutes >= 12 * 60),
    };
  }

  // GRUP: masa ilk kişiyle (6 hedefli) açılır; yeni gelen aynı şehirde kendi cinsiyeti eksik (en fazla 3E/3K)
  // en dolu masaya oturur. Eksik masa kalmadıysa yeni masa açılır.
  // Cinsiyet + şehir + engel hiç kalkmaz; mekan uyumu Perşembe 18:00'e kadar.
  private async assignGroup(ctx: AssignContext, user: EligibleUser): Promise<void> {
    const cityId = matchCity(user);
    const gender = user.profile?.gender;
    if (!cityId || !gender) return;
    if (await this.isComingSoonCity(cityId)) return; // Yakında şehir eşleştirmeye girmez

    const meetings = await this.prisma.meeting.findMany({
      where: { ...this.poolScope(ctx).meeting, cityId, type: MeetingType.GROUP, status: "PENDING" },
      select: {
        id: true,
        participants: {
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          select: { user: { select: ELIGIBLE_SELECT } },
        },
      },
    });
    const tables = meetings.map((m) => ({ id: m.id, members: m.participants.map((p) => p.user as unknown as EligibleUser) }));
    const blocked = await this.blockedIds(user, tables.flatMap((t) => t.members));

    const fits = tables.filter(({ members }) =>
      languageCompatible([user, ...members]) &&
      members.length < TABLE_SIZE_LARGE &&
      members.filter((u) => u.profile?.gender === gender).length < TABLE_SIZE_LARGE / 2 &&
      members.every((u) => !blocked.has(u.id) && (!ctx.groupVenue || !this.areVenueIncompatible(user, u))),
    );
    // Masa doldurarak gidilir: en dolu masa önce; eşitlikte sıralama puanı (pairScore) yüksek olan
    const avgScore = (members: EligibleUser[]) =>
      members.reduce((sum, u) => sum + this.pairScore(ctx, MeetingType.GROUP, user, u), 0) / Math.max(1, members.length);
    const preferNoTurkish = noTurkish(user);
    fits.sort((a, b) =>
      (preferNoTurkish ? noTurkishCount(b.members) - noTurkishCount(a.members) : 0) ||
      b.members.length - a.members.length || avgScore(b.members) - avgScore(a.members),
    );

    const target = fits[0];
    if (target) {
      // Seçimini iptal edip yeniden kaydolan kişi aynı masaya düşebilir: eski (iptal) satırı yeniden açılır
      const seat = { status: "INVITED" as const, leaveReason: null, leaveNote: null, cancelledAt: null, groupRightSubId: null };
      await this.prisma.meetingParticipant.upsert({
        where: { meetingId_userId: { meetingId: target.id, userId: user.id } },
        update: seat,
        create: { meetingId: target.id, userId: user.id, status: "INVITED" },
      });
      await this.saveScores(target.id);
      this.logger.log(`Grup ataması: user=${user.id} → meeting=${target.id} (${target.members.length + 1}/${TABLE_SIZE_LARGE})`);
      return;
    }

    const meeting = await this.prisma.meeting.create({
      data: {
        cycleId: ctx.cycleId,
        mode: ctx.mode,
        cityId,
        type: MeetingType.GROUP,
        ...(await (async () => {
          const scheduledAt = this.meetingAtFor(ctx, MeetingType.GROUP);
          return { scheduledAt, title: await tableTitle(this.prisma, cityId, MeetingType.GROUP, scheduledAt) };
        })()),
        maxParticipants: TABLE_SIZE_LARGE,
        participants: { create: { userId: user.id, status: "INVITED" } },
      },
    });
    this.logger.log(`Yeni grup masası: meeting=${meeting.id} user=${user.id}`);
  }

  // BAŞBAŞA: masa grup gibi ilk kişiyle açılır, hak ikinci kişi oturunca harcanır. Yeni gelen şehrindeki uygun tek kişilik
  // masaya oturur; yoksa kendi masasını açar. Karşı cins + şehir + en fazla 8 yaş farkı + engel hiç kalkmaz;
  // mekan uyumu Cuma 10:00'a kadar. Birden fazla aday → sıralama puanı (pairScore) en yüksek olan.
  // seat: kişi zaten tek başına oturuyor (saatlik tarama); eş bulunursa masası iptal edilip eşin masasına geçer.
  // Dolan masanın id'sini döner.
  private async assignOneOnOne(ctx: AssignContext, user: EligibleUser, seat?: LoneTable): Promise<string | null> {
    const cityId = matchCity(user);
    const gender = user.profile?.gender;
    if (!cityId || !gender) return null;
    if (await this.isComingSoonCity(cityId)) return null; // Yakında şehir eşleştirmeye girmez

    const tables = (await this.loneOneOnOneTables(this.poolScope(ctx).meeting)).filter(
      (t) =>
        t.id !== seat?.id &&
        t.user.id !== user.id &&
        languageCompatible([user, t.user]) &&
        t.cityId === cityId &&
        !!t.user.profile?.gender &&
        t.user.profile.gender !== gender &&
        !this.areAgeGapTooLarge(user, t.user) &&
        (!ctx.oneOnOneSoft || !this.areVenueIncompatible(user, t.user)),
    );
    const blocked = await this.blockedIds(user, tables.map((t) => t.user));
    const candidates = tables.filter((t) => !blocked.has(t.user.id));

    if (candidates.length === 0) {
      if (seat) return null;
      const opened = await this.prisma.meeting.create({
        data: {
          cycleId: ctx.cycleId,
          mode: ctx.mode,
          cityId,
          type: MeetingType.ONE_ON_ONE,
          ...(await (async () => {
            const scheduledAt = this.meetingAtFor(ctx, MeetingType.ONE_ON_ONE);
            return { scheduledAt, title: await tableTitle(this.prisma, cityId, MeetingType.ONE_ON_ONE, scheduledAt) };
          })()),
          maxParticipants: 2,
          participants: { create: { userId: user.id, status: "INVITED" } },
        },
      });
      this.logger.log(`Yeni başbaşa masası: meeting=${opened.id} user=${user.id}`);
      return null;
    }

    candidates.sort((a, b) =>
      (noTurkish(user) ? noTurkishCount([b.user]) - noTurkishCount([a.user]) : 0) ||
      this.pairScore(ctx, MeetingType.ONE_ON_ONE, user, b.user) - this.pairScore(ctx, MeetingType.ONE_ON_ONE, user, a.user),
    );
    const target = candidates[0];

    await this.prisma.$transaction(async (tx) => {
      if (seat) {
        await tx.meetingParticipant.update({ where: { id: seat.participantId }, data: { meetingId: target.id } });
        await tx.meeting.update({ where: { id: seat.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      } else {
        await tx.meetingParticipant.create({ data: { meetingId: target.id, userId: user.id, status: "INVITED" } });
      }
      // Planlı: baş başa hakkı iki kişi oturduğu anda harcanır; Yarın: 23:59 kilidinde masa kurulunca (runTomorrowLock)
      if (ctx.mode === MeetingMode.PLANNED) await consumeOneOnOneRights(tx, [user.id, target.user.id], target.createdAt);
    });
    await this.saveScores(target.id);
    this.logger.log(`Başbaşa masası: ${user.id} + ${target.user.id}`);
    return target.id;
  }

  // Bu döngüde (Planlı) / bu günde (Yarın) eş bekleyen tek kişilik başbaşa masaları (kişinin başbaşa hakkı açık)
  private async loneOneOnOneTables(scope: Prisma.MeetingWhereInput): Promise<LoneTable[]> {
    const meetings = await this.prisma.meeting.findMany({
      where: { ...scope, type: MeetingType.ONE_ON_ONE, status: "PENDING", maxParticipants: 2 },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        cityId: true,
        createdAt: true,
        participants: {
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          select: {
            id: true,
            user: { select: { ...ELIGIBLE_SELECT, subscriptions: { where: OPEN_ONE_ON_ONE_SUB, select: { id: true } } } },
          },
        },
      },
    });
    return meetings.flatMap((m) => {
      const [only, ...rest] = m.participants;
      if (!only || rest.length > 0 || only.user.subscriptions.length === 0) return [];
      return [{ id: m.id, cityId: m.cityId, createdAt: m.createdAt, participantId: only.id, user: only.user as unknown as EligibleUser }];
    });
  }

  async loneOneOnOneUserIds(cycleId: string): Promise<string[]> {
    return (await this.loneOneOnOneTables(this.plannedScope(cycleId).meeting)).map((t) => t.user.id);
  }

  // Cuma kapanışı: eşi bulunamayan tek kişilik başbaşa masaları iptal olur (kişi bekleme listesine geçer)
  async cancelLoneOneOnOneTables(cycleId: string): Promise<void> {
    const meetings = await this.prisma.meeting.findMany({
      where: { cycleId, mode: MeetingMode.PLANNED, type: MeetingType.ONE_ON_ONE, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        participants: { where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } }, select: { userId: true } },
      },
    });
    for (const m of meetings.filter((x) => x.participants.length < 2)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.meeting.update({ where: { id: m.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
        await restoreOneOnOneRights(tx, m.createdAt, m.participants.map((p) => p.userId));
      });
    }
  }

  // KANKAMLA: iki alıcı (1 erkek + 1 kadın) eşleşince kankaları da masaya oturur → 4 kişi (2E + 2K), bot yok.
  // İki alıcı: şehir + en fazla 8 yaş farkı hiç kalkmaz; mekan uyumu Cumartesi 12:00'ye kadar. Sıralama pairScore (iki alıcı).
  // Kankalara uyum filtresi yok; engel (engelleme + rehber) dört kişi arasında çapraz kontrol edilir.
  // Kurulan masanın karşı çiftinin paket id'sini döner.
  private async assignKanka(ctx: AssignContext, pair: KankaPair, pool?: KankaPair[]): Promise<string | null> {
    const cityId = matchCity(pair.buyer);
    const gender = pair.buyer.profile?.gender;
    if (!cityId || !gender) return null;
    if (await this.isComingSoonCity(cityId)) return null; // Yakında şehir eşleştirmeye girmez

    const others = (pool ?? (await this.kankaPairs(this.poolScope(ctx)))).filter(
      (o) =>
        o.subId !== pair.subId &&
        languageCompatible([pair.buyer, pair.kanka, o.buyer, o.kanka]) &&
        ![o.buyer.id, o.kanka.id].some((id) => id === pair.buyer.id || id === pair.kanka.id) &&
        matchCity(o.buyer) === cityId &&
        !!o.buyer.profile?.gender &&
        o.buyer.profile.gender !== gender &&
        // Yaş kuralı yalnız iki paket sahibi arasında (en fazla 8 yaş); kankaların yaşı kullanılmaz
        !this.areAgeGapTooLarge(pair.buyer, o.buyer) &&
        (!ctx.kankaSoft || !this.areVenueIncompatible(pair.buyer, o.buyer)),
    );
    const candidates: KankaPair[] = [];
    for (const o of others) {
      const theirs = [o.buyer, o.kanka];
      const blockedA = await this.blockedIds(pair.buyer, theirs);
      const blockedB = await this.blockedIds(pair.kanka, theirs);
      if (blockedA.size === 0 && blockedB.size === 0) candidates.push(o);
    }
    if (candidates.length === 0) return null;

    const pairNoTurkish = noTurkishCount([pair.buyer, pair.kanka]) > 0;
    candidates.sort((a, b) =>
      (pairNoTurkish ? noTurkishCount([b.buyer, b.kanka]) - noTurkishCount([a.buyer, a.kanka]) : 0) ||
      this.pairScore(ctx, MeetingType.KANKA, pair.buyer, b.buyer) - this.pairScore(ctx, MeetingType.KANKA, pair.buyer, a.buyer),
    );
    const other = candidates[0];

    const seatedId = await this.prisma.$transaction(async (tx) => {
      const seated = await tx.meeting.create({
        data: {
          cycleId: ctx.cycleId,
          mode: ctx.mode,
          cityId,
          type: MeetingType.KANKA,
          ...(await (async () => {
            const scheduledAt = this.meetingAtFor(ctx, MeetingType.KANKA);
            return { scheduledAt, title: await tableTitle(tx, cityId, MeetingType.KANKA, scheduledAt) };
          })()),
          maxParticipants: 4,
          participants: {
            createMany: {
              data: [
                { userId: pair.buyer.id, kankaPartnerId: pair.kanka.id },
                { userId: pair.kanka.id, kankaPartnerId: pair.buyer.id },
                { userId: other.buyer.id, kankaPartnerId: other.kanka.id },
                { userId: other.kanka.id, kankaPartnerId: other.buyer.id },
              ].map((p) => ({ ...p, status: "INVITED" as const })),
            },
          },
        },
      });
      return seated.id;
    });
    await this.saveScores(seatedId);
    this.logger.log(`Kankamla masası: ${pair.buyer.id}+${pair.kanka.id} & ${other.buyer.id}+${other.kanka.id}`);
    return other.subId;
  }

  // Kankamla havuzu: açık Kankamla paketi olan alıcı + aktif kankası. İkisi de aktif, KYC onaylı, bot değil,
  // aynı cinsiyet; bu hafta Kankamla masası olan / Kankamla rezervasyonunu iptal eden çift havuza girmez.
  // Çiftte iki kişide de paket varsa en eski paket kullanılır. userIds verilirse sadece o kişilerin çifti.
  async fetchKankaPairs(cycleId: string, userIds?: string[]): Promise<KankaPair[]> {
    return this.kankaPairs(this.plannedScope(cycleId), userIds);
  }

  private async kankaPairs(scope: PoolScope, userIds?: string[]): Promise<KankaPair[]> {
    let ownerIds: string[] | undefined;
    if (userIds) {
      const links = await this.prisma.kankaLink.findMany({
        where: { endedAt: null, OR: [{ userAId: { in: userIds } }, { userBId: { in: userIds } }] },
        select: { userAId: true, userBId: true },
      });
      ownerIds = [...new Set([...userIds, ...links.flatMap((l) => [l.userAId, l.userBId])])];
    }
    const subs = await this.prisma.subscription.findMany({
      where: { ...OPEN_KANKA_SUB, ...(ownerIds ? { userId: { in: ownerIds } } : {}) },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    });

    const pairs: KankaPair[] = [];
    const used = new Set<string>();
    for (const sub of subs) {
      if (used.has(sub.userId)) continue;
      const link = await activeKankaLink(this.prisma, sub.userId);
      if (!link || used.has(link.kankaId)) continue;
      used.add(sub.userId);
      used.add(link.kankaId);

      const notThisWeek: Prisma.UserWhereInput = {
        participations: {
          none: {
            OR: [
              { meeting: { ...scope.meeting, type: MeetingType.KANKA, status: { in: ["PENDING", "ACTIVE"] } } },
              { ...notSelfCancelled, meeting: { ...scope.meeting, type: MeetingType.KANKA } },
            ],
          },
        },
      };
      const [buyer, kanka] = await Promise.all([
        this.prisma.user.findFirst({
          // Paketin sahibi Kankamla'yı bu kapsamda (Planlı hafta / Yarın günü) seçmiş olmalı (weekly-selection.ts)
          where: { id: sub.userId, status: "ACTIVE", isBot: false, oceanScore: { isNot: null }, kyc: { status: KycStatus.APPROVED }, ...notThisWeek, ...scope.selected(MeetingType.KANKA) },
          select: ELIGIBLE_SELECT,
        }),
        this.prisma.user.findFirst({
          where: { id: link.kankaId, status: "ACTIVE", isBot: false, kyc: { status: KycStatus.APPROVED }, ...notThisWeek },
          select: ELIGIBLE_SELECT,
        }),
      ]);
      if (!buyer || !kanka) continue;
      if (!buyer.profile?.gender || buyer.profile.gender !== kanka.profile?.gender) continue;
      pairs.push({ buyer: buyer as unknown as EligibleUser, kanka: kanka as unknown as EligibleUser, subId: sub.id });
    }
    return pairs;
  }

  // Askı / ban: kişi bu haftaki (henüz yapılmamış) Kankamla masasından kankasıyla birlikte düşer; masa iptal olur,
  // karşı çift yeniden taramaya girer (hakları korunur). Düşen çiftin hakkı düşülmez.
  async dropKankaPair(userId: string, reason: string): Promise<void> {
    const parts = await this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        status: { notIn: ["CANCELLED", "DECLINED"] },
        meeting: { type: MeetingType.KANKA, status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gt: new Date() } },
      },
      select: { meetingId: true, kankaPartnerId: true },
    });
    for (const part of parts) {
      const pairIds = [userId, ...(part.kankaPartnerId ? [part.kankaPartnerId] : [])];
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: part.meetingId },
        select: { participants: { select: { userId: true } } },
      });
      const otherIds = (meeting?.participants ?? []).map((p) => p.userId).filter((id) => !pairIds.includes(id));
      await this.prisma.$transaction([
        this.prisma.meetingParticipant.updateMany({
          where: { meetingId: part.meetingId, userId: { in: pairIds } },
          data: { status: "CANCELLED", cancelledAt: new Date(), leaveNote: reason },
        }),
        this.prisma.meeting.update({ where: { id: part.meetingId }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
      ]);
      for (const id of otherIds) {
        await this.notifications.sendToUser(id, {
          title: "Karşı çift masadan ayrıldı",
          body: "Kankamla masandaki karşı çift ayrıldı. Senin için yeniden eşleşme aranıyor.",
          data: { type: "KANKA_PAIR_LEFT", meetingId: part.meetingId },
          en: { title: "The other pair left the table", body: "The other pair at your Bring a Buddy table left. We're looking for a new match for you." },
        }).catch(() => undefined);
        await enqueueAssign(this.assignQueue, id);
      }
    }
  }

  // Kart açılışı masayı onaylar: bildirimi giden masa admin onayı yok diye iptal olmaz, AI raporu da üretilir
  async activateRevealed(meetingIds: string[]): Promise<void> {
    if (meetingIds.length === 0) return;
    await this.prisma.meeting.updateMany({
      where: { id: { in: meetingIds }, status: "PENDING" },
      data: { status: "ACTIVE" },
    });
  }

  // Askı / ban: kişi yapılmamış grup ve başbaşa masalarından çıkar (kayıt iptal olarak kalır).
  // Başbaşa tek kişiyle kalmaz: masa iptal, kalanın hakkı geri verilir, yeniden taramaya girer.
  // Grup: sandalye boşalır, iptal son anına kadar bildirim Perşembe 20:00 özetiyle, sonrasında hemen gider.
  // Dönen liste iptal olan masalardır (mekân bildirimi için).
  async dropFromTables(userId: string, reason: string): Promise<string[]> {
    const now = new Date();
    const inactive: ParticipantStatus[] = ["CANCELLED", "DECLINED", "NO_SHOW"];
    const parts = await this.prisma.meetingParticipant.findMany({
      where: {
        userId,
        status: { notIn: inactive },
        meeting: { type: { in: [MeetingType.GROUP, MeetingType.ONE_ON_ONE] }, status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gt: now } },
      },
      select: {
        meetingId: true,
        meeting: {
          select: {
            type: true, createdAt: true, scheduledAt: true,
            participants: { where: { status: { notIn: inactive } }, select: { userId: true } },
          },
        },
      },
    });
    if (parts.length === 0) return [];

    const notice = cancellationNotice();
    const cancelled: string[] = [];

    for (const { meetingId, meeting } of parts) {
      const others = meeting.participants.map((p) => p.userId).filter((id) => id !== userId);
      const isOneOnOne = meeting.type === MeetingType.ONE_ON_ONE;
      await this.prisma.$transaction(async (tx) => {
        await tx.meetingParticipant.updateMany({
          where: { meetingId, userId },
          data: { status: "CANCELLED", cancelledAt: now, leaveNote: reason },
        });
        if (isOneOnOne) {
          await tx.meeting.update({ where: { id: meetingId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
          await restoreOneOnOneRights(tx, meeting.createdAt, others);
        }
      });
      if (isOneOnOne || now >= cancelDeadline(meeting.scheduledAt)) {
        for (const id of others) {
          await this.notifications.sendToUser(id, { ...notice, data: { type: "PARTICIPANT_LEFT", meetingId } });
        }
      }
      if (isOneOnOne) {
        cancelled.push(meetingId);
        for (const id of others) await enqueueAssign(this.assignQueue, id);
      }
    }
    return cancelled;
  }

  // Yarım masaları birleştirme: bir masanın TÜM kişileri aynı şehirdeki diğer masalara (cinsiyet sınırı, engel,
  // saate göre mekan uyumu) yerleşebiliyorsa taşınır ve boşalan masa iptal edilir. Kısmi taşıma yapılmaz.
  // En küçük masadan başlanır, kişiler en dolu uygun masaya gider; değişiklik kalmayana kadar tekrarlanır.
  private async mergeGroupTables(ctx: AssignContext): Promise<void> {
    for (let changed = true; changed; ) {
      changed = false;
      const meetings = await this.prisma.meeting.findMany({
        where: { ...this.poolScope(ctx).meeting, type: MeetingType.GROUP, status: "PENDING" },
        select: {
          id: true,
          cityId: true,
          participants: {
            where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
            select: { id: true, user: { select: ELIGIBLE_SELECT } },
          },
        },
      });
      const tables = meetings.map((m) => ({
        id: m.id,
        cityId: m.cityId,
        members: m.participants.map((p) => ({ participantId: p.id, user: p.user as unknown as EligibleUser })),
      }));

      for (const source of [...tables].sort((a, b) => a.members.length - b.members.length)) {
        if (source.members.length === 0 || source.members.length >= TABLE_SIZE_LARGE) continue;
        const targets = tables
          .filter((t) => t.id !== source.id && t.cityId === source.cityId && t.members.length >= source.members.length)
          .map((t) => ({ id: t.id, users: t.members.map((m) => m.user) }));
        if (targets.length === 0) continue;

        const moves: { participantId: string; meetingId: string }[] = [];
        for (const { participantId, user } of source.members) {
          const blocked = await this.blockedIds(user, targets.flatMap((t) => t.users));
          const gender = user.profile?.gender;
          const target = targets
            .filter((t) =>
              languageCompatible([user, ...t.users]) &&
              t.users.length < TABLE_SIZE_LARGE &&
              t.users.filter((u) => u.profile?.gender === gender).length < TABLE_SIZE_LARGE / 2 &&
              t.users.every((u) => !blocked.has(u.id) && (!ctx.groupVenue || !this.areVenueIncompatible(user, u))),
            )
            .sort((a, b) => b.users.length - a.users.length)[0];
          if (!target) break;
          target.users.push(user);
          moves.push({ participantId, meetingId: target.id });
        }
        if (moves.length !== source.members.length) continue;

        await this.prisma.$transaction([
          ...moves.map((m) =>
            this.prisma.meetingParticipant.update({ where: { id: m.participantId }, data: { meetingId: m.meetingId } }),
          ),
          this.prisma.meeting.update({ where: { id: source.id }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
        ]);
        for (const id of new Set(moves.map((m) => m.meetingId))) await this.saveScores(id);
        this.logger.log(`Masa birleştirildi: meeting=${source.id} → ${[...new Set(moves.map((m) => m.meetingId))].join(", ")}`);
        changed = true;
        break;
      }
    }
  }

  // Engelli kişiler (iki yönlü kullanıcı engeli + rehber engeli) hiçbir saatte aynı masaya düşmez
  private async blockedIds(user: EligibleUser, others: EligibleUser[]): Promise<Set<string>> {
    const result = new Set<string>();
    const ids = others.map((o) => o.id);
    if (ids.length === 0) return result;

    const pairs = await this.prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: user.id, blockedId: { in: ids } },
          { blockedId: user.id, blockerId: { in: ids } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    });
    for (const p of pairs) result.add(p.blockerId === user.id ? p.blockedId : p.blockerId);

    // Rehber engeli: ContactBlock.hashedPhone (adı eski) açık "+90XXXXXXXXXX" tutar, User.phone ile aynı formatta karşılaştırılır
    const myPhone = user.phone ? normalizePhone(user.phone) : null;
    for (const o of others) {
      if (o.phone) {
        const theirPhone = normalizePhone(o.phone);
        if (user.contactBlocks.some((cb) => normalizePhone(cb.hashedPhone) === theirPhone)) result.add(o.id);
      }
      if (myPhone && o.contactBlocks.some((cb) => normalizePhone(cb.hashedPhone) === myPhone)) result.add(o.id);
    }
    return result;
  }

  private async currentCycle() {
    const { week: weekNumber, year } = getISOWeekNumber(new Date());
    return this.prisma.matchingCycle.upsert({
      where: { weekNumber_year: { weekNumber, year } },
      update: {},
      create: { weekNumber, year, status: "RUNNING" },
    });
  }

  // ─── Kapanış botları (23:45–23:55 TR, masa başına rastgele an) ────────────

  // Perşembe 23:45: eksik grup masaları için bot işi planlanır; dengeli 4/6 masa bu sayıda kesinleşir
  async scheduleGroupBots(): Promise<void> {
    const cycle = await this.currentCycle();
    if (!cycle) return;
    const botSystemActive = await isBotSystemActive(this.prisma);

    const meetings = await this.prisma.meeting.findMany({
      where: { cycleId: cycle.id, type: MeetingType.GROUP, status: "PENDING" },
      select: {
        id: true,
        participants: {
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          select: { user: { select: { isBot: true, profile: { select: { gender: true } } } } },
        },
      },
    });

    for (const meeting of meetings) {
      const count = meeting.participants.length;
      // 1-2 kişi: bot yok, kapanışta (23:59) masa iptal
      if (count < TABLE_SIZE_SMALL - 1) continue;
      // Masaya en fazla 1 bot
      if (meeting.participants.some((p) => p.user.isBot)) continue;
      const males = meeting.participants.filter((p) => p.user.profile?.gender === Gender.MALE).length;
      const need = groupBotNeed(males, count - males);
      if (!need) continue;
      if (need.male + need.female === 0) {
        await this.prisma.meeting.update({ where: { id: meeting.id }, data: { maxParticipants: count } });
        continue;
      }
      if (!botSystemActive) continue;
      await this.assignQueue.add(
        JOB_GROUP_BOTS,
        { meetingId: meeting.id },
        { delay: randomBotDelayMs(), removeOnComplete: true, removeOnFail: 100 },
      );
    }
  }

  // Eksik cinsiyette tek bot: 3 → 4, 5 → 6 (masaya en fazla 1 bot). Yanlış cinsiyet ASLA eklenmez;
  // bot bulunamazsa eklenmez, SUPERADMIN'e uyarı düşer. Eklenen bot sayısını döner.
  async addGroupBots(meetingId: string): Promise<number> {
    if (!(await isBotSystemActive(this.prisma))) return 0;
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        cityId: true,
        participants: {
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          select: { userId: true, user: { select: { isBot: true, profile: { select: { gender: true } } } } },
        },
      },
    });
    if (!meeting || meeting.status !== "PENDING") return 0;
    const count = meeting.participants.length;
    if (count < TABLE_SIZE_SMALL - 1) return 0;
    // Masaya en fazla 1 bot
    if (meeting.participants.some((p) => p.user.isBot)) return 0;
    const males = meeting.participants.filter((p) => p.user.profile?.gender === Gender.MALE).length;
    const females = count - males;
    const need = groupBotNeed(males, females);
    if (!need || need.male + need.female === 0) return 0;

    const botIds: string[] = [];
    // Masadaki gerçek kullanıcılardan biriyle son 28 günde aynı masada bulunmuş bot seçilmez
    const recentBots = await recentlyMetBotIds(this.prisma, meeting.participants.filter((p) => !p.user.isBot).map((p) => p.userId));
    const wanted: [Gender, number][] = [[Gender.MALE, need.male], [Gender.FEMALE, need.female]];
    for (const [gender, n] of wanted) {
      for (let i = 0; i < n; i++) {
        const bot = await pickBot(this.prisma, { gender, scheduledAt: meeting.scheduledAt, cityId: meeting.cityId, excludeIds: [...botIds, ...recentBots] });
        if (!bot) {
          await alertBotNotFound(this.prisma, meeting.participants[0].userId);
          this.logger.warn(`Uygun bot bulunamadı: meeting=${meeting.id} (${males}E+${females}K)`);
          return 0;
        }
        botIds.push(bot.id);
      }
    }

    await this.prisma.$transaction([
      this.prisma.meetingParticipant.createMany({
        data: botIds.map((userId) => ({ meetingId, userId, status: "INVITED" as const })),
      }),
      this.prisma.meeting.update({ where: { id: meetingId }, data: { maxParticipants: count + botIds.length } }),
    ]);
    await this.saveScores(meetingId);
    await this.botAssigned(meetingId, botIds);
    this.logger.log(`Bot eklendi: meeting=${meetingId} (${count}→${count + botIds.length})`);
    return botIds.length;
  }

  // Bot atama uyarısı + SUPERADMIN bildirimi; hata atamayı geri almaz, yalnız loglanır
  async botAssigned(meetingId: string, botIds: string[]): Promise<void> {
    try {
      await notifyBotAssigned(this.prisma, (id, payload) => this.notifications.sendToUser(id, payload), meetingId, botIds);
    } catch (err) {
      this.logger.error(`Bot atama bildirimi hatası: meeting=${meetingId} ${err}`);
    }
  }

  // ─── Perşembe kapanışı ────────────────────────────────────────────────────

  async runThursdayClosing(): Promise<void> {
    const now = new Date();
    const { week: weekNumber, year } = getISOWeekNumber(now);
    const cycle = await this.prisma.matchingCycle.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });
    if (!cycle || cycle.status === "COMPLETED") return;

    // Botlar 23:45–23:55 arasında eklendi (scheduleGroupBots); burada sadece 1-2 kişi kalan masalar iptal edilir
    const pendingGroupMeetings = await this.prisma.meeting.findMany({
      where: { cycleId: cycle.id, type: MeetingType.GROUP, status: "PENDING" },
      include: {
        participants: {
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          select: { userId: true, createdAt: true, user: { select: { profile: { select: { gender: true } } } } },
        },
      },
    });

    for (const meeting of pendingGroupMeetings) {
      // Sadece aktif katılımcılar sayılır (iptal eden / gelmeyen sandalye tutmaz)
      const count = meeting.participants.length;
      if (count < TABLE_SIZE_SMALL - 1) {
        // 1-2 kişi → iptal et, bir sonraki haftaya taşı
        await this.prisma.meeting.update({ where: { id: meeting.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
        for (const p of meeting.participants) {
          const { week: nw, year: ny } = getISOWeekNumber(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
          const nextCycle = await this.prisma.matchingCycle.upsert({
            where: { weekNumber_year: { weekNumber: nw, year: ny } },
            update: {},
            create: { weekNumber: nw, year: ny, status: "RUNNING" },
          });
          await this.prisma.matchingWaitlist.upsert({
            where: { userId_cycleId: { userId: p.userId, cycleId: nextCycle.id } },
            update: {},
            create: { userId: p.userId, cycleId: nextCycle.id, reason: "ODD_NUMBER" },
          });
        }
        this.logger.log(`Masa iptal (yetersiz katılım): meeting=${meeting.id}`);
      }
      // "5 kişi kalırsa 4'e düşür" kuralı kaldırıldı
    }

    // Eşleşmemiş kullanıcıları bir sonraki haftaya taşı
    const matchedUserIds = new Set(
      (await this.prisma.meetingParticipant.findMany({
        where: { meeting: { cycleId: cycle.id, status: { in: ["PENDING", "ACTIVE"] } } },
        select: { userId: true },
      })).map((p) => p.userId),
    );

    const groupEligible = await this.fetchEligible(cycle.id, [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE], false);
    const oneOnOneEligible = await this.fetchEligible(cycle.id, [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE], true);
    const allEligible = [...new Set([...groupEligible, ...oneOnOneEligible].map((u) => u.id))];
    const unmatched = allEligible.filter((id) => !matchedUserIds.has(id));

    for (const userId of unmatched) {
      const nw = getISOWeekNumber(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
      const nextCycle = await this.prisma.matchingCycle.upsert({
        where: { weekNumber_year: { weekNumber: nw.week, year: nw.year } },
        update: {},
        create: { weekNumber: nw.week, year: nw.year, status: "RUNNING" },
      });
      await this.prisma.matchingWaitlist.upsert({
        where: { userId_cycleId: { userId, cycleId: nextCycle.id } },
        update: {},
        create: { userId, cycleId: nextCycle.id, reason: "ODD_NUMBER" },
      });
    }

    // Perşembe 23:59'da hiçbir kullanıcıya bildirim gitmez (CLAUDE.md MASA BİLDİRİM AKIŞI)

    await this.prisma.matchingCycle.update({ where: { id: cycle.id }, data: { status: "COMPLETED" } });
    this.logger.log(`Perşembe kapanışı: ${unmatched.length} kullanıcı bekliste`);
  }

  // ─── Yarın Buluşma kilidi (her gece 23:59 TR, atama kuyruğunda) ───────────
  // Ertesi gün 20:00 Yarın masaları kilitlenir:
  // - Grup: 3 / 5 kişilik masaya 1 bot (masaya en fazla 1 bot); dolu sayılan masa (6 kişi 3E+3K ya da botla 4'e tamamlanan
  //   2E+2K) kurulur ve her katılımcının 1 grup hakkı düşer; kurulamayan masa iptal olur.
  // - Baş Başa: 2 kişilik masa kurulur, iki kişinin baş başa hakkı düşer; tek kişilik masa iptal olur (Yarın'da bot yok).
  // - Kankamla: kurulan (4 kişilik) masada çiftin paketinden 1 hak düşer.
  // Masası kurulamayan Yarın kaydı en yakın Planlı gününe aktarılır (Grup → Cuma, Baş Başa → Cumartesi, Kankamla → Pazar;
  // o haftanın Planlı son saati geçtiyse bir sonraki hafta). İade yok; hak Planlı masada mevcut kurala göre düşer.
  async runTomorrowLock(): Promise<void> {
    const now = new Date();
    const meetingAt = nextDayMeetingAt(now);
    const LEFT_STATUSES: ParticipantStatus[] = ["CANCELLED", "DECLINED", "NO_SHOW"];
    const meetings = await this.prisma.meeting.findMany({
      where: { mode: MeetingMode.TOMORROW, scheduledAt: meetingAt, status: "PENDING" },
      select: { id: true, type: true, createdAt: true },
    });
    const activeOf = (meetingId: string) => this.prisma.meetingParticipant.findMany({
      where: { meetingId, status: { notIn: LEFT_STATUSES } },
      select: { id: true, userId: true, kankaPartnerId: true, kankaRightSubId: true, user: { select: { isBot: true, profile: { select: { gender: true } } } } },
    });

    let formed = 0;
    let cancelled = 0;
    for (const meeting of meetings) {
      if (meeting.type === MeetingType.GROUP) {
        await this.addGroupBots(meeting.id);
        const people = await activeOf(meeting.id);
        const males = people.filter((p) => p.user.profile?.gender === Gender.MALE).length;
        const females = people.length - males;
        const full = (people.length === TABLE_SIZE_LARGE || people.length === TABLE_SIZE_SMALL) && males === females;
        if (!full) {
          await this.prisma.meeting.update({ where: { id: meeting.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
          cancelled++;
          continue;
        }
        await this.prisma.$transaction(async (tx) => {
          for (const p of people.filter((x) => !x.user.isBot)) {
            const sub = await tx.subscription.findFirst({ where: { userId: p.userId, ...OPEN_GROUP_SUB }, orderBy: { createdAt: "asc" }, select: { id: true } });
            if (!sub) continue;
            await tx.subscription.update({ where: { id: sub.id }, data: { groupRights: { decrement: 1 } } });
            await tx.meetingParticipant.update({ where: { id: p.id }, data: { groupRightSubId: sub.id } });
            await syncPackageStatus(tx, sub.id);
          }
        });
        formed++;
      } else if (meeting.type === MeetingType.ONE_ON_ONE) {
        const people = await activeOf(meeting.id);
        if (people.length < 2) {
          await this.prisma.meeting.update({ where: { id: meeting.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
          cancelled++;
          continue;
        }
        await this.prisma.$transaction((tx) => consumeOneOnOneRights(tx, people.filter((p) => !p.user.isBot).map((p) => p.userId), meeting.createdAt));
        formed++;
      } else {
        const people = await activeOf(meeting.id);
        await this.prisma.$transaction(async (tx) => {
          const done = new Set<string>();
          for (const p of people) {
            if (done.has(p.userId)) continue;
            const pairIds = [p.userId, ...(p.kankaPartnerId ? [p.kankaPartnerId] : [])];
            pairIds.forEach((id) => done.add(id));
            if (people.some((x) => pairIds.includes(x.userId) && x.kankaRightSubId)) continue;
            const sub = await pairKankaSub(tx, pairIds);
            if (!sub) continue;
            const buyer = people.find((x) => x.userId === sub.userId) ?? p;
            await chargeKankaRight(tx, buyer.id, sub.id);
          }
        });
        formed++;
      }
    }

    // Masası kurulamayan Yarın kayıtları Planlı'ya aktarılır
    const selections = await this.prisma.weeklySelection.findMany({
      where: { mode: MeetingMode.TOMORROW, meetingDate: meetingAt },
      select: { id: true, userId: true, type: true },
    });
    const transferredUsers = new Set<string>();
    for (const sel of selections) {
      const seated = await this.prisma.meetingParticipant.count({
        where: {
          userId: sel.userId,
          status: { notIn: LEFT_STATUSES },
          meeting: { mode: MeetingMode.TOMORROW, scheduledAt: meetingAt, type: sel.type, status: { in: ["PENDING", "ACTIVE"] } },
        },
      });
      if (seated > 0) continue;
      const { week, year } = plannedTargetWeek(sel.type, now);
      await this.prisma.weeklySelection.update({
        where: { id: sel.id },
        data: { mode: MeetingMode.PLANNED, meetingDate: null, year, weekNumber: week, transferredAt: now },
      });
      transferredUsers.add(sel.userId);
    }
    // Aktarılanlar Planlı taramasına girer (Planlı penceresi açıksa)
    for (const userId of transferredUsers) await enqueueAssign(this.assignQueue, userId);
    this.logger.log(`Yarın kilidi: ${formed} masa kuruldu, ${cancelled} masa kurulamadı, ${transferredUsers.size} kişi Planlı'ya aktarıldı`);
  }

  // Yarın Buluşma kart açılışı (buluşma günü 10:00 TR): mekânı atanmış Yarın masalarına bildirim
  async sendTomorrowRevealNotifications(): Promise<void> {
    const meetings = await this.prisma.meeting.findMany({
      where: { mode: MeetingMode.TOMORROW, scheduledAt: todayMeetingAt(), status: { in: ["PENDING", "ACTIVE"] }, locationText: { not: null } },
      select: {
        id: true, scheduledAt: true,
        participants: { where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } }, select: { userId: true } },
      },
    });
    await this.activateRevealed(meetings.map((m) => m.id));
    for (const meeting of meetings) {
      for (const p of meeting.participants) {
        await this.notifications.notifyMeetingConfirmed(p.userId, meeting.id, meeting.scheduledAt);
      }
    }
    this.logger.log(`Yarın masası bildirimi: ${meetings.length} masa`);
  }

  // ─── Cumartesi bildirimleri ───────────────────────────────────────────────

  async sendGroupRevealNotifications(): Promise<void> {
    const now = new Date();
    const { week: weekNumber, year } = getISOWeekNumber(now);
    const cycle = await this.prisma.matchingCycle.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });
    if (!cycle) return;

    const meetings = await this.prisma.meeting.findMany({
      where: {
        cycleId: cycle.id,
        type: MeetingType.GROUP, // başbaşa masalar Cumartesi 10:00'da bildirilir
        status: { in: ["PENDING", "ACTIVE"] },
        locationText: { not: null },
      },
      include: {
        participants: {
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          select: {
            userId: true,
            user: { select: { profile: { select: { firstName: true, lastName: true, gender: true } } } },
          },
        },
      },
    });

    await this.activateRevealed(meetings.map((m) => m.id));
    for (const meeting of meetings) {
      const participantInitials = meeting.participants.map((p) => {
        const f = p.user.profile?.firstName?.[0] ?? "?";
        const l = p.user.profile?.lastName?.[0] ?? "?";
        const g = p.user.profile?.gender === "MALE" ? "E" : p.user.profile?.gender === "FEMALE" ? "K" : "";
        return g ? `${f}.${l}. (${g})` : `${f}.${l}.`;
      });

      for (const p of meeting.participants) {
        await this.notifications.notifyMeetingConfirmed(p.userId, meeting.id, meeting.scheduledAt);
      }
      this.logger.log(`Grup masası bildirimi: meeting=${meeting.id} (${participantInitials.join(", ")})`);
    }
  }

  // ─── Yardımcılar ──────────────────────────────────────────────────────────

  private fetchEligible(cycleId: string, plans: SubscriptionPlan[], oneOnOne: boolean, userIds?: string[]): Promise<EligibleUser[]> {
    return this.eligible(this.plannedScope(cycleId), plans, oneOnOne, userIds);
  }

  private async eligible(
    scope: PoolScope,
    plans: SubscriptionPlan[],
    oneOnOne: boolean,
    userIds?: string[],
  ): Promise<EligibleUser[]> {
    const type = oneOnOne ? MeetingType.ONE_ON_ONE : MeetingType.GROUP;
    return this.prisma.user.findMany({
      where: {
        ...(userIds ? { id: { in: userIds } } : {}),
        status: "ACTIVE",
        isBot: false,
        oceanScore: { isNot: null },
        kyc: { status: KycStatus.APPROVED },
        // Paketin o kısmı açık olmalı (hak kalmış) ve kişi bu kapsamda bu türü seçmiş olmalı (weekly-selection.ts)
        subscriptions: { some: { ...(oneOnOne ? OPEN_ONE_ON_ONE_SUB : OPEN_GROUP_SUB), plan: { in: plans } } },
        ...scope.selected(type),
        // Bu kapsamda (Planlı hafta / Yarın günü) aynı türde aktif masası olan ya da masadan çıkarılan havuza girmez.
        // Kendi seçim iptali (leaveReason dolu) yeniden kayıt olmayı engellemez.
        participations: {
          none: {
            OR: [
              { meeting: { ...scope.meeting, status: { in: ["PENDING", "ACTIVE"] }, type } },
              { ...notSelfCancelled, meeting: { ...scope.meeting, type } },
            ],
          },
        },
      },
      select: ELIGIBLE_SELECT,
    }) as unknown as EligibleUser[];
  }

  private areAgeGapTooLarge(a: EligibleUser, b: EligibleUser): boolean {
    const ageA = ageYears(a.profile?.birthDate);
    const ageB = ageYears(b.profile?.birthDate);
    if (ageA === null || ageB === null) return false;
    return Math.abs(ageA - ageB) > MAX_AGE_GAP_YEARS;
  }

  // ALCOHOLIC ↔ NON_ALCOHOLIC çifti uyumsuz; NO_PREFERENCE her ikiyle de uyumlu
  private areVenueIncompatible(a: EligibleUser, b: EligibleUser): boolean {
    const pa = a.profile?.venuePreference ?? 'NO_PREFERENCE';
    const pb = b.profile?.venuePreference ?? 'NO_PREFERENCE';
    return (pa === 'ALCOHOLIC' && pb === 'NON_ALCOHOLIC') ||
           (pa === 'NON_ALCOHOLIC' && pb === 'ALCOHOLIC');
  }

  // Skor yazımı eşleşmeyi durdurmaz: hata olursa masa kurulu kalır
  private async saveScores(meetingId: string): Promise<void> {
    await writeSeatScores(this.prisma, meetingId).catch((e) => this.logger.warn(`matchScore yazılamadı: meeting=${meetingId} ${e}`));
  }

  private scoreTwo(a: EligibleUser, b: EligibleUser): number {
    return matchScore(a, b);
  }

  // ─── Bot yönetimi ─────────────────────────────────────────────────────────

  // Bot kullanım sayacı (yalnız SUPERADMIN): buluşma haftasına (Pazartesi 00:00 – Pazar 23:59 TR) göre, en az bir aktif
  // bot katılımcısı olan ve iptal edilmemiş masa sayısı. Bu hafta + son 8 hafta (bu hafta dahil), en yeni en üstte.
  async botUsage() {
    const thisWeek = trWeekStart();
    const from = new Date(thisWeek.getTime() - 7 * WEEK_MS);
    const left = ["CANCELLED", "DECLINED", "NO_SHOW"] as const;
    const meetings = await this.prisma.meeting.findMany({
      where: {
        status: { not: "CANCELLED" },
        scheduledAt: { gte: from, lt: new Date(thisWeek.getTime() + WEEK_MS) },
        participants: { some: { user: { isBot: true }, status: { notIn: [...left] } } },
      },
      select: { scheduledAt: true },
    });
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const start = new Date(thisWeek.getTime() - i * WEEK_MS);
      const end = new Date(start.getTime() + WEEK_MS);
      const count = meetings.filter((m) => m.scheduledAt >= start && m.scheduledAt < end).length;
      return { start: start.toISOString(), end: new Date(end.getTime() - 1).toISOString(), count };
    });
    return { thisWeek: weeks[0].count, weeks };
  }

  async listBots() {
    const bots = await this.prisma.user.findMany({
      where: { isBot: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, status: true, email: true, botPhone: true, occupationSector: true,
        profile: { select: { firstName: true, lastName: true, gender: true, birthDate: true, primaryCity: true } },
        oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
      },
    });
    // Bot profil fotoğrafı (onaysız, yüklendiği anda APPROVED)
    const photos = await approvedPhotoMap(this.prisma, bots.map((b) => b.id));
    return bots.map((b) => ({ ...b, photoUrl: photos.get(b.id) ?? null }));
  }

  // Durumu Yakında olan şehir (isComingSoon) eşleştirmeye / taramaya girmez
  private async isComingSoonCity(cityId: string): Promise<boolean> {
    const city = await this.prisma.city.findFirst({ where: { OR: [{ id: cityId }, { name: cityId }] }, select: { isActive: true, isComingSoon: true } });
    return !!city && !city.isActive && city.isComingSoon;
  }

  // Bot şehri katılım şehridir (primaryCity = City.id); aktif şehir olmalı
  private async assertBotCity(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { isActive: true } });
    if (!city?.isActive) throw new BadRequestException("Seçilen şehir aktif değil");
  }

  private botOcean(dto: BotDto) {
    return {
      openness: dto.openness,
      conscientiousness: dto.conscientiousness,
      extraversion: dto.extraversion,
      agreeableness: dto.agreeableness,
      neuroticism: dto.neuroticism,
    };
  }

  async updateBot(botId: string, dto: BotDto) {
    const bot = await this.prisma.user.findFirst({ where: { id: botId, isBot: true } });
    if (!bot) throw new NotFoundException("Bot bulunamadı");
    await this.assertBotCity(dto.cityId);
    const profile = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender as Gender,
      birthDate: new Date(dto.birthDate),
      primaryCity: dto.cityId,
    };
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: botId },
        data: { botPhone: dto.phone, occupationSector: dto.occupationSector },
      }),
      this.prisma.profile.upsert({
        where: { userId: botId },
        update: profile,
        create: { userId: botId, ...profile, isPublic: false },
      }),
      this.prisma.oceanScore.upsert({
        where: { userId: botId },
        update: this.botOcean(dto),
        create: { userId: botId, ...this.botOcean(dto) },
      }),
    ]);
    return { id: botId };
  }

  async setBotStatus(botId: string, active: boolean) {
    const bot = await this.prisma.user.findFirst({ where: { id: botId, isBot: true } });
    if (!bot) throw new NotFoundException("Bot bulunamadı");
    return this.prisma.user.update({
      where: { id: botId },
      data: { status: active ? "ACTIVE" : "SUSPENDED" },
      select: { id: true, status: true },
    });
  }

  async createBot(dto: BotDto) {
    await this.assertBotCity(dto.cityId);
    // Sıradan kullanıcı gibi görünen sıralı adres: denge1@ahenk.co, denge2@ahenk.co …
    const existing = await this.prisma.user.findMany({
      where: { email: { startsWith: "denge", endsWith: "@ahenk.co" } },
      select: { email: true },
    });
    const idx = existing.reduce((max, u) => {
      const n = Number(u.email.slice("denge".length, -"@ahenk.co".length));
      return Number.isInteger(n) && n > max ? n : max;
    }, 0) + 1;
    // Telefon gerçek telefon alanına değil botPhone'a yazılır: bildirim gitmez, kayıt çakışmaz
    const bot = await this.prisma.user.create({
      data: {
        email: `denge${idx}@ahenk.co`,
        passwordHash: "bot-no-login",
        isBot: true,
        emailVerified: true,
        botPhone: dto.phone,
        occupationSector: dto.occupationSector,
        profile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            gender: dto.gender as Gender,
            birthDate: new Date(dto.birthDate),
            primaryCity: dto.cityId,
            isPublic: false,
          },
        },
        oceanScore: { create: this.botOcean(dto) },
      },
    });
    return { id: bot.id, email: bot.email };
  }

  async deleteBot(botId: string) {
    const bot = await this.prisma.user.findFirst({ where: { id: botId, isBot: true } });
    if (!bot) throw new NotFoundException("Bot bulunamadı");
    // Masa katılım satırları cascade ile silinmesin: aktif masası olan bot silinmez, geçmişi olan pasifleştirilir
    const active = await this.prisma.meetingParticipant.count({
      where: { userId: botId, meeting: { status: { in: ["PENDING", "ACTIVE"] } } },
    });
    if (active > 0) throw new BadRequestException("Aktif masası olan bot silinemez.");
    const past = await this.prisma.meetingParticipant.count({ where: { userId: botId } });
    if (past > 0) {
      // Bot pasif alanı: User.status (setBotStatus ile aynı: SUSPENDED = pasif)
      await this.prisma.user.update({ where: { id: botId }, data: { status: "SUSPENDED" } });
      return { deleted: false, deactivated: true, id: botId };
    }
    await this.prisma.user.delete({ where: { id: botId } });
    // Profil fotoğrafı kayıtları cascade ile silinir; dosyaları da kaldırılır
    fs.rmSync(path.join(PROFILE_PHOTO_DIR, botId), { recursive: true, force: true });
    return { deleted: true, id: botId };
  }

}
