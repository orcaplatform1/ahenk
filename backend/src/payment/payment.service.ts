import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { IyzicoService } from "./iyzico/iyzico.service";
import { PLAN_CONFIG, MASADA_DURATION_DAYS } from "./payment.constants";
import { SubscriptionPlan, PaymentPlatform, PaymentStatus, SubscriptionStatus, RefundType } from "@prisma/client";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private iyzico: IyzicoService,
    private config: ConfigService,
  ) {}

  // ─── Mevcut abonelik durumu ───────────────────────────────────────────────

  async getSubscriptions(userId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        plan: true,
        status: true,
        startsAt: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        missedGroupCycles: true,
        missedOneonOneCycles: true,
      },
    });

    return {
      subscriptions: subs,
      hasMasada: subs.some(
        (s) =>
          (s.plan === SubscriptionPlan.MASADA || s.plan === SubscriptionPlan.ICERDE) &&
          s.status === SubscriptionStatus.ACTIVE &&
          (!s.expiresAt || s.expiresAt > new Date()),
      ),
      hasKarsimda: subs.some(
        (s) =>
          (s.plan === SubscriptionPlan.KARSIMDA || s.plan === SubscriptionPlan.ICERDE) &&
          s.status === SubscriptionStatus.ACTIVE &&
          !s.usedAt,
      ),
    };
  }

  // ─── iyzico Checkout Form başlat ─────────────────────────────────────────

  async initCheckout(
    userId: string,
    plan: SubscriptionPlan,
    platform: PaymentPlatform,
    callbackOverride?: string,
  ) {
    if (platform === PaymentPlatform.IOS) {
      return { stub: true, message: "iOS ödemesi henüz aktif değil. StoreKit 2 desteği yakında gelecek." };
    }

    const planCfg = PLAN_CONFIG[plan];
    const conversationId = `ahenk-${userId}-${Date.now()}`;
    const callbackUrl =
      callbackOverride ?? this.config.get<string>("IYZICO_CALLBACK_URL") ?? "http://localhost:3001/odeme/callback";

    // Önceki PENDING payment varsa temizle
    await this.prisma.payment.deleteMany({
      where: { userId, status: PaymentStatus.PENDING },
    });

    // Payment kaydı oluştur
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        plan,
        amountKurus: planCfg.amountKurus,
        status: PaymentStatus.PENDING,
        platform,
        iyzicoConversationId: conversationId,
      },
    });

    // Kullanıcı profili
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");

    const firstName = user.profile?.firstName ?? "Kullanıcı";
    const lastName = user.profile?.lastName ?? "";

    const result = await this.iyzico.initCheckoutForm({
      conversationId,
      amountKurus: planCfg.amountKurus,
      basketId: payment.id,
      itemName: planCfg.nametr,
      buyerEmail: user.email,
      buyerName: firstName,
      buyerSurname: lastName,
      buyerPhone: user.phone ?? undefined,
      callbackUrl,
    });

    if (result.status !== "success") {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failureReason: result.errorMessage },
      });
      throw new BadRequestException(result.errorMessage ?? "Ödeme başlatılamadı");
    }

    // Token'ı kaydet
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { iyzicoToken: result.token },
    });

    return {
      paymentId: payment.id,
      token: result.token,
      checkoutFormContent: result.checkoutFormContent,
      plan: planCfg,
    };
  }

  // ─── iyzico Callback işle ─────────────────────────────────────────────────

  async handleCallback(token: string): Promise<{ success: boolean; message: string }> {
    const payment = await this.prisma.payment.findFirst({
      where: { iyzicoToken: token },
    });

    if (!payment) {
      this.logger.warn(`Bilinmeyen iyzico token: ${token}`);
      return { success: false, message: "Ödeme kaydı bulunamadı" };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { success: true, message: "Ödeme zaten tamamlandı" };
    }

    const result = await this.iyzico.retrieveCheckoutForm(token);

    if (result.status !== "success") {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: result.errorMessage,
        },
      });
      return { success: false, message: result.errorMessage ?? "Ödeme başarısız" };
    }

    // Ödeme başarılı — abonelik oluştur
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          iyzicoPaymentId: result.paymentId,
          paidAt: new Date(),
        },
      });

      await this.createSubscriptions(tx, payment.userId, payment.plan, payment.id);
    });

    return { success: true, message: "Ödeme başarıyla tamamlandı" };
  }

  // ─── Abonelik oluşturma (transaction içinde) ──────────────────────────────

  private async createSubscriptions(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    plan: SubscriptionPlan,
    paymentId: string,
  ) {
    if (plan === SubscriptionPlan.MASADA) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + MASADA_DURATION_DAYS);

      const sub = await tx.subscription.create({
        data: { userId, plan: SubscriptionPlan.MASADA, expiresAt },
      });
      await tx.payment.update({ where: { id: paymentId }, data: { subscriptionId: sub.id } });
    }

    if (plan === SubscriptionPlan.KARSIMDA) {
      const sub = await tx.subscription.create({
        data: { userId, plan: SubscriptionPlan.KARSIMDA },
      });
      await tx.payment.update({ where: { id: paymentId }, data: { subscriptionId: sub.id } });
    }

    if (plan === SubscriptionPlan.ICERDE) {
      // ICERDE paketi: hem MASADA (30 gün) hem KARSIMDA (tek kullanım) hakkı verir
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + MASADA_DURATION_DAYS);

      const sub = await tx.subscription.create({
        data: { userId, plan: SubscriptionPlan.ICERDE, expiresAt },
      });
      await tx.payment.update({ where: { id: paymentId }, data: { subscriptionId: sub.id } });
    }
  }

  // ─── İade Talebi ─────────────────────────────────────────────────────────

  async requestRefund(userId: string, refundType: RefundType) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) throw new NotFoundException("Aktif abonelik bulunamadı.");

    const isGroup = refundType === RefundType.GROUP || refundType === RefundType.FULL;
    const isOneone = refundType === RefundType.ONEONE || refundType === RefundType.FULL;

    if (isGroup && sub.missedGroupCycles < 4) {
      throw new BadRequestException(
        `Grup döngüsü iade için 4 kaçırılmış döngü gerekli. Mevcut: ${sub.missedGroupCycles}`,
      );
    }
    if (isOneone && sub.missedOneonOneCycles < 4) {
      throw new BadRequestException(
        `Başbaşa döngüsü iade için 4 kaçırılmış döngü gerekli. Mevcut: ${sub.missedOneonOneCycles}`,
      );
    }

    const existing = await this.prisma.refundRequest.findFirst({
      where: { userId, subscriptionId: sub.id, status: "PENDING" },
    });
    if (existing) throw new ConflictException("Bu abonelik için bekleyen bir iade talebi zaten var.");

    const refundRequest = await this.prisma.refundRequest.create({
      data: { userId, subscriptionId: sub.id, refundType },
    });

    return { ok: true, refundRequestId: refundRequest.id };
  }

  // ─── Planlar listesi (herkese açık) ──────────────────────────────────────

  getPlans() {
    return Object.entries(PLAN_CONFIG).map(([plan, cfg]) => ({
      plan,
      nametr: cfg.nametr,
      amountTL: (cfg.amountKurus / 100).toFixed(2),
      label: cfg.label,
      recurring: cfg.recurring,
    }));
  }
}
