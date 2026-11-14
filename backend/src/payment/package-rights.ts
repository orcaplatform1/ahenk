import { Prisma, PrismaClient, SubscriptionPlan, SubscriptionStatus, MeetingType } from "../generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Tek seferlik paketler (haklar kullanılana kadar geçerli, süre / döngü sınırı yok):
// - Grup (MASADA):       1 grup buluşması hakkı
// - Başbaşa (KARSIMDA):  1 başbaşa buluşması hakkı (usedAt ile izlenir)
// - İçerde (ICERDE):     1 grup + 1 başbaşa buluşması hakkı
// - Kankamla (KANKAMLA): 1 Kankamla buluşması hakkı (alıcının paketi; kankası ücretsiz katılır)
// Prime (PRIME_1M/3M/6M/12M): 1 grup + 1 başbaşa + 1 kankamla; satın almadan itibaren her 30 günde yeniden tanımlanır.
// Döngü sayaçları yalnız bilgi amaçlı artar. Bütün kısımları kapanan tek seferlik paket EXPIRED olur;
// Prime dönem sonuna kadar ACTIVE kalır (prime.ts).
export const PRIME_PLANS: SubscriptionPlan[] = [SubscriptionPlan.PRIME_1M, SubscriptionPlan.PRIME_3M, SubscriptionPlan.PRIME_6M, SubscriptionPlan.PRIME_12M];
export const isPrime = (plan: SubscriptionPlan): boolean => PRIME_PLANS.includes(plan);
export const GROUP_RIGHTS: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.MASADA]: 1,
  [SubscriptionPlan.KARSIMDA]: 0,
  [SubscriptionPlan.ICERDE]: 1,
  [SubscriptionPlan.KANKAMLA]: 0,
  [SubscriptionPlan.PRIME_1M]: 1,
  [SubscriptionPlan.PRIME_3M]: 1,
  [SubscriptionPlan.PRIME_6M]: 1,
  [SubscriptionPlan.PRIME_12M]: 1,
};
export const KANKA_RIGHTS = 1;
export const GROUP_PLANS: SubscriptionPlan[] = [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE, ...PRIME_PLANS];
export const ONE_ON_ONE_PLANS: SubscriptionPlan[] = [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE, ...PRIME_PLANS];
export const KANKA_PLANS: SubscriptionPlan[] = [SubscriptionPlan.KANKAMLA, ...PRIME_PLANS];
// Pakette tanımlı başlangıç hakları (satın almada ve Prime 30 günlük yenilemede)
export const kankaRightsOf = (plan: SubscriptionPlan): number => (KANKA_PLANS.includes(plan) ? KANKA_RIGHTS : 0);

// Kilit anından bu kadar önce alınan paket o döngüye sayılmaz (atama 23:44'te durur, kilit 23:59)
const CYCLE_COUNT_CUTOFF_MS = 15 * 60 * 1000;

type RightsSub = {
  plan: SubscriptionPlan;
  groupRights: number;
  groupCycles: number;
  usedAt: Date | null;
  oneOnOneCycles: number;
  kankaRights?: number;
  kankaCycles?: number;
};

export function groupPartOpen(s: RightsSub): boolean {
  return GROUP_PLANS.includes(s.plan) && s.groupRights > 0;
}

export function oneOnOnePartOpen(s: RightsSub): boolean {
  return ONE_ON_ONE_PLANS.includes(s.plan) && !s.usedAt;
}

export function kankaPartOpen(s: RightsSub): boolean {
  return KANKA_PLANS.includes(s.plan) && (s.kankaRights ?? 0) > 0;
}

// Havuz sorguları için: grup / başbaşa kısmı açık aktif paket
export const OPEN_GROUP_SUB: Prisma.SubscriptionWhereInput = {
  status: SubscriptionStatus.ACTIVE,
  plan: { in: GROUP_PLANS },
  groupRights: { gt: 0 },
};
export const OPEN_ONE_ON_ONE_SUB: Prisma.SubscriptionWhereInput = {
  status: SubscriptionStatus.ACTIVE,
  plan: { in: ONE_ON_ONE_PLANS },
  usedAt: null,
};
export const OPEN_KANKA_SUB: Prisma.SubscriptionWhereInput = {
  status: SubscriptionStatus.ACTIVE,
  plan: { in: KANKA_PLANS },
  kankaRights: { gt: 0 },
};
export const RIGHTS_SELECT = {
  plan: true, groupRights: true, groupCycles: true, usedAt: true, oneOnOneCycles: true, kankaRights: true, kankaCycles: true,
} as const;

