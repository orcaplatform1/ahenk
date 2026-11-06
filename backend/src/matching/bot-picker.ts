import { AdminAlertType, Gender, Prisma, PrismaClient } from "../generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Belirtilen cinsiyette, masanın şehrinde (bot şehri: profil primaryCity) ve o buluşma saatinde
 * başka aktif masada olmayan aktif botlar
 * (admin elle bot ekleme listesi + otomatik seçim aynı kuralı kullanır).
 */
export async function availableBots(
  db: Db,
  opts: { gender: Gender; scheduledAt: Date; cityId?: string | null; excludeIds?: string[] },
) {
  return db.user.findMany({
    where: {
      isBot: true,
      status: "ACTIVE",
      ...(opts.excludeIds?.length ? { id: { notIn: opts.excludeIds } } : {}),
      profile: { is: { gender: opts.gender, ...(opts.cityId ? { primaryCity: opts.cityId } : {}) } },
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
 * - Sadece istenen cinsiyetteki ve masanın şehrindeki aktif botlar (yanlış cinsiyet ASLA eklenmez)
 * - Aynı buluşma saatinde başka bir aktif masada aktif katılımcı olan bot seçilmez
 * - excludeIds: aynı masaya bu işlemde zaten seçilmiş botlar
 * - targetBirthDate verilirse yaşı en yakın bot; verilmezse rastgele
 * Uygun bot yoksa null döner.
 */
export async function pickBot(
  db: Db,
  opts: { gender: Gender; scheduledAt: Date; cityId?: string | null; targetBirthDate?: Date | null; excludeIds?: string[] },
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

/** Aynı bot 4 hafta kuralı: bu gerçek kullanıcılardan biriyle son 28 gün içinde aynı masada bulunmuş botlar */
export const BOT_REPEAT_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
export async function recentlyMetBotIds(db: Db, realUserIds: string[], now: Date = new Date()): Promise<string[]> {
  if (realUserIds.length === 0) return [];
  const left = ["CANCELLED", "DECLINED", "NO_SHOW"] as const;
  const rows = await db.meetingParticipant.findMany({
    where: {
      user: { isBot: true },
      status: { notIn: [...left] },
      meeting: {
        scheduledAt: { gte: new Date(now.getTime() - BOT_REPEAT_WINDOW_MS) },
        status: { not: "CANCELLED" },
        participants: { some: { userId: { in: realUserIds }, status: { notIn: [...left] } } },
      },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.map((r) => r.userId);
}
