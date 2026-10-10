import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FcmService } from "./fcm/fcm.service";
import { WhatsappNotifyService } from "./whatsapp-notify.service";
import { NotificationType, KycStatus } from "@prisma/client";

type SendPayload = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  whatsappTemplate?: string;
  whatsappParams?: string[];
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private fcm: FcmService,
    private whatsappNotify: WhatsappNotifyService,
  ) {}

  // ─── Genel gönderici ─────────────────────────────────────────────────────

  private async send(payload: SendPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { fcmToken: true, phone: true },
    });
    if (!user) return;

    // 1) IN_APP kaydı her zaman oluştur
    await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: NotificationType.IN_APP,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sentAt: new Date(),
      },
    });

    // 2) FCM push (token varsa)
    if (user.fcmToken) {
      const sent = await this.fcm.sendToToken({
        token: user.fcmToken,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });

      if (sent) {
        await this.prisma.notification.create({
          data: {
            userId: payload.userId,
            type: NotificationType.PUSH,
            title: payload.title,
            body: payload.body,
            data: payload.data ?? {},
            sentAt: new Date(),
          },
        });
      }
    }

    // 3) WhatsApp (kritik bildirimler + telefon varsa)
    if (payload.whatsappTemplate && user.phone) {
      await this.whatsappNotify.send(
        user.phone,
        payload.whatsappTemplate,
        payload.whatsappParams ?? [],
      );

      await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          type: NotificationType.WHATSAPP,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
          sentAt: new Date(),
        },
      });
    }
  }

  // ─── KYC olayları ────────────────────────────────────────────────────────

  async notifyKycReviewed(userId: string, status: KycStatus, rejectReason?: string | null): Promise<void> {
    if (status === KycStatus.APPROVED) {
      await this.send({
        userId,
        title: "Kimlik doğrulamanız onaylandı ✓",
        body: "Profilinizde 'Doğrulanmış' rozeti aktif. Artık abonelik satın alabilirsiniz.",
        data: { event: "KYC_APPROVED" },
        whatsappTemplate: "ahenk_kyc_approved",
        whatsappParams: [],
      });
    } else if (status === KycStatus.REJECTED) {
      await this.send({
        userId,
        title: "Kimlik doğrulamanız reddedildi",
        body: rejectReason ?? "Başvurunuz reddedildi. Yeniden başvurabilirsiniz.",
        data: { event: "KYC_REJECTED" },
        whatsappTemplate: "ahenk_kyc_rejected",
        whatsappParams: [rejectReason ?? "Bilgi eksik veya uyumsuz"],
      });
    } else if (status === KycStatus.SUSPICIOUS) {
      await this.send({
        userId,
        title: "Kimlik doğrulamanız inceleme altında",
        body: "Başvurunuz ek inceleme gerektiriyor. En kısa sürede bilgilendirileceğiz.",
        data: { event: "KYC_SUSPICIOUS" },
      });
    }
  }

  // ─── Masa onayı ──────────────────────────────────────────────────────────

  async notifyMeetingConfirmed(userId: string, meetingId: string, scheduledAt: Date): Promise<void> {
    const dateStr = scheduledAt.toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    });

    await this.send({
      userId,
      title: "Masanız kesinleşti! 🎉",
      body: `Buluşmanız ${dateStr} tarihinde gerçekleşecek. Mekan bilgisi yakında paylaşılacak.`,
      data: { event: "MEETING_CONFIRMED", meetingId },
      whatsappTemplate: "ahenk_meeting_confirmed",
      whatsappParams: [dateStr],
    });
  }

  // ─── Mekan + saat bildirimi ───────────────────────────────────────────────

  async notifyMeetingVenueSet(
    userId: string,
    meetingId: string,
    venueName: string,
    scheduledAt: Date,
  ): Promise<void> {
    const dateStr = scheduledAt.toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    });

    await this.send({
      userId,
      title: "Mekan bilgisi güncellendi 📍",
      body: `Buluşma mekanı: ${venueName} — ${dateStr}`,
      data: { event: "MEETING_VENUE_SET", meetingId, venueName },
    });
  }

  // ─── Abonelik hatırlatması ────────────────────────────────────────────────

  async notifySubscriptionExpiring(userId: string, expiresAt: Date, planName: string): Promise<void> {
    const dateStr = expiresAt.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      timeZone: "Europe/Istanbul",
    });

    await this.send({
      userId,
      title: "Aboneliğiniz sona eriyor",
      body: `${planName} aboneliğiniz ${dateStr} tarihinde sona eriyor. Yenilemek için tıklayın.`,
      data: { event: "SUBSCRIPTION_EXPIRING", planName },
    });
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

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, type: NotificationType.IN_APP },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: { id: true, title: true, body: true, data: true, read: true, createdAt: true },
      }),
      this.prisma.notification.count({ where: { userId, type: NotificationType.IN_APP } }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false, type: NotificationType.IN_APP },
      data: { read: true },
    });
  }
}
