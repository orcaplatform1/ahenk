import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { IyzicoCallbackResult, IyzicoService } from "./iyzico/iyzico.service";
import { PLAN_CONFIG } from "./payment.constants";
import { PricingService } from "./pricing.service";
import { isMaintenanceMode } from "../admin/app-settings";
import { GROUP_RIGHTS, KANKA_RIGHTS, ONE_ON_ONE_PLANS, PACKAGE_CYCLES, groupPartOpen, oneOnOnePartOpen, syncPackageStatus } from "./package-rights";
import { activeKankaLink } from "../kanka/kanka-links";
import { decryptIdentityNumber } from "../kyc/identity-number";
import { ASSIGN_QUEUE, enqueueAssign } from "../matching/assign-queue";
import { AdminAlertType, Prisma, SubscriptionPlan, PaymentPlatform, PaymentStatus, SubscriptionStatus, RefundType, ReferralStatus, PaymentDiscountType, UserStatus, MeetingType, MeetingStatus } from "@prisma/client";

type Db = PrismaService | Prisma.TransactionClient;

const PENDING_MIN_AGE_MS = 45 * 60 * 1000;
const PENDING_MAX_AGE_MS = 48 * 60 * 60 * 1000;

// İade türü → iade edilebilen paketler (İçerde'de grup / başbaşa kısmı ayrı ayrı ya da tamamı)
const REFUND_PLANS: Record<RefundType, SubscriptionPlan[]> = {
  [RefundType.GROUP]: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE],
  [RefundType.ONEONE]: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
  [RefundType.FULL]: [SubscriptionPlan.ICERDE],
  [RefundType.KANKA]: [SubscriptionPlan.KANKAMLA],
};
const REFUND_SUB_SELECT = {
  id: true, plan: true, createdAt: true, usedAt: true, groupCycles: true, oneOnOneCycles: true, kankaCycles: true,
} as const;
// Aynı kısmı kapsayan iade türleri birlikte işlenemez (İçerde'de FULL hem grup hem başbaşa kısmını kapsar)
const refundsOverlap = (a: RefundType, b: RefundType): boolean =>
  a === b || (a === RefundType.FULL && b !== RefundType.KANKA) || (b === RefundType.FULL && a !== RefundType.KANKA);
