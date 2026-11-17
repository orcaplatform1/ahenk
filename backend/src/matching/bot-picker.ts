import { AdminAlertType, Gender, MeetingType, Prisma, PrismaClient, UserRole } from "../generated/prisma/client";

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
 * - uygun botlardan rastgele biri
 * Uygun bot yoksa null döner.
 */
export async function pickBot(
  db: Db,
  opts: { gender: Gender; scheduledAt: Date; cityId?: string | null; excludeIds?: string[] },
): Promise<{ id: string; birthDate: Date | null } | null> {
  const bots = await availableBots(db, opts);
  if (bots.length === 0) return null;

  const bot = bots[Math.floor(Math.random() * bots.length)];
  return { id: bot.id, birthDate: bot.profile?.birthDate ?? null };
}

/** Uygun bot bulunamadı uyarısı — sadece SUPERADMIN görür (bot gizliliği) */
export async function alertBotNotFound(db: Db, userId: string): Promise<void> {
  await db.adminAlert.create({ data: { userId, alertType: AdminAlertType.BOT_NOT_FOUND } });
}

const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  [MeetingType.GROUP]: "Grup Masası",
  [MeetingType.ONE_ON_ONE]: "Baş Başa Masası",
  [MeetingType.KANKA]: "Kankamla Masası",
};

/**
 * Masaya bot atandı: her bot için Uyarılar sayfasına BOT_ASSIGNED kaydı + yalnız SUPERADMIN hesaplarına bildirim
 * (bot adı soyadı, masa türü, mekân, şehir, buluşma tarihi ve saati). Hata çağıranı kesmez.
 */
export async function notifyBotAssigned(
  db: Db,
  send: (userId: string, payload: { title: string; body: string; data?: Record<string, string> }) => Promise<void>,
  meetingId: string,
  botIds: string[],
): Promise<void> {
  if (botIds.length === 0) return;
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: { type: true, scheduledAt: true, locationText: true, venue: { select: { name: true } }, city: { select: { name: true } } },
  });
  if (!meeting) return;
  const [bots, superadmins] = await Promise.all([
    db.user.findMany({ where: { id: { in: botIds } }, select: { id: true, profile: { select: { firstName: true, lastName: true } } } }),
    db.user.findMany({ where: { role: UserRole.SUPERADMIN }, select: { id: true } }),
  ]);
  const when = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(meeting.scheduledAt);
  const venue = meeting.venue?.name ?? meeting.locationText ?? "Atanmadı";
  const city = meeting.city?.name ?? "—";
  for (const bot of bots) {
    const name = `${bot.profile?.firstName ?? ""} ${bot.profile?.lastName ?? ""}`.trim() || "Bot";
    const message = `${name} — ${MEETING_TYPE_LABEL[meeting.type]} — Mekân: ${venue} — Şehir: ${city} — ${when}`;
    await db.adminAlert.create({ data: { userId: bot.id, alertType: AdminAlertType.BOT_ASSIGNED, message } });
    for (const sa of superadmins) {
      await send(sa.id, { title: "Masaya bot atandı", body: message, data: { type: "BOT_ASSIGNED", meetingId } });
    }
  }
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
