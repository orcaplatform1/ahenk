import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import {
  WEIGHTS,
  OCEAN_MAX_DISTANCE,
  CITY_SCORE,
  TABLE_SIZE_LARGE,
  TABLE_SIZE_SMALL,
  MEETING_HOUR_UTC,
} from "./matching.constants";
import { Gender, MeetingType, UserStatus, SubscriptionPlan, KycStatus } from "@prisma/client";

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
  phoneHash: string | null;
  activeCity: string | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    gender: Gender | null;
    city: string | null;
    district: string | null;
    primaryCity: string | null;
    venueCategories: string[];
    venuePreference: 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE' | null;
  } | null;
  oceanScore: OceanScoreData | null;
  contactBlocks: { hashedPhone: string }[];
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
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now);
  sat.setUTCDate(now.getUTCDate() + daysUntilSat);
  sat.setUTCHours(hourUTC, 0, 0, 0);
  return sat;
}

function buildBlockedSet(users: EligibleUser[], blockPairs: { blockerId: string; blockedId: string }[]): Set<string> {
  const blocked = new Set(blockPairs.map((b) => `${b.blockerId}:${b.blockedId}`));
  for (const user of users) {
    for (const other of users) {
      if (other.id === user.id) continue;
      if (other.phoneHash && user.contactBlocks.some((cb) => cb.hashedPhone === other.phoneHash))
        blocked.add(`${user.id}:${other.id}`);
      if (user.phoneHash && other.contactBlocks.some((cb) => cb.hashedPhone === user.phoneHash))
        blocked.add(`${other.id}:${user.id}`);
    }
  }
  return blocked;
}

