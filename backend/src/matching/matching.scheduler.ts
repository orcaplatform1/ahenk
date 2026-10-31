import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MatchingService } from "./matching.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiReportService } from "../meetings/ai-report.service";
import { NotificationService } from "../notification/notification.service";
import { SubscriptionPlan, SubscriptionStatus, KycStatus } from "@prisma/client";
import { cancellationNotice, initialsOf } from "../meetings/cancellation-notice";
import { VenueAssignmentService } from "../venue-panel/venue-assignment.service";
import { closeGroupCycle, closeKankaCycle, closeOneOnOneCycle, OPEN_KANKA_SUB } from "../payment/package-rights";

@Injectable()
export class MatchingScheduler {
  private readonly logger = new Logger(MatchingScheduler.name);

  constructor(
    private matchingService: MatchingService,
    private prisma: PrismaService,
    private aiReportService: AiReportService,
    private notifications: NotificationService,
    private venueAssignment: VenueAssignmentService,
  ) {}

  // Her saat başı güvenlik taraması: atama anında kaçan ve saatle gevşeyen filtrelere (Perşembe 12:00 / 18:00,
  // Cuma 10:00) takılmış kişileri masaya atar. Asıl atama kişi havuza girdiği an yapılır.
  @Cron("0 * * * *", { timeZone: "Europe/Istanbul" })
  async scheduleHourlyMatching(): Promise<void> {
    try {
      await this.matchingService.requestScan();
    } catch (err) {
      this.logger.error(`Saatlik tarama hatası: ${err}`);
    }
  }

  // Kilidi geçmiş, mekânı boş masalar güncel kontenjana göre ortak mekânlara atanır
  @Cron("5 * * * *", { timeZone: "Europe/Istanbul" })
  async assignVenues(): Promise<void> {
    try {
      await this.venueAssignment.assignLockedMeetings();
    } catch (err) {
      this.logger.error(`Mekân atama hatası: ${err}`);
    }
  }

  // Kart açılışından 2 saat önce (Cuma/Cmt/Pazar 08:00): hâlâ mekânsız masalar için admin'e tekrar uyarı
  @Cron("0 8 * * 5,6,0", { timeZone: "Europe/Istanbul" })
  async remindMissingVenues(): Promise<void> {
    try {
      await this.venueAssignment.remindMissingVenues();
    } catch (err) {
      this.logger.error(`Mekânsız masa hatırlatma hatası: ${err}`);
    }
  }