// Kısımlarına göre paket durumu: açık kısım varsa ACTIVE, yoksa EXPIRED (iptal edilmiş paket değişmez).
// Prime hakları bitse de dönem sonuna kadar ACTIVE kalır (30 günde bir yenilenir; süre bitişi prime.ts'de).
export async function syncPackageStatus(db: Db, subscriptionId: string): Promise<void> {
  const s = await db.subscription.findUnique({
    where: { id: subscriptionId },
    select: { status: true, ...RIGHTS_SELECT },
  });
  if (!s || s.status === SubscriptionStatus.CANCELLED || isPrime(s.plan)) return;
  const next = groupPartOpen(s) || oneOnOnePartOpen(s) || kankaPartOpen(s) ? SubscriptionStatus.ACTIVE : SubscriptionStatus.EXPIRED;
  if (next !== s.status) await db.subscription.update({ where: { id: subscriptionId }, data: { status: next } });
}

// Rezervasyon iptali (grup): en eski açık paketten 1 hak + 1 döngü anında düşer; kilit bu paketi tekrar saymaz
export async function chargeGroupCancel(db: Db, participantId: string, userId: string): Promise<void> {
  const sub = await db.subscription.findFirst({
    where: { userId, ...OPEN_GROUP_SUB },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!sub) return;
  await db.subscription.update({
    where: { id: sub.id },
    data: { groupRights: { decrement: 1 }, groupCycles: { increment: 1 } },
  });
  await db.meetingParticipant.update({ where: { id: participantId }, data: { groupRightSubId: sub.id } });
  await syncPackageStatus(db, sub.id);
}

// Grup kilidi (Perşembe 23:59): grup kısmı açık paketlerin döngüsü 1 artar; bu döngüde kurulmuş (iptal edilmemiş)
// grup masasında yeri olan kişinin 1 grup hakkı düşer. Kendisi iptal etmiş olsa da masa kurulmuş sayılır.
// Rezervasyon iptalinde hak ve döngüsü düşülmüş paket bu kilitte sayılmaz.
export async function closeGroupCycle(db: Db, cycleId: string | null, now = new Date()): Promise<void> {
  const subs = await db.subscription.findMany({
    where: { ...OPEN_GROUP_SUB, createdAt: { lte: new Date(now.getTime() - CYCLE_COUNT_CUTOFF_MS) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true },
  });

  const participants = cycleId
    ? await db.meetingParticipant.findMany({
        where: { groupRightSubId: null, meeting: { cycleId, type: MeetingType.GROUP, status: { not: "CANCELLED" } } },
        select: { id: true, userId: true },
      })
    : [];
  const participantByUser = new Map(participants.map((p) => [p.userId, p.id]));
  const cancelCharged = new Set(
    cycleId
      ? (await db.meetingParticipant.findMany({
          where: { status: "CANCELLED", groupRightSubId: { not: null }, meeting: { cycleId, type: MeetingType.GROUP } },
          select: { groupRightSubId: true },
        })).map((p) => p.groupRightSubId)
      : [],
  );

  const charged = new Set<string>();
  for (const sub of subs) {
    if (cancelCharged.has(sub.id)) continue;
    const participantId = participantByUser.get(sub.userId);
    // Aynı kişinin birden fazla grup paketi varsa hak en eskiden düşer
    const charge = !!participantId && !charged.has(sub.userId);
    await db.subscription.update({
      where: { id: sub.id },
      data: { groupCycles: { increment: 1 }, ...(charge ? { groupRights: { decrement: 1 } } : {}) },
    });
    if (charge) {
      charged.add(sub.userId);
      await db.meetingParticipant.update({ where: { id: participantId }, data: { groupRightSubId: sub.id } });
    }
    await syncPackageStatus(db, sub.id);
  }
}

// Başbaşa kilidi (Cuma 23:59): başbaşa kısmı açık paketlerin döngüsü 1 artar (hak masa kurulunca zaten harcanır)
export async function closeOneOnOneCycle(db: Db, now = new Date()): Promise<void> {
  const subs = await db.subscription.findMany({
    where: { ...OPEN_ONE_ON_ONE_SUB, createdAt: { lte: new Date(now.getTime() - CYCLE_COUNT_CUTOFF_MS) } },
    select: { id: true },
  });
  for (const sub of subs) {
    await db.subscription.update({ where: { id: sub.id }, data: { oneOnOneCycles: { increment: 1 } } });
    await syncPackageStatus(db, sub.id);
  }
}

// Admin kilitten sonra grup masasını iptal ederse / katılımcıyı çıkarırsa düşülen grup hakkı geri verilir
export async function restoreGroupRights(db: Db, meetingId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const charged = await db.meetingParticipant.findMany({
    where: { meetingId, userId: { in: userIds }, groupRightSubId: { not: null } },
    select: { id: true, groupRightSubId: true },
  });
  for (const p of charged) {
    await db.subscription.update({ where: { id: p.groupRightSubId! }, data: { groupRights: { increment: 1 } } });
    await db.meetingParticipant.update({ where: { id: p.id }, data: { groupRightSubId: null } });
    await syncPackageStatus(db, p.groupRightSubId!);
  }
}

// ─── Kankamla ────────────────────────────────────────────────────────────────

// Çiftin kullandığı paket: iki kişiden birinin açık Kankamla paketi (iki kişide de varsa en eskisi)
export async function pairKankaSub(db: Db, userIds: string[]) {
  return db.subscription.findFirst({
    where: { userId: { in: userIds }, ...OPEN_KANKA_SUB },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, createdAt: true },
  });
}

// Çiftin paketinden 1 hak düşer ve hangi paketten düşüldüğü katılımcıya yazılır (admin iadesi için)
export async function chargeKankaRight(db: Db, participantId: string, subscriptionId: string): Promise<void> {
  await db.subscription.update({ where: { id: subscriptionId }, data: { kankaRights: { decrement: 1 } } });
  await db.meetingParticipant.update({ where: { id: participantId }, data: { kankaRightSubId: subscriptionId } });
  await syncPackageStatus(db, subscriptionId);
}

// Rezervasyon iptali (Kankamla): çiftin paketinden 1 hak + 1 döngü anında düşer; kilit bu paketi tekrar saymaz
export async function chargeKankaCancel(db: Db, participantId: string, subscriptionId: string): Promise<void> {
  await db.subscription.update({ where: { id: subscriptionId }, data: { kankaCycles: { increment: 1 } } });
  await chargeKankaRight(db, participantId, subscriptionId);
}

// Kankamla kilidi (Cumartesi 23:59): bu döngüde kurulmuş (iptal edilmemiş) masadaki her çiftin paketinden 1 hak
// düşer; sonra açık Kankamla paketlerinin döngüsü 1 artar. İptal eden çiftin hak ve döngüsü iptal anında düşer.
export async function closeKankaCycle(db: Db, cycleId: string | null, now = new Date()): Promise<void> {
  if (cycleId) {
    const meetings = await db.meeting.findMany({
      where: { cycleId, type: MeetingType.KANKA, status: { not: "CANCELLED" } },
      select: { participants: { select: { id: true, userId: true, kankaPartnerId: true, kankaRightSubId: true } } },
    });
    for (const m of meetings) {
      const done = new Set<string>();
      for (const p of m.participants) {
        if (done.has(p.userId)) continue;
        const pairIds = [p.userId, ...(p.kankaPartnerId ? [p.kankaPartnerId] : [])];
        pairIds.forEach((id) => done.add(id));
        if (m.participants.some((x) => pairIds.includes(x.userId) && x.kankaRightSubId)) continue;
        const sub = await pairKankaSub(db, pairIds);
        if (!sub) continue;
        const buyer = m.participants.find((x) => x.userId === sub.userId) ?? p;
        await chargeKankaRight(db, buyer.id, sub.id);
      }
    }
  }
  const cancelCharged = new Set(
    cycleId
      ? (await db.meetingParticipant.findMany({
          where: { kankaRightSubId: { not: null }, meeting: { cycleId, type: MeetingType.KANKA, status: "CANCELLED" } },
          select: { kankaRightSubId: true },
        })).map((p) => p.kankaRightSubId)
      : [],
  );
  const subs = await db.subscription.findMany({
    where: { ...OPEN_KANKA_SUB, createdAt: { lte: new Date(now.getTime() - CYCLE_COUNT_CUTOFF_MS) } },
    select: { id: true },
  });
  for (const sub of subs) {
    if (cancelCharged.has(sub.id)) continue;
    await db.subscription.update({ where: { id: sub.id }, data: { kankaCycles: { increment: 1 } } });
    await syncPackageStatus(db, sub.id);
  }
}

// Admin Kankamla masasını iptal ederse / çiftten birini çıkarırsa düşülen hak geri verilir
export async function restoreKankaRights(db: Db, meetingId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const charged = await db.meetingParticipant.findMany({
    where: { meetingId, userId: { in: userIds }, kankaRightSubId: { not: null } },
    select: { id: true, kankaRightSubId: true },
  });
  for (const p of charged) {
    await db.subscription.update({ where: { id: p.kankaRightSubId! }, data: { kankaRights: { increment: 1 } } });
    await db.meetingParticipant.update({ where: { id: p.id }, data: { kankaRightSubId: null } });
    await syncPackageStatus(db, p.kankaRightSubId!);
  }
}
