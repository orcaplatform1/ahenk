import { Injectable } from "@nestjs/common";
import { MeetingType, ParticipantStatus, Prisma } from "../generated/prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { trWeekStart, WEEK_MS } from "../admin/tr-week";
import { WEIGHTS } from "../matching/matching.constants";
import { MatchPerson, matchScore } from "../matching/match-score";
import { densityListOf, type DensityRow } from "../common/districts";
import { liveDistrictSource } from "../admin/app-settings";
import { meetingLockAt } from "./meeting-windows";

const LEFT_STATUSES: ParticipantStatus[] = ["DECLINED", "CANCELLED", "NO_SHOW"];
const NEW_ENTRY_MS = 5 * 60 * 1000;
const ACTIVE_ENTRY_MS = 60 * 60 * 1000;
const SONAR_MAX_DOTS = 60;
const SONAR_MAX_LABELS = 8;
const HEATMAP_MAX = 9;
const DENSITY_MAX = 15;
const FEED_MAX = 20;
const HIGH_MATCH_RATIO = 0.7; // Eşleşme puanının en az %70'i "yüksek uyum"

type FeedSegment = { t: "text"; v: string } | { t: "person"; v: string; g: string | null };
type FeedEvent = { key: string; at: Date; segments: FeedSegment[] };

// Masa adı: admin paneldeki sıralı masa numarası (Meeting.title sonundaki sayı) → "Grup Masa 16"
const TYPE_NAME: Record<MeetingType, string> = { GROUP: "Grup", ONE_ON_ONE: "Baş Başa", KANKA: "Kankamla" };
function tableNo(title: string): number | null {
  const m = /(\d+)\s*$/.exec(title);
  return m ? Number(m[1]) : null;
}
function tableLabel(type: MeetingType, title: string): string {
  const no = tableNo(title);
  return `${TYPE_NAME[type]} Masa${no !== null ? ` ${no}` : ""}`;
}

// Sayının okunuşundaki son kelimeye göre Türkçe ek: 16'ya / 16'da, 5'e / 5'te
const NUM_WORD_END: Record<number, { front: boolean; vowel: boolean; hard: boolean }> = {
  0: { front: false, vowel: false, hard: false }, // sıfır
  1: { front: true, vowel: false, hard: false }, // bir
  2: { front: true, vowel: true, hard: false }, // iki
  3: { front: true, vowel: false, hard: true }, // üç
  4: { front: true, vowel: false, hard: true }, // dört
  5: { front: true, vowel: false, hard: true }, // beş
  6: { front: false, vowel: true, hard: false }, // altı
  7: { front: true, vowel: true, hard: false }, // yedi
  8: { front: true, vowel: false, hard: false }, // sekiz
  9: { front: false, vowel: false, hard: false }, // dokuz
  10: { front: false, vowel: false, hard: false }, // on
  20: { front: true, vowel: true, hard: false }, // yirmi
  30: { front: false, vowel: false, hard: false }, // otuz
  40: { front: false, vowel: false, hard: true }, // kırk
  50: { front: true, vowel: true, hard: false }, // elli
  60: { front: false, vowel: false, hard: true }, // altmış
  70: { front: true, vowel: false, hard: true }, // yetmiş
  80: { front: true, vowel: false, hard: false }, // seksen
  90: { front: false, vowel: false, hard: false }, // doksan
  100: { front: true, vowel: false, hard: false }, // yüz
  1000: { front: true, vowel: false, hard: false }, // bin
};
function numEnd(n: number) {
  if (n % 10 !== 0 || n === 0) return NUM_WORD_END[n % 10];
  if (n % 100 !== 0) return NUM_WORD_END[n % 100];
  if (n % 1000 !== 0) return NUM_WORD_END[100];
  return NUM_WORD_END[1000];
}
function dativeSuffix(n: number): string {
  const e = numEnd(n);
  return `${e.vowel ? "y" : ""}${e.front ? "e" : "a"}`;
}
function locativeSuffix(n: number): string {
  const e = numEnd(n);
  return `${e.hard ? "t" : "d"}${e.front ? "e" : "a"}`;
}

// Detaylar: masa günü 10:00 (TR)
function revealAt(scheduledAt: Date): number {
  const tr = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);
  return Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate(), 10 - 3, 0, 0, 0);
}

const DIMENSIONS = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"] as const;
type Dimension = (typeof DIMENSIONS)[number];

const OCEAN_SELECT = { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } as const;

