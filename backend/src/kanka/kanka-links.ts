import { Prisma, PrismaClient, MeetingType, MeetingStatus } from "@prisma/client";
import { trWeekStart } from "../admin/tr-week";
import { sosWindowEnd } from "../meetings/meeting-windows";

type Db = PrismaClient | Prisma.TransactionClient;

// Kişinin aktif kankalığı (kişi başına tek aktif kankalık)
export async function activeKankaLink(db: Db, userId: string) {
  const link = await db.kankaLink.findFirst({
    where: { endedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, userAId: true, userBId: true, createdAt: true },
  });
  if (!link) return null;
  return { ...link, kankaId: link.userAId === userId ? link.userBId : link.userAId };
}

// Kankalık kilidi: kanka seçildiği hafta (Pazar 23:59 TR'ye kadar) ve çiftin o haftaki Kankamla masası
// sürerken (acil yardım süresi bitene kadar) kankalıktan çıkılamaz / kanka değiştirilemez.
export async function kankaLockReason(db: Db, link: { createdAt: Date; userAId: string; userBId: string }, now = new Date()): Promise<string | null> {
  if (link.createdAt >= trWeekStart(now)) {
    return "Kanka seçildiği hafta kilitlenir; Pazar 23:59'dan sonra değiştirebilirsin.";
  }
  const meetings = await db.meeting.findMany({
    where: {
      type: MeetingType.KANKA,
      status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] },
      participants: { some: { userId: { in: [link.userAId, link.userBId] }, status: { notIn: ["CANCELLED", "DECLINED"] } } },
    },
    select: { scheduledAt: true },
  });
  if (meetings.some((m) => sosWindowEnd(m.scheduledAt) > now)) {
    return "Kankamla masanız sürerken kankalıktan çıkamazsın.";
  }
  return null;
}

// Ban / hesap kapatma: kankalık biter, bekleyen davetler iptal olur
export async function endKankaLinks(db: Db, userId: string, reason: "USER" | "BAN"): Promise<string[]> {
  const links = await db.kankaLink.findMany({
    where: { endedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true, userAId: true, userBId: true },
  });
  if (links.length > 0) {
    await db.kankaLink.updateMany({ where: { id: { in: links.map((l) => l.id) } }, data: { endedAt: new Date(), endReason: reason } });
  }
  if (reason === "BAN") {
    await db.kankaInvite.updateMany({ where: { inviterId: userId, status: "PENDING" }, data: { status: "CANCELLED" } });
  }
  return links.map((l) => (l.userAId === userId ? l.userBId : l.userAId));
}
