import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { IyzicoService, IyzicoSubscriptionWebhook } from "./iyzico/iyzico.service";
import { PLAN_CONFIG, MASADA_DURATION_DAYS } from "./payment.constants";
import { PricingService } from "./pricing.service";
import { isMaintenanceMode } from "../admin/app-settings";
import { decryptIdentityNumber } from "../kyc/identity-number";
import { ASSIGN_QUEUE, enqueueAssign } from "../matching/assign-queue";
import { Prisma, SubscriptionPlan, PaymentPlatform, PaymentStatus, SubscriptionStatus, RefundType, ReferralStatus, PaymentDiscountType, UserStatus, MeetingType, MeetingStatus, RecurringStatus } from "@prisma/client";

type Db = PrismaService | Prisma.TransactionClient;


@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private iyzico: IyzicoService,
    private config: ConfigService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
    private pricing: PricingService,
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
        recurring: { select: { id: true, status: true } },
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
    useDiscount: 'REFERRER' | 'INVITEE' | undefined,
    clientIp: string,
  ) {
    if (await isMaintenanceMode(this.prisma)) {
      throw new ServiceUnavailableException("Kısa bir bakım çalışması yapıyoruz. Paket satın alma geçici olarak durduruldu.");
    }

    await this.assertCanBuy(userId, plan);

    if (platform === PaymentPlatform.IOS) {
      return { stub: true, message: "iOS ödemesi henüz aktif değil. StoreKit 2 desteği yakında gelecek." };
    }

    // TC kimlik no KYC onayında girilir; yoksa ödeme başlatılmaz (iyzico'ya sahte numara gönderilmez)
    const identity = await this.prisma.userIdentity.findUnique({ where: { userId }, select: { identityNumberEnc: true } });
    if (!identity) {
      throw new BadRequestException("Kimlik doğrulama bilgilerinde eksik var. Lütfen bilgi@ahenk.co adresiyle iletişime geç.");
    }
    const identityNumber = decryptIdentityNumber(identity.identityNumberEnc, this.config.get("IDENTITY_ENC_KEY"));

    const planCfg = PLAN_CONFIG[plan];
    // Web fiyatı (ham + %20 KDV, SUPERADMIN fiyat sayfasından); indirim her ödenen pakette %10
    const price = await this.pricing.current(plan);
    let amountKurus = price.webKurus;
    let discountType: PaymentDiscountType | null = null;

    // İndirim burada sadece kontrol edilir; hak ödeme başarılı olunca harcanır
    if (useDiscount === 'REFERRER') {
      const referral = await this.prisma.referral.findFirst({
        where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED },
      });
      if (referral) {
        amountKurus = price.webDiscountKurus;
        discountType = PaymentDiscountType.REFERRER;
      }
    } else if (useDiscount === 'INVITEE') {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { referralDiscountAvailable: true } });
      if (user?.referralDiscountAvailable) {
        amountKurus = price.webDiscountKurus;
        discountType = PaymentDiscountType.INVITEE;
      }
    }

    // Masada / İçerde: iyzico aboneliği ile her ay otomatik yenilenir
    if (planCfg.recurring) {
      return this.initRecurringCheckout(userId, plan, platform, discountType, identityNumber);
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
        listKurus: price.webKurus,
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
      buyerIdentityNumber: identityNumber,
      // Gerçek istemci IP'si (nginx X-Forwarded-For, trust proxy); IPv6 içine gömülü IPv4 sadeleştirilir
      buyerIp: clientIp.replace(/^::ffff:/, ""),
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
      plan: { ...planCfg, amountKurus },
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

      if (payment.discountType) await this.consumeDiscount(tx, payment.userId, payment.discountType);
      return true;
    });

    // Kişi havuza girdi: anında masaya atanır
    if (processed) await enqueueAssign(this.assignQueue, payment.userId);
    // İndirim hakkı harcandıysa otomatik yenilenen aboneliğin sıradaki fiyatı güncellenir
    if (processed && payment.discountType) await this.syncRecurringPlan(payment.userId);

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

    // İade edilen dönem otomatik yenilenen aboneliğe aitse yenileme de durdurulur
    const period = await this.prisma.subscription.findUnique({ where: { id: sub.id }, select: { recurringId: true } });
    if (period?.recurringId) await this.cancelRecurringById(period.recurringId);

    return { ok: true, refundedKurus: amountKurus };
  }

  // ─── İndirim hakları ──────────────────────────────────────────────────────

  // Harcanmamış indirim hakkı: önce davet edilenin tek seferlik hakkı, sonra davet edenin her onaylı davet hakkı
  private async availableDiscount(db: Db, userId: string): Promise<PaymentDiscountType | null> {
    const user = await db.user.findUnique({ where: { id: userId }, select: { referralDiscountAvailable: true } });
    if (user?.referralDiscountAvailable) return PaymentDiscountType.INVITEE;
    const referral = await db.referral.findFirst({ where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED } });
    return referral ? PaymentDiscountType.REFERRER : null;
  }

  private async consumeDiscount(tx: Prisma.TransactionClient, userId: string, type: PaymentDiscountType): Promise<boolean> {
    if (type === PaymentDiscountType.REFERRER) {
      const referral = await tx.referral.findFirst({ where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED } });
      if (!referral) return false;
      await tx.referral.update({
        where: { id: referral.id },
        data: { discountUsedAt: new Date(), status: ReferralStatus.DISCOUNT_USED },
      });
      return true;
    }
    const { count } = await tx.user.updateMany({
      where: { id: userId, referralDiscountAvailable: true },
      data: { referralDiscountAvailable: false },
    });
    return count > 0;
  }

  // ─── Otomatik yenilenen abonelik (Masada / İçerde, iyzico Abonelik API) ───

  // Geçerli fiyatın iyzico planı (yoksa oluşturulur)
  private async pricingPlanRef(plan: SubscriptionPlan, discounted: boolean): Promise<string> {
    const price = await this.pricing.ensureIyzicoPlans(plan);
    return (discounted ? price.iyzicoDiscountPlanRef : price.iyzicoPlanRef)!;
  }

  private async initRecurringCheckout(
    userId: string,
    plan: SubscriptionPlan,
    platform: PaymentPlatform,
    discountType: PaymentDiscountType | null,
    identityNumber: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    if (!user.phone) throw new BadRequestException("Abonelik için kayıtlı telefon numarası gerekli.");

    // Tamamlanmamış önceki abonelik formu temizlenir
    await this.prisma.recurringSubscription.deleteMany({ where: { userId, status: RecurringStatus.PENDING } });
    const pricingPlanReferenceCode = await this.pricingPlanRef(plan, !!discountType);
    const recurring = await this.prisma.recurringSubscription.create({
      data: { userId, plan, platform, discounted: !!discountType, initialDiscountType: discountType, iyzicoPricingPlanRef: pricingPlanReferenceCode },
    });

    const callbackUrl = this.config.getOrThrow<string>("IYZICO_CALLBACK_URL").replace(/\/callback$/, "/subscription/callback");
    const result = await this.iyzico.initSubscriptionCheckout({
      conversationId: `ahenk-sub-${recurring.id}`,
      pricingPlanReferenceCode,
      callbackUrl,
      name: user.profile?.firstName ?? "Kullanıcı",
      surname: user.profile?.lastName ?? "",
      email: user.email,
      gsmNumber: user.phone,
      identityNumber,
    });
    if (result.status !== "success" || !result.token) {
      await this.prisma.recurringSubscription.delete({ where: { id: recurring.id } });
      throw new BadRequestException(result.errorMessage ?? "Ödeme başlatılamadı");
    }
    await this.prisma.recurringSubscription.update({ where: { id: recurring.id }, data: { checkoutToken: result.token } });

    return {
      recurringId: recurring.id,
      token: result.token,
      checkoutFormContent: result.checkoutFormContent,
      plan: PLAN_CONFIG[plan],
    };
  }

  // Abonelik formu dönüşü: abonelik iyzico'da başladıysa ilk dönem hemen açılır
  async handleSubscriptionCallback(token: string): Promise<{ success: boolean }> {
    const recurring = await this.prisma.recurringSubscription.findUnique({ where: { checkoutToken: token } });
    if (!recurring) {
      this.logger.warn(`Bilinmeyen abonelik token: ${token}`);
      return { success: false };
    }
    return { success: !!(await this.activateFromCheckout(recurring.id)) };
  }

  // Form sonucunu iyzico'dan sorgular; abonelik başladıysa kaydı aktifleştirir ve ilk dönemi açar.
  // Başlayan aboneliğin iyzico kodunu döner (sonradan plan değişikliğiyle kod değişebilir)
  private async activateFromCheckout(recurringId: string): Promise<string | null> {
    const recurring = await this.prisma.recurringSubscription.findUnique({ where: { id: recurringId } });
    if (!recurring?.checkoutToken) return null;
    if (recurring.status !== RecurringStatus.PENDING) return recurring.iyzicoSubscriptionRef;

    const result = await this.iyzico.retrieveSubscriptionCheckout(recurring.checkoutToken);
    const data = result.data;
    if (result.status !== "success" || data?.subscriptionStatus !== "ACTIVE" || !data.referenceCode) {
      this.logger.warn(`Abonelik başlatılamadı: recurring=${recurring.id} ${result.errorMessage ?? data?.subscriptionStatus ?? ""}`);
      return null;
    }

    await this.prisma.recurringSubscription.update({
      where: { id: recurring.id },
      data: {
        status: RecurringStatus.ACTIVE,
        iyzicoSubscriptionRef: data.referenceCode,
        iyzicoCustomerRef: data.customerReferenceCode ?? null,
        iyzicoPricingPlanRef: data.pricingPlanReferenceCode ?? recurring.iyzicoPricingPlanRef,
      },
    });
    await this.grantPeriod(recurring.id, null, null);
    return data.referenceCode;
  }

  // iyzico abonelik webhook'u: imza doğrulanır; başarılı çekim → yeni dönem, başarısız → yeni hak verilmez
  async handleSubscriptionWebhook(body: IyzicoSubscriptionWebhook, signature: string | undefined): Promise<{ ok: boolean }> {
    if (!body?.orderReferenceCode || !this.iyzico.verifySubscriptionWebhook(body, signature)) {
      this.logger.warn(`Geçersiz abonelik webhook imzası: order=${body?.orderReferenceCode}`);
      return { ok: false };
    }

    // Plan değişikliğinden (indirim) sonra iyzico yeni abonelik kodu üretir → müşteri koduyla da eşlenir
    const recurring =
      (await this.prisma.recurringSubscription.findUnique({ where: { iyzicoSubscriptionRef: body.subscriptionReferenceCode } })) ??
      (await this.prisma.recurringSubscription.findFirst({
        where: { iyzicoCustomerRef: body.customerReferenceCode, status: { not: RecurringStatus.PENDING } },
        orderBy: { createdAt: "desc" },
      }));
    // Kullanıcı ödemeden sonra tarayıcıyı kapattıysa form dönüşü gelmemiştir: bekleyen formlar iyzico'dan sorgulanır
    const matched = recurring ?? (await this.matchPendingCheckout(body.subscriptionReferenceCode));
    if (!matched) {
      this.logger.warn(`Abonelik webhook eşleşmedi: sub=${body.subscriptionReferenceCode}`);
      return { ok: false };
    }
    return this.applyWebhook(matched, body);
  }

  private async matchPendingCheckout(subscriptionRef: string) {
    const pending = await this.prisma.recurringSubscription.findMany({
      where: { status: RecurringStatus.PENDING, checkoutToken: { not: null }, createdAt: { gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
      select: { id: true },
    });
    for (const p of pending) {
      if ((await this.activateFromCheckout(p.id)) === subscriptionRef) {
        return this.prisma.recurringSubscription.findUnique({ where: { id: p.id } });
      }
    }
    return null;
  }

  private async applyWebhook(
    recurring: { id: string; status: RecurringStatus },
    body: IyzicoSubscriptionWebhook,
  ): Promise<{ ok: boolean }> {
    // Kayıtlı kod ezilmez: plan değişikliğinden önceki çekimler eski kodla gelebilir (eşleşme müşteri koduyla da yapılır)

    if (body.iyziEventType === "subscription.order.success") {
      await this.grantPeriod(recurring.id, body.orderReferenceCode, body.iyziReferenceCode ?? null);
    } else if (body.iyziEventType === "subscription.order.failure") {
      // Yeni hak verilmez, bildirim gönderilmez; eldeki haklar mevcut kurallarla sürer
      if (recurring.status === RecurringStatus.ACTIVE) {
        await this.prisma.recurringSubscription.update({ where: { id: recurring.id }, data: { status: RecurringStatus.UNPAID } });
      }
      this.logger.warn(`Abonelik çekimi başarısız: recurring=${recurring.id} order=${body.orderReferenceCode}`);
    }
    return { ok: true };
  }

  // Bir ödenmiş dönem: Masada → 1 ay grup hakkı; İçerde → 1 ay grup + yeni 1 başbaşa hakkı.
  // Aynı çekim iki kez işlenmez (orderRef tekil). İlk dönem formdan dönüşte (orderRef yok) açılırsa,
  // aynı ilk çekimin webhook'u sadece o kayda bağlanır.
  private async grantPeriod(recurringId: string, orderRef: string | null, iyziRef: string | null): Promise<void> {
    const granted = await this.prisma.$transaction(async (tx) => {
      if (orderRef && (await tx.payment.findUnique({ where: { iyzicoOrderRef: orderRef } }))) return null;
      const recurring = await tx.recurringSubscription.findUnique({
        where: { id: recurringId },
        include: { payments: { orderBy: { createdAt: "asc" }, select: { id: true, iyzicoOrderRef: true, createdAt: true } } },
      });
      if (!recurring) return null;

      // İlk çekimin webhook'u dakikalar içinde gelir; ilk ödemenin webhook'u hiç gelmediyse (7 günü geçtiyse)
      // sonraki ayın çekimi yeni dönem sayılır, ilk ödemeye bağlanmaz
      const unlinkedFirst = recurring.payments.find(
        (p) => !p.iyzicoOrderRef && p.createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000,
      );
      if (orderRef && unlinkedFirst && recurring.payments.length === 1) {
        await tx.payment.update({ where: { id: unlinkedFirst.id }, data: { iyzicoOrderRef: orderRef, iyzicoPaymentId: iyziRef } });
        return null;
      }
      if (!orderRef && recurring.payments.length > 0) return null;

      const isFirst = recurring.payments.length === 0;
      let discountType: PaymentDiscountType | null = null;
      if (recurring.discounted) {
        const wanted = isFirst && recurring.initialDiscountType
          ? recurring.initialDiscountType
          : await this.availableDiscount(tx, recurring.userId);
        if (wanted && (await this.consumeDiscount(tx, recurring.userId, wanted))) discountType = wanted;
        else this.logger.warn(`İndirimli çekim ama harcanacak hak yok: recurring=${recurring.id}`);
      }
      // Çekim tutarı: çekimin yapıldığı iyzico planının fiyatı (fiyat sonradan değişse de o anki tutar)
      const charged = await this.pricing.byIyzicoPlanRef(recurring.iyzicoPricingPlanRef);
      const priceRow = charged?.row ?? (await this.pricing.current(recurring.plan));
      const chargedDiscounted = charged ? charged.discounted : recurring.discounted;

      // Dönem, serinin hâlâ süren son döneminin bitişinden (yoksa şimdiden) itibaren 30 gün
      const last = await tx.subscription.findFirst({
        where: { recurringId, status: SubscriptionStatus.ACTIVE },
        orderBy: { expiresAt: "desc" },
        select: { expiresAt: true },
      });
      const from = last?.expiresAt && last.expiresAt > new Date() ? last.expiresAt : new Date();
      const expiresAt = new Date(from.getTime() + MASADA_DURATION_DAYS * 24 * 60 * 60 * 1000);

      const sub = await tx.subscription.create({
        data: { userId: recurring.userId, plan: recurring.plan, expiresAt, recurringId },
      });
      await tx.payment.create({
        data: {
          userId: recurring.userId,
          subscriptionId: sub.id,
          recurringId,
          plan: recurring.plan,
          amountKurus: chargedDiscounted ? priceRow.webDiscountKurus : priceRow.webKurus,
          listKurus: priceRow.webKurus,
          status: PaymentStatus.SUCCESS,
          platform: recurring.platform,
          iyzicoOrderRef: orderRef,
          iyzicoPaymentId: iyziRef,
          iyzicoConversationId: `ahenk-sub-${recurring.id}`,
          discountType,
          paidAt: new Date(),
        },
      });
      // Başarısız çekimin elle yeniden denenmesi başarılı olursa yenileme tekrar açılır
      if (recurring.status === RecurringStatus.UNPAID) {
        await tx.recurringSubscription.update({ where: { id: recurringId }, data: { status: RecurringStatus.ACTIVE } });
      }
      return recurring.userId;
    });

    if (!granted) return;
    // Kişi havuza girdi: anında masaya atanır; indirim hakkına göre sıradaki çekimin fiyatı ayarlanır
    await enqueueAssign(this.assignQueue, granted);
    await this.syncRecurringPlan(granted);
  }

  // Sıradaki çekim: indirim hakkı varsa indirimli plan, yoksa normal plan (hakkı olmayan indirimli plana geçemez)
  async syncRecurringPlan(userId: string): Promise<void> {
    const recurring = await this.prisma.recurringSubscription.findFirst({
      where: { userId, status: RecurringStatus.ACTIVE, iyzicoSubscriptionRef: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!recurring) return;
    const wantDiscount = !!(await this.availableDiscount(this.prisma, userId));
    const newPlanRef = await this.pricingPlanRef(recurring.plan, wantDiscount);
    if (wantDiscount === recurring.discounted && newPlanRef === recurring.iyzicoPricingPlanRef) return;

    const result = await this.iyzico.upgradeSubscription(recurring.iyzicoSubscriptionRef!, newPlanRef);
    if (result.status !== "success") {
      this.logger.error(`Abonelik plan değişikliği başarısız: recurring=${recurring.id} ${result.errorMessage ?? ""}`);
      return;
    }
    await this.prisma.recurringSubscription.update({
      where: { id: recurring.id },
      data: {
        discounted: wantDiscount,
        iyzicoPricingPlanRef: newPlanRef,
        iyzicoSubscriptionRef: result.data?.referenceCode ?? recurring.iyzicoSubscriptionRef,
      },
    });
  }

  // Kullanıcı iptali: bir sonraki ay çekim yapılmaz; ödenmiş dönem sonuna kadar sürer, iade yok
  async cancelRecurring(userId: string) {
    const recurring = await this.prisma.recurringSubscription.findFirst({
      where: { userId, status: { in: [RecurringStatus.ACTIVE, RecurringStatus.UNPAID] } },
      orderBy: { createdAt: "desc" },
    });
    if (!recurring) throw new NotFoundException("Otomatik yenilenen aboneliğiniz yok.");
    await this.cancelRecurringById(recurring.id);
    const last = await this.prisma.subscription.findFirst({
      where: { recurringId: recurring.id, status: SubscriptionStatus.ACTIVE },
      orderBy: { expiresAt: "desc" },
      select: { expiresAt: true },
    });
    return { cancelled: true, activeUntil: last?.expiresAt ?? null };
  }

  private async cancelRecurringById(recurringId: string): Promise<void> {
    const recurring = await this.prisma.recurringSubscription.findUnique({ where: { id: recurringId } });
    if (!recurring || recurring.status === RecurringStatus.CANCELLED) return;
    if (recurring.iyzicoSubscriptionRef) {
      const result = await this.iyzico.cancelSubscription(recurring.iyzicoSubscriptionRef);
      if (result.status !== "success") {
        throw new BadRequestException(`Abonelik iptal edilemedi: ${result.errorMessage ?? "iyzico hatası"}`);
      }
    }
    await this.prisma.recurringSubscription.update({
      where: { id: recurringId },
      data: { status: RecurringStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  // ─── Planlar listesi (herkese açık) ──────────────────────────────────────

  // Herkese açık paket fiyatları (web: ham + %20 KDV; mobil: + %15 mağaza komisyonu; indirimli: %10)
  async getPlans() {
    const prices = await this.pricing.all();
    return Object.entries(PLAN_CONFIG).map(([plan, cfg]) => {
      const p = prices[plan as SubscriptionPlan];
      return {
        plan,
        nametr: cfg.nametr,
        label: cfg.label,
        recurring: cfg.recurring,
        webTL: p.webKurus / 100,
        mobileTL: p.mobileKurus / 100,
        webDiscountTL: p.webDiscountKurus / 100,
        mobileDiscountTL: p.mobileDiscountKurus / 100,
      };
    });
  }
}