type RefundSub = { id: string; plan: SubscriptionPlan; createdAt: Date; usedAt: Date | null; groupCycles: number; oneOnOneCycles: number; kankaCycles: number };


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
        kankaRights: true,
        kankaCycles: true,
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
    for (const type of [RefundType.GROUP, RefundType.ONEONE, RefundType.FULL, RefundType.KANKA]) {
      const subs = await this.prisma.subscription.findMany({
        where: {
          userId,
          plan: { in: REFUND_PLANS[type] },
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRED] },
          payment: { status: PaymentStatus.SUCCESS },
          refundRequests: { none: { status: { in: ["PENDING", "PROCESSING"] } } },
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
    // Kankamla: kanka seçmeden alınamaz; çiftte (iki kişiden birinde) aktif Kankamla paketi bitene kadar yenisi alınamaz
    if (plan === SubscriptionPlan.KANKAMLA) {
      const link = await activeKankaLink(this.prisma, userId);
      if (!link) {
        throw new BadRequestException("Kankamla paketini almak için önce Profilim'den bir kanka davet etmelisin.");
      }
      if (await this.planConflict(this.prisma, userId, plan)) {
        throw new ConflictException("Sizin ya da kankanızın aktif Kankamla paketi var; paket bitene kadar yenisi alınamaz.");
      }
      return;
    }
    if (await this.planConflict(this.prisma, userId, plan)) {
      throw new ConflictException("Aktif paketiniz bu paketi kapsıyor; bu paketi şu an satın alamazsınız.");
    }
  }

  // Satın alma kuralı: init'te ve ödeme dönüşünde (kilit altında) aynı kontrol yapılır
  private async planConflict(db: Db, userId: string, plan: SubscriptionPlan): Promise<boolean> {
    if (plan === SubscriptionPlan.KANKAMLA) {
      const link = await activeKankaLink(db, userId);
      const pairActive = await db.subscription.count({
        where: { userId: { in: link ? [userId, link.kankaId] : [userId] }, plan: SubscriptionPlan.KANKAMLA, status: SubscriptionStatus.ACTIVE },
      });
      return pairActive > 0;
    }
    const active = await db.subscription.findMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      select: { plan: true, groupRights: true, groupCycles: true, usedAt: true, oneOnOneCycles: true },
    });
    // Aynı içeriğin açık kısmı varken alınamaz: grup kısmı açıksa Masada / İçerde, başbaşa kısmı açıksa Karşımda / İçerde
    const groupOpen = active.some(groupPartOpen);
    const oneOnOneOpen = active.some(oneOnOnePartOpen);
    return (GROUP_RIGHTS[plan] > 0 && groupOpen) || (ONE_ON_ONE_PLANS.includes(plan) && oneOnOneOpen);
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
    // Fiyat platforma göre (web: ham + %20 KDV; Android: + mağaza komisyonu); indirim her ödenen pakette %10
    const price = await this.pricing.current(plan);
    const isMobile = platform === PaymentPlatform.ANDROID;
    const listKurus = isMobile ? price.mobileKurus : price.webKurus;
    const discountedKurus = isMobile ? price.mobileDiscountKurus : price.webDiscountKurus;
    let amountKurus = listKurus;
    let discountType: PaymentDiscountType | null = null;

    // İndirim burada sadece kontrol edilir; hak ödeme başarılı olunca harcanır
    if (useDiscount === 'REFERRER') {
      const referral = await this.prisma.referral.findFirst({
        where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED },
      });
      if (referral) {
        amountKurus = discountedKurus;
        discountType = PaymentDiscountType.REFERRER;
      }
    } else if (useDiscount === 'INVITEE') {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { referralDiscountAvailable: true } });
      if (user?.referralDiscountAvailable) {
        amountKurus = discountedKurus;
        discountType = PaymentDiscountType.INVITEE;
      }
    }

    const conversationId = `ahenk-${userId}-${Date.now()}`;
    const callbackUrl = this.config.getOrThrow<string>("IYZICO_CALLBACK_URL");

    // Önceki PENDING kayıtlar silinmez: açık kalan başka sekmedeki ödeme tamamlanabilir (kapanmayanları cron sonuçlandırır).
    // İki ödeme de tamamlanırsa handleCallback tek paket verir, fazlasını iade eder.
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
        listKurus,
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
      await this.handleUnknownToken(token);
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
    const paid = result.status === "success" && result.paymentStatus === "SUCCESS";
    const expectedPrice = payment.amountKurus / 100;
    const verified = paid && result.basketId === payment.id && Number(result.price) === expectedPrice;

    if (!verified) {
      const reason =
        result.errorMessage ??
        (paid
          ? `Doğrulama uyuşmazlığı (sepet: ${result.basketId}, tutar: ${result.price})`
          : `Ödeme durumu: ${result.paymentStatus ?? result.status}`);
      if (paid) {
        // Para çekildi ama pakete bağlanamıyor: paket verilmez, para iade edilir
        this.logger.error(`iyzico doğrulama uyuşmazlığı: payment=${payment.id} ${reason}`);
        await this.refundUnfulfilled(payment.id, payment.userId, result, reason);
        return { success: false, message: "Ödeme doğrulanamadı, iade başlatıldı" };
      }
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: reason },
      });
      return { success: false, message: result.errorMessage ?? "Ödeme başarısız" };
    }

    // Ödeme başarılı — abonelik oluştur, indirimi harca. Kişi (Kankamla'da çift) satırı kilitlenir:
    // iki sekmeden gelen ödemeler sırayla işlenir, ikincisi paketi görür ve iade yoluna gider.
    const outcome = await this.prisma.$transaction(async (tx) => {
      const link = payment.plan === SubscriptionPlan.KANKAMLA ? await activeKankaLink(tx, payment.userId) : null;
      const lockIds = link ? [payment.userId, link.kankaId] : [payment.userId];
      await tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${Prisma.join(lockIds)}) ORDER BY id FOR UPDATE`;

      const current = await tx.payment.findUnique({ where: { id: payment.id }, select: { status: true } });
      if (current?.status !== PaymentStatus.PENDING) return current?.status === PaymentStatus.SUCCESS ? "ALREADY_DONE" : "NOT_PENDING";
      if (await this.planConflict(tx, payment.userId, payment.plan)) return "CONFLICT";

      // Sadece PENDING ise işle: aynı token için ikinci callback abonelik oluşturmaz
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.SUCCESS,
          iyzicoPaymentId: result.paymentId,
          paidAt: new Date(),
        },
      });
      if (count === 0) return "ALREADY_DONE";

      await this.createSubscriptions(tx, payment.userId, payment.plan, payment.id);

      if (payment.discountType) await this.consumeDiscount(tx, payment.userId, payment.discountType);
      return "CREATED";
    });

    if (outcome === "CONFLICT") {
      await this.refundUnfulfilled(payment.id, payment.userId, result, "Aynı paket için ikinci ödeme");
      return { success: false, message: "Bu paket zaten alınmış, ikinci ödeme iade ediliyor" };
    }
    if (outcome === "NOT_PENDING") return { success: false, message: "Ödeme başarısız" };

    // Kişi havuza girdi: anında masaya atanır
    if (outcome === "CREATED") await enqueueAssign(this.assignQueue, payment.userId);

    return outcome === "CREATED"
      ? { success: true, message: "Ödeme başarıyla tamamlandı" }
      : { success: true, message: "Ödeme zaten tamamlandı" };
  }

  // Para çekilmiş, paket verilmemiş ödeme: PENDING → DUPLICATE geçişini kazanan tek istek iade gönderir.
  // İade kesinleşince REFUNDED; olmazsa DUPLICATE kalır ve admine uyarı düşer (iade yeniden gönderilmez).
  private async refundUnfulfilled(paymentId: string, userId: string, result: IyzicoCallbackResult, reason: string) {
    const { count } = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.DUPLICATE, iyzicoPaymentId: result.paymentId, failureReason: reason },
    });
    if (count === 0) return;

    const amountKurus = Math.round(Number(result.paidPrice ?? result.price) * 100);
    const refund = result.paymentId && amountKurus > 0
      ? await this.iyzico.refundPayment({
          paymentId: result.paymentId,
          amountKurus,
          conversationId: `ahenk-unfulfilled-${paymentId}`,
          ip: "127.0.0.1",
        })
      : null;
    if (refund?.status === "success") {
      await this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.REFUNDED } });
      return;
    }
    this.logger.error(`Fazla ödeme iade edilemedi: payment=${paymentId} ${refund?.errorMessage ?? "iade gönderilemedi"}`);
    await this.paymentAlert(userId);
  }

  // Kaydı olmayan token: iyzico'da başarılıysa admine uyarı (kayıt olmadığından otomatik iade yapılmaz)
  private async handleUnknownToken(token: string) {
    const result = await this.iyzico.retrieveCheckoutForm(token);
    if (result.status !== "success" || result.paymentStatus !== "SUCCESS") {
      this.logger.warn("Bilinmeyen iyzico token");
      return;
    }
    this.logger.error(`Kaydı olmayan başarılı ödeme: paymentId=${result.paymentId} conversation=${result.conversationId}`);
    const userId = /^ahenk-(.+)-\d+$/.exec(result.conversationId ?? "")?.[1];
    if (userId) await this.paymentAlert(userId);
  }

  // Dönüşü gelmeyen ödemeler (kapanan sekme, bağlantı kopması): iyzico'dan sonucu okunur, ödenmişse paket verilir.
  // 45 dakikadan yeni kayda dokunulmaz: iyzico formu kullanıcıda hâlâ açık olabilir.
  @Cron("*/15 * * * *", { timeZone: "Europe/Istanbul" })
  async reconcilePendingPayments(): Promise<void> {
    const now = Date.now();
    const pending = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        iyzicoToken: { not: null },
        createdAt: { lt: new Date(now - PENDING_MIN_AGE_MS), gt: new Date(now - PENDING_MAX_AGE_MS) },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true, iyzicoToken: true },
    });
    for (const p of pending) {
      try {
        await this.handleCallback(p.iyzicoToken!);
      } catch (err) {
        this.logger.error(`Bekleyen ödeme kontrolü hatası: payment=${p.id} ${err}`);
      }
    }
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
      data: { userId, plan, groupRights: GROUP_RIGHTS[plan], kankaRights: plan === SubscriptionPlan.KANKAMLA ? KANKA_RIGHTS : 0 },
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
      where: { userId, subscriptionId: sub.id, status: { in: ["PENDING", "PROCESSING"] } },
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

  // Kişi + (varsa) aktif kankası
  private async kankaPairIds(userId: string): Promise<string[]> {
    const link = await activeKankaLink(this.prisma, userId);
    return link ? [userId, link.kankaId] : [userId];
  }

  // Paket + iade türü uyumu, 4 döngü dolmuş olması ve "masa kurulduysa hizmet alınmıştır" kuralı
  private async assertRefundAllowed(userId: string, sub: RefundSub, refundType: RefundType) {
    if (!REFUND_PLANS[refundType].includes(sub.plan)) {
      throw new BadRequestException("Bu paket için bu iade türü geçerli değil.");
    }

    const isGroup = refundType === RefundType.GROUP || refundType === RefundType.FULL;
    const isOneone = refundType === RefundType.ONEONE || refundType === RefundType.FULL;
    const isKanka = refundType === RefundType.KANKA;

    // Aynı kısım daha önce iade edildiyse tekrar edilmez
    const refunded = await this.prisma.refundRequest.findMany({
      where: { subscriptionId: sub.id, status: "APPROVED" },
      select: { refundType: true },
    });
    const groupRefunded = refunded.some((r) => r.refundType === RefundType.GROUP || r.refundType === RefundType.FULL);
    const oneoneRefunded = refunded.some((r) => r.refundType === RefundType.ONEONE || r.refundType === RefundType.FULL);
    if ((isGroup && groupRefunded) || (isOneone && oneoneRefunded) || (isKanka && refunded.length > 0)) {
      throw new BadRequestException("Bu paket için iade zaten yapıldı.");
    }

    if (isGroup && sub.groupCycles < PACKAGE_CYCLES) {
      throw new BadRequestException(`Grup masası iadesi için ${PACKAGE_CYCLES} döngünün dolması gerekir. Geçen: ${sub.groupCycles}/${PACKAGE_CYCLES}`);
    }
    if (isOneone && sub.oneOnOneCycles < PACKAGE_CYCLES) {
      throw new BadRequestException(`Başbaşa masası iadesi için ${PACKAGE_CYCLES} döngünün dolması gerekir. Geçen: ${sub.oneOnOneCycles}/${PACKAGE_CYCLES}`);
    }
    if (isKanka && sub.kankaCycles < PACKAGE_CYCLES) {
      throw new BadRequestException(`Kankamla iadesi için ${PACKAGE_CYCLES} döngünün dolması gerekir. Geçen: ${sub.kankaCycles}/${PACKAGE_CYCLES}`);
    }
    // Kankamla: masa kurulduysa ya da çift rezervasyonu kendisi iptal ettiyse (grupta olduğu gibi) hizmet alınmış sayılır
    const kankaSelfCancelled = isKanka && (await this.prisma.meetingParticipant.count({
      where: {
        userId: { in: await this.kankaPairIds(userId) },
        status: "CANCELLED",
        leaveReason: { not: null },
        meeting: { type: MeetingType.KANKA, createdAt: { gte: sub.createdAt } },
      },
    })) > 0;
    if (isKanka && (kankaSelfCancelled || await this.tableFormedSince(userId, MeetingType.KANKA, sub.createdAt))) {
      throw new BadRequestException("Kankamla masanız kurulduğu için bu hizmet alınmış sayılır; iade yapılamaz.");
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

    // iyzico'dan önce talep kilitlenir: paket satırı FOR UPDATE ile tutulur, durum koşullu geçer, benzersiz anahtar
    // (paket + iade türü) veritabanında aynı iadenin ikinci kez işlenmesini engeller. Eşzamanlı onaylardan biri kazanır.
    await this.claimRefund(refund.id, sub.id, refund.refundType);

    const result = await this.iyzico.refundPayment({
      paymentId: payment.iyzicoPaymentId,
      amountKurus,
      conversationId: `ahenk-refund-${refund.id}`,
      ip,
    });
    if (result.outcomeUnknown) {
      // Para iade edilmiş olabilir: talep PROCESSING kalır, tekrar gönderilmez, elle kontrol gerekir
      this.logger.error(`iyzico iade sonucu bilinmiyor: refund=${refund.id}`);
      await this.paymentAlert(refund.userId);
      throw new ServiceUnavailableException("iyzico yanıt vermedi. İade işleniyor durumunda bırakıldı; iyzico panelinden kontrol edin.");
    }
    if (result.status !== "success") {
      // iyzico kesin olarak reddetti: para çıkmadı, talep yeniden denenebilir
      await this.prisma.refundRequest.updateMany({
        where: { id: refund.id, status: "PROCESSING" },
        data: { status: "PENDING", idempotencyKey: null },
      });
      throw new BadRequestException(`iyzico iadesi başarısız: ${result.errorMessage ?? "bilinmeyen hata"}`);
    }

    // Tek kısımlı paket ya da İçerde'nin tamamı → paket iptal; İçerde'nin tek kısmı → sadece o kısım kapanır
    const partial = sub.plan === SubscriptionPlan.ICERDE && refund.refundType !== RefundType.FULL;
    try {
      await this.finishRefund(refund, sub.id, partial, amountKurus, result.paymentId ?? null, adminNote);
    } catch (err) {
      // Para iade edildi, kayıt yazılamadı: talep PROCESSING kalır (yeniden gönderilmez)
      this.logger.error(`iade yapıldı, kayıt yazılamadı: refund=${refund.id} ${err}`);
      await this.paymentAlert(refund.userId);
      throw new InternalServerErrorException("İade yapıldı ancak kayıt güncellenemedi. Talep işleniyor durumunda bırakıldı.");
    }

    return { ok: true, refundedKurus: amountKurus };
  }

  private async claimRefund(refundId: string, subscriptionId: string, refundType: RefundType) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id = ${subscriptionId} FOR UPDATE`;
        const others = await tx.refundRequest.findMany({
          where: { subscriptionId, id: { not: refundId }, status: { in: ["PROCESSING", "APPROVED"] } },
          select: { refundType: true },
        });
        if (others.some((o) => refundsOverlap(o.refundType, refundType))) {
          throw new ConflictException("Bu paket için iade zaten işleniyor ya da yapıldı.");
        }
        const { count } = await tx.refundRequest.updateMany({
          where: { id: refundId, status: "PENDING" },
          data: { status: "PROCESSING", idempotencyKey: `refund:${subscriptionId}:${refundType}` },
        });
        if (count === 0) throw new ConflictException("Bu iade talebi zaten işleniyor ya da sonuçlandırılmış.");
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Bu paket için iade zaten işleniyor ya da yapıldı.");
      }
      throw err;
    }
  }

  private async finishRefund(
    refund: { id: string; refundType: RefundType; adminNote: string | null },
    subscriptionId: string,
    partial: boolean,
    amountKurus: number,
    iyzicoRefundId: string | null,
    adminNote?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: "APPROVED",
          adminNote: adminNote ?? refund.adminNote,
          refundedKurus: amountKurus,
          iyzicoRefundId,
        },
      });
      if (!partial) {
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { status: SubscriptionStatus.CANCELLED, cancelNote: "İade" },
        });
      } else {
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: refund.refundType === RefundType.GROUP ? { groupRights: 0 } : { oneOnOneCycles: PACKAGE_CYCLES },
        });
        await syncPackageStatus(tx, subscriptionId);
      }
    });
  }

  // Elle kontrol gerektiren ödeme / iade durumu: okunmamış uyarı varsa yenisi açılmaz
  private async paymentAlert(userId: string) {
    try {
      const existing = await this.prisma.adminAlert.findFirst({
        where: { userId, alertType: AdminAlertType.PAYMENT_ISSUE, isRead: false },
        select: { id: true },
      });
      if (!existing) await this.prisma.adminAlert.create({ data: { userId, alertType: AdminAlertType.PAYMENT_ISSUE } });
    } catch (err) {
      this.logger.error(`Ödeme uyarısı oluşturulamadı: user=${userId} ${err}`);
    }
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
        kankaRights: plan === SubscriptionPlan.KANKAMLA ? KANKA_RIGHTS : 0,
        cycles: PACKAGE_CYCLES,
        webTL: p.webKurus / 100,
        mobileTL: p.mobileKurus / 100,
        webDiscountTL: p.webDiscountKurus / 100,
        mobileDiscountTL: p.mobileDiscountKurus / 100,
      };
    });
  }
}
