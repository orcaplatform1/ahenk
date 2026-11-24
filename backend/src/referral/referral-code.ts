import { PrismaService } from "../prisma/prisma.service";

// Kalıcı kişisel davet kodu: yalnız rakamdan oluşan tam sayı. Numaralar 1'den başlar ve DB dizisinden ("User_referralCode_seq")
// sırayla alınır: aynı anda kayıtta çakışma olmaz, dizi geri sarılmadığı için silinen hesabın numarası tekrar verilmez.
// Botlara numara verilmez.

export function referralLink(code: number): string {
  return `${process.env.APP_URL ?? "https://ahenk.co"}/davet/${code}`;
}

// Kodu olmayan (bot olmayan) kullanıcıya sıradaki numara atanır; botta null
export async function ensureReferralCode(prisma: PrismaService, userId: string): Promise<number | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true, isBot: true } });
  if (!u || u.isBot) return null;
  if (u.referralCode != null) return u.referralCode;
  const rows = await prisma.$queryRaw<{ referralCode: number }[]>`
    UPDATE "User" SET "referralCode" = nextval('"User_referralCode_seq"')
    WHERE id = ${userId} AND "referralCode" IS NULL AND "isBot" = false
    RETURNING "referralCode"`;
  if (rows[0]) return rows[0].referralCode;
  const again = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  return again?.referralCode ?? null;
}

// Davet kodu metni geçerli mi: yalnız rakam, pozitif tam sayı
export function parseReferralCode(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!/^\d{1,9}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 2147483647 ? n : null;
}
