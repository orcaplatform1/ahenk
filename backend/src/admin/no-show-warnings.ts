import { PrismaClient, SanctionType } from "@prisma/client";

type Db = Pick<PrismaClient, "userSanction">;

// Geçerli gelmedi uyarıları: son askıdan sonra verilmiş ve kaldırılmamış (askı sayacı sıfırlar)
export async function activeNoShowWarningsWhere(db: Db, userId: string) {
  const lastSuspension = await db.userSanction.findFirst({
    where: { userId, type: SanctionType.SUSPENSION },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return {
    userId,
    type: SanctionType.WARNING,
    meetingId: { not: null },
    liftedAt: null,
    ...(lastSuspension ? { createdAt: { gt: lastSuspension.createdAt } } : {}),
  };
}
