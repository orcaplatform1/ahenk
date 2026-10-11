import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MatchingService } from "./matching.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MatchingScheduler {
  private readonly logger = new Logger(MatchingScheduler.name);

  constructor(
    private matchingService: MatchingService,
    private prisma: PrismaService,
  ) {}

  // Her saat başı: havuzda yeterli kullanıcı birikince masa kur
  @Cron("0 * * * *", { timeZone: "Europe/Istanbul" })
  async scheduleHourlyMatching(): Promise<void> {
    this.logger.log("Saatlik eşleştirme başlıyor...");
    try {
      const result = await this.matchingService.runHourlyMatching();
      this.logger.log(`Saatlik eşleştirme: ${result.tablesCreated} masa kuruldu`);
    } catch (err) {
      this.logger.error(`Saatlik eşleştirme hatası: ${err}`);
    }
  }

  // Perşembe 23:59 (TR): döngüyü kapat, bot ekle, artakalanları bekliste al
  @Cron("59 23 * * 4", { timeZone: "Europe/Istanbul" })
  async scheduleThursdayClosing(): Promise<void> {
    this.logger.log("Perşembe kapanışı başlıyor...");
    try {
      await this.matchingService.runThursdayClosing();
      this.logger.log("Perşembe kapanışı tamamlandı");
    } catch (err) {
      this.logger.error(`Perşembe kapanışı hatası: ${err}`);
    }
  }

  // Cumartesi 10:00 (TR): eşleşmiş kullanıcılara bildirim gönder
  @Cron("0 10 * * 6", { timeZone: "Europe/Istanbul" })
  async scheduleSaturdayNotifications(): Promise<void> {
    this.logger.log("Cumartesi bildirimleri gönderiliyor...");
    try {
      await this.matchingService.sendSaturdayNotifications();
      this.logger.log("Cumartesi bildirimleri tamamlandı");
    } catch (err) {
      this.logger.error(`Cumartesi bildirim hatası: ${err}`);
    }
  }

  // Pazartesi 00:01 (TR): aktif şehirleri sıfırla
  @Cron("1 0 * * 1", { timeZone: "Europe/Istanbul" })
  async resetActiveCities(): Promise<void> {
    this.logger.log("Aktif şehirler sıfırlanıyor...");
    try {
      await this.prisma.user.updateMany({ data: { activeCity: null } });
      this.logger.log("Aktif şehirler sıfırlandı");
    } catch (err) {
      this.logger.error(`Aktif şehir sıfırlama hatası: ${err}`);
    }
  }
}
