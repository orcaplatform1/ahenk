import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import type { BotDto } from "./dto/update-bot.dto";
import { PrismaService } from "../prisma/prisma.service";
import { isBotSystemActive, isMaintenanceMode } from "../admin/app-settings";
import { NotificationService } from "../notification/notification.service";
import {
  WEIGHTS,
  OCEAN_MAX_DISTANCE,
  TABLE_SIZE_LARGE,
  TABLE_SIZE_SMALL,
  MEETING_HOUR_UTC,
} from "./matching.constants";
import { Gender, MeetingType, UserStatus, SubscriptionPlan, KycStatus, Prisma } from "@prisma/client";
import { pickBot, alertBotNotFound, availableBots } from "./bot-picker";
import { consumeOneOnOneRights } from "./one-on-one-right";
import { ASSIGN_QUEUE, JOB_SCAN_POOL, JOB_GROUP_BOTS, JOB_ONE_ON_ONE_BOT, randomBotDelayMs } from "./assign-queue";

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

type AssignContext = {
  cycleId: string;
  weekNumber: number;
  groupOpen: boolean;
  oneOnOneOpen: boolean;
  groupOcean: boolean;   // Perşembe 12:00'ye kadar OCEAN uyumu
  groupVenue: boolean;   // Perşembe 18:00'e kadar mekan uyumu
  oneOnOneSoft: boolean; // Cuma 10:00'a kadar OCEAN + mekan uyumu
};

// Atama son anı 23:44 (TR); 23:45'ten itibaren sadece kapanış botları
const ASSIGN_CUTOFF_MIN = 23 * 60 + 45;
const GROUP_PLANS = [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE];
const ONE_ON_ONE_PLANS = [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE];
// Başbaşa yaş farkı sınırı — hiçbir saatte kalkmaz
const MAX_AGE_GAP_YEARS = 8;

const ELIGIBLE_SELECT = {
  id: true,
  isBot: true,
  status: true,
  phone: true,
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

function nextSaturdayAt(hourUTC: number): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now);
  sat.setUTCDate(now.getUTCDate() + daysUntilSat);
  sat.setUTCHours(hourUTC, 0, 0, 0);
  return sat;
}

// Başbaşa buluşma: haftanın Pazar günü (Pazar günü çağrılırsa bir sonraki Pazar)
function nextSundayAt(hourUTC: number): Date {
  const now = new Date();
  const daysUntilSun = (7 - now.getUTCDay()) % 7 || 7;
  const sun = new Date(now);
  sun.setUTCDate(now.getUTCDate() + daysUntilSun);
  sun.setUTCHours(hourUTC, 0, 0, 0);
  return sun;
}

// TR saatiyle gün (0=Pazar … 6=Cumartesi) ve gün içindeki dakika
function trClock(date: Date): { day: number; minutes: number } {
  const tr = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return { day: tr.getUTCDay(), minutes: tr.getUTCHours() * 60 + tr.getUTCMinutes() };
}

// Kullanıcının eşleştirme şehri: aktif şehir seçtiyse o, yoksa ana şehir. Şehri olmayan eşleştirmeye alınmaz.
function matchCity(user: EligibleUser): string | null {
  return user.activeCity ?? user.profile?.primaryCity ?? null;
}

function ageYears(birthDate: string | Date | null | undefined): number | null {
  if (!birthDate) return null;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
}

// Masa adı: "İstanbul Grup 44" = o şehirdeki 44. grup masası (haftalık değil, şehir + türe göre sıra).
// Atamalar kuyrukta tek tek çalıştığı için sıra numarası çakışmaz.
async function tableTitle(
  db: Pick<PrismaService, "city" | "meeting"> | Prisma.TransactionClient,
  cityId: string,
  type: MeetingType,
): Promise<string> {
  const [city, count] = await Promise.all([
    db.city.findUnique({ where: { id: cityId }, select: { name: true } }),
    db.meeting.count({ where: { cityId, type } }),
  ]);
  return `${city?.name ?? ""} ${type === MeetingType.GROUP ? "Grup" : "Başbaşa"} ${count + 1}`.trim();
}

