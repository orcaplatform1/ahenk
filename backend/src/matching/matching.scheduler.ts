import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MatchingService } from "./matching.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiReportService } from "../meetings/ai-report.service";
import { NotificationService } from "../notification/notification.service";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

@Injectable()
export class MatchingScheduler {
  private readonly logger = new Logger(MatchingScheduler.name);

  constructor(
    private matchingService: MatchingService,
    private prisma: PrismaService,
    private aiReportService: AiReportService,
    private notifications: NotificationService,
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

  // Cumartesi 10:00 (TR): eşleşmiş kullanıcılara bildirim gönder + AI raporları oluştur
  @Cron("0 10 * * 6", { timeZone: "Europe/Istanbul" })
  async scheduleSaturdayNotifications(): Promise<void> {
    this.logger.log("Cumartesi bildirimleri gönderiliyor...");
    try {
      await this.matchingService.sendSaturdayNotifications();
      this.logger.log("Cumartesi bildirimleri tamamlandı");
    } catch (err) {
      this.logger.error(`Cumartesi bildirim hatası: ${err}`);
    }

    this.logger.log("Cumartesi AI raporları oluşturuluyor...");
    try {
      await this.generateSaturdayAiReports();
      this.logger.log("Cumartesi AI raporları tamamlandı");
    } catch (err) {
      this.logger.error(`Cumartesi AI raporu hatası: ${err}`);
    }
  }

  private async generateSaturdayAiReports(): Promise<void> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const meetings = await this.prisma.meeting.findMany({
      where: {
        status: "ACTIVE",
        scheduledAt: { gte: weekStart },
        aiReport: null,
      },
      select: { id: true },
    });

    this.logger.log(`${meetings.length} masa için AI raporu oluşturulacak`);
    for (const meeting of meetings) {
      await this.aiReportService.generateReport(meeting.id);
    }
  }

  // Perşembe 11:59 (TR): GROUP döngüsü kapanışına 12 saat kala hatırlatma
  @Cron("59 11 * * 4", { timeZone: "Europe/Istanbul" })
  async notifyGroupCycleClosingSoon(): Promise<void> {
    this.logger.log("Perşembe 12 saat kala GROUP bildirimi gönderiliyor...");
    try {
      await this.sendCycleClosingSoonNotifications('GROUP');
      this.logger.log("GROUP kapanış hatırlatması tamamlandı");
    } catch (err) {
      this.logger.error(`GROUP kapanış hatırlatması hatası: ${err}`);
    }
  }

  // Cuma 11:59 (TR): ONE_ON_ONE döngüsü kapanışına 12 saat kala hatırlatma
  @Cron("59 11 * * 5", { timeZone: "Europe/Istanbul" })
  async notifyOneOnOneCycleClosingSoon(): Promise<void> {
    this.logger.log("Cuma 12 saat kala ONE_ON_ONE bildirimi gönderiliyor...");
    try {
      await this.sendCycleClosingSoonNotifications('ONE_ON_ONE');
      this.logger.log("ONE_ON_ONE kapanış hatırlatması tamamlandı");
    } catch (err) {
      this.logger.error(`ONE_ON_ONE kapanış hatırlatması hatası: ${err}`);
    }
  }

  // Cuma 23:59 (TR): ONE_ON_ONE döngüsünü kapat
  @Cron("59 23 * * 5", { timeZone: "Europe/Istanbul" })
  async scheduleFridayOneOnOneClosing(): Promise<void> {
    this.logger.log("Cuma ONE_ON_ONE kapanışı başlıyor...");
    try {
      await this.runOneOnOneClosing();
      this.logger.log("Cuma ONE_ON_ONE kapanışı tamamlandı");
    } catch (err) {
      this.logger.error(`Cuma ONE_ON_ONE kapanışı hatası: ${err}`);
    }
  }

  // Pazar 10:00 (TR): ONE_ON_ONE mekanı atanmış masaların katılımcılarına bildirim gönder
  @Cron("0 10 * * 0", { timeZone: "Europe/Istanbul" })
  async scheduleSundayOneOnOneNotifications(): Promise<void> {
    this.logger.log("Pazar ONE_ON_ONE bildirimleri gönderiliyor...");
    try {
      await this.sendOneOnOneNotifications();
      this.logger.log("Pazar ONE_ON_ONE bildirimleri tamamlandı");
    } catch (err) {
      this.logger.error(`Pazar ONE_ON_ONE bildirim hatası: ${err}`);
    }
  }