const matchRatio = (a: MatchPerson, b: MatchPerson) => matchScore(a, b) / (WEIGHTS.OCEAN + WEIGHTS.OCCUPATION);

// Tarayıcıya kullanıcı/masa kimliği gitmez: haftalık tuzlu özet
const opaque = (id: string, weekStart: Date) =>
  createHash("sha256").update(`${id}:${weekStart.getTime()}`).digest("hex").slice(0, 12);

function topDistrict(districts: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const d of districts) if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

type Density = { mode: "static" | "real"; districts: { name: string; level: 1 | 2 | 3 | 4; percent: number | null }[] } | null;

// Gerçek veri: ilçeler yoğunluk sırasına göre dört eşit seviyeye bölünür
function realDensity(demand: Map<string, number>): Density {
  const sorted = [...demand.entries()].sort((a, b) => b[1] - a[1]).slice(0, DENSITY_MAX);
  if (sorted.length === 0) return null;
  const peak = sorted[0][1];
  return {
    mode: "real",
    districts: sorted.map(([name, count], i) => ({
      name,
      level: (Math.floor((i * 4) / sorted.length) + 1) as 1 | 2 | 3 | 4,
      percent: Math.round((count / peak) * 100),
    })),
  };
}

// Sabit listeli şehirde gerçek veri: liste korunur, seviye talebe göre belirlenir; talebi olmayan ilçe 4. seviyededir
function fixedRealDensity(list: DensityRow[], demand: Map<string, number>): Density {
  const rows = list.map(({ name }) => ({ name, count: demand.get(name) ?? 0 })).sort((a, b) => b.count - a.count);
  const peak = rows[0]?.count ?? 0;
  return {
    mode: "real",
    districts: rows.map(({ name, count }, i) => ({
      name,
      level: count ? ((Math.floor((i * 4) / rows.length) + 1) as 1 | 2 | 3 | 4) : 4,
      percent: peak ? Math.round((count / peak) * 100) : 0,
    })),
  };
}