// Grup kapanışında dengeyi tamamlayan bot sayısı: önce 2E+2K, sığmazsa 3E+3K hedeflenir
// (2E+1K → 1 K, 3E+2K → 1 K, 3E+1K → 2 K, 3E+0K → 3 K)
function groupBotNeed(males: number, females: number): { male: number; female: number } | null {
  for (const size of [TABLE_SIZE_SMALL, TABLE_SIZE_LARGE]) {
    const half = size / 2;
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

  async assignUser(userId: string): Promise<void> {
    const ctx = await this.assignContext();
    if (!ctx) return;
    if (ctx.groupOpen) {
      const [user] = await this.fetchEligible(ctx.cycleId, GROUP_PLANS, false, [userId]);
      if (user) await this.assignGroup(ctx, user);
    }
    if (ctx.oneOnOneOpen) {
      const [user] = await this.fetchEligible(ctx.cycleId, ONE_ON_ONE_PLANS, true, [userId]);
      if (user) await this.assignOneOnOne(ctx, user);
    }
  }

  async scanPool(): Promise<void> {
    const ctx = await this.assignContext();
    if (!ctx) return;
    if (ctx.groupOpen) {
      for (const user of await this.fetchEligible(ctx.cycleId, GROUP_PLANS, false)) {
        await this.assignGroup(ctx, user);
      }
      await this.mergeGroupTables(ctx);
    }
    if (ctx.oneOnOneOpen) {
      let pool = await this.fetchEligible(ctx.cycleId, ONE_ON_ONE_PLANS, true);
      for (const user of [...pool]) {
        if (!pool.some((u) => u.id === user.id)) continue;
        const partnerId = await this.assignOneOnOne(ctx, user, pool);
        if (partnerId) pool = pool.filter((u) => u.id !== user.id && u.id !== partnerId);
      }
    }
  }

  // Atama açık mı + saate göre hangi filtreler geçerli (TR saati)
  private async assignContext(): Promise<AssignContext | null> {
    const matchingEnabled = await this.prisma.appConfig.findUnique({ where: { key: "MATCHING_ENABLED" } });
    if (matchingEnabled?.value === "false") return null;
    // Bakım modunda atama yapılmaz
    if (await isMaintenanceMode(this.prisma)) return null;

    const now = new Date();
    const { day, minutes } = trClock(now);
    // Grup Pazartesi – Perşembe 23:44, Başbaşa Pazartesi – Cuma 23:44
    const groupOpen = (day >= 1 && day <= 3) || (day === 4 && minutes < ASSIGN_CUTOFF_MIN);
    const oneOnOneOpen = (day >= 1 && day <= 4) || (day === 5 && minutes < ASSIGN_CUTOFF_MIN);
    if (!groupOpen && !oneOnOneOpen) return null;

    const { week: weekNumber, year } = getISOWeekNumber(now);
    const cycle = await this.prisma.matchingCycle.upsert({
      where: { weekNumber_year: { weekNumber, year } },
      update: {},
      create: { weekNumber, year, status: "RUNNING" },
    });

    return {
      cycleId: cycle.id,
      weekNumber,
      groupOpen,
      oneOnOneOpen,
      groupOcean: !(day === 4 && minutes >= 12 * 60),
      groupVenue: !(day === 4 && minutes >= 18 * 60),
      oneOnOneSoft: !(day === 5 && minutes >= 10 * 60),
    };
  }

  // GRUP: masa ilk kişiyle (6 hedefli) açılır; yeni gelen aynı şehirde kendi cinsiyeti eksik (en fazla 3E/3K)
  // en dolu masaya oturur. Eksik masa kalmadıysa yeni masa açılır.
  // Cinsiyet + şehir + engel hiç kalkmaz; mekan uyumu Perşembe 18:00'e, OCEAN Perşembe 12:00'ye kadar.
  private async assignGroup(ctx: AssignContext, user: EligibleUser): Promise<void> {
    const cityId = matchCity(user);
    const gender = user.profile?.gender;
    if (!cityId || !gender) return;

    const meetings = await this.prisma.meeting.findMany({
      where: { cycleId: ctx.cycleId, cityId, type: MeetingType.GROUP, status: "PENDING" },
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
      members.length < TABLE_SIZE_LARGE &&
      members.filter((u) => u.profile?.gender === gender).length < TABLE_SIZE_LARGE / 2 &&
      members.every((u) => !blocked.has(u.id) && (!ctx.groupVenue || !this.areVenueIncompatible(user, u))),
    );
    // Masa doldurarak gidilir: en dolu masa önce; eşitlikte (Perşembe 12:00'ye kadar) OCEAN uyumu yüksek olan
    const avgScore = (members: EligibleUser[]) =>
      members.reduce((sum, u) => sum + this.scoreTwo(user, u), 0) / Math.max(1, members.length);
    fits.sort((a, b) =>
      b.members.length - a.members.length || (ctx.groupOcean ? avgScore(b.members) - avgScore(a.members) : 0),
    );

    const target = fits[0];
    if (target) {
      await this.prisma.meetingParticipant.create({
        data: { meetingId: target.id, userId: user.id, status: "INVITED" },
      });
      this.logger.log(`Grup ataması: user=${user.id} → meeting=${target.id} (${target.members.length + 1}/${TABLE_SIZE_LARGE})`);
      return;
    }

    const meeting = await this.prisma.meeting.create({
      data: {
        cycleId: ctx.cycleId,
        cityId,
        type: MeetingType.GROUP,
        title: await tableTitle(this.prisma, cityId, MeetingType.GROUP),
        scheduledAt: nextSaturdayAt(MEETING_HOUR_UTC),
        maxParticipants: TABLE_SIZE_LARGE,
        participants: { create: { userId: user.id, status: "INVITED" } },
      },
    });
    this.logger.log(`Yeni grup masası: meeting=${meeting.id} user=${user.id}`);
  }

  // BAŞBAŞA: masa asla tek kişiyle kurulmaz; karşı cinsten uygun kişi bulununca kurulur ve iki tarafın hakkı harcanır.
  // Karşı cins + şehir + en fazla 8 yaş farkı + engel hiç kalkmaz; OCEAN ve mekan uyumu Cuma 10:00'a kadar.
  // Birden fazla aday → yaşı en yakın olan. Kurulan masanın karşı tarafının id'sini döner.
  private async assignOneOnOne(ctx: AssignContext, user: EligibleUser, pool?: EligibleUser[]): Promise<string | null> {
    const cityId = matchCity(user);
    const gender = user.profile?.gender;
    if (!cityId || !gender) return null;

    const others = (pool ?? (await this.fetchEligible(ctx.cycleId, ONE_ON_ONE_PLANS, true))).filter(
      (u) =>
        u.id !== user.id &&
        matchCity(u) === cityId &&
        !!u.profile?.gender &&
        u.profile.gender !== gender &&
        !this.areAgeGapTooLarge(user, u) &&
        (!ctx.oneOnOneSoft || !this.areVenueIncompatible(user, u)),
    );
    const blocked = await this.blockedIds(user, others);
    const candidates = others.filter((u) => !blocked.has(u.id));
    if (candidates.length === 0) return null;

    const myAge = ageYears(user.profile?.birthDate);
    const ageDiff = (u: EligibleUser) => {
      const age = ageYears(u.profile?.birthDate);
      return myAge === null || age === null ? Number.MAX_SAFE_INTEGER : Math.abs(myAge - age);
    };
    candidates.sort((a, b) =>
      ageDiff(a) - ageDiff(b) || (ctx.oneOnOneSoft ? this.scoreTwo(user, b) - this.scoreTwo(user, a) : 0),
    );
    const partner = candidates[0];

    await this.prisma.$transaction(async (tx) => {
      await tx.meeting.create({
        data: {
          cycleId: ctx.cycleId,
          cityId,
          type: MeetingType.ONE_ON_ONE,
          title: await tableTitle(tx, cityId, MeetingType.ONE_ON_ONE),
          scheduledAt: nextSundayAt(MEETING_HOUR_UTC),
          maxParticipants: 2,
          participants: {
            createMany: { data: [user, partner].map((u) => ({ userId: u.id, status: "INVITED" as const })) },
          },
        },
      });
      // Başbaşa hakkı masa kurulduğu anda harcanır
      await consumeOneOnOneRights(tx, [user.id, partner.id]);
    });
    this.logger.log(`Başbaşa masası: ${user.id} + ${partner.id}`);
    return partner.id;
  }

  // Yarım masaları birleştirme: bir masanın TÜM kişileri aynı şehirdeki diğer masalara (cinsiyet sınırı, engel,
  // saate göre mekan uyumu) yerleşebiliyorsa taşınır ve boşalan masa iptal edilir. Kısmi taşıma yapılmaz.
  // En küçük masadan başlanır, kişiler en dolu uygun masaya gider; değişiklik kalmayana kadar tekrarlanır.
  private async mergeGroupTables(ctx: AssignContext): Promise<void> {
    for (let changed = true; changed; ) {
      changed = false;
      const meetings = await this.prisma.meeting.findMany({
        where: { cycleId: ctx.cycleId, type: MeetingType.GROUP, status: "PENDING" },
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
          this.prisma.meeting.update({ where: { id: source.id }, data: { status: "CANCELLED" } }),
        ]);
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

    // Rehber engeli: ContactBlock.hashedPhone düz "+90XXXXXXXXXX" tutar, User.phone ile karşılaştırılır
    for (const o of others) {
      if (o.phone && user.contactBlocks.some((cb) => cb.hashedPhone === o.phone)) result.add(o.id);
      if (user.phone && o.contactBlocks.some((cb) => cb.hashedPhone === user.phone)) result.add(o.id);
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
          select: { user: { select: { profile: { select: { gender: true } } } } },
        },
      },
    });

    for (const meeting of meetings) {
      const count = meeting.participants.length;
      // 1-2 kişi: bot yok, kapanışta (23:59) masa iptal
      if (count < TABLE_SIZE_SMALL - 1) continue;
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

  // Eksik cinsiyette bot: 3 → 4, 5 → 6, dengesiz 4 (3E+1K) → 6. Yanlış cinsiyet ASLA eklenmez;
  // gereken botların hepsi bulunamazsa hiçbiri eklenmez, SUPERADMIN'e uyarı düşer.
  async addGroupBots(meetingId: string): Promise<void> {
    if (!(await isBotSystemActive(this.prisma))) return;
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        participants: {
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          select: { userId: true, user: { select: { profile: { select: { gender: true } } } } },
        },
      },
    });
    if (!meeting || meeting.status !== "PENDING") return;
    const count = meeting.participants.length;
    if (count < TABLE_SIZE_SMALL - 1) return;
    const males = meeting.participants.filter((p) => p.user.profile?.gender === Gender.MALE).length;
    const females = count - males;
    const need = groupBotNeed(males, females);
    if (!need || need.male + need.female === 0) return;

    const botIds: string[] = [];
    const wanted: [Gender, number][] = [[Gender.MALE, need.male], [Gender.FEMALE, need.female]];
    for (const [gender, n] of wanted) {
      for (let i = 0; i < n; i++) {
        const bot = await pickBot(this.prisma, { gender, scheduledAt: meeting.scheduledAt, excludeIds: botIds });
        if (!bot) {
          await alertBotNotFound(this.prisma, meeting.participants[0].userId);
          this.logger.warn(`Uygun bot bulunamadı: meeting=${meeting.id} (${males}E+${females}K)`);
          return;
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
    this.logger.log(`Bot eklendi: meeting=${meetingId} (${count}→${count + botIds.length})`);
  }

  // Cuma 23:45: eşi bulunamayan ve 2. başbaşa haftasında olan (önceki başbaşa döngüsünde masası kurulamamış) kişiler
  async scheduleOneOnOneBots(): Promise<void> {
    if (!(await isBotSystemActive(this.prisma))) return;
    const cycle = await this.currentCycle();
    if (!cycle) return;
    const pool = await this.fetchEligible(cycle.id, ONE_ON_ONE_PLANS, true);
    if (pool.length === 0) return;

    const subs = await this.prisma.subscription.findMany({
      where: {
        userId: { in: pool.map((u) => u.id) },
        status: "ACTIVE",
        usedAt: null,
        plan: { in: ONE_ON_ONE_PLANS },
        missedOneonOneCycles: { gte: 1 },
      },
      select: { userId: true },
    });
    for (const userId of new Set(subs.map((s) => s.userId))) {
      await this.assignQueue.add(
        JOB_ONE_ON_ONE_BOT,
        { userId },
        { delay: randomBotDelayMs(), removeOnComplete: true, removeOnFail: 100 },
      );
    }
  }

  // Karşı cinsten, yaşı en yakın bot (yaş farkı en fazla 8); yoksa SUPERADMIN'e uyarı, kişi kapanışta bekleme listesine
  async addOneOnOneBot(userId: string): Promise<void> {
    if (!(await isBotSystemActive(this.prisma))) return;
    const cycle = await this.currentCycle();
    if (!cycle) return;
    // Bu arada eşleşmiş ya da hakkı kalmamışsa listede çıkmaz
    const [user] = await this.fetchEligible(cycle.id, ONE_ON_ONE_PLANS, true, [userId]);
    const gender = user?.profile?.gender;
    const cityId = user ? matchCity(user) : null;
    if (!user || !gender || !cityId) return;

    const scheduledAt = nextSundayAt(MEETING_HOUR_UTC);
    const bot = await pickBot(this.prisma, {
      gender: gender === Gender.MALE ? Gender.FEMALE : Gender.MALE,
      scheduledAt,
      targetBirthDate: user.profile?.birthDate ? new Date(user.profile.birthDate) : null,
    });
    const myAge = ageYears(user.profile?.birthDate);
    const botAge = ageYears(bot?.birthDate);
    if (!bot || (myAge !== null && botAge !== null && Math.abs(myAge - botAge) > MAX_AGE_GAP_YEARS)) {
      await alertBotNotFound(this.prisma, user.id);
      this.logger.warn(`Uygun bot bulunamadı: ONE_ON_ONE user=${user.id}`);
      return;
    }

    await this.createOneOnOneBotMeeting(cycle, user.id, cityId, bot.id, scheduledAt);
  }

  private async createOneOnOneBotMeeting(
    cycle: { id: string; weekNumber: number },
    userId: string,
    cityId: string,
    botId: string,
    scheduledAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.meeting.create({
        data: {
          cycleId: cycle.id,
          cityId,
          type: MeetingType.ONE_ON_ONE,
          title: await tableTitle(tx, cityId, MeetingType.ONE_ON_ONE),
          scheduledAt,
          maxParticipants: 2,
          participants: {
            createMany: { data: [{ userId, status: "INVITED" }, { userId: botId, status: "INVITED" }] },
          },
        },
      });
      // Başbaşa hakkı masa kurulduğu anda harcanır
      await consumeOneOnOneRights(tx, [userId]);
    });
    this.logger.log(`ONE_ON_ONE bot eşleşmesi: user=${userId} bot=${botId}`);
  }

  // ─── Admin: başbaşada eşi bekleyenler (Açık masalar) ──────────────────────

  // Kaçıncı başbaşa döngüsünde olduğu: önceki döngülerde masası kurulamadıysa artar (1. döngüde bot eklenmez)
  async getOneOnOneWaiting() {
    const cycle = await this.currentCycle();
    const pool = await this.fetchEligible(cycle.id, ONE_ON_ONE_PLANS, true);
    if (pool.length === 0) return [];
    const ids = pool.map((u) => u.id);
    const cityIds = [...new Set(pool.map(matchCity).filter((c): c is string => !!c))];
    const [subs, cities] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { userId: { in: ids }, status: "ACTIVE", usedAt: null, plan: { in: ONE_ON_ONE_PLANS } },
        select: { userId: true, missedOneonOneCycles: true },
      }),
      this.prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, name: true } }),
    ]);
    return pool.map((u) => {
      const missed = Math.max(0, ...subs.filter((s) => s.userId === u.id).map((s) => s.missedOneonOneCycles));
      const cityId = matchCity(u);
      return {
        userId: u.id,
        initials: `${u.profile?.firstName?.[0] ?? "?"}.${u.profile?.lastName?.[0] ?? "?"}.`,
        gender: u.profile?.gender ?? null,
        age: ageYears(u.profile?.birthDate),
        city: cities.find((c) => c.id === cityId)?.name ?? null,
        cycleNo: missed + 1,
      };
    });
  }

  private async waitingUser(userId: string) {
    const cycle = await this.currentCycle();
    const [user] = await this.fetchEligible(cycle.id, ONE_ON_ONE_PLANS, true, [userId]);
    const gender = user?.profile?.gender;
    const cityId = user ? matchCity(user) : null;
    if (!user || !gender || !cityId) throw new BadRequestException("Kişi eşi bekleyenler listesinde değil");
    return { cycle, user, gender, cityId };
  }

  // Elle bot listesi: karşı cins, en fazla 8 yaş fark, Pazar buluşma saatinde boşta
  async botsForWaiting(userId: string) {
    const { user, gender } = await this.waitingUser(userId);
    const bots = await availableBots(this.prisma, {
      gender: gender === Gender.MALE ? Gender.FEMALE : Gender.MALE,
      scheduledAt: nextSundayAt(MEETING_HOUR_UTC),
    });
    const myAge = ageYears(user.profile?.birthDate);
    return bots
      .map((b) => ({ id: b.id, name: `${b.profile?.firstName ?? ""} ${b.profile?.lastName ?? ""}`.trim(), gender: b.profile?.gender ?? null, age: ageYears(b.profile?.birthDate) }))
      .filter((b) => myAge === null || b.age === null || Math.abs(myAge - b.age) <= MAX_AGE_GAP_YEARS)
      .sort((a, b) => (myAge === null || a.age === null || b.age === null ? 0 : Math.abs(myAge - a.age) - Math.abs(myAge - b.age)));
  }

  async addOneOnOneBotManual(userId: string, botId: string) {
    const { cycle, cityId } = await this.waitingUser(userId);
    const allowed = await this.botsForWaiting(userId);
    if (!allowed.some((b) => b.id === botId)) {
      throw new BadRequestException("Bu bot eklenemez (cinsiyet, yaş farkı ya da aynı saatte başka masada)");
    }
    await this.createOneOnOneBotMeeting(cycle, userId, cityId, botId, nextSundayAt(MEETING_HOUR_UTC));
    return { created: true };
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
          select: { userId: true },
        },
      },
    });

    for (const meeting of pendingGroupMeetings) {
      // Sadece aktif katılımcılar sayılır (iptal eden / gelmeyen koltuk tutmaz)
      const count = meeting.participants.length;
      if (count < TABLE_SIZE_SMALL - 1) {
        // 1-2 kişi → iptal et, bir sonraki haftaya taşı
        await this.prisma.meeting.update({ where: { id: meeting.id }, data: { status: "CANCELLED" } });
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

    // Grup masası kurulamayanlara (1-2 kişi kalıp iptal edilen masalar dahil) bildirim + WhatsApp
    for (const u of groupEligible) {
      await this.notifications.notifyMeetingNotFormed(u.id);
    }

    await this.prisma.matchingCycle.update({ where: { id: cycle.id }, data: { status: "COMPLETED" } });
    this.logger.log(`Perşembe kapanışı: ${unmatched.length} kullanıcı bekliste`);
  }

  // ─── Cumartesi bildirimleri ───────────────────────────────────────────────

  async sendSaturdayNotifications(): Promise<void> {
    const now = new Date();
    const { week: weekNumber, year } = getISOWeekNumber(now);
    const cycle = await this.prisma.matchingCycle.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });
    if (!cycle) return;

    const meetings = await this.prisma.meeting.findMany({
      where: {
        cycleId: cycle.id,
        type: MeetingType.GROUP, // başbaşa masalar Pazar 10:00'da bildirilir
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
      this.logger.log(`Cumartesi bildirimi: meeting=${meeting.id} (${participantInitials.join(", ")})`);
    }
  }

  // ─── Yardımcılar ──────────────────────────────────────────────────────────

  private async fetchEligible(
    cycleId: string,
    plans: SubscriptionPlan[],
    oneOnOne: boolean,
    userIds?: string[],
  ): Promise<EligibleUser[]> {
    return this.prisma.user.findMany({
      where: {
        ...(userIds ? { id: { in: userIds } } : {}),
        status: "ACTIVE",
        isBot: false,
        oceanScore: { isNot: null },
        kyc: { status: KycStatus.APPROVED },
        subscriptions: {
          some: {
            plan: { in: plans },
            status: "ACTIVE",
            ...(oneOnOne ? { usedAt: null } : {}),
          },
        },
        // Bu hafta aynı türde aktif masası olan ya da rezervasyonunu iptal eden havuza girmez
        // (İçerde: grubu iptal eden yalnızca gruba, başbaşayı iptal eden yalnızca başbaşaya giremez)
        participations: {
          none: {
            OR: [
              {
                meeting: {
                  cycleId,
                  status: { in: ["PENDING", "ACTIVE"] },
                  type: oneOnOne ? MeetingType.ONE_ON_ONE : MeetingType.GROUP,
                },
              },
              {
                status: "CANCELLED",
                meeting: { cycleId, type: oneOnOne ? MeetingType.ONE_ON_ONE : MeetingType.GROUP },
              },
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

  private scoreTwo(a: EligibleUser, b: EligibleUser): number {
    return (
      this.calcOcean(a.oceanScore, b.oceanScore) +
      this.calcOccupation(a.occupationSector, b.occupationSector)
    );
  }

  private calcOccupation(a: string | null, b: string | null): number {
    if (!a || !b) return 0;
    if (a === 'Öğrenci' || a === 'Diğer' || b === 'Öğrenci' || b === 'Diğer') return 0;
    return a === b ? WEIGHTS.OCCUPATION : 0;
  }

  private calcOcean(a: OceanScoreData | null, b: OceanScoreData | null): number {
    if (!a || !b) return WEIGHTS.OCEAN / 2;
    const d = Math.sqrt(
      (a.openness - b.openness) ** 2 +
      (a.conscientiousness - b.conscientiousness) ** 2 +
      (a.extraversion - b.extraversion) ** 2 +
      (a.agreeableness - b.agreeableness) ** 2 +
      (a.neuroticism - b.neuroticism) ** 2,
    );
    return (1 - d / OCEAN_MAX_DISTANCE) * WEIGHTS.OCEAN;
  }

  // ─── Bot yönetimi ─────────────────────────────────────────────────────────

  async listBots() {
    return this.prisma.user.findMany({
      where: { isBot: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, status: true, email: true, botPhone: true, occupationSector: true,
        profile: { select: { firstName: true, lastName: true, gender: true, birthDate: true, primaryCity: true } },
        oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
      },
    });
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
    await this.prisma.user.delete({ where: { id: botId } });
    return { deleted: true, id: botId };
  }

  async getPoolStatus(userId: string): Promise<{
    isSubscribed: boolean;
    activePlan: string | null;
    inPool: boolean;
    hasMeeting: boolean;
    poolSize: number;
    meetingScheduledAt: string | null;
  }> {
    const now = new Date();
    const { week: weekNumber, year } = getISOWeekNumber(now);

    const cycle = await this.prisma.matchingCycle.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });

    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { plan: true },
    });

    if (!activeSub) {
      return { isSubscribed: false, activePlan: null, inPool: false, hasMeeting: false, poolSize: 0, meetingScheduledAt: null };
    }

    const planOrder = ['ICERDE', 'MASADA', 'KARSIMDA'];
    const allSubs = await this.prisma.subscription.findMany({
      where: { userId, status: "ACTIVE" },
      select: { plan: true },
    });
    const plans = allSubs.map(s => s.plan);
    const activePlan = planOrder.find(p => plans.includes(p as any)) ?? plans[0] ?? null;

    if (!cycle) {
      const poolSize = await this.prisma.user.count({
        where: {
          status: "ACTIVE",
          isBot: false,
          oceanScore: { isNot: null },
          kyc: { status: KycStatus.APPROVED },
          subscriptions: { some: { status: "ACTIVE" } },
        },
      });
      return { isSubscribed: true, activePlan, inPool: true, hasMeeting: false, poolSize, meetingScheduledAt: null };
    }

    const existingMeeting = await this.prisma.meetingParticipant.findFirst({
      where: {
        userId,
        meeting: {
          cycleId: cycle.id,
          status: { in: ["PENDING", "ACTIVE"] },
        },
      },
      include: { meeting: { select: { scheduledAt: true, status: true } } },
    });

    const poolSize = await this.prisma.user.count({
      where: {
        status: "ACTIVE",
        isBot: false,
        oceanScore: { isNot: null },
        kyc: { status: KycStatus.APPROVED },
        subscriptions: { some: { status: "ACTIVE" } },
        participations: {
          none: {
            meeting: {
              cycleId: cycle.id,
              status: { in: ["PENDING", "ACTIVE"] },
            },
          },
        },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        isBot: true,
        oceanScore: true,
        kyc: { select: { status: true } },
        subscriptions: {
          where: { status: "ACTIVE" },
          select: { plan: true },
        },
      },
    });

    const inPool = !existingMeeting &&
      user?.status === "ACTIVE" &&
      !user?.isBot &&
      !!user?.oceanScore &&
      user?.kyc?.status === "APPROVED" &&
      (user?.subscriptions?.length ?? 0) > 0;

    return {
      isSubscribed: true,
      activePlan,
      inPool,
      hasMeeting: !!existingMeeting,
      poolSize: inPool ? poolSize + 1 : poolSize,
      meetingScheduledAt: existingMeeting?.meeting?.scheduledAt?.toISOString() ?? null,
    };
  }
}
