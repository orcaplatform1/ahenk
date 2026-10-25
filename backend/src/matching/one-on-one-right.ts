import { Prisma, PrismaClient, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { OPEN_ONE_ON_ONE_SUB, syncPackageStatus } from "../payment/package-rights";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Başbaşa masası kurulduğu anda katılımcıların başbaşa hakkını harcar.
 * - KARSIMDA: tek kullanımlık → usedAt dolar, paket EXPIRED olur
 * - ICERDE:   başbaşa hakkı harcanır (usedAt); grup kısmı da kapandıysa paket EXPIRED olur
 * Önce KARSIMDA harcanır; yoksa ICERDE. Hakkı olmayan (bot vb.) kullanıcı atlanır.
 */
export async function consumeOneOnOneRights(db: Db, userIds: string[]): Promise<void> {
  const now = new Date();
  for (const userId of userIds) {
    const subs = await db.subscription.findMany({
      where: { userId, ...OPEN_ONE_ON_ONE_SUB },
      orderBy: { createdAt: "asc" },
      select: { id: true, plan: true },
    });
    const sub = subs.find((s) => s.plan === SubscriptionPlan.KARSIMDA) ?? subs[0];
    if (!sub) continue;

    await db.subscription.update({ where: { id: sub.id }, data: { usedAt: now } });
    await syncPackageStatus(db, sub.id);
  }
}

/**
 * Admin başbaşa masasını iptal ederse / katılımcıyı çıkarırsa harcanan hak geri verilir.
 * Hak masa oluşturulduğu işlemde harcandığı için usedAt, masanın createdAt anına denk gelir.
 * - usedAt temizlenir; başbaşa kısmı yeniden açıldığı için paket ACTIVE olur (4 döngü dolmadıysa)
 */
export async function restoreOneOnOneRights(db: Db, meetingCreatedAt: Date, userIds: string[]): Promise<void> {
  const WINDOW_MS = 5 * 60 * 1000;
  const from = new Date(meetingCreatedAt.getTime() - WINDOW_MS);
  const to = new Date(meetingCreatedAt.getTime() + WINDOW_MS);
  for (const userId of userIds) {
    const sub = await db.subscription.findFirst({
      where: {
        userId,
        plan: { in: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE] },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED] },
        usedAt: { gte: from, lte: to },
      },
      orderBy: { usedAt: "desc" },
      select: { id: true, plan: true },
    });
    if (!sub) continue;
    await db.subscription.update({ where: { id: sub.id }, data: { usedAt: null } });
    await syncPackageStatus(db, sub.id);
  }
}