// Sabit listeli şehirde listede olmayan kayıt ilçesi sonarda ve ısı haritasında yok sayılır
function shownDistrict(cityName: string, district: string | null | undefined): string | null {
  const list = densityListOf(cityName);
  if (!district || (list && !list.some((d) => d.name === district))) return null;
  return district;
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

  // Yoğunluk katmanı: sabit listeli şehirlerde liste hep görünür; diğer şehirlerde gerçek veri (yoksa null, eski görünüm sürer)
  private async density(city: { name: string }, demand: Map<string, number>): Promise<Density> {
    const list = densityListOf(city.name);
    if ((await liveDistrictSource(this.prisma)) === "real") return list ? fixedRealDensity(list, demand) : realDensity(demand);
    return list ? { mode: "static", districts: list.map((d) => ({ ...d, percent: null })) } : null;
  }

  // 15 sn'de bir: sonar + canlı akış. İsim, baş harf, yaş, meslek, fotoğraf dönmez
  async pulse(userId: string, cityId?: string) {
    const city = await this.resolveCity(userId, cityId);
    if (!city) return { sonar: { dots: [], labels: [], density: null }, feed: { events: [] } };
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
        kyc: { select: { reviewedAt: true } },
      },
    });
    const dots = users
      .map((u) => {
        // Havuza giriş: paket alınması ya da KYC onayı, hangisi daha geç olduysa
        const joinedAt = Math.max(u.subscriptions[0]?.createdAt.getTime() ?? 0, u.kyc?.reviewedAt?.getTime() ?? 0);
        const age = now - joinedAt;
        const state = age <= NEW_ENTRY_MS ? "new" : age <= ACTIVE_ENTRY_MS ? "active" : "pool";
        return { key: opaque(u.id, start), district: shownDistrict(city.name, u.profile?.district), state, age };
      })
      .sort((a, b) => a.age - b.age)
      .slice(0, SONAR_MAX_DOTS)
      .map(({ age: _age, ...dot }) => dot);

    const demand = new Map<string, number>();
    for (const u of users) {
      const d = shownDistrict(city.name, u.profile?.district);
      if (d) demand.set(d, (demand.get(d) ?? 0) + 1);
    }

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
      density: await this.density(city, demand),
    };
  }

  // Olay tablosu yok: masa ve katılımcı kayıtlarından türetilir; en son FEED_MAX olay döner.
  // Mekân adı, semt ve buluşma günü/saati akışa yazılmaz; kişiler yalnızca baş harfle görünür.
  private async feed(city: { id: string; name: string }) {
    const { start, end } = this.week();
    const prevStart = new Date(start.getTime() - WEEK_MS);
    const now = Date.now();
    const [meetings, lastWeekCount] = await Promise.all([
      this.prisma.meeting.findMany({
        where: { cityId: city.id, status: { not: "CANCELLED" }, scheduledAt: { gte: prevStart, lt: end } },
        select: {
          id: true, type: true, title: true, maxParticipants: true, scheduledAt: true,
          participants: {
            select: {
              status: true, createdAt: true, cancelledAt: true,
              user: { select: { profile: { select: { firstName: true, lastName: true, gender: true } } } },
            },
          },
        },
      }),
      this.prisma.meeting.count({ where: { cityId: city.id, status: { not: "CANCELLED" }, scheduledAt: { gte: prevStart, lt: start } } }),
    ]);

    const events: FeedEvent[] = [];
    const push = (key: string, at: number, segments: FeedSegment[]) => {
      if (at <= now) events.push({ key: opaque(key, start), at: new Date(at), segments });
    };
    const head = `${city.name} · `;

    for (const m of meetings) {
      const label = tableLabel(m.type, m.title);
      const no = tableNo(m.title);
      const person = (p: (typeof m.participants)[number]): FeedSegment => ({
        t: "person",
        v: `${(p.user.profile?.firstName ?? "").trim()[0]?.toLocaleUpperCase("tr-TR") ?? "?"}.${(p.user.profile?.lastName ?? "").trim()[0]?.toLocaleUpperCase("tr-TR") ?? "?"}`,
        g: p.user.profile?.gender ?? null,
      });
      // Katılım ve iptaller zaman sırasıyla yeniden oynatılır (o andaki doluluk için)
      const steps: { at: number; join: boolean; p: (typeof m.participants)[number] }[] = [];
      for (const p of m.participants) {
        steps.push({ at: p.createdAt.getTime(), join: true, p });
        if (p.cancelledAt && LEFT_STATUSES.includes(p.status)) steps.push({ at: p.cancelledAt.getTime(), join: false, p });
      }
      steps.sort((a, b) => a.at - b.at);
      const seated: (typeof m.participants)[number][] = [];
      steps.forEach((st, i) => {
        const k = `${m.id}:${i}`;
        if (!st.join) {
          const idx = seated.indexOf(st.p);
          if (idx >= 0) seated.splice(idx, 1);
          push(`${k}:cancel`, st.at, [{ t: "text", v: `${head}${label}${no !== null ? `'${locativeSuffix(no)}` : ""} 1 sandalye açıldı` }]);
          return;
        }
        seated.push(st.p);
        if (m.type === MeetingType.ONE_ON_ONE && seated.length === 2) {
          push(`${k}:match`, st.at, [{ t: "text", v: `${head}${label} · ` }, person(seated[0]), { t: "text", v: " " }, person(seated[1]), { t: "text", v: " eşleşti" }]);
          return;
        }
        push(`${k}:join`, st.at, [{ t: "text", v: `${head}${label}${no !== null ? `'${dativeSuffix(no)}` : ""} ` }, person(st.p), { t: "text", v: " katıldı" }]);
        if (m.type === MeetingType.ONE_ON_ONE) return;
        const left = m.maxParticipants - seated.length;
        if (left > 0) push(`${k}:left`, st.at + 1, [{ t: "text", v: `${head}${label}${no !== null ? `'${locativeSuffix(no)}` : ""} ${left} sandalye kaldı` }]);
        else push(`${k}:full`, st.at + 1, [{ t: "text", v: `${head}${label} tamamlandı (${seated.length}/${m.maxParticipants})` }]);
      });

      if (m.participants.some((p) => !LEFT_STATUSES.includes(p.status))) {
        push(`${m.id}:locked`, meetingLockAt(m.scheduledAt), [{ t: "text", v: `${head}${label} kuruldu` }]);
        push(`${m.id}:reveal`, revealAt(m.scheduledAt), [{ t: "text", v: `${head}${label} masa detayları açıldı` }]);
        push(`${m.id}:met`, m.scheduledAt.getTime(), [{ t: "text", v: `${head}${label} buluştu` }]);
      }
    }
    push(`${city.id}:weekly`, start.getTime(), [{ t: "text", v: `${head}Geçen hafta ${lastWeekCount} masa kuruldu` }]);

    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    return { events: events.slice(0, FEED_MAX) };
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
      const d = shownDistrict(city.name, u.profile?.district);
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
      density: await this.density(city, demand),
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
