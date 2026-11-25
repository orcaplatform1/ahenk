// Sözleşme / onay kaydı (AgreementConsent) ve giriş kaydı (LoginLog) için ortak yardımcılar.
import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Belge versiyonu: yasal metinlerdeki "Son güncelleme" ayı
export const AGREEMENT_VERSIONS = {
  kullanim_kosullari: "2026-11",
  kvkk_aydinlatma: "2026-11",
  mesafeli_satis: "2026-11",
  on_bilgilendirme: "2026-11",
  acik_riza_biyometrik: "2026-11",
} as const;

export type AgreementDocument = keyof typeof AGREEMENT_VERSIONS;
export type ClientPlatform = "web" | "ios" | "android";

// İstemci platformu User-Agent'tan: React Native Android ağ katmanı "okhttp", iOS "CFNetwork / Darwin"; diğerleri web
export function platformFromUserAgent(ua: string | undefined | null): ClientPlatform {
  const s = ua ?? "";
  if (/okhttp/i.test(s)) return "android";
  if (/CFNetwork|Darwin/i.test(s)) return "ios";
  return "web";
}

// İstemci platformu: önce X-Client-Platform başlığı (web | ios | android; web ve mobil istemciler gönderir), yoksa User-Agent
export function clientPlatform(headers: Record<string, string | string[] | undefined> | undefined): ClientPlatform {
  const h = headers?.["x-client-platform"];
  const v = (Array.isArray(h) ? h[0] : h ?? "").trim().toLowerCase();
  if (v === "web" || v === "ios" || v === "android") return v;
  const ua = headers?.["user-agent"];
  return platformFromUserAgent(Array.isArray(ua) ? ua[0] : ua);
}

export function cleanIp(ip: string | undefined | null): string | null {
  return ip ? ip.replace(/^::ffff:/, "") : null;
}

export async function recordAgreements(
  prisma: PrismaService,
  userId: string,
  documents: AgreementDocument[],
  ip: string | undefined | null,
  platform: ClientPlatform,
  packageId: string | null,
) {
  await prisma.agreementConsent.createMany({
    data: documents.map((d) => ({
      userId,
      documentType: d,
      documentVersion: AGREEMENT_VERSIONS[d],
      ip: cleanIp(ip),
      platform,
      packageId,
    })),
  });
}

type Headers = Record<string, string | string[] | undefined>;
export type RequestLike = { ip?: string; headers: Headers };

const loginLogger = new Logger("LoginLog");

// Giriş kaydı (LoginLog, 5651, 2 yıl): IP, User-Agent, platform (X-Client-Platform, yoksa User-Agent), başarılı / başarısız.
// Hesap türü: USER (üye) / ADMIN (ADMIN, SUPERADMIN) → userId = User.id; VENUE (mekân paneli) → venueAccountId = VenueAccount.id.
// Kayıt hatası girişi bozmaz
export type LoginAccount = { accountType: "USER" | "ADMIN"; userId: string } | { accountType: "VENUE"; venueAccountId: string };
export async function writeLoginLog(prisma: PrismaService, account: LoginAccount, req: RequestLike, success: boolean) {
  try {
    const ua = req.headers["user-agent"];
    const userAgent = (Array.isArray(ua) ? ua[0] : ua)?.slice(0, 500) ?? null;
    await prisma.loginLog.create({ data: { ...account, ip: cleanIp(req.ip), userAgent, platform: clientPlatform(req.headers), success } });
  } catch (e) {
    loginLogger.error(`Giriş kaydı yazılamadı: ${(e as Error).message}`);
  }
}
