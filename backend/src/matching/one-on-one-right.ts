import { Prisma, PrismaClient, SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/client";
import { OPEN_ONE_ON_ONE_SUB, syncPackageStatus } from "../payment/package-rights";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Başbaşa masasında iki kişi oturduğu anda katılımcıların başbaşa hakkını harcar.
 * usedAt masanın açılış anıdır (createdAt): masa ilk kişiyle açılıp sonradan dolsa da hak iadesi masayı bulur.
 * - KARSIMDA: tek kullanımlık → usedAt dolar, paket EXPIRED olur
 * - ICERDE:   başbaşa hakkı harcanır (usedAt); grup kısmı da kapandıysa paket EXPIRED olur
 * Önce KARSIMDA harcanır; yoksa ICERDE. Hakkı olmayan (bot vb.) kullanıcı atlanır.
 */
export async function consumeOneOnOneRights(db: Db, userIds: string[], meetingCreatedAt: Date): Promise<void> {
  for (const userId of userIds) {
    const subs = await db.subscription.findMany({
      where: { userId, ...OPEN_ONE_ON_ONE_SUB },
      orderBy: { createdAt: "asc" },
      select: { id: true, plan: true },
    });
    const sub = subs.find((s) => s.plan === SubscriptionPlan.KARSIMDA) ?? subs[0];
    if (!sub) continue;

    await db.subscription.update({ where: { id: sub.id }, data: { usedAt: meetingCreatedAt } });
    await syncPackageStatus(db, sub.id);
  }
}

// Bu masa için harcanmış başbaşa hakkının paketi
function spentSub(db: Db, userId: string, meetingCreatedAt: Date) {
  const WINDOW_MS = 5 * 60 * 1000;
  return db.subscription.findFirst({
    where: {
      userId,
      plan: { in: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE] },
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED] },
      usedAt: { gte: new Date(meetingCreatedAt.getTime() - WINDOW_MS), lte: new Date(meetingCreatedAt.getTime() + WINDOW_MS) },
    },
    orderBy: { usedAt: "desc" },
    select: { id: true },
  });
}

/**
 * Rezervasyon iptali (başbaşa): iptal edenin hakkı kullanılmış sayılır, 1 döngü düşer.
 * Masada tek başınaysa hak henüz harcanmamıştır, burada harcanır.
 */
export async function chargeOneOnOneCancel(db: Db, userId: string, meetingCreatedAt: Date): Promise<void> {
  const spent = await spentSub(db, userId, meetingCreatedAt);
  const open = spent ? [] : await db.subscription.findMany({
    where: { userId, ...OPEN_ONE_ON_ONE_SUB },
    orderBy: { createdAt: "asc" },
    select: { id: true, plan: true },
  });
  const subId = spent?.id ?? (open.find((s) => s.plan === SubscriptionPlan.KARSIMDA) ?? open[0])?.id;
  if (!subId) return;
  await db.subscription.update({
    where: { id: subId },
    data: { oneOnOneCycles: { increment: 1 }, ...(spent ? {} : { usedAt: new Date() }) },
  });
  await syncPackageStatus(db, subId);
}

/**
 * Admin başbaşa masasını iptal ederse / katılımcıyı çıkarırsa harcanan hak geri verilir.
 * Hak masa oluşturulduğu işlemde harcandığı için usedAt, masanın createdAt anına denk gelir.
 * - usedAt temizlenir; başbaşa kısmı yeniden açıldığı için paket ACTIVE olur (4 döngü dolmadıysa)
 */
export async function restoreOneOnOneRights(db: Db, meetingCreatedAt: Date, userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    const sub = await spentSub(db, userId, meetingCreatedAt);
    if (!sub) continue;
    await db.subscription.update({ where: { id: sub.id }, data: { usedAt: null } });
    await syncPackageStatus(db, sub.id);
  }
}