  // Pazartesi 10:00 (TR): MASADA aboneliği 7 gün içinde dolacakları bildir
  @Cron("0 10 * * 1", { timeZone: "Europe/Istanbul" })
  async notifySubscriptionExpiring(): Promise<void> {
    this.logger.log("Abonelik bitiş hatırlatmaları gönderiliyor...");
    try {
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expiringSubs = await this.prisma.subscription.findMany({
        where: {
          plan: { in: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE] },
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gte: now, lte: sevenDaysLater },
        },
        select: { userId: true, plan: true, expiresAt: true },
      });
      for (const sub of expiringSubs) {
        if (sub.expiresAt) {
          await this.notifications.notifySubscriptionExpiring(sub.userId, sub.expiresAt, sub.plan);
        }
      }
      this.logger.log(`${expiringSubs.length} abonelik bitiş hatırlatması gönderildi`);
    } catch (err) {
      this.logger.error(`Abonelik bitiş hatırlatması hatası: ${err}`);
    }
  }

  // ─── Yardımcılar ──────────────────────────────────────────────────────────

  private async sendCycleClosingSoonNotifications(meetingType: 'GROUP' | 'ONE_ON_ONE'): Promise<void> {
    const isGroup = meetingType === 'GROUP';
    const plans = isGroup
      ? [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE]
      : [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE];

    const now = new Date();
    const { week: weekNumber, year } = this.getISOWeek(now);
    const cycle = await this.prisma.matchingCycle.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });

    // Bu döngüde zaten masası olan kullanıcıları bul
    const matchedUserIds = cycle
      ? new Set(
          (await this.prisma.meetingParticipant.findMany({
            where: {
              meeting: {
                cycleId: cycle.id,
                status: { in: ['PENDING', 'ACTIVE'] },
                type: isGroup ? 'GROUP' : 'ONE_ON_ONE',
              },
            },
            select: { userId: true },
          })).map((p) => p.userId),
        )
      : new Set<string>();

    // Havuzda olan ama eşleşmemiş kullanıcılar
    const eligibleUsers = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        isBot: false,
        oceanScore: { isNot: null },
        subscriptions: {
          some: {
            plan: { in: plans },
            status: SubscriptionStatus.ACTIVE,
            ...(isGroup ? {} : { usedAt: null }),
          },
        },
      },
      select: { id: true },
    });

    for (const user of eligibleUsers) {
      if (!matchedUserIds.has(user.id)) {
        await this.notifications.notifyCycleClosingSoon(user.id, meetingType);
      }
    }
    this.logger.log(`${meetingType} kapanış hatırlatması: ${eligibleUsers.filter((u) => !matchedUserIds.has(u.id)).length} kullanıcıya gönderildi`);
  }

  private async runOneOnOneClosing(): Promise<void> {
    const now = new Date();
    const { week: weekNumber, year } = this.getISOWeek(now);
    const cycle = await this.prisma.matchingCycle.upsert({
      where: { weekNumber_year: { weekNumber, year } },
      update: {},
      create: { weekNumber, year, status: 'RUNNING' },
    });

    // Eşleşmemiş ONE_ON_ONE kullanıcıları bul
    const matchedIds = new Set(
      (await this.prisma.meetingParticipant.findMany({
        where: {
          meeting: {
            cycleId: cycle.id,
            status: { in: ['PENDING', 'ACTIVE'] },
            type: 'ONE_ON_ONE',
          },
        },
        select: { userId: true },
      })).map((p) => p.userId),
    );

    const eligible = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        isBot: false,
        oceanScore: { isNot: null },
        subscriptions: {
          some: {
            plan: { in: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE] },
            status: SubscriptionStatus.ACTIVE,
            usedAt: null,
          },
        },
      },
      select: { id: true },
    });

    const unmatched = eligible.filter((u) => !matchedIds.has(u.id));

    const activeBots = await this.prisma.user.findMany({
      where: { isBot: true, status: 'ACTIVE' },
      select: { id: true },
    });

    const nextSat = this.nextSaturdayAt(17);

    for (const user of unmatched) {
      // Kaç döngüdür eşleşemedi?
      const missedCount = await this.prisma.matchingWaitlist.count({ where: { userId: user.id } });

      if (missedCount >= 2 && activeBots.length > 0) {
        // 3. döngüde bot ile eşleştir
        const bot = activeBots[Math.floor(Math.random() * activeBots.length)];
        await this.prisma.meeting.create({
          data: {
            cycleId: cycle.id,
            type: 'ONE_ON_ONE',
            title: `Hafta ${weekNumber} Başbaşa Buluşma`,
            scheduledAt: nextSat,
            maxParticipants: 2,
            participants: {
              createMany: { data: [{ userId: user.id, status: 'INVITED' }, { userId: bot.id, status: 'INVITED' }] },
            },
          },
        });
        this.logger.log(`ONE_ON_ONE bot eşleşmesi: user=${user.id} bot=${bot.id}`);
      } else {
        // Bekliste al
        const { week: nw, year: ny } = this.getISOWeek(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
        const nextCycle = await this.prisma.matchingCycle.upsert({
          where: { weekNumber_year: { weekNumber: nw, year: ny } },
          update: {},
          create: { weekNumber: nw, year: ny, status: 'RUNNING' },
        });
        await this.prisma.matchingWaitlist.upsert({
          where: { userId_cycleId: { userId: user.id, cycleId: nextCycle.id } },
          update: {},
          create: { userId: user.id, cycleId: nextCycle.id, reason: 'ODD_NUMBER' },
        });
      }
    }
  }

  private async sendOneOnOneNotifications(): Promise<void> {
    const now = new Date();
    const { week: weekNumber, year } = this.getISOWeek(now);
    const cycle = await this.prisma.matchingCycle.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });
    if (!cycle) return;

    const meetings = await this.prisma.meeting.findMany({
      where: {
        cycleId: cycle.id,
        type: 'ONE_ON_ONE',
        status: { in: ['PENDING', 'ACTIVE'] },
        locationText: { not: null },
      },
      include: { participants: { select: { userId: true } } },
    });

    for (const meeting of meetings) {
      for (const p of meeting.participants) {
        await this.notifications.notifyMeetingConfirmed(p.userId, meeting.id, meeting.scheduledAt);
      }
    }
    this.logger.log(`Pazar ONE_ON_ONE bildirimi: ${meetings.length} masa`);
  }

  private getISOWeek(date: Date): { week: number; year: number } {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { week, year: d.getUTCFullYear() };
  }

  private nextSaturdayAt(hourUTC: number): Date {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilSat = (6 - day + 7) % 7 || 7;
    const sat = new Date(now);
    sat.setUTCDate(now.getUTCDate() + daysUntilSat);
    sat.setUTCHours(hourUTC, 0, 0, 0);
    return sat;
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