  // Her saat başı: saati 6 saat geçmiş masaları kapat
  // ACTIVE → COMPLETED (iptal etmeyen katılımcılar ATTENDED), onaylanmamış PENDING → CANCELLED
  @Cron("0 * * * *", { timeZone: "Europe/Istanbul" })
  async completeFinishedMeetings(): Promise<void> {
    const threshold = new Date(Date.now() - 6 * 60 * 60 * 1000);
    try {
      const finished = await this.prisma.meeting.findMany({
        where: { status: "ACTIVE", scheduledAt: { lte: threshold } },
        select: { id: true },
      });
      for (const meeting of finished) {
        await this.prisma.$transaction([
          this.prisma.meetingParticipant.updateMany({
            where: { meetingId: meeting.id, status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
            data: { status: "ATTENDED" },
          }),
          this.prisma.meeting.update({ where: { id: meeting.id }, data: { status: "COMPLETED" } }),
        ]);
      }

      const { count: cancelled } = await this.prisma.meeting.updateMany({
        where: { status: "PENDING", scheduledAt: { lte: threshold } },
        data: { status: "CANCELLED" },
      });

      if (finished.length > 0 || cancelled > 0) {
        this.logger.log(`Masa kapanışı: ${finished.length} tamamlandı, ${cancelled} onaysız iptal`);
      }
    } catch (err) {
      this.logger.error(`Masa kapanışı hatası: ${err}`);
    }
  }

  // Her saat başı: süresi dolan abonelikleri EXPIRED yap
  @Cron("0 * * * *", { timeZone: "Europe/Istanbul" })
  async expireSubscriptions(): Promise<void> {
    try {
      const { count } = await this.prisma.subscription.updateMany({
        where: { status: SubscriptionStatus.ACTIVE, expiresAt: { lte: new Date() } },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      if (count > 0) this.logger.log(`${count} aboneliğin süresi doldu`);
    } catch (err) {
      this.logger.error(`Abonelik süre dolumu hatası: ${err}`);
    }
  }

  // Her gün 22:00 (TR): o akşam başlamış onaylı masaların katılımcılarına "gelmeyeni işaretle" bildirimi
  // (uygulama içi; WhatsApp yok). İşaretleme masa kartında ertesi gün 10:00'a kadar açık.
  @Cron("0 22 * * *", { timeZone: "Europe/Istanbul" })
  async notifyNoShowMarking(): Promise<void> {
    try {
      const now = new Date();
      const meetings = await this.prisma.meeting.findMany({
        where: {
          status: "ACTIVE",
          scheduledAt: { gte: new Date(now.getTime() - 4 * 60 * 60 * 1000), lte: now },
        },
        select: {
          id: true,
          participants: { where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } }, select: { userId: true } },
        },
      });
      for (const m of meetings) {
        for (const p of m.participants) {
          await this.notifications.sendToUser(p.userId, {
            title: "Masana gelmeyen oldu mu?",
            body: "Gelmeyen katılımcı varsa masa kartından işaretleyebilirsin.",
            data: { type: "NO_SHOW_MARK", meetingId: m.id },
          });
        }
      }
      if (meetings.length > 0) this.logger.log(`Gelmeyen işaretleme bildirimi: ${meetings.length} masa`);
    } catch (err) {
      this.logger.error(`Gelmeyen işaretleme bildirimi hatası: ${err}`);
    }
  }

  // Perşembe, Cuma ve Cumartesi 23:44 (TR): son tarama — havuzdakiler atanır, yarım grup masaları birleştirilir
  @Cron("44 23 * * 4,5,6", { timeZone: "Europe/Istanbul" })
  async scheduleFinalScan(): Promise<void> {
    try {
      await this.matchingService.requestScan();
    } catch (err) {
      this.logger.error(`Son tarama hatası: ${err}`);
    }
  }

  // Perşembe 23:45 (TR): tarama durdu → eksik grup masalarına 23:45–23:55 arası rastgele anda bot
  @Cron("45 23 * * 4", { timeZone: "Europe/Istanbul" })
  async scheduleGroupClosingBots(): Promise<void> {
    try {
      await this.matchingService.scheduleGroupBots();
    } catch (err) {
      this.logger.error(`Grup kapanış botu planlama hatası: ${err}`);
    }
  }

  // Perşembe 23:59 (TR): döngüyü kapat, 1-2 kişilik masaları iptal et, artakalanları bekliste al
  @Cron("59 23 * * 4", { timeZone: "Europe/Istanbul" })
  async scheduleThursdayClosing(): Promise<void> {
    this.logger.log("Perşembe kapanışı başlıyor...");
    try {
      await this.matchingService.runThursdayClosing();
      await this.updateMissedCycles("GROUP");
      // Paket hakları: grup döngüsü sayılır, masası kurulanın 1 grup hakkı düşer
      const { week: weekNumber, year } = this.getISOWeek(new Date());
      const cycle = await this.prisma.matchingCycle.findUnique({ where: { weekNumber_year: { weekNumber, year } }, select: { id: true } });
      await closeGroupCycle(this.prisma, cycle?.id ?? null);
      this.logger.log("Perşembe kapanışı tamamlandı");
    } catch (err) {
      this.logger.error(`Perşembe kapanışı hatası: ${err}`);
    }
  }

  // İade güvencesi sayacı: bu döngüde kullanıcıya masa kurulduysa sıfırlanır, kurulamadıysa 1 artar.
  // Katılım şartı yok; kullanıcı kendisi iptal etse de masa kurulmuş sayılır.
  // GROUP → Perşembe kapanışında, ONE_ON_ONE → Cuma kapanışında çağrılır.
  private async updateMissedCycles(meetingType: "GROUP" | "ONE_ON_ONE"): Promise<void> {
    const isGroup = meetingType === "GROUP";
    const { week: weekNumber, year } = this.getISOWeek(new Date());
    const cycle = await this.prisma.matchingCycle.findUnique({
      where: { weekNumber_year: { weekNumber, year } },
    });

    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        // Başbaşa: sadece harcanmamış hak döngü kaçırabilir
        ...(isGroup
          ? { plan: { in: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE] } }
          : { plan: { in: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE] }, usedAt: null }),
      },
      select: { id: true, userId: true, missedGroupCycles: true, missedOneonOneCycles: true },
    });

    const formedUserIds = new Set(
      cycle
        ? (await this.prisma.meetingParticipant.findMany({
            where: { meeting: { cycleId: cycle.id, type: meetingType, status: { not: "CANCELLED" } } },
            select: { userId: true },
          })).map((p) => p.userId)
        : [],
    );

    for (const sub of subs) {
      const userId = sub.userId;
      const current = isGroup ? sub.missedGroupCycles : sub.missedOneonOneCycles;
      const next = formedUserIds.has(userId) ? 0 : current + 1;

      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: isGroup ? { missedGroupCycles: next } : { missedOneonOneCycles: next },
      });

      // 4'e ulaşınca AdminAlert oluştur (tekrar oluşturma)
      if (next === 4) {
        const alertType = isGroup ? "MISSED_GROUP_CYCLES" : "MISSED_ONEONE_CYCLES";
        const existing = await this.prisma.adminAlert.findFirst({
          where: { userId, alertType, isRead: false },
        });
        if (!existing) {
          await this.prisma.adminAlert.create({ data: { userId, alertType } });
        }
      }
    }
    this.logger.log(`Döngü takibi güncellendi (${meetingType})`);
  }

  // Cuma 10:00 (TR, grup buluşma günü): grup masası katılımcılarına bildirim + AI raporları
  @Cron("0 10 * * 5", { timeZone: "Europe/Istanbul" })
  async scheduleGroupRevealNotifications(): Promise<void> {
    this.logger.log("Cuma grup bildirimleri gönderiliyor...");
    try {
      await this.matchingService.sendGroupRevealNotifications();
      this.logger.log("Cuma grup bildirimleri tamamlandı");
    } catch (err) {
      this.logger.error(`Cuma grup bildirim hatası: ${err}`);
    }

    this.logger.log("Cuma grup AI raporları oluşturuluyor...");
    try {
      await this.generateAiReports("GROUP");
      this.logger.log("Cuma grup AI raporları tamamlandı");
    } catch (err) {
      this.logger.error(`Cuma grup AI raporu hatası: ${err}`);
    }
  }

  // Bugün (önümüzdeki 24 saat içinde) buluşacak onaylı masaların raporu
  private async generateAiReports(meetingType: "GROUP" | "ONE_ON_ONE" | "KANKA"): Promise<void> {
    const now = new Date();
    const meetings = await this.prisma.meeting.findMany({
      where: {
        type: meetingType,
        status: "ACTIVE",
        scheduledAt: { gte: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        aiReport: null,
      },
      select: { id: true },
    });

    this.logger.log(`${meetings.length} ${meetingType} masa için AI raporu oluşturulacak`);
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

  // Perşembe 20:00 (TR): grup iptal son anı — o hafta iptal olan masalara toplu bildirim
  // (başbaşada bildirim iptal anında karşı tarafa gider)
  @Cron("0 20 * * 4", { timeZone: "Europe/Istanbul" })
  async notifyGroupCancellations(): Promise<void> {
    try {
      await this.sendGroupCancellationSummaries();
    } catch (err) {
      this.logger.error(`GROUP iptal özeti hatası: ${err}`);
    }
  }

  // Cuma 23:45 (TR): eşi bulunamayan 2. hafta kişilerine 23:45–23:55 arası rastgele anda bot
  @Cron("45 23 * * 5", { timeZone: "Europe/Istanbul" })
  async scheduleOneOnOneClosingBots(): Promise<void> {
    try {
      await this.matchingService.scheduleOneOnOneBots();
    } catch (err) {
      this.logger.error(`Başbaşa kapanış botu planlama hatası: ${err}`);
    }
  }

  // Cuma 23:59 (TR): ONE_ON_ONE döngüsünü kapat
  @Cron("59 23 * * 5", { timeZone: "Europe/Istanbul" })
  async scheduleFridayOneOnOneClosing(): Promise<void> {
    this.logger.log("Cuma ONE_ON_ONE kapanışı başlıyor...");
    try {
      await this.runOneOnOneClosing();
      await this.updateMissedCycles("ONE_ON_ONE");
      // Paket hakları: başbaşa döngüsü sayılır (hak masa kurulunca zaten harcandı)
      await closeOneOnOneCycle(this.prisma);
      this.logger.log("Cuma ONE_ON_ONE kapanışı tamamlandı");
    } catch (err) {
      this.logger.error(`Cuma ONE_ON_ONE kapanışı hatası: ${err}`);
    }
  }

  // Cumartesi 11:59 (TR): Kankamla döngüsü kapanışına 12 saat kala hatırlatma
  @Cron("59 11 * * 6", { timeZone: "Europe/Istanbul" })
  async notifyKankaCycleClosingSoon(): Promise<void> {
    try {
      await this.sendCycleClosingSoonNotifications('KANKA');
    } catch (err) {
      this.logger.error(`KANKA kapanış hatırlatması hatası: ${err}`);
    }
  }

  // Cumartesi 23:59 (TR): Kankamla kilidi — eşleşemeyen çiftler bekleme listesine + "masa kurulamadı";
  // iade sayacı, hak düşümü (kurulan masalar) ve döngü sayımı
  @Cron("59 23 * * 6", { timeZone: "Europe/Istanbul" })
  async scheduleSaturdayKankaClosing(): Promise<void> {
    this.logger.log("Cumartesi KANKA kapanışı başlıyor...");
    try {
      const now = new Date();
      const { week: weekNumber, year } = this.getISOWeek(now);
      const cycle = await this.prisma.matchingCycle.upsert({
        where: { weekNumber_year: { weekNumber, year } },
        update: {},
        create: { weekNumber, year, status: "RUNNING" },
      });
      // Atama 23:44'te durdu: havuzda kalan çiftler bu hafta eşleşemedi
      const unmatched = await this.matchingService.fetchKankaPairs(cycle.id);
      const { week: nw, year: ny } = this.getISOWeek(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
      const nextCycle = await this.prisma.matchingCycle.upsert({
        where: { weekNumber_year: { weekNumber: nw, year: ny } },
        update: {},
        create: { weekNumber: nw, year: ny, status: "RUNNING" },
      });
      for (const pair of unmatched) {
        for (const userId of [pair.buyer.id, pair.kanka.id]) {
          await this.prisma.matchingWaitlist.upsert({
            where: { userId_cycleId: { userId, cycleId: nextCycle.id } },
            update: {},
            create: { userId, cycleId: nextCycle.id, reason: "ODD_NUMBER" },
          });
          await this.notifications.notifyMeetingNotFormed(userId);
        }
      }
      await this.updateMissedKankaCycles(cycle.id);
      await closeKankaCycle(this.prisma, cycle.id);
      this.logger.log(`Cumartesi KANKA kapanışı tamamlandı (${unmatched.length} çift eşleşemedi)`);
    } catch (err) {
      this.logger.error(`Cumartesi KANKA kapanışı hatası: ${err}`);
    }
  }

  // Kankamla iade sayacı: çiftin bu döngüde masası kurulduysa sıfırlanır, kurulamadıysa 1 artar (alıcı paketinde)
  private async updateMissedKankaCycles(cycleId: string): Promise<void> {
    const subs = await this.prisma.subscription.findMany({
      where: { ...OPEN_KANKA_SUB },
      select: { id: true, userId: true, missedKankaCycles: true },
    });
    const formed = new Set(
      (await this.prisma.meetingParticipant.findMany({
        where: { meeting: { cycleId, type: "KANKA", status: { not: "CANCELLED" } } },
        select: { userId: true, kankaPartnerId: true },
      })).flatMap((p) => [p.userId, ...(p.kankaPartnerId ? [p.kankaPartnerId] : [])]),
    );
    for (const sub of subs) {
      const next = formed.has(sub.userId) ? 0 : sub.missedKankaCycles + 1;
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { missedKankaCycles: next } });
      if (next === 4) {
        const existing = await this.prisma.adminAlert.findFirst({ where: { userId: sub.userId, alertType: "MISSED_KANKA_CYCLES", isRead: false } });
        if (!existing) await this.prisma.adminAlert.create({ data: { userId: sub.userId, alertType: "MISSED_KANKA_CYCLES" } });
      }
    }
  }

  // Pazar 10:00 (TR, Kankamla buluşma günü): mekanı atanmış Kankamla masalarına bildirim + AI raporları
  @Cron("0 10 * * 0", { timeZone: "Europe/Istanbul" })
  async scheduleKankaRevealNotifications(): Promise<void> {
    try {
      const { week: weekNumber, year } = this.getISOWeek(new Date());
      const cycle = await this.prisma.matchingCycle.findUnique({ where: { weekNumber_year: { weekNumber, year } } });
      if (cycle) {
        const meetings = await this.prisma.meeting.findMany({
          where: { cycleId: cycle.id, type: "KANKA", status: { in: ["PENDING", "ACTIVE"] }, locationText: { not: null } },
          include: { participants: { where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } }, select: { userId: true } } },
        });
        for (const meeting of meetings) {
          for (const p of meeting.participants) {
            await this.notifications.notifyMeetingConfirmed(p.userId, meeting.id, meeting.scheduledAt);
          }
        }
        this.logger.log(`Pazar KANKA bildirimi: ${meetings.length} masa`);
      }
    } catch (err) {
      this.logger.error(`Pazar KANKA bildirim hatası: ${err}`);
    }
    try {
      await this.generateAiReports("KANKA");
    } catch (err) {
      this.logger.error(`Pazar KANKA AI raporu hatası: ${err}`);
    }
  }

  // Cumartesi 10:00 (TR, başbaşa buluşma günü): mekanı atanmış ONE_ON_ONE masalarına bildirim + AI raporları
  @Cron("0 10 * * 6", { timeZone: "Europe/Istanbul" })
  async scheduleOneOnOneRevealNotifications(): Promise<void> {
    this.logger.log("Cumartesi ONE_ON_ONE bildirimleri gönderiliyor...");
    try {
      await this.sendOneOnOneNotifications();
      this.logger.log("Cumartesi ONE_ON_ONE bildirimleri tamamlandı");
    } catch (err) {
      this.logger.error(`Cumartesi ONE_ON_ONE bildirim hatası: ${err}`);
    }

    this.logger.log("Cumartesi ONE_ON_ONE AI raporları oluşturuluyor...");
    try {
      await this.generateAiReports("ONE_ON_ONE");
      this.logger.log("Cumartesi ONE_ON_ONE AI raporları tamamlandı");
    } catch (err) {
      this.logger.error(`Cumartesi AI raporu hatası: ${err}`);
    }
  }

  // ─── Yardımcılar ──────────────────────────────────────────────────────────

  // Grup iptal son anında (Perşembe 20:00) kalan katılımcılara masa başına tek bildirim.
  // Tarama ekranındaki iptal edenler de bu anda kaybolur (meetings.service getDashboardTable).
  private async sendGroupCancellationSummaries(): Promise<void> {
    const now = new Date();
    const meetings = await this.prisma.meeting.findMany({
      where: {
        type: 'GROUP',
        status: { in: ['PENDING', 'ACTIVE'] },
        // Bu haftanın Cumartesi masaları
        scheduledAt: { gt: now, lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        participants: {
          select: { userId: true, status: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
        },
      },
    });

    let notified = 0;
    for (const m of meetings) {
      const cancelled = m.participants.filter((p) => p.status === 'CANCELLED');
      if (cancelled.length === 0) continue;
      const notice = cancellationNotice(cancelled.map((p) => initialsOf(p.user.profile)));
      const remaining = m.participants.filter((p) => !['CANCELLED', 'DECLINED', 'NO_SHOW'].includes(p.status));
      for (const p of remaining) {
        await this.notifications.sendToUser(p.userId, { ...notice, data: { type: 'PARTICIPANT_LEFT', meetingId: m.id } });
      }
      notified++;
    }
    this.logger.log(`GROUP iptal özeti: ${notified} masa`);
  }

  private async sendCycleClosingSoonNotifications(meetingType: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'): Promise<void> {
    const isGroup = meetingType === 'GROUP';
    const now = new Date();
    if (meetingType === 'KANKA') {
      // Kankamla: havuzda kalan (masası kurulmamış) çiftin ikisine de
      const { week, year } = this.getISOWeek(now);
      const cycle = await this.prisma.matchingCycle.findUnique({ where: { weekNumber_year: { weekNumber: week, year } } });
      const pairs = cycle ? await this.matchingService.fetchKankaPairs(cycle.id) : [];
      for (const pair of pairs) {
        for (const id of [pair.buyer.id, pair.kanka.id]) await this.notifications.notifyCycleClosingSoon(id, 'KANKA');
      }
      this.logger.log(`KANKA kapanış hatırlatması: ${pairs.length} çift`);
      return;
    }
    const plans = isGroup
      ? [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE]
      : [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE];

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
        // KYC onaylı olmayan (admin paket vermiş olsa bile) eşleşmeye giremez
        kyc: { status: KycStatus.APPROVED },
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
        // KYC onaylı olmayan (admin paket vermiş olsa bile) eşleşmeye giremez
        kyc: { status: KycStatus.APPROVED },
        subscriptions: {
          some: {
            plan: { in: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE] },
            status: SubscriptionStatus.ACTIVE,
            usedAt: null,
          },
        },
      },
      select: { id: true, profile: { select: { gender: true, birthDate: true } } },
    });

    const unmatched = eligible.filter((u) => !matchedIds.has(u.id));

    // Botlar 23:45–23:55 arasında eklendi (2. hafta); eşi bulunamayanlar bekleme listesine + bildirim
    for (const user of unmatched) {
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
      await this.notifications.notifyMeetingNotFormed(user.id);
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
      include: {
        participants: {
          where: { status: { notIn: ['CANCELLED', 'DECLINED', 'NO_SHOW'] } },
          select: { userId: true },
        },
      },
    });

    for (const meeting of meetings) {
      for (const p of meeting.participants) {
        await this.notifications.notifyMeetingConfirmed(p.userId, meeting.id, meeting.scheduledAt);
      }
    }
    this.logger.log(`Cumartesi ONE_ON_ONE bildirimi: ${meetings.length} masa`);
  }

  private getISOWeek(date: Date): { week: number; year: number } {
    // Hafta TR saatine (UTC+3) göre hesaplanır; sunucunun saat diliminden bağımsız
    const tr = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    const d = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { week, year: d.getUTCFullYear() };
  }
}
