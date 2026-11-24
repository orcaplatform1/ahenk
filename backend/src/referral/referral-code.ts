import { randomInt } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

// Kalıcı kişisel davet kodu: 8 karakter (karışan 0/O, 1/I harfleri yok), kullanıcı başına bir kez oluşturulur, değişmez
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newReferralCode(): string {
  let c = "";
  for (let i = 0; i < 8; i++) c += ALPHABET[randomInt(ALPHABET.length)];
  return c;
}

export function referralLink(code: string): string {
  return `${process.env.APP_URL ?? "https://ahenk.co"}/kayit?ref=${code}`;
}

// Kodu olmayan kullanıcıya (migration sonrası oluşan hesaplar) ilk ihtiyaçta kod atanır
export async function ensureReferralCode(prisma: PrismaService, userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = newReferralCode();
    try {
      const { count } = await prisma.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } });
      if (count > 0) return code;
      const again = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
      if (again?.referralCode) return again.referralCode;
    } catch {
      // Benzersizlik çakışması: yeni kodla tekrar denenir
    }
  }
  throw new Error("Davet kodu oluşturulamadı");
}
