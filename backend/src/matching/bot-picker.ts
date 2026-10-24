import { AdminAlertType, Gender, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Belirtilen cinsiyette, o buluşma saatinde başka aktif masada olmayan aktif botlar
 * (admin elle bot ekleme listesi + otomatik seçim aynı kuralı kullanır).
 */
export async function availableBots(
  db: Db,
  opts: { gender: Gender; scheduledAt: Date; excludeIds?: string[] },
) {
  return db.user.findMany({
    where: {
      isBot: true,
      status: "ACTIVE",
      ...(opts.excludeIds?.length ? { id: { notIn: opts.excludeIds } } : {}),
      profile: { is: { gender: opts.gender } },
      participations: {
        none: {
          status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] },
          meeting: { scheduledAt: opts.scheduledAt, status: { in: ["PENDING", "ACTIVE"] } },
        },
      },
    },
    select: { id: true, profile: { select: { firstName: true, lastName: true, gender: true, birthDate: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Masaya eklenecek botu seçer.
 * - Sadece istenen cinsiyetteki aktif botlar (yanlış cinsiyet ASLA eklenmez)
 * - Aynı buluşma saatinde başka bir aktif masada aktif katılımcı olan bot seçilmez
 * - excludeIds: aynı masaya bu işlemde zaten seçilmiş botlar
 * - targetBirthDate verilirse yaşı en yakın bot; verilmezse rastgele
 * Uygun bot yoksa null döner.
 */
export async function pickBot(
  db: Db,
  opts: { gender: Gender; scheduledAt: Date; targetBirthDate?: Date | null; excludeIds?: string[] },
): Promise<{ id: string; birthDate: Date | null } | null> {
  const bots = await availableBots(db, opts);
  if (bots.length === 0) return null;

  const target = opts.targetBirthDate?.getTime();
  if (target === undefined) {
    const bot = bots[Math.floor(Math.random() * bots.length)];
    return { id: bot.id, birthDate: bot.profile?.birthDate ?? null };
  }

  const dist = (b: (typeof bots)[number]) =>
    b.profile?.birthDate ? Math.abs(b.profile.birthDate.getTime() - target) : Number.MAX_SAFE_INTEGER;
  bots.sort((a, b) => dist(a) - dist(b));
  return { id: bots[0].id, birthDate: bots[0].profile?.birthDate ?? null };
}

/** Uygun bot bulunamadı uyarısı — sadece SUPERADMIN görür (bot gizliliği) */
export async function alertBotNotFound(db: Db, userId: string): Promise<void> {
  await db.adminAlert.create({ data: { userId, alertType: AdminAlertType.BOT_NOT_FOUND } });
}
