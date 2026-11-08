import { PrismaService } from "../prisma/prisma.service";

// Her kullanıcı için en fazla son 25 uygulama içi (IN_APP) bildirim tutulur; 26. bildirim gelince en eskisi silinir.
export const NOTIFICATION_KEEP = 25;

export async function pruneInAppNotifications(prisma: PrismaService, userId: string): Promise<void> {
  const old = await prisma.notification.findMany({
    where: { userId, type: "IN_APP" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: NOTIFICATION_KEEP,
    select: { id: true },
  });
  if (old.length > 0) await prisma.notification.deleteMany({ where: { id: { in: old.map((n) => n.id) } } });
}
