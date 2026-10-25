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
import { IyzicoService } from "./iyzico/iyzico.service";
import { PLAN_CONFIG } from "./payment.constants";
import { PricingService } from "./pricing.service";
import { isMaintenanceMode } from "../admin/app-settings";
import { GROUP_RIGHTS, ONE_ON_ONE_PLANS, PACKAGE_CYCLES, groupPartOpen, oneOnOnePartOpen, syncPackageStatus } from "./package-rights";
import { decryptIdentityNumber } from "../kyc/identity-number";
import { ASSIGN_QUEUE, enqueueAssign } from "../matching/assign-queue";
import { Prisma, SubscriptionPlan, PaymentPlatform, PaymentStatus, SubscriptionStatus, RefundType, ReferralStatus, PaymentDiscountType, UserStatus, MeetingType, MeetingStatus } from "@prisma/client";

type Db = PrismaService | Prisma.TransactionClient;

// İade türü → iade edilebilen paketler (İçerde'de grup / başbaşa kısmı ayrı ayrı ya da tamamı)
const REFUND_PLANS: Record<RefundType, SubscriptionPlan[]> = {
  [RefundType.GROUP]: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE],
  [RefundType.ONEONE]: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
  [RefundType.FULL]: [SubscriptionPlan.ICERDE],
};
const REFUND_SUB_SELECT = {
  id: true, plan: true, createdAt: true, usedAt: true, groupCycles: true, oneOnOneCycles: true,
} as const;
type RefundSub = { id: string; plan: SubscriptionPlan; createdAt: Date; usedAt: Date | null; groupCycles: number; oneOnOneCycles: number };


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
        usedAt: true,
        createdAt: true,
        groupRights: true,
        groupCycles: true,
        oneOnOneCycles: true,
        payment: { select: { status: true } },
      },
    });

    // Paket süresince kurulmuş masa varsa o tür için iade yok
    const withTables = await Promise.all(subs.map(async ({ payment, ...s }) => ({
      ...s,
      paid: payment?.status === PaymentStatus.SUCCESS,
      groupTableFormed: await this.tableFormedSince(userId, MeetingType.GROUP, s.createdAt),
      oneOnOneTableFormed: await this.tableFormedSince(userId, MeetingType.ONE_ON_ONE, s.createdAt),
    })));

    return {
      subscriptions: withTables,
      hasMasada: subs.some(groupPartOpen),
      hasKarsimda: subs.some(oneOnOnePartOpen),
      // Şu an talep edilebilecek iade türleri (süresi dolmuş paketler dahil; kural assertRefundAllowed)
      refundOptions: await this.refundOptions(userId),
      packageCycles: PACKAGE_CYCLES,
    };
  }

  private async refundOptions(userId: string): Promise<RefundType[]> {
    const options: RefundType[] = [];
    for (const type of [RefundType.GROUP, RefundType.ONEONE, RefundType.FULL]) {
      const subs = await this.prisma.subscription.findMany({
        where: {
          userId,
          plan: { in: REFUND_PLANS[type] },
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED] },
          payment: { status: PaymentStatus.SUCCESS },
          refundRequests: { none: { status: "PENDING" } },
        },
        select: REFUND_SUB_SELECT,
      });
      for (const sub of subs) {
        const ok = await this.assertRefundAllowed(userId, sub, type).then(() => true, () => false);
        if (ok) { options.push(type); break; }
      }
    }
    return options;
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
      where: { userId, status: SubscriptionStatus.ACTIVE },
      select: { plan: true, groupRights: true, groupCycles: true, usedAt: true, oneOnOneCycles: true },
    });
    // Aynı içeriğin açık kısmı varken alınamaz: grup kısmı açıksa Masada / İçerde, başbaşa kısmı açıksa Karşımda / İçerde
    const groupOpen = active.some(groupPartOpen);
    const oneOnOneOpen = active.some(oneOnOnePartOpen);
    const blocked =
      (GROUP_RIGHTS[plan] > 0 && groupOpen) || (ONE_ON_ONE_PLANS.includes(plan) && oneOnOneOpen);
    if (blocked) {
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

    return processed
      ? { success: true, message: "Ödeme başarıyla tamamlandı" }
      : { success: true, message: "Ödeme zaten tamamlandı" };
  }

  // ─── Paket oluşturma (transaction içinde) ─────────────────────────────────
  // Tek seferlik paket: Masada 2 grup hakkı, Karşımda 1 başbaşa hakkı, İçerde 2 grup + 1 başbaşa hakkı;
  // her kısım 4 döngü geçerli (süre tarihle değil döngüyle biter: package-rights.ts)

  private async createSubscriptions(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    plan: SubscriptionPlan,
    paymentId: string,
  ) {
    const sub = await tx.subscription.create({
      data: { userId, plan, groupRights: GROUP_RIGHTS[plan] },
    });
    await tx.payment.update({ where: { id: paymentId }, data: { subscriptionId: sub.id } });
  }

  // ─── İade Talebi ─────────────────────────────────────────────────────────

  // İade: ilgili kısmın 4 döngüsü dolmuş ve o kısımda hiç masa kurulmamış olmalı (süresi dolmuş paket için de).
  // Bir masa kurulduysa kalan hak olsa bile hizmet alınmış sayılır.
  async requestRefund(userId: string, refundType: RefundType) {
    const subs = await this.prisma.subscription.findMany({
      where: {
        userId,
        plan: { in: REFUND_PLANS[refundType] },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED] },
        payment: { status: PaymentStatus.SUCCESS },
      },
      orderBy: { createdAt: "desc" },
      select: REFUND_SUB_SELECT,
    });
    if (subs.length === 0) throw new NotFoundException("İade talep edilebilecek ücretli paket bulunamadı.");

    // Birden fazla uygun paket varsa iade şartını sağlayan en yenisi
    let lastError: unknown = null;
    let sub: (typeof subs)[number] | null = null;
    for (const candidate of subs) {
      try {
        await this.assertRefundAllowed(userId, candidate, refundType);
        sub = candidate;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!sub) throw lastError;

    const existing = await this.prisma.refundRequest.findFirst({
      where: { userId, subscriptionId: sub.id, status: "PENDING" },
    });
    if (existing) throw new ConflictException("Bu paket için bekleyen bir iade talebi zaten var.");

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

  // Paket + iade türü uyumu, 4 döngü dolmuş olması ve "masa kurulduysa hizmet alınmıştır" kuralı
  private async assertRefundAllowed(userId: string, sub: RefundSub, refundType: RefundType) {
    if (!REFUND_PLANS[refundType].includes(sub.plan)) {
      throw new BadRequestException("Bu paket için bu iade türü geçerli değil.");
    }

    const isGroup = refundType === RefundType.GROUP || refundType === RefundType.FULL;
    const isOneone = refundType === RefundType.ONEONE || refundType === RefundType.FULL;

    // Aynı kısım daha önce iade edildiyse tekrar edilmez
    const refunded = await this.prisma.refundRequest.findMany({
      where: { subscriptionId: sub.id, status: "APPROVED" },
      select: { refundType: true },
    });
    const groupRefunded = refunded.some((r) => r.refundType === RefundType.GROUP || r.refundType === RefundType.FULL);
    const oneoneRefunded = refunded.some((r) => r.refundType === RefundType.ONEONE || r.refundType === RefundType.FULL);
    if ((isGroup && groupRefunded) || (isOneone && oneoneRefunded)) {
      throw new BadRequestException("Bu paket için iade zaten yapıldı.");
    }

    if (isGroup && sub.groupCycles < PACKAGE_CYCLES) {
      throw new BadRequestException(`Grup masası iadesi için ${PACKAGE_CYCLES} döngünün dolması gerekir. Geçen: ${sub.groupCycles}/${PACKAGE_CYCLES}`);
    }
    if (isOneone && sub.oneOnOneCycles < PACKAGE_CYCLES) {
      throw new BadRequestException(`Başbaşa masası iadesi için ${PACKAGE_CYCLES} döngünün dolması gerekir. Geçen: ${sub.oneOnOneCycles}/${PACKAGE_CYCLES}`);
    }
    if (isGroup && await this.tableFormedSince(userId, MeetingType.GROUP, sub.createdAt)) {
      throw new BadRequestException("Grup masanız kurulduğu için bu hizmet alınmış sayılır; iade yapılamaz.");
    }
    if (isOneone && (sub.usedAt || await this.tableFormedSince(userId, MeetingType.ONE_ON_ONE, sub.createdAt))) {
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
            ...REFUND_SUB_SELECT, status: true,
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
      throw new BadRequestException("Bu paket için iade edilecek bir ödeme bulunmuyor.");
    }
    await this.assertRefundAllowed(refund.userId, sub, refund.refundType);

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

    // Tek kısımlı paket ya da İçerde'nin tamamı → paket iptal; İçerde'nin tek kısmı → sadece o kısım kapanır
    const partial = sub.plan === SubscriptionPlan.ICERDE && refund.refundType !== RefundType.FULL;
    await this.prisma.$transaction(async (tx) => {
      await tx.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: "APPROVED",
          adminNote: adminNote ?? refund.adminNote,
          refundedKurus: amountKurus,
          iyzicoRefundId: result.paymentId ?? null,
        },
      });
      if (!partial) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.CANCELLED, cancelNote: "İade" },
        });
      } else {
        await tx.subscription.update({
          where: { id: sub.id },
          data: refund.refundType === RefundType.GROUP ? { groupRights: 0 } : { oneOnOneCycles: PACKAGE_CYCLES },
        });
        await syncPackageStatus(tx, sub.id);
      }
    });

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
        // Tek seferlik paket hakları: grup / başbaşa masası sayısı, her kısım PACKAGE_CYCLES döngü geçerli
        groupRights: GROUP_RIGHTS[plan as SubscriptionPlan],
        oneOnOneRights: ONE_ON_ONE_PLANS.includes(plan as SubscriptionPlan) ? 1 : 0,
        cycles: PACKAGE_CYCLES,
        webTL: p.webKurus / 100,
        mobileTL: p.mobileKurus / 100,
        webDiscountTL: p.webDiscountKurus / 100,
        mobileDiscountTL: p.mobileDiscountKurus / 100,
      };
    });
  }
}
