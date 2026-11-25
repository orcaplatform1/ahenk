// Sözleşme / onay kaydı (AgreementConsent) ve giriş kaydı (LoginLog) için ortak yardımcılar.
import { PrismaService } from "../prisma/prisma.service";

// Belge versiyonu: yasal metinlerdeki "Son güncelleme" ayı
export const AGREEMENT_VERSIONS = {
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
