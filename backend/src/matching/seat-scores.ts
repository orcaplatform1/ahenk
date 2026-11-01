import { ParticipantStatus, Prisma, PrismaClient } from "../generated/prisma/client";
import { matchScore } from "./match-score";

type Db = PrismaClient | Prisma.TransactionClient;

const LEFT: ParticipantStatus[] = [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED, ParticipantStatus.NO_SHOW];

// Masadaki herkesin matchScore'u: masadaki diğer kişilerle skorlarının ortalaması (başbaşada tek skor).
// Masaya yeni kişi oturunca diğerlerinin ortalaması da değiştiği için tüm masa yazılır.
export async function writeSeatScores(db: Db, meetingId: string): Promise<void> {
  const seated = await db.meetingParticipant.findMany({
    where: { meetingId, status: { notIn: LEFT } },
    select: {
      id: true,
      user: {
        select: {
          occupationSector: true,
          oceanScore: { select: { openness: true, conscientiousness: true, extraversion: true, agreeableness: true, neuroticism: true } },
        },
      },
    },
  });
  if (seated.length < 2) return;
  for (const me of seated) {
    const others = seated.filter((p) => p.id !== me.id);
    const score = others.reduce((sum, p) => sum + matchScore(me.user, p.user), 0) / others.length;
    await db.meetingParticipant.update({ where: { id: me.id }, data: { matchScore: Math.round(score * 100) / 100 } });
  }
}
