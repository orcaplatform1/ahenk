import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { KycStatus, Prisma, SubscriptionPlan, SubscriptionStatus, UserStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { activeKankaLink } from "../kanka/kanka-links";
import { trIsoWeek } from "../admin/tr-week";
import { PLAN_CONFIG } from "./payment.constants";
import { PricingService } from "./pricing.service";

type Db = PrismaService | Prisma.TransactionClient;

const AMOUNT_KEY = "WINBACK_AMOUNT_TL";
const PLANS_KEY = "WINBACK_PLANS";
const OFFER_MS = 60 * 60 * 1000;
const REMINDER_MS = 15 * 60 * 1000;

// Pazartesi push metinleri: ISO hafta numarasına göre sırayla. İndirimden bahsedilmez.
const MONDAY_TEXTS = [
  "Masa eşleşmeleri başladı, sen neredesin?",
  "Hafta sonu planını hazırladık.",
  "Bu hafta masanda kimler var, merak etmiyor musun?",
  "Yeni haftanın masaları kuruluyor.",
];

@Injectable()
export class WinbackService {
  private readonly logger = new Logger(WinbackService.name);

  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private notifications: NotificationService,
  ) {}

  // ─── Ayarlar (AppConfig) ──────────────────────────────────────────────────

  async settings(): Promise<{ amountTL: number; plans: SubscriptionPlan[] }> {
    const rows = await this.prisma.appConfig.findMany({ where: { key: { in: [AMOUNT_KEY, PLANS_KEY] } } });
    const value = (key: string) => rows.find((r) => r.key === key)?.value ?? "";
    // Geri kazanım indirimi tüm tek seferlik paketlerde ve tüm Prime planlarında geçerlidir
    // (WINBACK_PLANS ayarı okunmaz; admin ekranındaki paket seçimi uygulanmaz)
    const plans = Object.keys(PLAN_CONFIG) as SubscriptionPlan[];
    return { amountTL: Number(value(AMOUNT_KEY)) || 0, plans };
  }

  async updateSettings(amountTL: number, plans: SubscriptionPlan[]) {
    const prices = await this.pricing.all();
    const tooLow = plans.find((p) => prices[p].webKurus <= amountTL * 100 || prices[p].mobileKurus <= amountTL * 100);
    if (tooLow) throw new BadRequestException(`İndirim tutarı ${PLAN_CONFIG[tooLow].nametr} fiyatından küçük olmalı.`);
    const write = (key: string, value: string) =>
      this.prisma.appConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
    await this.prisma.$transaction([write(AMOUNT_KEY, String(amountTL)), write(PLANS_KEY, plans.join(","))]);
    return this.settings();
  }

  // ─── Kullanıcı durumu ─────────────────────────────────────────────────────

  // Geçerli teklif: kullanılmamış, süresi bitmemiş, kişinin aktif paketi yok
  private async liveOffer(db: Db, userId: string) {
    const offer = await db.winbackOffer.findUnique({ where: { userId } });
    if (!offer || offer.usedAt) return null;
    if (offer.expiresAt && offer.expiresAt.getTime() <= Date.now()) return null;
    const active = await db.subscription.count({ where: { userId, status: SubscriptionStatus.ACTIVE } });
    return active > 0 ? null : offer;
  }

  private async isKycApproved(userId: string) {
    const kyc = await this.prisma.kycSubmission.findUnique({ where: { userId }, select: { status: true } });
    return kyc?.status === KycStatus.APPROVED;
  }

  async state(userId: string) {
    const offer = await this.liveOffer(this.prisma, userId);
    const settings = await this.settings();
    if (!offer || settings.amountTL <= 0 || settings.plans.length === 0) return { active: false as const };

    const kycApproved = await this.isKycApproved(userId);
    const [prices, everBought, link] = await Promise.all([
      this.pricing.all(),
      this.prisma.subscription.count({ where: { userId } }),
      activeKankaLink(this.prisma, userId),
    ]);
    // Kankanın aktif Kankamla paketi varsa çift yenisini alamaz: kart çıkmaz
    const pairKanka = link
      ? await this.prisma.subscription.count({ where: { userId: link.kankaId, plan: SubscriptionPlan.KANKAMLA, status: SubscriptionStatus.ACTIVE } })
      : 0;
    const plans = settings.plans
      .filter((plan) => plan !== SubscriptionPlan.KANKAMLA || pairKanka === 0)
      .map((plan) => ({
        plan,
        name: PLAN_CONFIG[plan].nametr,
        listTL: prices[plan].webKurus / 100,
        discountedTL: prices[plan].webKurus / 100 - settings.amountTL,
        // Mobil gösterim: mobilde tahsil edilen tutarla aynı (mobil fiyat − geri kazanım tutarı)
        mobileListTL: prices[plan].mobileKurus / 100,
        mobileDiscountedTL: prices[plan].mobileKurus / 100 - settings.amountTL,
        needsKanka: plan === SubscriptionPlan.KANKAMLA && !link,
      }));

    return {
      active: true as const,
      amountTL: settings.amountTL,
      plans,
      kycApproved,
      // Paketi olmuşsa "Birkaç masa daha?", hiç olmamışsa "Uyumlu bir masa?"
      lapsed: everBought > 0,
      durationSeconds: OFFER_MS / 1000,
      // Sayaç başlamadıysa null (KYC onaysız ya da ekran henüz gösterilmedi)
      expiresAt: offer.expiresAt,
      serverNow: new Date(),
      // İlk açılışta ekran kendiliğinden çıkar
      autoOpen: kycApproved ? !offer.shownAt : !offer.heldSeenAt,
    };
  }

  // Ekran gösterildi: KYC onaylıda sayaç bu anda başlar (bir kez), KYC onaysızda sadece görüldü işlenir
  async markShown(userId: string) {
    const offer = await this.liveOffer(this.prisma, userId);
    if (offer) {
      const now = new Date();
      if (await this.isKycApproved(userId)) {
        await this.prisma.winbackOffer.updateMany({
          where: { id: offer.id, shownAt: null },
          data: { shownAt: now, expiresAt: new Date(now.getTime() + OFFER_MS) },
        });
      } else {
        await this.prisma.winbackOffer.updateMany({ where: { id: offer.id, heldSeenAt: null }, data: { heldSeenAt: now } });
      }
    }
    return this.state(userId);
  }

  // Sayaç işliyorsa ve paket seçiliyse indirimli tutar (kuruş); değilse null
  async discountedKurus(userId: string, plan: SubscriptionPlan, listKurus: number): Promise<number | null> {
    const offer = await this.liveOffer(this.prisma, userId);
    if (!offer?.expiresAt) return null;
    const { amountTL, plans } = await this.settings();
    const amount = listKurus - amountTL * 100;
    return plans.includes(plan) && amountTL > 0 && amount > 0 ? amount : null;
  }

  // Ödeme başarılı olunca harcanır; bu kişi bir daha hak kazanmaz
  async consume(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
    const { count } = await tx.winbackOffer.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    return count > 0;
  }

  // ─── Pazartesi 21:00 push ─────────────────────────────────────────────────

  @Cron("0 21 * * 1", { timeZone: "Europe/Istanbul" })
  async mondayPush(): Promise<void> {
    const targets = await this.prisma.user.findMany({
      where: {
        isBot: false,
        status: UserStatus.ACTIVE,
        subscriptions: { none: { status: SubscriptionStatus.ACTIVE } },
        NOT: { winbackOffer: { usedAt: { not: null } } },
      },
      select: { id: true, winbackOffer: { select: { expiresAt: true } } },
    });
    const body = MONDAY_TEXTS[(trIsoWeek() - 1) % MONDAY_TEXTS.length];
    const now = new Date();
    for (const t of targets) {
      try {
        const fresh = { grantedAt: now, heldSeenAt: null, shownAt: null, expiresAt: null, reminderSentAt: null };
        const expired = !!t.winbackOffer?.expiresAt && t.winbackOffer.expiresAt <= now;
        // Bekleyen ya da süresi işleyen hak korunur; süresi dolmuş hak sıfırlanır
        if (!t.winbackOffer) await this.prisma.winbackOffer.create({ data: { userId: t.id, grantedAt: now } });
        else if (expired) await this.prisma.winbackOffer.update({ where: { userId: t.id }, data: fresh });
        await this.notifications.sendToUser(t.id, { title: "Ahenk", body, data: { event: "WEEKLY_MASA" } });
      } catch (err) {
        this.logger.error(`Pazartesi push hatası: user=${t.id} ${err}`);
      }
    }
    this.logger.log(`Pazartesi push: ${targets.length} kullanıcı`);
  }

  // ─── Bitişe 15 dakika kala hatırlatma (sadece push) ───────────────────────

  @Cron("* * * * *", { timeZone: "Europe/Istanbul" })
  async expiryReminders(): Promise<void> {
    const now = Date.now();
    const offers = await this.prisma.winbackOffer.findMany({
      where: {
        usedAt: null,
        reminderSentAt: null,
        expiresAt: { gt: new Date(now), lte: new Date(now + REMINDER_MS) },
        user: { subscriptions: { none: { status: SubscriptionStatus.ACTIVE } } },
      },
      select: { id: true, userId: true },
    });
    for (const o of offers) {
      try {
        const { count } = await this.prisma.winbackOffer.updateMany({
          where: { id: o.id, reminderSentAt: null },
          data: { reminderSentAt: new Date() },
        });
        if (count === 0) continue;
        await this.notifications.sendToUser(o.userId, {
          title: "İndirimin bitmek üzere",
          body: "Sana özel indiriminin bitmesine 15 dakika kaldı.",
          data: { event: "WINBACK_REMINDER" },
        });
      } catch (err) {
        this.logger.error(`İndirim hatırlatma hatası: user=${o.userId} ${err}`);
      }
    }
  }
}
