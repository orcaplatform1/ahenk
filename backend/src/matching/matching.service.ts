import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import {
  WEIGHTS,
  OCEAN_MAX_DISTANCE,
  CITY_SCORE,
  TABLE_SIZE_LARGE,
  TABLE_SIZE_SMALL,
  REGISTRATION_DEADLINE_HOUR_UTC,
  EXTENSION_HOURS,
  MATCHING_QUEUE,
  JOB_CHECK_DEADLINE,
} from "./matching.constants";
import { Gender, MeetingType, UserStatus } from "@prisma/client";

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
  profile: {
    gender: Gender | null;
    city: string | null;
    district: string | null;
    venueCategories: string[];
    topicPreferences: string[];
  } | null;
  oceanScore: OceanScoreData | null;
};

type TableGroup = {
  users: EligibleUser[];
};

function getISOWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

function nextSaturdayAt(hourUTC: number): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now);
  sat.setUTCDate(now.getUTCDate() + daysUntilSat);
  sat.setUTCHours(hourUTC, 0, 0, 0);
  return sat;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    @InjectQueue(MATCHING_QUEUE) private matchingQueue: Queue,
  ) {}

  async runWeeklyMatching(): Promise<{ tablesCreated: number; waitlisted: number }> {
    const now = new Date();
    const { week: weekNumber, year } = getISOWeekNumber(now);

    this.logger.log(`Haftalık eşleştirme başlıyor — Hafta ${weekNumber}/${year}`);

    // MATCHING_ENABLED kontrolü
    const matchingEnabled = await this.prisma.appConfig.findUnique({ where: { key: "MATCHING_ENABLED" } });
    if (matchingEnabled?.value === "false") {
      this.logger.warn("Eşleştirme devre dışı (MATCHING_ENABLED=false), atlandı");
      return { tablesCreated: 0, waitlisted: 0 };
    }

    // Haftalık masa limiti
    const tableLimitCfg = await this.prisma.appConfig.findUnique({ where: { key: "WEEKLY_TABLE_LIMIT" } });
    const weeklyTableLimit = parseInt(tableLimitCfg?.value ?? "0", 10);

    const cycle = await this.prisma.matchingCycle.upsert({
      where: { weekNumber_year: { weekNumber, year } },
      update: { status: "RUNNING" },
      create: { weekNumber, year, status: "RUNNING" },
    });

    const waitlisted = await this.prisma.matchingWaitlist.findMany({
      where: { cycleId: { not: cycle.id } },
      select: { userId: true },
    });
    const priorityIds = new Set(waitlisted.map((w) => w.userId));

    const allEligible = await this.prisma.user.findMany({
      where: { status: "ACTIVE", isBot: false, oceanScore: { isNot: null } },
      select: {
        id: true,
        isBot: true,
        status: true,
        profile: {
          select: { gender: true, city: true, district: true, venueCategories: true, topicPreferences: true },
        },
        oceanScore: {
          select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true },
        },
      },
    });

    const eligible: EligibleUser[] = [
      ...allEligible.filter((u) => priorityIds.has(u.id)),
      ...allEligible.filter((u) => !priorityIds.has(u.id)),
    ] as EligibleUser[];

    if (eligible.length < TABLE_SIZE_SMALL) {
      this.logger.warn("Yeterli kullanıcı yok, eşleştirme atlandı");
      await this.prisma.matchingCycle.update({ where: { id: cycle.id }, data: { status: "COMPLETED" } });
      return { tablesCreated: 0, waitlisted: 0 };
    }

    const botUser = (await this.prisma.user.findFirst({
      where: { isBot: true, status: "ACTIVE" },
      select: {
        id: true,
        isBot: true,
        status: true,
        profile: { select: { gender: true, city: true, district: true, venueCategories: true, topicPreferences: true } },
        oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
      },
    })) as EligibleUser | null;

    // UserBlock çiftlerini yükle
    const eligibleIds = eligible.map((u) => u.id);
    const blockPairs = await this.prisma.userBlock.findMany({
      where: { blockerId: { in: eligibleIds }, blockedId: { in: eligibleIds } },
      select: { blockerId: true, blockedId: true },
    });
    const blockedSet = new Set(blockPairs.map((b) => `${b.blockerId}:${b.blockedId}`));

    const { tables, leftover } = this.formTables(eligible, botUser, blockedSet);
    const deadline = nextSaturdayAt(REGISTRATION_DEADLINE_HOUR_UTC);

    let tablesCreated = 0;
    for (const table of tables) {
      if (weeklyTableLimit > 0 && tablesCreated >= weeklyTableLimit) break;
      const meeting = await this.prisma.meeting.create({
        data: {
          cycleId: cycle.id,
          type: table.users.length === 2 ? MeetingType.ONE_ON_ONE : MeetingType.GROUP,
          title: `Hafta ${weekNumber} Buluşması`,
          scheduledAt: deadline,
          maxParticipants: table.users.length,
          registrationDeadline: deadline,
          participants: {
            createMany: {
              data: table.users.map((u) => ({ userId: u.id, status: "INVITED" })),
            },
          },
        },
      });

      const delayMs = deadline.getTime() - Date.now();
      if (delayMs > 0) {
        await this.matchingQueue.add(
          JOB_CHECK_DEADLINE,
          { meetingId: meeting.id },
          { delay: delayMs, jobId: `deadline:${meeting.id}` },
        );
      }
      tablesCreated++;
    }

    let waitlistedCount = 0;
    for (const user of leftover) {
      await this.prisma.matchingWaitlist.upsert({
        where: { userId_cycleId: { userId: user.id, cycleId: cycle.id } },
        update: {},
        create: { userId: user.id, cycleId: cycle.id, reason: "ODD_NUMBER" },
      });
      waitlistedCount++;
    }

    await this.prisma.matchingCycle.update({ where: { id: cycle.id }, data: { status: "COMPLETED" } });
    this.logger.log(`Eşleştirme tamamlandı: ${tablesCreated} masa, ${waitlistedCount} bekliste`);
    return { tablesCreated, waitlisted: waitlistedCount };
  }

  async checkTableDeadline(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: true },
    });
    if (!meeting || meeting.status !== "PENDING") return;

    const accepted = meeting.participants.filter((p) => p.status === "ACCEPTED").length;

    if (accepted >= TABLE_SIZE_SMALL) {
      await this.prisma.meeting.update({ where: { id: meetingId }, data: { status: "ACTIVE" } });
      this.logger.log(`Masa kesinleşti: ${meetingId}`);
      this.notifyMeetingParticipants(meetingId, meeting.scheduledAt).catch(() => {});
      return;
    }

    const currentDeadline = meeting.registrationDeadline!;
    const extendedDeadline = new Date(currentDeadline.getTime() + EXTENSION_HOURS * 60 * 60 * 1000);
    const isFirstCheck = currentDeadline.getUTCHours() === REGISTRATION_DEADLINE_HOUR_UTC;

    if (isFirstCheck) {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { registrationDeadline: extendedDeadline },
      });
      const delayMs = extendedDeadline.getTime() - Date.now();
      await this.matchingQueue.add(
        JOB_CHECK_DEADLINE,
        { meetingId },
        { delay: delayMs, jobId: `deadline-ext:${meetingId}` },
      );
      this.logger.log(`Masa süresi 12 saat uzatıldı: ${meetingId}`);
    } else {
      await this.prisma.meeting.update({ where: { id: meetingId }, data: { status: "CANCELLED" } });
      this.logger.warn(`Masa iptal edildi: ${meetingId}`);
    }
  }

  async onParticipantAccepted(meetingId: string): Promise<void> {
    const accepted = await this.prisma.meetingParticipant.count({
      where: { meetingId, status: "ACCEPTED" },
    });
    if (accepted >= TABLE_SIZE_SMALL) {
      const meeting = await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: "ACTIVE" },
        select: { scheduledAt: true },
      });
      await this.matchingQueue.removeJobs(`deadline:${meetingId}`);
      await this.matchingQueue.removeJobs(`deadline-ext:${meetingId}`);
      this.logger.log(`Masa kesinleşti (kabul tetikleyici): ${meetingId}`);
      this.notifyMeetingParticipants(meetingId, meeting.scheduledAt).catch(() => {});
    }
  }

  private async notifyMeetingParticipants(meetingId: string, scheduledAt: Date): Promise<void> {
    const participants = await this.prisma.meetingParticipant.findMany({
      where: { meetingId },
      select: { userId: true },
    });
    for (const p of participants) {
      await this.notifications.notifyMeetingConfirmed(p.userId, meetingId, scheduledAt);
    }
  }

  async listBots() {
    return this.prisma.user.findMany({
      where: { isBot: true },
      select: {
        id: true,
        status: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async updateBotName(botId: string, firstName: string, lastName: string) {
    const bot = await this.prisma.user.findFirst({ where: { id: botId, isBot: true } });
    if (!bot) throw new NotFoundException("Bot bulunamadı");
    return this.prisma.profile.update({
      where: { userId: botId },
      data: { firstName, lastName },
      select: { userId: true, firstName: true, lastName: true },
    });
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

  async createBot(firstName: string, lastName: string, oceanScore?: Partial<{
    openness: number; conscientiousness: number; extraversion: number;
    agreeableness: number; neuroticism: number;
  }>) {
    const idx = Date.now();
    const bot = await this.prisma.user.create({
      data: {
        email: `bot-${idx}@ahenk.tr`,
        passwordHash: "bot-no-login",
        isBot: true,
        emailVerified: true,
        profile: { create: { firstName, lastName, isPublic: false } },
      },
    });
    await this.prisma.oceanScore.create({
      data: {
        userId: bot.id,
        openness: oceanScore?.openness ?? 50,
        conscientiousness: oceanScore?.conscientiousness ?? 50,
        extraversion: oceanScore?.extraversion ?? 50,
        agreeableness: oceanScore?.agreeableness ?? 50,
        neuroticism: oceanScore?.neuroticism ?? 50,
      },
    });
    return { id: bot.id, email: bot.email, firstName, lastName };
  }

  async deleteBot(botId: string) {
    const bot = await this.prisma.user.findFirst({ where: { id: botId, isBot: true } });
    if (!bot) throw new NotFoundException("Bot bulunamadı");
    await this.prisma.user.delete({ where: { id: botId } });
    return { deleted: true, id: botId };
  }

  private areBlocked(aId: string, bId: string, blocks: Set<string>): boolean {
    return blocks.has(`${aId}:${bId}`) || blocks.has(`${bId}:${aId}`);
  }

  private formTables(
    users: EligibleUser[],
    bot: EligibleUser | null,
    blockedSet: Set<string> = new Set(),
  ): { tables: TableGroup[]; leftover: EligibleUser[] } {
    const tables: TableGroup[] = [];
    const used = new Set<string>();

    const males = users.filter((u) => u.profile?.gender === Gender.MALE);
    const females = users.filter((u) => u.profile?.gender === Gender.FEMALE);
    const neutrals = users.filter(
      (u) => !u.profile?.gender || u.profile.gender === Gender.OTHER || u.profile.gender === Gender.PREFER_NOT_TO_SAY,
    );

    const avail = (pool: EligibleUser[]) => pool.filter((u) => !used.has(u.id));
    const markUsed = (group: EligibleUser[]) => group.forEach((u) => used.add(u.id));

    // Seçili group içinde hiçbir çift engellenmiş değil mi?
    const groupHasNoBlocks = (group: EligibleUser[]): boolean => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (this.areBlocked(group[i].id, group[j].id, blockedSet)) return false;
        }
      }
      return true;
    };

    const pickBest = (pool: EligibleUser[], n: number, anchor: EligibleUser, existing: EligibleUser[] = []): EligibleUser[] => {
      const a = avail(pool).filter((u) => {
        // Anchor ile engeli yok mu?
        if (this.areBlocked(anchor.id, u.id, blockedSet)) return false;
        // Mevcut seçililerle de engeli yok mu?
        return existing.every((e) => !this.areBlocked(e.id, u.id, blockedSet));
      });
      if (a.length < n) return [];
      return [...a].sort((x, y) => this.scoreTwo(anchor, y) - this.scoreTwo(anchor, x)).slice(0, n);
    };

    // Phase 1: 3E+3K masalar
    while (avail(males).length >= 3 && avail(females).length >= 3) {
      const anchor = avail(males)[0];
      const mg = pickBest(males, 3, anchor);
      if (mg.length < 3) break;
      const fg = pickBest(females, 3, anchor, mg);
      if (fg.length < 3) break;
      markUsed([...mg, ...fg]);
      tables.push({ users: [...mg, ...fg] });
    }

    // Phase 2: 2E+2K masalar
    while (avail(males).length >= 2 && avail(females).length >= 2) {
      const anchor = avail(males)[0];
      const mg = pickBest(males, 2, anchor);
      if (mg.length < 2) break;
      const fg = pickBest(females, 2, anchor, mg);
      if (fg.length < 2) break;
      markUsed([...mg, ...fg]);
      tables.push({ users: [...mg, ...fg] });
    }

    // Phase 3: Kalan cinsiyetli + nötrler → 4'lü masalar
    const mixPool = () => [...avail(males), ...avail(females), ...avail(neutrals)];
    while (mixPool().length >= TABLE_SIZE_SMALL) {
      const pool = mixPool();
      const anchor = pool[0];
      const group: EligibleUser[] = [anchor];
      for (const candidate of pool.slice(1)) {
        if (group.length >= TABLE_SIZE_SMALL) break;
        if (group.every((g) => !this.areBlocked(g.id, candidate.id, blockedSet))) {
          group.push(candidate);
        }
      }
      if (group.length < TABLE_SIZE_SMALL) break;
      markUsed(group);
      tables.push({ users: group });
    }

    // Kalan nötrleri mevcut masalara ekle (6'ya kadar)
    for (const table of tables) {
      while (table.users.length < TABLE_SIZE_LARGE && avail(neutrals).length > 0) {
        const n = avail(neutrals)[0];
        table.users.push(n);
        used.add(n.id);
      }
    }

    // Phase 4: 5 kişilik masaları düzelt
    for (const table of tables) {
      if (table.users.length === 5) {
        if (bot && bot.status === UserStatus.ACTIVE) {
          table.users.push(bot);
        } else {
          const worst = this.findWorstFit(table.users);
          table.users = table.users.filter((u) => u.id !== worst.id);
          used.delete(worst.id);
        }
      }
    }

    const leftover = users.filter((u) => !used.has(u.id));
    return { tables, leftover };
  }

  private scoreTwo(a: EligibleUser, b: EligibleUser): number {
    return (
      this.calcOcean(a.oceanScore, b.oceanScore) +
      this.calcVenue(a.profile?.venueCategories ?? [], b.profile?.venueCategories ?? []) +
      this.calcCity(a.profile, b.profile) +
      this.calcTopic(a.profile?.topicPreferences ?? [], b.profile?.topicPreferences ?? [])
    );
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

  private calcVenue(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    const union = new Set([...a, ...b]).size;
    const intersection = b.filter((x) => setA.has(x)).length;
    return (intersection / union) * WEIGHTS.VENUE;
  }

  private calcCity(
    a: { city?: string | null; district?: string | null } | null,
    b: { city?: string | null; district?: string | null } | null,
  ): number {
    if (!a?.city || !b?.city || a.city !== b.city) return CITY_SCORE.DIFFERENT;
    if (a.district && b.district && a.district === b.district) return CITY_SCORE.SAME_CITY_AND_DISTRICT;
    return CITY_SCORE.SAME_CITY_ONLY;
  }

  private calcTopic(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    const union = new Set([...a, ...b]).size;
    const intersection = b.filter((x) => setA.has(x)).length;
    return (intersection / union) * WEIGHTS.TOPIC;
  }

  private findWorstFit(users: EligibleUser[]): EligibleUser {
    let worst = users[0];
    let worstAvg = Infinity;
    for (const u of users) {
      const others = users.filter((o) => o.id !== u.id);
      const avg = others.reduce((sum, o) => sum + this.scoreTwo(u, o), 0) / others.length;
      if (avg < worstAvg) { worstAvg = avg; worst = u; }
    }
    return worst;
  }
}
