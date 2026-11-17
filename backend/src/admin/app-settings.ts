import { PrismaService } from "../prisma/prisma.service";

// Admin ayarlar sayfasındaki anahtarların okunması (AppConfig)

// "Bot Sistemi Aktif" kapalıysa hiçbir yerde bot eklenmez
export async function isBotSystemActive(prisma: PrismaService): Promise<boolean> {
  const row = await prisma.appConfig.findUnique({ where: { key: "BOT_SYSTEM_ACTIVE" } });
  return row?.value !== "false";
}

// "Canlı katman ilçe verisi": varsayılan statik
export async function liveDistrictSource(prisma: PrismaService): Promise<"static" | "real"> {
  const row = await prisma.appConfig.findUnique({ where: { key: "LIVE_DISTRICT_SOURCE" } });
  return row?.value === "real" ? "real" : "static";
}

// "Bakım Modu": paket satın alma ve yeni eşleşmeler durur; kayıt, giriş ve diğer işlemler çalışır
export async function isMaintenanceMode(prisma: PrismaService): Promise<boolean> {
  const row = await prisma.appConfig.findUnique({ where: { key: "MAINTENANCE_MODE" } });
  return row?.value === "true";
}

// "Eşleştirme Kriterleri": Planlı Buluşma'da masa türüne göre OCEAN sıralaması (her atamada okunur, restart gerekmez).
// Varsayılan: Grup AÇIK, Baş Başa KAPALI, Kankamla KAPALI. Kapalıyken sıralama yaş %50 + mekân kategori %50. Yarın'da OCEAN hep kapalı.
export async function oceanCriteria(prisma: PrismaService): Promise<{ GROUP: boolean; ONE_ON_ONE: boolean; KANKA: boolean }> {
  const rows = await prisma.appConfig.findMany({ where: { key: { in: ["OCEAN_GROUP", "OCEAN_ONE_ON_ONE", "OCEAN_KANKA"] } } });
  const v = (key: string) => rows.find((r) => r.key === key)?.value;
  return { GROUP: v("OCEAN_GROUP") !== "false", ONE_ON_ONE: v("OCEAN_ONE_ON_ONE") === "true", KANKA: v("OCEAN_KANKA") === "true" };
}

// "Eşleştirme Aktif" kapalıysa masa atamaları, kilitler, hak düşümleri ve eşleştirme bildirimleri durur
export async function isMatchingEnabled(prisma: PrismaService): Promise<boolean> {
  const row = await prisma.appConfig.findUnique({ where: { key: "MATCHING_ENABLED" } });
  return row?.value !== "false";
}
