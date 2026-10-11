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
      await this.updateMissedCycles();
      this.logger.log("Perşembe kapanışı tamamlandı");
    } catch (err) {
      this.logger.error(`Perşembe kapanışı hatası: ${err}`);
    }
  }

  private async updateMissedCycles(): Promise<void> {
    const now = new Date();
    // Aktif abonelikler
    const subs = await this.prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { user: { select: { id: true } } },
    });

    for (const sub of subs) {
      const userId = sub.userId;
      const hasGroup = sub.plan === "MASADA" || sub.plan === "ICERDE";
      const hasOneone = sub.plan === "KARSIMDA" || sub.plan === "ICERDE";

      // Bu haftaki grup masası katılımı var mı?
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1); // Pazartesi
      weekStart.setHours(0, 0, 0, 0);

      const groupParticipation = hasGroup
        ? await this.prisma.meetingParticipant.findFirst({
            where: {
              userId,
              meeting: { type: "GROUP", createdAt: { gte: weekStart } },
              status: "ATTENDED",
            },
          })
        : null;

      const oneoneParticipation = hasOneone
        ? await this.prisma.meetingParticipant.findFirst({
            where: {
              userId,
              meeting: { type: "ONE_ON_ONE", createdAt: { gte: weekStart } },
              status: "ATTENDED",
            },
          })
        : null;

      let newGroupCycles = sub.missedGroupCycles;
      let newOneOneCycles = sub.missedOneonOneCycles;

      if (hasGroup) {
        newGroupCycles = groupParticipation ? 0 : sub.missedGroupCycles + 1;
      }
      if (hasOneone) {
        newOneOneCycles = oneoneParticipation ? 0 : sub.missedOneonOneCycles + 1;
      }

      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { missedGroupCycles: newGroupCycles, missedOneonOneCycles: newOneOneCycles },
      });

      // 4'e ulaşınca AdminAlert oluştur (tekrar oluşturma)
      if (hasGroup && newGroupCycles === 4) {
        const existing = await this.prisma.adminAlert.findFirst({
          where: { userId, alertType: "MISSED_GROUP_CYCLES", isRead: false },
        });
        if (!existing) {
          await this.prisma.adminAlert.create({ data: { userId, alertType: "MISSED_GROUP_CYCLES" } });
        }
      }
      if (hasOneone && newOneOneCycles === 4) {
        const existing = await this.prisma.adminAlert.findFirst({
          where: { userId, alertType: "MISSED_ONEONE_CYCLES", isRead: false },
        });
        if (!existing) {
          await this.prisma.adminAlert.create({ data: { userId, alertType: "MISSED_ONEONE_CYCLES" } });
        }
      }
    }
    this.logger.log("Döngü takibi güncellendi");
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
