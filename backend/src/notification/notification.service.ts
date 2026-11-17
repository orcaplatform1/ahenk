import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FcmService } from "./fcm/fcm.service";
import { WhatsappNotifyService } from "./whatsapp-notify.service";
import { pruneInAppNotifications } from "./notification-limit";
import { NotificationType, KycStatus } from "../generated/prisma/client";

type SendPayload = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  whatsappTemplate?: string;
  whatsappParams?: string[];
  // İngilizce metin: alıcının language alanı "en" ise push / uygulama içi bildirim ve WhatsApp parametreleri bundan gider
  en?: { title: string; body: string; whatsappParams?: string[] };
};

export type NotificationEn = { title: string; body: string };

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private fcm: FcmService,
    private whatsappNotify: WhatsappNotifyService,
  ) {}

  // ─── Genel gönderici ─────────────────────────────────────────────────────

  // Bildirim hatası çağıranı asla kesmez: kapanış ve döngü işleri devam eder, hata loglanır.
  // Kanallar birbirinden bağımsızdır.
  private async send(payload: SendPayload): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { fcmToken: true, phone: true, isBot: true, language: true },
      });
      // Botlara hiçbir kanaldan bildirim gönderilmez
      if (!user || user.isBot) return;
      // Alıcının diline göre metin (İngilizce yoksa Türkçe); WhatsApp şablon dil kodu da alıcının dili
      const lang = user.language === "en" ? "en" : "tr";
      if (lang === "en" && payload.en) {
        payload = { ...payload, title: payload.en.title, body: payload.en.body, whatsappParams: payload.en.whatsappParams ?? payload.whatsappParams };
      }

      // 1) IN_APP kaydı her zaman oluştur; kullanıcıda son 25 bildirim kalır
      await this.saveRecord(payload, NotificationType.IN_APP);
      await pruneInAppNotifications(this.prisma, payload.userId);

      // 2) FCM push (token varsa)
      if (user.fcmToken) {
        try {
          const sent = await this.fcm.sendToToken({
            token: user.fcmToken,
            title: payload.title,
            body: payload.body,
            data: payload.data,
          });
          if (sent) await this.saveRecord(payload, NotificationType.PUSH);
        } catch (err) {
          this.logger.error(`FCM bildirimi gönderilemedi: user=${payload.userId} ${err}`);
        }
      }

      // 3) WhatsApp (kritik bildirimler + telefon varsa)
      if (payload.whatsappTemplate && user.phone) {
        try {
          await this.whatsappNotify.send(user.phone, payload.whatsappTemplate, payload.whatsappParams ?? [], lang);
          await this.saveRecord(payload, NotificationType.WHATSAPP);
        } catch (err) {
          this.logger.error(`WhatsApp bildirimi gönderilemedi: user=${payload.userId} şablon=${payload.whatsappTemplate} ${err}`);
        }
      }
    } catch (err) {
      this.logger.error(`Bildirim kaydedilemedi: user=${payload.userId} ${err}`);
    }
  }

  private saveRecord(payload: SendPayload, type: NotificationType) {
    return this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sentAt: new Date(),
      },
    });
  }

  // ─── KYC olayları ────────────────────────────────────────────────────────

  async notifyKycReviewed(userId: string, status: KycStatus, rejectReason?: string | null): Promise<void> {
    if (status === KycStatus.APPROVED) {
      await this.send({
        userId,
        title: "Kimlik doğrulaman onaylandı ✓",
        body: "Profilinde 'Doğrulanmış' rozeti aktif. Artık paket satın alabilirsin.",
        data: { event: "KYC_APPROVED" },
        whatsappTemplate: "ahenk_kyc_approved",
        whatsappParams: [],
        en: { title: "Your identity is verified ✓", body: "Your profile now shows the 'Verified' badge. You can buy packages now." },
      });
    } else if (status === KycStatus.REJECTED) {
      await this.send({
        userId,
        title: "Kimlik doğrulaman reddedildi",
        body: rejectReason ?? "Başvurun reddedildi. Yeniden başvurabilirsin.",
        data: { event: "KYC_REJECTED" },
        whatsappTemplate: "ahenk_kyc_rejected",
        whatsappParams: [rejectReason ?? "Bilgi eksik veya uyumsuz"],
        en: { title: "Your identity verification was declined", body: rejectReason ?? "Your application was declined. You can apply again.", whatsappParams: [rejectReason ?? "Missing or mismatched information"] },
      });
    } else if (status === KycStatus.SUSPICIOUS) {
      await this.send({
        userId,
        title: "Kimlik doğrulaman inceleme altında",
        body: "Başvurun ek inceleme gerektiriyor. En kısa sürede bilgilendirileceksin.",
        data: { event: "KYC_SUSPICIOUS" },
        en: { title: "Your identity verification is under review", body: "Your application needs a closer look. We'll let you know soon." },
      });
    }
  }

  // ─── Masa onayı ──────────────────────────────────────────────────────────

  async notifyMeetingConfirmed(userId: string, meetingId: string, scheduledAt: Date): Promise<void> {
    // Saat dilimi: masanın bölgesinin (şehir) saat dilimi
    const m = await this.prisma.meeting.findUnique({ where: { id: meetingId }, select: { city: { select: { timezone: true } } } }).catch(() => null);
    const timeZone = m?.city?.timezone ?? "Europe/Istanbul";
    // Buluşmanın yapıldığı bölgenin saat dilimi; gün / ay adı alıcının dilinde, saat 24 saat
    const fmt = (locale: string) => scheduledAt.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
    });
    const dateStr = fmt("tr-TR");
    const dateEn = fmt("en-GB");

    await this.send({
      userId,
      title: "Masa detayın belli oldu",
      body: `${dateStr} tarihli masanın detayları belli oldu. Masalarım alanından kontrol edebilirsin.`,
      data: { event: "MEETING_CONFIRMED", meetingId },
      whatsappTemplate: "ahenk_meeting_confirmed",
      whatsappParams: [dateStr],
      en: { title: "Your table details are ready", body: `The details of your table on ${dateEn} are ready. Check them under My Tables.`, whatsappParams: [dateEn] },
    });
  }

  // ─── Masa kurulamadı (kritik: WhatsApp) ─────────────────────────────────────

  async notifyMeetingNotFormed(userId: string): Promise<void> {
    await this.send({
      userId,
      title: "Masan kurulamadı",
      body: "Çok üzgünüm, yetersiz sayıda eşleşme nedeniyle masan kurulamadı.",
      data: { event: "MEETING_NOT_FORMED" },
      whatsappTemplate: "ahenk_meeting_not_formed",
      whatsappParams: [],
      en: { title: "Your table couldn't be set up", body: "We're really sorry — there weren't enough matches to set up your table." },
    });
  }

  // ─── Döngü kapanış hatırlatması ──────────────────────────────────────────

  async notifyCycleClosingSoon(userId: string, meetingType: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'): Promise<void> {
    const label = meetingType === 'GROUP' ? 'Grup masası' : meetingType === 'KANKA' ? 'Kankamla' : 'Baş Başa';
    await this.send({
      userId,
      title: `${meetingType === 'GROUP' ? 'Grup' : label} döngüsü kapanıyor`,
      body: `${label} döngüsü 12 saat içinde kapanıyor. Hâlâ eşleşme havuzundasın.`,
      data: { event: 'CYCLE_CLOSING_SOON', meetingType },
      en: (() => {
        const l = meetingType === 'GROUP' ? 'Group table' : meetingType === 'KANKA' ? 'Kankamla' : 'One-on-One';
        return { title: `${l} cycle is closing`, body: `The ${l} cycle closes within 12 hours. You're still in the matching pool.` };
      })(),
    });
  }

  // ─── Genel kullanım için public wrapper ──────────────────────────────────

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string>; en?: NotificationEn },
  ): Promise<void> {
    await this.send({ userId, ...payload });
  }

  // ─── FCM token kayıt ─────────────────────────────────────────────────────

  async registerFcmToken(userId: string, token: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
    });
  }

  // ─── Bildirim listesi ─────────────────────────────────────────────────────

  async getNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const seen = await this.prisma.user.findUnique({ where: { id: userId }, select: { lastNotificationsSeenAt: true } });
    const [items, total, unreadCount, newUnreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, type: NotificationType.IN_APP },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: { id: true, title: true, body: true, data: true, read: true, createdAt: true },
      }),
      this.prisma.notification.count({ where: { userId, type: NotificationType.IN_APP } }),
      // Okunmamış toplamı (mobil Bildirimler rozeti)
      this.prisma.notification.count({ where: { userId, type: NotificationType.IN_APP, read: false } }),
      // Alt menü rozeti: Bildirimler sayfasının son açılışından sonra gelen okunmamışlar (hiç açılmadıysa bütün okunmamışlar)
      this.prisma.notification.count({
        where: { userId, type: NotificationType.IN_APP, read: false, ...(seen?.lastNotificationsSeenAt ? { createdAt: { gt: seen.lastNotificationsSeenAt } } : {}) },
      }),
    ]);

    // newUnreadCount > 0 → sayı; değilse unreadCount > 0 (hasUnread) → nokta
    return { items, total, page, totalPages: Math.ceil(total / limit), unreadCount, newUnreadCount, hasUnread: unreadCount > 0 };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  // Bildirimler sayfası açıldı: rozet sayısı sıfırlanır (okunmamış varsa nokta kalır)
  async markSeen(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastNotificationsSeenAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false, type: NotificationType.IN_APP },
      data: { read: true },
    });
  }
}
