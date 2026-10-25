import { PrismaService } from "../prisma/prisma.service";

// Admin ayarlar sayfasındaki anahtarların okunması (AppConfig)

// "Bot Sistemi Aktif" kapalıysa hiçbir yerde bot eklenmez
export async function isBotSystemActive(prisma: PrismaService): Promise<boolean> {
  const row = await prisma.appConfig.findUnique({ where: { key: "BOT_SYSTEM_ACTIVE" } });
  return row?.value !== "false";
}

// "Bakım Modu": paket satın alma ve yeni eşleşmeler durur; kayıt, giriş ve diğer işlemler çalışır
export async function isMaintenanceMode(prisma: PrismaService): Promise<boolean> {
  const row = await prisma.appConfig.findUnique({ where: { key: "MAINTENANCE_MODE" } });
  return row?.value === "true";
}
