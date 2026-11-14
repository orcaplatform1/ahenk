import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PaymentPlatform, PaymentStatus, Prisma, SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PRIME_MONTHS } from "./payment.constants";
import { GROUP_RIGHTS, KANKA_RIGHTS, PRIME_PLANS } from "./package-rights";
import { PricingService } from "./pricing.service";
import { IyzicoService } from "./iyzico/iyzico.service";

type Db = PrismaService | Prisma.TransactionClient;

// Prime abonelik kuralları:
// - Satın alındığı anda 1 grup + 1 başbaşa + 1 kankamla hakkı tanımlanır.
// - Satın alma tarihinden itibaren her 30 günde haklar sıfırlanıp yeniden 1 + 1 + 1 olur; kullanılmayan haklar devretmez.
// - Dönem (1/3/6/12 ay) başında planın tam tutarı tek seferde çekilir; dönem bitince aynı süreyle otomatik yenilenir
//   (web: iyzico abonelik API'si, mobil: App Store / Play Store). Yenileme ödemeleri indirimsizdir.
// - "Aboneliği İptal Et": otomatik yenileme durur, haklar dönem sonuna kadar kullanılır, iade yapılmaz.
export const PRIME_RESET_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

@Injectable()
export class PrimeService {
  private readonly logger = new Logger(PrimeService.name);

  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private iyzico: IyzicoService,
  ) {}

  // Yeni Prime aboneliği (ödeme doğrulandıktan sonra, transaction içinde)
  async createPrime(
    db: Db,
    userId: string,
    plan: SubscriptionPlan,
    opts: { autoRenew?: boolean; storePlatform?: PaymentPlatform; storeOriginalTransactionId?: string; expiresAt?: Date },
  ) {
    const now = new Date();
    return db.subscription.create({
      data: {
        userId,
        plan,
        startsAt: now,
        expiresAt: opts.expiresAt ?? addMonths(now, PRIME_MONTHS[plan] ?? 1),
        rightsResetAt: new Date(now.getTime() + PRIME_RESET_DAYS * DAY_MS),
        groupRights: GROUP_RIGHTS[plan],
        kankaRights: KANKA_RIGHTS,
        autoRenew: opts.autoRenew ?? false,
        storePlatform: opts.storePlatform ?? null,
        storeOriginalTransactionId: opts.storeOriginalTransactionId ?? null,
      },
    });
  }

  // iyzico abonelik formu tamamlandı: formu açan Prime'a (sid) referans yazılır, otomatik yenileme açılır
  async attachIyzicoSubscription(subscriptionId: string, ref: string, pricingPlanRef: string, planRefOf: (plan: SubscriptionPlan) => string | undefined): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, select: { id: true, plan: true, status: true, iyzicoSubscriptionRef: true } });
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE || sub.iyzicoSubscriptionRef || planRefOf(sub.plan) !== pricingPlanRef) return false;
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { iyzicoSubscriptionRef: ref, autoRenew: true } });
    return true;
  }

  // Dönem yenilendi (iyzico webhook / mağaza bildirimi): yenileme ödemesi (indirimsiz) yazılır, dönem aynı süreyle uzar
  async renew(subscriptionId: string, platform: PaymentPlatform, ref: { iyzicoPaymentId?: string; storeTransactionId?: string; expiresAt?: Date }) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub || !PRIME_PLANS.includes(sub.plan)) throw new NotFoundException("Prime aboneliği bulunamadı");
    if (ref.storeTransactionId && (await this.prisma.payment.count({ where: { storeTransactionId: ref.storeTransactionId } })) > 0) return;
    const price = await this.pricing.current(sub.plan);
    const amountKurus = platform === PaymentPlatform.WEB ? price.webKurus : price.mobileKurus;
    const base = sub.expiresAt && sub.expiresAt.getTime() > Date.now() ? sub.expiresAt : new Date();
    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          userId: sub.userId, plan: sub.plan, amountKurus, listKurus: amountKurus, status: PaymentStatus.SUCCESS, platform,
          isRenewal: true, paidAt: new Date(), iyzicoPaymentId: ref.iyzicoPaymentId ?? null, storeTransactionId: ref.storeTransactionId ?? null,
        },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.ACTIVE, expiresAt: ref.expiresAt ?? addMonths(base, PRIME_MONTHS[sub.plan] ?? 1) },
      }),
    ]);
  }

  // Otomatik yenileme sağlayıcıda durdu (iptal / ödeme alınamadı): dönem sonunda abonelik biter
  async stopAutoRenew(subscriptionId: string) {
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { autoRenew: false, renewCancelledAt: new Date() },
    });
  }

  // "Aboneliği İptal Et": otomatik yenileme durur, haklar dönem sonuna kadar kullanılır, iade yapılmaz.
  // Mağaza aboneliği uygulama içinden iptal edilemez (Apple / Google kuralı): kullanıcı mağazanın abonelik sayfasına yönlendirilir.
  async cancelRenewal(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, plan: { in: PRIME_PLANS } },
      select: { id: true, autoRenew: true, iyzicoSubscriptionRef: true, storePlatform: true, expiresAt: true },
    });
    if (!sub) throw new NotFoundException("Aktif Prime aboneliğin bulunamadı.");
    if (sub.storePlatform) return { storeManaged: sub.storePlatform, expiresAt: sub.expiresAt };
    if (sub.iyzicoSubscriptionRef) {
      const r = await this.iyzico.cancelSubscription(sub.iyzicoSubscriptionRef);
      if (r.status !== "success") this.logger.error(`iyzico abonelik iptali başarısız: sub=${sub.id} ${r.errorMessage}`);
    }
    await this.stopAutoRenew(sub.id);
    return { cancelled: true, expiresAt: sub.expiresAt };
  }

  // Her saat: 30 günü dolan Prime'ların hakları yeniden 1 + 1 + 1 olur (devretmez); dönemi biten ve yenilenmeyen Prime biter
  @Cron("5 * * * *", { timeZone: "Europe/Istanbul" })
  async hourly(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE, plan: { in: PRIME_PLANS }, rightsResetAt: { lte: now } },
      select: { id: true, plan: true, rightsResetAt: true, expiresAt: true },
    });
    for (const s of due) {
      let next = s.rightsResetAt!.getTime();
      while (next <= now.getTime()) next += PRIME_RESET_DAYS * DAY_MS;
      await this.prisma.subscription.update({
        where: { id: s.id },
        data: { groupRights: GROUP_RIGHTS[s.plan], usedAt: null, kankaRights: KANKA_RIGHTS, rightsResetAt: new Date(next) },
      });
    }
    const { count } = await this.prisma.subscription.updateMany({
      where: { status: SubscriptionStatus.ACTIVE, plan: { in: PRIME_PLANS }, expiresAt: { lte: now } },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    if (due.length || count) this.logger.log(`Prime: ${due.length} hak yenilendi, ${count} abonelik bitti`);
  }
}