function initials(user: EligibleUser): string {
  const f = user.profile?.firstName?.[0] ?? "?";
  const l = user.profile?.lastName?.[0] ?? "?";
  return `${f}.${l}.`;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // ─── Saatlik eşleştirme ───────────────────────────────────────────────────

  async runHourlyMatching(): Promise<{ tablesCreated: number }> {
    const matchingEnabled = await this.prisma.appConfig.findUnique({ where: { key: "MATCHING_ENABLED" } });
    if (matchingEnabled?.value === "false") return { tablesCreated: 0 };

    const now = new Date();
    const { week: weekNumber, year } = getISOWeekNumber(now);
    const cycle = await this.prisma.matchingCycle.upsert({
      where: { weekNumber_year: { weekNumber, year } },
      update: {},
      create: { weekNumber, year, status: "RUNNING" },
    });

    const weeklyTableLimit = parseInt(
      (await this.prisma.appConfig.findUnique({ where: { key: "WEEKLY_TABLE_LIMIT" } }))?.value ?? "0",
      10,
    );

    const currentTableCount = await this.prisma.meeting.count({
      where: { cycleId: cycle.id, status: { in: ["PENDING", "ACTIVE"] } },
    });
    if (weeklyTableLimit > 0 && currentTableCount >= weeklyTableLimit) return { tablesCreated: 0 };

    const scheduledAt = nextSaturdayAt(MEETING_HOUR_UTC);

    const groupUsers = await this.fetchEligible(cycle.id, [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE], false);
    const oneOnOneUsers = await this.fetchEligible(cycle.id, [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE], true);

    const groupIds = groupUsers.map((u) => u.id);
    const oneOnOneIds = oneOnOneUsers.map((u) => u.id);
    const allIds = [...new Set([...groupIds, ...oneOnOneIds])];

    const blockPairs = await this.prisma.userBlock.findMany({
      where: { blockerId: { in: allIds }, blockedId: { in: allIds } },
      select: { blockerId: true, blockedId: true },
    });

    let tablesCreated = 0;

    // GROUP masaları: en az 4 kişi gerekli
    if (groupUsers.length >= TABLE_SIZE_SMALL) {
      const blockedSet = buildBlockedSet(groupUsers, blockPairs);
      const { tables } = this.formGroupTables(groupUsers, blockedSet);
      for (const table of tables) {
        if (weeklyTableLimit > 0 && currentTableCount + tablesCreated >= weeklyTableLimit) break;
        await this.prisma.meeting.create({
          data: {
            cycleId: cycle.id,
            type: MeetingType.GROUP,
            title: `Hafta ${weekNumber} Grup Buluşması`,
            scheduledAt,
            maxParticipants: table.users.length,
            participants: { createMany: { data: table.users.map((u) => ({ userId: u.id, status: "INVITED" })) } },
          },
        });
        tablesCreated++;
      }
    }

    // ONE_ON_ONE masaları: en az 2 kişi
    if (oneOnOneUsers.length >= 2) {
      const blockedSet = buildBlockedSet(oneOnOneUsers, blockPairs);
      const pairs = this.formOneOnOnePairs(oneOnOneUsers, blockedSet);
      for (const pair of pairs) {
        if (weeklyTableLimit > 0 && currentTableCount + tablesCreated >= weeklyTableLimit) break;
        await this.prisma.meeting.create({
          data: {
            cycleId: cycle.id,
            type: MeetingType.ONE_ON_ONE,
            title: `Hafta ${weekNumber} Başbaşa Buluşma`,
            scheduledAt,
            maxParticipants: 2,
            participants: { createMany: { data: pair.map((u) => ({ userId: u.id, status: "INVITED" })) } },
          },
        });
        tablesCreated++;
      }
    }

    return { tablesCreated };
  }

  // ─── Perşembe kapanışı ────────────────────────────────────────────────────

  async runThursdayClosing(): Promise<void> {
    const now = new Date();
    const { week: weekNumber, year } = getISOWeekNumber(now);
    const cycle = await this.prisma.matchingCycle.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });
    if (!cycle || cycle.status === "COMPLETED") return;

    // Bot doldurma: GROUP masalarında 3 kişi → +1 bot = 4, 5 kişi → +1 bot = 6
    const pendingGroupMeetings = await this.prisma.meeting.findMany({
      where: { cycleId: cycle.id, type: MeetingType.GROUP, status: "PENDING" },
      include: { participants: { select: { userId: true } } },
    });

    const activeBots = await this.prisma.user.findMany({
      where: { isBot: true, status: "ACTIVE" },
      select: { id: true, profile: { select: { gender: true } } },
    });

    for (const meeting of pendingGroupMeetings) {
      const count = meeting.participants.length;
      if (count === 3 || count === 5) {
        const bot = activeBots[Math.floor(Math.random() * activeBots.length)];
        if (bot) {
          await this.prisma.meetingParticipant.create({
            data: { meetingId: meeting.id, userId: bot.id, status: "INVITED" },
          });
          await this.prisma.meeting.update({
            where: { id: meeting.id },
            data: { maxParticipants: count + 1 },
          });
          this.logger.log(`Bot eklendi: meeting=${meeting.id} (${count}→${count + 1})`);
        }
      } else if (count < TABLE_SIZE_SMALL) {
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
        status: { in: ["PENDING", "ACTIVE"] },
        locationText: { not: null },
      },
      include: {
        participants: {
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
  ): Promise<EligibleUser[]> {
    return this.prisma.user.findMany({
      where: {
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
        participations: {
          none: {
            meeting: {
              cycleId,
              status: { in: ["PENDING", "ACTIVE"] },
              ...(oneOnOne ? { type: MeetingType.ONE_ON_ONE } : { type: MeetingType.GROUP }),
            },
          },
        },
      },
      select: {
        id: true,
        isBot: true,
        status: true,
        phoneHash: true,
        activeCity: true,
        profile: { select: { firstName: true, lastName: true, gender: true, city: true, district: true, primaryCity: true, venueCategories: true, venuePreference: true } },
        oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
        contactBlocks: { select: { hashedPhone: true } },
      },
    }) as unknown as EligibleUser[];
  }

  private formGroupTables(
    users: EligibleUser[],
    blockedSet: Set<string>,
  ): { tables: TableGroup[]; leftover: EligibleUser[] } {
    const tables: TableGroup[] = [];
    const used = new Set<string>();

    const males   = users.filter((u) => u.profile?.gender === Gender.MALE);
    const females = users.filter((u) => u.profile?.gender === Gender.FEMALE);
    const neutrals = users.filter((u) => !u.profile?.gender || u.profile.gender === Gender.OTHER || u.profile.gender === Gender.PREFER_NOT_TO_SAY);

    const avail = (pool: EligibleUser[]) => pool.filter((u) => !used.has(u.id));
    const mark  = (group: EligibleUser[]) => group.forEach((u) => used.add(u.id));

    const pickBest = (pool: EligibleUser[], n: number, anchor: EligibleUser, existing: EligibleUser[] = []): EligibleUser[] => {
      const a = avail(pool).filter((u) => {
        if (this.areBlocked(anchor.id, u.id, blockedSet)) return false;
        if (this.areVenueIncompatible(anchor, u)) return false;
        return existing.every((e) => !this.areBlocked(e.id, u.id, blockedSet) && !this.areVenueIncompatible(e, u));
      });
      if (a.length < n) return [];
      return [...a].sort((x, y) => this.scoreTwo(anchor, y) - this.scoreTwo(anchor, x)).slice(0, n);
    };

    // Phase 1: 3M+3F
    while (avail(males).length >= 3 && avail(females).length >= 3) {
      const anchor = avail(males)[0];
      const mg = pickBest(males, 3, anchor);
      if (mg.length < 3) break;
      const fg = pickBest(females, 3, anchor, mg);
      if (fg.length < 3) break;
      mark([...mg, ...fg]);
      tables.push({ users: this.interleaveMF([...mg], [...fg]) });
    }

    // Phase 2: 2M+2F
    while (avail(males).length >= 2 && avail(females).length >= 2) {
      const anchor = avail(males)[0];
      const mg = pickBest(males, 2, anchor);
      if (mg.length < 2) break;
      const fg = pickBest(females, 2, anchor, mg);
      if (fg.length < 2) break;
      mark([...mg, ...fg]);
      tables.push({ users: this.interleaveMF([...mg], [...fg]) });
    }

    // Phase 3: karma 4'lü
    const mixPool = () => [...avail(males), ...avail(females), ...avail(neutrals)];
    while (mixPool().length >= TABLE_SIZE_SMALL) {
      const pool = mixPool();
      const anchor = pool[0];
      const group: EligibleUser[] = [anchor];
      for (const c of pool.slice(1)) {
        if (group.length >= TABLE_SIZE_SMALL) break;
        if (group.every((g) => !this.areBlocked(g.id, c.id, blockedSet) && !this.areVenueIncompatible(g, c))) group.push(c);
      }
      if (group.length < TABLE_SIZE_SMALL) break;
      mark(group);
      tables.push({ users: group });
    }

    // Nötr artakalanları mevcut masalara ekle (max 6)
    for (const table of tables) {
      while (table.users.length < TABLE_SIZE_LARGE && avail(neutrals).length > 0) {
        const n = avail(neutrals)[0];
        table.users.push(n);
        used.add(n.id);
      }
    }

    const leftover = users.filter((u) => !used.has(u.id));
    return { tables, leftover };
  }

  private formOneOnOnePairs(
    users: EligibleUser[],
    blockedSet: Set<string>,
  ): EligibleUser[][] {
    const pairs: EligibleUser[][] = [];
    const used = new Set<string>();

    const avail = () => users.filter((u) => !used.has(u.id));
    const males   = () => avail().filter((u) => u.profile?.gender === Gender.MALE);
    const females = () => avail().filter((u) => u.profile?.gender === Gender.FEMALE);

    // Önce M+F çiftleri
    while (males().length >= 1 && females().length >= 1) {
      const m = males()[0];
      const f = females().find((w) => !this.areBlocked(m.id, w.id, blockedSet) && !this.areVenueIncompatible(m, w));
      if (!f) break;
      used.add(m.id); used.add(f.id);
      pairs.push([m, f]);
    }

    // Kalan eşcinsel çiftler
    const rem = avail();
    for (let i = 0; i + 1 < rem.length; i += 2) {
      if (!this.areBlocked(rem[i].id, rem[i + 1].id, blockedSet) && !this.areVenueIncompatible(rem[i], rem[i + 1])) {
        used.add(rem[i].id); used.add(rem[i + 1].id);
        pairs.push([rem[i], rem[i + 1]]);
      }
    }

    return pairs;
  }

  // M-F-M-F sıralı dizi oluştur
  private interleaveMF(males: EligibleUser[], females: EligibleUser[]): EligibleUser[] {
    const result: EligibleUser[] = [];
    const len = Math.max(males.length, females.length);
    for (let i = 0; i < len; i++) {
      if (i < males.length)   result.push(males[i]);
      if (i < females.length) result.push(females[i]);
    }
    return result;
  }

  private areBlocked(aId: string, bId: string, blocks: Set<string>): boolean {
    return blocks.has(`${aId}:${bId}`) || blocks.has(`${bId}:${aId}`);
  }

  // ALCOHOLIC ↔ NON_ALCOHOLIC çifti uyumsuz; NO_PREFERENCE her ikiyle de uyumlu
  private areVenueIncompatible(a: EligibleUser, b: EligibleUser): boolean {
    const pa = a.profile?.venuePreference ?? 'NO_PREFERENCE';
    const pb = b.profile?.venuePreference ?? 'NO_PREFERENCE';
    return (pa === 'ALCOHOLIC' && pb === 'NON_ALCOHOLIC') ||
           (pa === 'NON_ALCOHOLIC' && pb === 'ALCOHOLIC');
  }

  private effectiveCity(u: EligibleUser): string | null {
    return u.activeCity ?? u.profile?.primaryCity ?? u.profile?.city ?? null;
  }

  private scoreTwo(a: EligibleUser, b: EligibleUser): number {
    return (
      this.calcOcean(a.oceanScore, b.oceanScore) +
      this.calcVenue(a.profile?.venueCategories ?? [], b.profile?.venueCategories ?? []) +
      this.calcCity(this.effectiveCity(a), a.profile?.district ?? null, this.effectiveCity(b), b.profile?.district ?? null)
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
    cityA: string | null,
    districtA: string | null,
    cityB: string | null,
    districtB: string | null,
  ): number {
    if (!cityA || !cityB || cityA !== cityB) return CITY_SCORE.DIFFERENT;
    if (districtA && districtB && districtA === districtB) return CITY_SCORE.SAME_CITY_AND_DISTRICT;
    return CITY_SCORE.SAME_CITY_ONLY;
  }

  // ─── Bot yönetimi ─────────────────────────────────────────────────────────

  async listBots() {
    return this.prisma.user.findMany({
      where: { isBot: true },
      select: { id: true, status: true, profile: { select: { firstName: true, lastName: true } } },
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

  // ─── Geriye dönük uyumluluk ───────────────────────────────────────────────

  async checkTableDeadline(meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: true },
    });
    if (!meeting || meeting.status !== "PENDING") return;
    // Kapanış anında yetersiz katılım → iptal (uzatma yok)
    await this.prisma.meeting.update({ where: { id: meetingId }, data: { status: "CANCELLED" } });
    this.logger.warn(`Masa iptal edildi (yetersiz katılım): ${meetingId}`);
  }

  async onParticipantAccepted(meetingId: string): Promise<void> {
    const accepted = await this.prisma.meetingParticipant.count({
      where: { meetingId, status: "ACCEPTED" },
    });
    if (accepted >= TABLE_SIZE_SMALL) {
      await this.prisma.meeting.update({ where: { id: meetingId }, data: { status: "ACTIVE" } });
      this.logger.log(`Masa kesinleşti (kabul): ${meetingId}`);
    }
  }
}
