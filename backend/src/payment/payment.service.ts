import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { IyzicoService } from "./iyzico/iyzico.service";
import { PLAN_CONFIG, MASADA_DURATION_DAYS } from "./payment.constants";
import { isMaintenanceMode } from "../admin/app-settings";
import { SubscriptionPlan, PaymentPlatform, PaymentStatus, SubscriptionStatus, RefundType, ReferralStatus, PaymentDiscountType, UserStatus, MeetingType, MeetingStatus } from "@prisma/client";

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

    // Abonelik süresince kurulmuş masa varsa o tür için iade yok (web butonu buna göre)
    const withTables = await Promise.all(subs.map(async (s) => ({
      ...s,
      groupTableFormed: await this.tableFormedSince(userId, MeetingType.GROUP, s.createdAt),
      oneOnOneTableFormed: await this.tableFormedSince(userId, MeetingType.ONE_ON_ONE, s.createdAt),
    })));

    return {
      subscriptions: withTables,
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

  async getDiscountInfo(userId: string): Promise<{ referralDiscount: boolean; referralCount: number; inviteeDiscount: boolean }> {
    const [referralCount, user] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { referralDiscountAvailable: true } }),
    ]);
    return {
      referralDiscount: referralCount > 0,
      referralCount,
      inviteeDiscount: user?.referralDiscountAvailable ?? false,
    };
  }

  // Aktif paket kuralı: Masada → Masada/İçerde alınamaz; Karşımda → Karşımda/İçerde; İçerde → hiçbiri
  private async assertCanBuy(userId: string, plan: SubscriptionPlan) {
    const active = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { plan: true },
    });
    const owned = new Set(active.map((s) => s.plan));
    const blockedBy: Record<SubscriptionPlan, SubscriptionPlan[]> = {
      [SubscriptionPlan.MASADA]: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE],
      [SubscriptionPlan.KARSIMDA]: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
      [SubscriptionPlan.ICERDE]: [SubscriptionPlan.MASADA, SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
    };
    if (blockedBy[plan].some((p) => owned.has(p))) {
      throw new ConflictException("Aktif paketiniz bu paketi kapsıyor; bu paketi şu an satın alamazsınız.");
    }
  }

  async initCheckout(
    userId: string,
    plan: SubscriptionPlan,
    platform: PaymentPlatform,
    useDiscount?: 'REFERRER' | 'INVITEE',
  ) {
    if (await isMaintenanceMode(this.prisma)) {
      throw new ServiceUnavailableException("Kısa bir bakım çalışması yapıyoruz. Paket satın alma geçici olarak durduruldu.");
    }

    await this.assertCanBuy(userId, plan);

    if (platform === PaymentPlatform.IOS) {
      return { stub: true, message: "iOS ödemesi henüz aktif değil. StoreKit 2 desteği yakında gelecek." };
    }

    const planCfg = PLAN_CONFIG[plan];
    let amountKurus = planCfg.amountKurus;
    let discountType: PaymentDiscountType | null = null;

    // İndirim burada sadece kontrol edilir; hak ödeme başarılı olunca harcanır
    if (useDiscount === 'REFERRER') {
      const referral = await this.prisma.referral.findFirst({
        where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED },
      });
      if (referral) {
        amountKurus = Math.round(amountKurus * 0.9);
        discountType = PaymentDiscountType.REFERRER;
      }
    } else if (useDiscount === 'INVITEE') {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { referralDiscountAvailable: true } });
      if (user?.referralDiscountAvailable) {
        amountKurus = Math.round(amountKurus * 0.9);
        discountType = PaymentDiscountType.INVITEE;
      }
    }

    const conversationId = `ahenk-${userId}-${Date.now()}`;
    const callbackUrl = this.config.getOrThrow<string>("IYZICO_CALLBACK_URL");

    // Önceki PENDING payment varsa temizle
    await this.prisma.payment.deleteMany({
      where: { userId, status: PaymentStatus.PENDING },
    });

    // Payment kaydı oluştur
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        plan,
        amountKurus,
        status: PaymentStatus.PENDING,
        platform,
        iyzicoConversationId: conversationId,
        discountType,
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
      amountKurus,
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

    if (payment.status !== PaymentStatus.PENDING) {
      return { success: false, message: "Ödeme başarısız" };
    }

    const result = await this.iyzico.retrieveCheckoutForm(token);

    // API çağrısının başarılı olması yetmez: ödeme durumu, sepet ve tutar da tutmalı
    const expectedPrice = payment.amountKurus / 100;
    const verified =
      result.status === "success" &&
      result.paymentStatus === "SUCCESS" &&
      result.basketId === payment.id &&
      Number(result.price) === expectedPrice;

    if (!verified) {
      const reason =
        result.errorMessage ??
        (result.status === "success" && result.paymentStatus === "SUCCESS"
          ? `Doğrulama uyuşmazlığı (sepet: ${result.basketId}, tutar: ${result.price})`
          : `Ödeme durumu: ${result.paymentStatus ?? result.status}`);
      if (result.status === "success" && result.paymentStatus === "SUCCESS") {
        this.logger.error(`iyzico doğrulama uyuşmazlığı: payment=${payment.id} ${reason}`);
      }
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: reason },
      });
      return { success: false, message: result.errorMessage ?? "Ödeme başarısız" };
    }

    // Ödeme başarılı — abonelik oluştur, indirimi harca
    const processed = await this.prisma.$transaction(async (tx) => {
      // Sadece PENDING ise işle: aynı token için ikinci callback abonelik oluşturmaz
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.SUCCESS,
          iyzicoPaymentId: result.paymentId,
          paidAt: new Date(),
        },
      });
      if (count === 0) return false;

      await this.createSubscriptions(tx, payment.userId, payment.plan, payment.id);

      if (payment.discountType === PaymentDiscountType.REFERRER) {
        const referral = await tx.referral.findFirst({
          where: { referrerId: payment.userId, status: ReferralStatus.KYC_APPROVED },
        });
        if (referral) {
          await tx.referral.update({
            where: { id: referral.id },
            data: { discountUsedAt: new Date(), status: ReferralStatus.DISCOUNT_USED },
          });
        }
      } else if (payment.discountType === PaymentDiscountType.INVITEE) {
        await tx.user.update({
          where: { id: payment.userId },
          data: { referralDiscountAvailable: false },
        });
      }
      return true;
    });

    return processed
      ? { success: true, message: "Ödeme başarıyla tamamlandı" }
      : { success: true, message: "Ödeme zaten tamamlandı" };
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
      include: { payment: { select: { status: true } } },
    });
    if (!sub) throw new NotFoundException("Aktif abonelik bulunamadı.");
    if (sub.payment?.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException("Bu abonelik için iade edilecek bir ödeme bulunmuyor.");
    }

    await this.assertRefundAllowed(userId, sub.createdAt, sub.plan, refundType, sub.missedGroupCycles, sub.missedOneonOneCycles);

    const existing = await this.prisma.refundRequest.findFirst({
      where: { userId, subscriptionId: sub.id, status: "PENDING" },
    });
    if (existing) throw new ConflictException("Bu abonelik için bekleyen bir iade talebi zaten var.");

    const refundRequest = await this.prisma.refundRequest.create({
      data: { userId, subscriptionId: sub.id, refundType },
    });

    return { ok: true, refundRequestId: refundRequest.id };
  }

  // Abonelik başladıktan sonra bu türde kurulmuş (iptal edilmemiş) bir masaya yerleşmiş mi
  private async tableFormedSince(userId: string, type: MeetingType, since: Date): Promise<boolean> {
    const count = await this.prisma.meetingParticipant.count({
      where: {
        userId,
        meeting: { type, createdAt: { gte: since }, status: { not: MeetingStatus.CANCELLED } },
      },
    });
    return count > 0;
  }

  // Paket + iade türü uyumu, 4 kaçırılmış döngü ve "masa kurulduysa hizmet alınmıştır" kuralı
  private async assertRefundAllowed(
    userId: string,
    subCreatedAt: Date,
    plan: SubscriptionPlan,
    refundType: RefundType,
    missedGroup: number,
    missedOneone: number,
  ) {
    const allowed: Record<SubscriptionPlan, RefundType[]> = {
      [SubscriptionPlan.MASADA]: [RefundType.GROUP],
      [SubscriptionPlan.KARSIMDA]: [RefundType.ONEONE],
      [SubscriptionPlan.ICERDE]: [RefundType.GROUP, RefundType.ONEONE, RefundType.FULL],
    };
    if (!allowed[plan].includes(refundType)) {
      throw new BadRequestException("Bu paket için bu iade türü geçerli değil.");
    }

    const isGroup = refundType === RefundType.GROUP || refundType === RefundType.FULL;
    const isOneone = refundType === RefundType.ONEONE || refundType === RefundType.FULL;

    if (isGroup && missedGroup < 4) {
      throw new BadRequestException(
        `Grup döngüsü iade için 4 kaçırılmış döngü gerekli. Mevcut: ${missedGroup}`,
      );
    }
    if (isOneone && missedOneone < 4) {
      throw new BadRequestException(
        `Başbaşa döngüsü iade için 4 kaçırılmış döngü gerekli. Mevcut: ${missedOneone}`,
      );
    }
    if (isGroup && await this.tableFormedSince(userId, MeetingType.GROUP, subCreatedAt)) {
      throw new BadRequestException("Grup masanız kurulduğu için bu hizmet alınmış sayılır; iade yapılamaz.");
    }
    if (isOneone && await this.tableFormedSince(userId, MeetingType.ONE_ON_ONE, subCreatedAt)) {
      throw new BadRequestException("Başbaşa masanız kurulduğu için bu hizmet alınmış sayılır; iade yapılamaz.");
    }
  }

  // İade tutarı ödenen tutar üzerinden: İçerde'de tek tarafın iadesi yarısı, diğerlerinde tamamı
  static refundAmountKurus(plan: SubscriptionPlan, refundType: RefundType, paidKurus: number): number {
    if (plan === SubscriptionPlan.ICERDE && refundType !== RefundType.FULL) {
      return Math.round(paidKurus / 2);
    }
    return paidKurus;
  }

  // Admin onayı: iyzico iadesi → talep APPROVED + abonelik CANCELLED
  async approveRefund(refundId: string, ip: string, adminNote?: string) {
    const refund = await this.prisma.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        user: { select: { status: true } },
        subscription: {
          select: {
            id: true, plan: true, createdAt: true, status: true, missedGroupCycles: true, missedOneonOneCycles: true,
            payment: { select: { status: true, amountKurus: true, iyzicoPaymentId: true } },
          },
        },
      },
    });
    if (!refund) throw new NotFoundException("İade talebi bulunamadı.");
    if (refund.status !== "PENDING") throw new BadRequestException("Bu iade talebi zaten sonuçlandırılmış.");
    if (refund.user.status === UserStatus.BANNED || refund.user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException("Banlı veya askıdaki kullanıcıya iade yapılmaz.");
    }

    const sub = refund.subscription;
    const payment = sub.payment;
    if (payment?.status !== PaymentStatus.SUCCESS || !payment.iyzicoPaymentId) {
      throw new BadRequestException("Bu abonelik için iade edilecek bir ödeme bulunmuyor.");
    }
    await this.assertRefundAllowed(refund.userId, sub.createdAt, sub.plan, refund.refundType, sub.missedGroupCycles, sub.missedOneonOneCycles);

    const amountKurus = PaymentService.refundAmountKurus(sub.plan, refund.refundType, payment.amountKurus);
    const result = await this.iyzico.refundPayment({
      paymentId: payment.iyzicoPaymentId,
      amountKurus,
      conversationId: `ahenk-refund-${refund.id}`,
      ip,
    });
    if (result.status !== "success") {
      throw new BadRequestException(`iyzico iadesi başarısız: ${result.errorMessage ?? "bilinmeyen hata"}`);
    }

    await this.prisma.$transaction([
      this.prisma.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: "APPROVED",
          adminNote: adminNote ?? refund.adminNote,
          refundedKurus: amountKurus,
          iyzicoRefundId: result.paymentId ?? null,
        },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.CANCELLED, cancelNote: "İade" },
      }),
    ]);

    return { ok: true, refundedKurus: amountKurus };
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
