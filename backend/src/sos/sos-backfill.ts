// Tek seferlik: daha önce çözülmüş acil yardım taleplerinde son konumu açık adrese çevirip konum verisini siler.
// Çalıştırma: node dist/sos/sos-backfill.js (uygulama modülü açılmaz; yalnız veritabanı ve Nominatim kullanılır)
import "dotenv/config";
import { PrismaService } from "../prisma/prisma.service";
import { SosService } from "./sos.service";

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const sos = new SosService(prisma, null as never, null as never);
  const r = await sos.backfillResolvedLocations();
  console.log(JSON.stringify(r));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
