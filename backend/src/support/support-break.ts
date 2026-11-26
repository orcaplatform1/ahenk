import type { PrismaService } from "../prisma/prisma.service";
import { SupportAgentStatus } from "../generated/prisma/client";

// Temsilcinin açık mola kaydını verilen saatle kapatır (moladan dönüş, çevrimdışı olma, çıkış)
export async function closeOpenBreak(prisma: PrismaService, agentId: string, at = new Date()) {
  await prisma.supportBreak.updateMany({ where: { agentId, endedAt: null }, data: { endedAt: at } });
}

// Çıkış yapan temsilci: moladaysa çevrimdışı olur, açık mola kaydı o anki saatle kapanır
export async function endBreakOnLogout(prisma: PrismaService, userId: string) {
  const at = new Date();
  const res = await prisma.supportAgent.updateMany({ where: { userId, status: SupportAgentStatus.BREAK }, data: { status: SupportAgentStatus.OFFLINE, statusChangedAt: at } });
  if (res.count) await closeOpenBreak(prisma, userId, at);
}
