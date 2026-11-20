// Askı modeli (tüm askılar): süreler 3 gün / 15 gün / 1 ay. Askı girişi engellemez, oturumları kapatmaz, paket haklarını ve
// aboneliği iptal etmez, iyzico / mağaza aboneliğini durdurmaz. Askıdaki kullanıcı yalnız masaya katılamaz (Seçim Yap ve tüm tarama
// kayıtları, kanka daveti / kabulü), paket ve abonelik satın alamaz. Askı aktif SUSPENSION yaptırımıyla belirlenir (User.status değişmez).
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, SanctionType } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const SUSPEND_DAYS = [3, 15, 30] as const; // 30 = 1 ay (takvim ayı)
export type SuspendDays = (typeof SUSPEND_DAYS)[number];

export const SUSPENDED_MESSAGE = "Hesabın askıda olduğu için masalara katılamaz, paket ve abonelik satın alamazsın.";

export function isSuspendDays(v: unknown): v is SuspendDays {
  return SUSPEND_DAYS.includes(v as SuspendDays);
}

// Askı bitişi: 3 / 15 gün; 30 → Türkiye takviminde 1 ay sonra
export function suspendUntil(days: SuspendDays, from = new Date()): Date {
  if (days !== 30) return new Date(from.getTime() + days * 86400000);
  const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const d = new Date(from.getTime() + TR_OFFSET_MS);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return new Date(d.getTime() - TR_OFFSET_MS);
}

export function suspendLabel(days: SuspendDays): { tr: string; en: string } {
  return days === 30 ? { tr: "1 ay", en: "1 month" } : { tr: `${days} gün`, en: `${days} days` };
}

// Askıya al bildirim şablonu
export function suspendText(days: SuspendDays): { tr: string; en: string } {
  const l = suspendLabel(days);
  return {
    tr: `Ahenk Ekibi: Kural ihlalin nedeniyle hesabın ${l.tr} boyunca askıya alındı. Bu süre içinde masalara katılamaz, paket ve abonelik satın alamazsın.`,
    en: `Ahenk Team: Your account has been suspended for ${l.en} due to a rule violation. During this period you can't join tables or buy packages and subscriptions.`,
  };
}

export function activeSuspensionWhere(now = new Date()): Prisma.UserSanctionWhereInput {
  return { type: SanctionType.SUSPENSION, liftedAt: null, expiresAt: { gt: now } };
}

// Eşleştirme havuzu: askıdaki kullanıcı havuza girmez
export function notSuspended(now = new Date()): Prisma.UserWhereInput {
  return { sanctions: { none: activeSuspensionWhere(now) } };
}

export async function activeSuspension(prisma: PrismaService, userId: string) {
  return prisma.userSanction.findFirst({
    where: { userId, ...activeSuspensionWhere() },
    orderBy: { expiresAt: "desc" },
    select: { id: true, expiresAt: true },
  });
}

// Masaya katılma / paket / abonelik satın alma uçlarında: askıdaki kullanıcı reddedilir (JwtAuthGuard'dan sonra)
@Injectable()
export class NotSuspendedGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const user = ctx.switchToHttp().getRequest().user as { id?: string } | undefined;
    if (user?.id && (await activeSuspension(this.prisma, user.id))) throw new ForbiddenException(SUSPENDED_MESSAGE);
    return true;
  }
}
