import { Injectable } from "@nestjs/common";
import { MeetingType, ParticipantStatus, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { trWeekStart, WEEK_MS } from "../admin/tr-week";
import { OCEAN_MAX_DISTANCE, WEIGHTS } from "../matching/matching.constants";

const LEFT_STATUSES: ParticipantStatus[] = ["DECLINED", "CANCELLED", "NO_SHOW"];
const NEW_ENTRY_MS = 5 * 60 * 1000;
const ACTIVE_ENTRY_MS = 60 * 60 * 1000;
const SONAR_MAX_DOTS = 60;
const SONAR_MAX_LABELS = 8;
const HEATMAP_MAX = 9;
const FEED_MAX = 30;
const FEED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const HIGH_MATCH_RATIO = 0.7; // Eşleşme puanının en az %70'i "yüksek uyum"

const DIMENSIONS = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"] as const;
type Dimension = (typeof DIMENSIONS)[number];
type Ocean = Record<Dimension, number>;
type Person = { oceanScore: Ocean | null; occupationSector: string | null };

const OCEAN_SELECT = { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } as const;

// Eşleşme algoritmasının puanı (matching.service scoreTwo ile aynı formül), 0-1 aralığında
function matchRatio(a: Person, b: Person): number {
  let ocean: number = WEIGHTS.OCEAN / 2;
  if (a.oceanScore && b.oceanScore) {
    const x = a.oceanScore, y = b.oceanScore;
    const distance = Math.sqrt(DIMENSIONS.reduce((sum, d) => sum + (x[d] - y[d]) ** 2, 0));
    ocean = (1 - distance / OCEAN_MAX_DISTANCE) * WEIGHTS.OCEAN;
  }
  const p = a.occupationSector, q = b.occupationSector;
  const skip = !p || !q || [p, q].some((s) => s === "Öğrenci" || s === "Diğer");
  const occupation = !skip && p === q ? WEIGHTS.OCCUPATION : 0;
  return (ocean + occupation) / (WEIGHTS.OCEAN + WEIGHTS.OCCUPATION);
}

// Tarayıcıya kullanıcı/masa kimliği gitmez: haftalık tuzlu özet
const opaque = (id: string, weekStart: Date) =>
  createHash("sha256").update(`${id}:${weekStart.getTime()}`).digest("hex").slice(0, 12);

function topDistrict(districts: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const d of districts) if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

@Injectable()
export class LiveLayerService {
  constructor(private prisma: PrismaService) {}

  private week() {
    const start = trWeekStart();
    return { start, end: new Date(start.getTime() + WEEK_MS) };
  }

  // Seçilmezse kullanıcının aktif şehri (eşleşmedeki sıra: activeCity → primaryCity); yoksa ilk aktif şehir
  private async resolveCity(userId: string, cityId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeCity: true, profile: { select: { primaryCity: true } } },
    });
    const wanted = cityId ?? user?.activeCity ?? user?.profile?.primaryCity ?? undefined;
    const city = wanted
      ? await this.prisma.city.findFirst({ where: { OR: [{ id: wanted }, { name: wanted }] }, select: { id: true, name: true } })
      : null;
    return city ?? this.prisma.city.findFirst({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  }

  // Bu hafta havuzdakiler: eşleşmeye uygun, paketi aktif, gerçek kullanıcılar (bot yok)
  private poolWhere(city: { id: string; name: string }): Prisma.UserWhereInput {
    return {
      status: "ACTIVE",
      isBot: false,
      oceanScore: { isNot: null },
      kyc: { status: "APPROVED" },
      subscriptions: { some: { status: "ACTIVE" } },
      OR: [
        { activeCity: city.id },
        { activeCity: null, profile: { primaryCity: { in: [city.id, city.name] } } },
      ],
    };
  }

  // 15 sn'de bir: sonar + canlı akış. İsim, baş harf, yaş, meslek, fotoğraf dönmez
  async pulse(userId: string, cityId?: string) {
    const city = await this.resolveCity(userId, cityId);
    if (!city) return { sonar: { dots: [], labels: [] }, feed: { events: [], perMinute: 0 } };
    return { sonar: await this.sonar(city), feed: await this.feed(city) };
  }

  private async sonar(city: { id: string; name: string }) {
    const { start } = this.week();
    const now = Date.now();
    const users = await this.prisma.user.findMany({
      where: this.poolWhere(city),
      select: {
        id: true,
        profile: { select: { district: true } },
        subscriptions: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
    const dots = users
      .map((u) => {
        const age = now - (u.subscriptions[0]?.createdAt.getTime() ?? 0);
        const state = age <= NEW_ENTRY_MS ? "new" : age <= ACTIVE_ENTRY_MS ? "active" : "pool";
        return { key: opaque(u.id, start), district: u.profile?.district ?? null, state, age };
      })
      .sort((a, b) => a.age - b.age)
      .slice(0, SONAR_MAX_DOTS)
      .map(({ age: _age, ...dot }) => dot);

    const labels = new Map<string, { count: number; active: boolean }>();
    for (const d of dots) {
      if (!d.district) continue;
      const row = labels.get(d.district) ?? { count: 0, active: false };
      labels.set(d.district, { count: row.count + 1, active: row.active || d.state !== "pool" });
    }
    return {
      dots,
      labels: [...labels.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, SONAR_MAX_LABELS)
        .map(([name, v]) => ({ name, active: v.active })),
    };
  }

  // Olay tablosu yok: masa ve mekân kayıtlarından türetilir, "yeni katılım" olayı üretilmez
  private async feed(city: { id: string; name: string }) {
    const { start, end } = this.week();
    const since = new Date(Date.now() - FEED_WINDOW_MS);
    const [meetings, venues] = await Promise.all([
      this.prisma.meeting.findMany({
        where: { cityId: city.id, status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gte: start, lt: end }, type: { in: [MeetingType.GROUP, MeetingType.ONE_ON_ONE] } },
        select: {
          id: true, type: true, maxParticipants: true, createdAt: true,
          participants: {
            where: { status: { notIn: LEFT_STATUSES } },
            select: {
              createdAt: true,
              user: { select: { occupationSector: true, oceanScore: { select: OCEAN_SELECT }, profile: { select: { district: true } } } },
            },
          },
        },
      }),
      this.prisma.venue.findMany({
        where: { cityId: city.id, isActive: true, createdAt: { gte: since } },
        select: { id: true, createdAt: true },
      }),
    ]);

    const events: { key: string; at: Date; place: string; kind: "FULL" | "MATCH" | "OPEN" | "VENUE"; value: number | null }[] = [];
    for (const m of meetings) {
      const place = topDistrict(m.participants.map((p) => p.user.profile?.district)) ?? city.name;
      const at = new Date(Math.max(m.createdAt.getTime(), ...m.participants.map((p) => p.createdAt.getTime())));
      const key = opaque(m.id, start);
      if (m.type === MeetingType.ONE_ON_ONE) {
        if (m.participants.length === 2) {
          const value = Math.round(matchRatio(m.participants[0].user, m.participants[1].user) * 100);
          events.push({ key, at, place, kind: "MATCH", value });
        }
      } else {
        const left = m.maxParticipants - m.participants.length;
        events.push(left > 0 ? { key, at, place, kind: "OPEN", value: left } : { key, at, place, kind: "FULL", value: null });
      }
    }
    for (const v of venues) events.push({ key: opaque(v.id, start), at: v.createdAt, place: city.name, kind: "VENUE", value: null });

    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const lastHour = events.filter((e) => e.at.getTime() >= hourAgo).length;
    return { events: events.slice(0, FEED_MAX), perMinute: Math.round((lastHour / 60) * 10) / 10 };
  }

  // 60 sn'de bir: metrikler, ısı haritası, uyum sinyali, dolum
  async overview(userId: string, cityId?: string) {
    const city = await this.resolveCity(userId, cityId);
    if (!city) return null;
    const { start, end } = this.week();

    const [pool, meetings, me, myParticipation] = await Promise.all([
      this.prisma.user.findMany({
        where: this.poolWhere(city),
        select: { id: true, occupationSector: true, oceanScore: { select: OCEAN_SELECT }, profile: { select: { district: true } } },
      }),
      this.prisma.meeting.findMany({
        where: { cityId: city.id, status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gte: start, lt: end } },
        select: { type: true, maxParticipants: true, participants: { where: { status: { notIn: LEFT_STATUSES } }, select: { id: true } } },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { occupationSector: true, oceanScore: { select: OCEAN_SELECT } } }),
      this.prisma.meetingParticipant.findFirst({
        where: { userId, status: { notIn: LEFT_STATUSES }, meeting: { status: { in: ["PENDING", "ACTIVE"] }, scheduledAt: { gte: start, lt: end } } },
        orderBy: { meeting: { scheduledAt: "asc" } },
        select: {
          meeting: {
            select: {
              participants: {
                where: { userId: { not: userId }, status: { notIn: LEFT_STATUSES } },
                select: { user: { select: { oceanScore: { select: OCEAN_SELECT } } } },
              },
            },
          },
        },
      }),
    ]);

    const fill = (type: MeetingType) => {
      const rows = meetings.filter((m) => m.type === type);
      return { filled: rows.reduce((s, m) => s + m.participants.length, 0), total: rows.reduce((s, m) => s + m.maxParticipants, 0) };
    };
    const group = fill(MeetingType.GROUP), oneOnOne = fill(MeetingType.ONE_ON_ONE), kanka = fill(MeetingType.KANKA);
    const filled = group.filled + oneOnOne.filled + kanka.filled;
    const total = group.total + oneOnOne.total + kanka.total;

    const demand = new Map<string, number>();
    for (const u of pool) {
      const d = u.profile?.district;
      if (d) demand.set(d, (demand.get(d) ?? 0) + 1);
    }
    const sorted = [...demand.entries()].sort((a, b) => b[1] - a[1]).slice(0, HEATMAP_MAX);
    const peak = sorted[0]?.[1] ?? 0;

    const ocean = me?.oceanScore ?? null;
    const others = myParticipation?.meeting.participants.flatMap((p) => (p.user.oceanScore ? [p.user.oceanScore] : [])) ?? [];

    return {
      city,
      metrics: { pool: pool.length, tables: meetings.length, fillPercent: total ? Math.round((filled / total) * 100) : 0 },
      groupSeatsLeft: group.total ? Math.max(0, group.total - group.filled) : null,
      fill: { group, oneOnOne, kanka },
      heatmap: sorted.map(([name, count]) => ({ name, percent: Math.round((count / peak) * 100) })),
      signal: {
        closeCount: me ? pool.filter((u) => u.id !== userId && matchRatio(me, u) >= HIGH_MATCH_RATIO).length : 0,
        top: ocean
          ? DIMENSIONS.map((key) => ({ key, score: Math.round(ocean[key]) })).sort((a, b) => b.score - a.score).slice(0, 3)
          : [],
        // Masadakilerle ortalama farkın en küçük olduğu boyut
        commonDimension: ocean && others.length
          ? [...DIMENSIONS].sort((a, b) => {
              const gap = (d: Dimension) => others.reduce((s, o) => s + Math.abs(o[d] - ocean[d]), 0);
              return gap(a) - gap(b);
            })[0]
          : null,
      },
      hasTable: !!myParticipation,
    };
  }
}
