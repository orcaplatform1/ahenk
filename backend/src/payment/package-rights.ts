import { Prisma, PrismaClient, SubscriptionPlan, SubscriptionStatus, MeetingType } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Tek seferlik paketler:
// - Masada:   2 grup masası hakkı
// - Karşımda: 1 başbaşa masası hakkı (usedAt ile izlenir)
// - İçerde:   2 grup masası hakkı + 1 başbaşa masası hakkı
// - Kankamla: 2 Kankamla masası hakkı (alıcının paketi; kankası ücretsiz katılır)
// Her kısım 4 döngü geçerli. Döngü sayacı o türün her kilidinde (grup Perşembe, başbaşa Cuma) 1 artar.
// Kısmın hakkı bitince ya da 4 döngü dolunca o kısım kapanır; bütün kısımları kapanan paket EXPIRED olur.
export const PACKAGE_CYCLES = 4;
export const GROUP_RIGHTS: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.MASADA]: 2,
  [SubscriptionPlan.KARSIMDA]: 0,
  [SubscriptionPlan.ICERDE]: 2,
  [SubscriptionPlan.KANKAMLA]: 0,
};
export const KANKA_RIGHTS = 2;
export const GROUP_PLANS: SubscriptionPlan[] = [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE];
export const ONE_ON_ONE_PLANS: SubscriptionPlan[] = [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE];

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
  return GROUP_PLANS.includes(s.plan) && s.groupRights > 0 && s.groupCycles < PACKAGE_CYCLES;
}

export function oneOnOnePartOpen(s: RightsSub): boolean {
  return ONE_ON_ONE_PLANS.includes(s.plan) && !s.usedAt && s.oneOnOneCycles < PACKAGE_CYCLES;
}

export function kankaPartOpen(s: RightsSub): boolean {
  return s.plan === SubscriptionPlan.KANKAMLA && (s.kankaRights ?? 0) > 0 && (s.kankaCycles ?? 0) < PACKAGE_CYCLES;
}

// Havuz sorguları için: grup / başbaşa kısmı açık aktif paket
export const OPEN_GROUP_SUB: Prisma.SubscriptionWhereInput = {
  status: SubscriptionStatus.ACTIVE,
  plan: { in: GROUP_PLANS },
  groupRights: { gt: 0 },
  groupCycles: { lt: PACKAGE_CYCLES },
};
export const OPEN_ONE_ON_ONE_SUB: Prisma.SubscriptionWhereInput = {
  status: SubscriptionStatus.ACTIVE,
  plan: { in: ONE_ON_ONE_PLANS },
  usedAt: null,
  oneOnOneCycles: { lt: PACKAGE_CYCLES },
};
export const OPEN_KANKA_SUB: Prisma.SubscriptionWhereInput = {
  status: SubscriptionStatus.ACTIVE,
  plan: SubscriptionPlan.KANKAMLA,
  kankaRights: { gt: 0 },
  kankaCycles: { lt: PACKAGE_CYCLES },
};
export const RIGHTS_SELECT = {
  plan: true, groupRights: true, groupCycles: true, usedAt: true, oneOnOneCycles: true, kankaRights: true, kankaCycles: true,
} as const;

// Kısımlarına göre paket durumu: açık kısım varsa ACTIVE, yoksa EXPIRED (iptal edilmiş paket değişmez)
export async function syncPackageStatus(db: Db, subscriptionId: string): Promise<void> {
  const s = await db.subscription.findUnique({
    where: { id: subscriptionId },
    select: { status: true, ...RIGHTS_SELECT },
  });
  if (!s || s.status === SubscriptionStatus.CANCELLED) return;
  const next = groupPartOpen(s) || oneOnOnePartOpen(s) || kankaPartOpen(s) ? SubscriptionStatus.ACTIVE : SubscriptionStatus.EXPIRED;
  if (next !== s.status) await db.subscription.update({ where: { id: subscriptionId }, data: { status: next } });
}

// Grup kilidi (Perşembe 23:59): grup kısmı açık paketlerin döngüsü 1 artar; bu döngüde kurulmuş (iptal edilmemiş)
// grup masasında yeri olan kişinin 1 grup hakkı düşer. Kendisi iptal etmiş olsa da masa kurulmuş sayılır.
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

  const charged = new Set<string>();
  for (const sub of subs) {
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

// Kankamla kilidi (Cumartesi 23:59): bu döngüde kurulmuş (iptal edilmemiş) masadaki her çiftin paketinden 1 hak
// düşer; sonra açık Kankamla paketlerinin döngüsü 1 artar. İptal eden çiftin hakkı iptal anında düşer.
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
  const subs = await db.subscription.findMany({
    where: { ...OPEN_KANKA_SUB, createdAt: { lte: new Date(now.getTime() - CYCLE_COUNT_CUTOFF_MS) } },
    select: { id: true },
  });
  for (const sub of subs) {
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
