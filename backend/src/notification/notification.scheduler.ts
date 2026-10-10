import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "./notification.service";
import { SUBSCRIPTION_REMINDER_DAYS } from "./notification.constants";
import { SubscriptionStatus, SubscriptionPlan } from "@prisma/client";
import { PLAN_CONFIG } from "../payment/payment.constants";

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // Her gün 10:00 TR saatinde abonelik hatırlatması kontrol et
  @Cron("0 7 * * *", { timeZone: "Europe/Istanbul" })
  async checkExpiringSubscriptions(): Promise<void> {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + SUBSCRIPTION_REMINDER_DAYS);

    const expiring = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gte: now, lte: threshold },
        plan: { in: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE] },
      },
      select: { userId: true, plan: true, expiresAt: true },
    });

    this.logger.log(`Sona yaklaşan abonelik: ${expiring.length} adet`);

    for (const sub of expiring) {
      const planName = PLAN_CONFIG[sub.plan].nametr;
      await this.notifications.notifySubscriptionExpiring(sub.userId, sub.expiresAt!, planName);
    }
  }
}
