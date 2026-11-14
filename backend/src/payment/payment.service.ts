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
import { createHmac } from "crypto";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { IyzicoCallbackResult, IyzicoService } from "./iyzico/iyzico.service";
import { PLAN_CONFIG, PRIME_MONTHS } from "./payment.constants";
import { PricingService } from "./pricing.service";
import { WinbackService } from "./winback.service";
import { isMaintenanceMode } from "../admin/app-settings";
import { GROUP_RIGHTS, ONE_ON_ONE_PLANS, KANKA_PLANS, PRIME_PLANS, groupPartOpen, isPrime, kankaPartOpen, kankaRightsOf, oneOnOnePartOpen } from "./package-rights";
import { PrimeService } from "./prime.service";
import { StoreService, planOfProduct } from "./store.service";
import { activeKankaLink } from "../kanka/kanka-links";
import { decryptIdentityNumber } from "../kyc/identity-number";
import { ASSIGN_QUEUE, enqueueAssign } from "../matching/assign-queue";
import { AdminAlertType, Prisma, SubscriptionPlan, PaymentPlatform, PaymentStatus, SubscriptionStatus, ReferralStatus, PaymentDiscountType } from "../generated/prisma/client";

type Db = PrismaService | Prisma.TransactionClient;

const PENDING_MIN_AGE_MS = 45 * 60 * 1000;
const PENDING_MAX_AGE_MS = 48 * 60 * 60 * 1000;



@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private iyzico: IyzicoService,
    private config: ConfigService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
    private pricing: PricingService,
    private winback: WinbackService,
    private prime: PrimeService,
    private store: StoreService,
  ) {}

  // ─── Mevcut abonelik durumu ───────────────────────────────────────────────

  // Aktif paketler ve türüne göre kalan hak adedi (profildeki paket kutusu)
  async getSubscriptions(userId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, plan: true, status: true, startsAt: true, usedAt: true, createdAt: true,
        groupRights: true, groupCycles: true, oneOnOneCycles: true, kankaRights: true, kankaCycles: true,
        expiresAt: true, rightsResetAt: true, autoRenew: true, renewCancelledAt: true, storePlatform: true,
      },
    });
    const rights = {
      group: subs.filter(groupPartOpen).reduce((n, s) => n + s.groupRights, 0),
      oneOnOne: subs.filter(oneOnOnePartOpen).length,
      kanka: subs.filter(kankaPartOpen).reduce((n, s) => n + s.kankaRights, 0),
    };
    return {
      subscriptions: subs.map((s) => ({ ...s, isPrime: isPrime(s.plan), name: PLAN_CONFIG[s.plan].nametr })),
      rights,
      hasMasada: subs.some(groupPartOpen),
      hasKarsimda: subs.some(oneOnOnePartOpen),
      primeActive: subs.some((s) => isPrime(s.plan)),
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

  // Satın alma kuralları:
  // - Aktif Prime'ı olan ikinci Prime alamaz.
  // - Aktif Prime'ı olan tek seferlik paket alamaz; istisna: Prime'da hakkı bitmiş tür varsa yalnız o türü içeren
  //   tek seferlik paket alınabilir (İçerde iki türü de içerdiği için iki türün hakkı da bitmiş olmalı).
  // - Aynı türün açık hakkı varken o türü içeren tek seferlik paket alınamaz (planConflict).
  private async assertCanBuy(userId: string, plan: SubscriptionPlan) {
    const prime = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, plan: { in: PRIME_PLANS } },
      select: { plan: true, groupRights: true, groupCycles: true, usedAt: true, oneOnOneCycles: true, kankaRights: true, kankaCycles: true },
    });
    if (isPrime(plan)) {
      if (prime) throw new ConflictException("Aktif Prime aboneliğin var; ikinci bir Prime alınamaz.");
    } else if (prime) {
      const blocked =
        (GROUP_RIGHTS[plan] > 0 && groupPartOpen(prime)) ||
        (ONE_ON_ONE_PLANS.includes(plan) && oneOnOnePartOpen(prime)) ||
        (KANKA_PLANS.includes(plan) && kankaPartOpen(prime));
      if (blocked) throw new ConflictException("Prime aboneliğinde bu türün hakkı duruyor; yalnız hakkı biten türün paketini alabilirsin.");
    }
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
    if (isPrime(plan)) {
      return (await db.subscription.count({ where: { userId, status: SubscriptionStatus.ACTIVE, plan: { in: PRIME_PLANS } } })) > 0;
    }
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

    // Mobil: iOS App Store / Android Play Store uygulama içi satın alma (store.service.ts). Lansmana kadar pasif.
    if (platform === PaymentPlatform.IOS || platform === PaymentPlatform.ANDROID) {
      return this.store.purchaseInfo(plan, platform);
    }

    // Web Prime: ilk dönem bu ödeme formuyla, otomatik yenileme iyzico abonelik API'siyle (lansmana kadar pasif)
    if (isPrime(plan) && this.config.get<string>("IYZICO_SUBSCRIPTION_ENABLED") !== "true") {
      throw new ServiceUnavailableException("Prime abonelik henüz aktif değil.");
    }

    const identityNumber = await this.identityNumberOf(userId);

    const planCfg = PLAN_CONFIG[plan];
    // Web fiyatı: ham + %20 KDV; indirim (davet %10 ya da geri kazanım 100 TL, birlikte kullanılamaz) yalnız bu ödemede
    const price = await this.pricing.current(plan);
    const listKurus = price.webKurus;
    const discountedKurus = price.webDiscountKurus;
    let amountKurus = listKurus;
    let discountType: PaymentDiscountType | null = null;

    // İndirim burada sadece kontrol edilir; hak ödeme başarılı olunca harcanır.
    // Geri kazanım indirimi süresi içindeyse otomatik uygulanır, referans indirimiyle birleşmez.
    const winbackKurus = await this.winback.discountedKurus(userId, plan, listKurus);
    if (winbackKurus !== null) {
      amountKurus = winbackKurus;
      discountType = PaymentDiscountType.WINBACK;
    } else if (useDiscount === 'REFERRER') {
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

  async handleCallback(token: string): Promise<{ success: boolean; message: string; prime?: boolean }> {
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
      // Kesin ödeme durumu yoksa (SDK / ağ / timeout hatası) satır PENDING kalır; reconcile cron'u sonra çözer
      if (!result.paymentStatus) {
        this.logger.error(`iyzico sorgu hatası, ödeme PENDING bırakıldı: payment=${payment.id} ${reason}`);
        return { success: false, message: result.errorMessage ?? "Ödeme durumu doğrulanamadı" };
      }
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: reason },
      });
      return { success: false, message: result.errorMessage ?? "Ödeme başarısız" };
    }

    // Ödeme başarılı — abonelik oluştur, indirimi harca. Kişi (Kankamla'da çift) satırı kilitlenir:
    // iki sekmeden gelen ödemeler sırayla işlenir, ikincisi paketi görür ve iade yoluna gider.
    const DISCOUNT_USED = "DISCOUNT_USED";
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

      // İndirim hakkı harcanamıyorsa (başka ödemede kullanıldı) her şey geri alınır: SUCCESS ve abonelik yazılmaz
      if (payment.discountType && !(await this.consumeDiscount(tx, payment.userId, payment.discountType))) {
        throw new Error(DISCOUNT_USED);
      }
      return "CREATED";
    }).catch((err: unknown) => {
      if (err instanceof Error && err.message === DISCOUNT_USED) return DISCOUNT_USED;
      throw err;
    });

    if (outcome === DISCOUNT_USED) {
      await this.refundUnfulfilled(payment.id, payment.userId, result, "İndirim hakkı başka ödemede kullanılmış");
      return { success: false, message: "İndirim hakkı zaten kullanılmış, ödeme iade ediliyor" };
    }
    if (outcome === "CONFLICT") {
      await this.refundUnfulfilled(payment.id, payment.userId, result, "Aynı paket için ikinci ödeme");
      return { success: false, message: "Bu paket zaten alınmış, ikinci ödeme iade ediliyor" };
    }
    if (outcome === "NOT_PENDING") return { success: false, message: "Ödeme başarısız" };

    // Kişi havuza girdi: anında masaya atanır
    if (outcome === "CREATED") await enqueueAssign(this.assignQueue, payment.userId);

    return outcome === "CREATED"
      ? { success: true, message: "Ödeme başarıyla tamamlandı", prime: isPrime(payment.plan) }
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
  // Tek seferlik: Grup 1 grup, Başbaşa 1 başbaşa, İçerde 1 grup + 1 başbaşa, Kankamla 1 kankamla hakkı (kullanılana kadar).
  // Prime: 1 grup + 1 başbaşa + 1 kankamla; dönem ve 30 günlük yenileme prime.service.ts'de.

  private async createSubscriptions(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    plan: SubscriptionPlan,
    paymentId: string,
  ) {
    const sub = isPrime(plan)
      ? await this.prime.createPrime(tx, userId, plan, {})
      : await tx.subscription.create({ data: { userId, plan, groupRights: GROUP_RIGHTS[plan], kankaRights: kankaRightsOf(plan) } });
    await tx.payment.update({ where: { id: paymentId }, data: { subscriptionId: sub.id } });
  }

  // iyzico alıcı TC kimlik no: KYC onayında girilir. Ödeme KYC'den önce alındığı için henüz yoksa iyzico'nun
  // kimlik numarası olmayan alıcılar için kabul ettiği 11111111111 gönderilir.
  private async identityNumberOf(userId: string): Promise<string> {
    const identity = await this.prisma.userIdentity.findUnique({ where: { userId }, select: { identityNumberEnc: true } });
    return identity ? decryptIdentityNumber(identity.identityNumberEnc, this.config.get("IDENTITY_ENC_KEY")) : "11111111111";
  }

  // ─── Prime otomatik yenileme (web, iyzico abonelik API'si) ────────────────
  // İlk dönem ödendikten sonra kart kaydı için abonelik formu açılır (planın deneme süresi = ilk dönem, tahsilat yok).
  async initPrimeAutoRenew(userId: string) {
    if (this.config.get<string>("IYZICO_SUBSCRIPTION_ENABLED") !== "true") {
      throw new ServiceUnavailableException("Prime abonelik henüz aktif değil.");
    }
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, plan: { in: PRIME_PLANS }, iyzicoSubscriptionRef: null, storePlatform: null },
      select: { id: true, plan: true },
    });
    if (!sub) throw new NotFoundException("Otomatik yenileme başlatılacak Prime aboneliği bulunamadı.");
    const planRef = this.config.get<string>(`IYZICO_${sub.plan}_PLAN_REF`);
    if (!planRef) throw new ServiceUnavailableException("Prime abonelik planı tanımlı değil.");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    const result = await this.iyzico.initSubscriptionCheckoutForm({
      pricingPlanReferenceCode: planRef,
      conversationId: `ahenk-prime-${sub.id}`,
      callbackUrl: `${this.config.getOrThrow<string>("IYZICO_PRIME_CALLBACK_URL")}?sid=${sub.id}`,
      name: user.profile?.firstName ?? "Kullanıcı",
      surname: user.profile?.lastName ?? "",
      email: user.email,
      gsmNumber: user.phone ?? undefined,
      identityNumber: await this.identityNumberOf(userId),
    });
    if (result.status !== "success") throw new BadRequestException(result.errorMessage ?? "Abonelik formu açılamadı");
    return { token: result.token, checkoutFormContent: result.checkoutFormContent };
  }

  async handlePrimeAutoRenewCallback(token: string, subscriptionId: string): Promise<boolean> {
    const result = await this.iyzico.retrieveSubscriptionCheckoutForm(token);
    const ref = result.data?.referenceCode;
    if (result.status !== "success" || !ref) return false;
    return this.prime.attachIyzicoSubscription(subscriptionId, ref, result.data!.pricingPlanReferenceCode, (plan) => this.config.get<string>(`IYZICO_${plan}_PLAN_REF`));
  }

  // iyzico abonelik webhook'u (yenileme başarılı / başarısız). İmza: X-IYZ-SIGNATURE-V3 =
  // HMAC-SHA256(secretKey, merchantId + secretKey + iyziEventType + subscriptionReferenceCode + orderReferenceCode + customerReferenceCode)
  async handleIyzicoSubscriptionWebhook(body: Record<string, string>, signature: string | undefined): Promise<void> {
    const secret = this.config.get<string>("IYZICO_SECRET_KEY") ?? "";
    const merchantId = this.config.get<string>("IYZICO_MERCHANT_ID") ?? "";
    const expected = createHmac("sha256", secret)
      .update(`${merchantId}${secret}${body.iyziEventType}${body.subscriptionReferenceCode}${body.orderReferenceCode}${body.customerReferenceCode}`)
      .digest("hex");
    if (!signature || signature !== expected) {
      this.logger.warn("iyzico abonelik webhook imzası geçersiz");
      return;
    }
    const sub = await this.prisma.subscription.findFirst({ where: { iyzicoSubscriptionRef: body.subscriptionReferenceCode }, select: { id: true } });
    if (!sub) return;
    if (body.iyziEventType === "subscription.order.success") {
      if ((await this.prisma.payment.count({ where: { iyzicoPaymentId: body.orderReferenceCode } })) > 0) return;
      await this.prime.renew(sub.id, PaymentPlatform.WEB, { iyzicoPaymentId: body.orderReferenceCode });
    } else if (body.iyziEventType === "subscription.order.failure") {
      await this.prime.stopAutoRenew(sub.id);
    }
  }

  // ─── Mobil uygulama içi satın alma doğrulama (IAP_ENABLED=true olunca) ─────
  // Mağaza işlemi sunucuda App Store / Play API'sinden doğrulanır; aynı işlem ikinci kez paket vermez.
  async verifyStorePurchase(userId: string, platform: PaymentPlatform, productId: string, transactionIdOrToken: string) {
    this.store.assertEnabled();
    if (platform !== PaymentPlatform.IOS && platform !== PaymentPlatform.ANDROID) throw new BadRequestException("Geçersiz platform");
    const v = platform === PaymentPlatform.IOS
      ? await this.store.verifyApple(transactionIdOrToken)
      : await this.store.verifyGoogle(productId, transactionIdOrToken);
    const plan = v ? planOfProduct(v.productId) : null;
    if (!v || !plan) throw new BadRequestException("Satın alma doğrulanamadı.");
    if ((await this.prisma.payment.count({ where: { storeTransactionId: v.transactionId } })) > 0) return { success: true };

    const price = await this.pricing.current(plan);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if ((await tx.payment.count({ where: { storeTransactionId: v.transactionId } })) > 0) return;
      const payment = await tx.payment.create({
        data: {
          userId, plan, amountKurus: price.mobileKurus, listKurus: price.mobileKurus, status: PaymentStatus.SUCCESS,
          platform, paidAt: new Date(), storeTransactionId: v.transactionId,
        },
      });
      const sub = isPrime(plan)
        ? await this.prime.createPrime(tx, userId, plan, {
            autoRenew: v.autoRenewing ?? true, storePlatform: platform, storeOriginalTransactionId: v.originalTransactionId, expiresAt: v.expiresAt,
          })
        : await tx.subscription.create({ data: { userId, plan, groupRights: GROUP_RIGHTS[plan], kankaRights: kankaRightsOf(plan) } });
      await tx.payment.update({ where: { id: payment.id }, data: { subscriptionId: sub.id } });
    });
    await enqueueAssign(this.assignQueue, userId);
    return { success: true };
  }

  // App Store Server Notifications V2: bildirimdeki işlem App Store API'sinden yeniden okunarak doğrulanır
  async handleAppleNotification(signedPayload: string) {
    if (!this.store.enabled()) return;
    const n = this.store.decodeJws<{ notificationType: string; subtype?: string; data?: { signedTransactionInfo?: string } }>(signedPayload);
    const tInfo = n?.data?.signedTransactionInfo ? this.store.decodeJws<{ transactionId: string }>(n.data.signedTransactionInfo) : null;
    if (!n || !tInfo) return;
    const v = await this.store.verifyApple(tInfo.transactionId);
    if (!v) return;
    const sub = await this.prisma.subscription.findFirst({ where: { storeOriginalTransactionId: v.originalTransactionId }, select: { id: true } });
    if (!sub) return;
    if (n.notificationType === "DID_RENEW") await this.prime.renew(sub.id, PaymentPlatform.IOS, { storeTransactionId: v.transactionId, expiresAt: v.expiresAt });
    else if (n.notificationType === "DID_CHANGE_RENEWAL_STATUS" && n.subtype === "AUTO_RENEW_DISABLED") await this.prime.stopAutoRenew(sub.id);
  }

  // Google Play Real-time Developer Notifications (Pub/Sub push): bildirimdeki abonelik Play API'sinden yeniden okunur
  async handleGoogleNotification(data: string) {
    if (!this.store.enabled()) return;
    const msg = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as {
      subscriptionNotification?: { notificationType: number; purchaseToken: string; subscriptionId: string };
    };
    const sn = msg.subscriptionNotification;
    if (!sn) return;
    const sub = await this.prisma.subscription.findFirst({ where: { storeOriginalTransactionId: sn.purchaseToken }, select: { id: true } });
    if (!sub) return;
    // 2 = SUBSCRIPTION_RENEWED, 3 = SUBSCRIPTION_CANCELED
    if (sn.notificationType === 2) {
      const v = await this.store.verifyGoogle(sn.subscriptionId, sn.purchaseToken);
      if (v) await this.prime.renew(sub.id, PaymentPlatform.ANDROID, { storeTransactionId: v.transactionId, expiresAt: v.expiresAt });
    } else if (sn.notificationType === 3) {
      await this.prime.stopAutoRenew(sub.id);
    }
  }

  async cancelPrimeRenewal(userId: string) {
    return this.prime.cancelRenewal(userId);
  }

  // ─── Ödeme sonuçlandırma (SUPERADMIN, iyzico panelinden kontrol sonrası) ─────────────
  // Para çekilmiş, paket verilmemiş (DUPLICATE) ödemeler. İyzico'ya istek gitmez, sadece kayıt sonuçlanır.
  async listSettlements() {
    const payments = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.DUPLICATE },
      orderBy: { updatedAt: "asc" },
      include: { user: { select: { phone: true, profile: { select: { firstName: true, lastName: true } } } } },
    });
    const name = (u: { profile: { firstName: string; lastName: string } | null }) =>
      u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : "Silinmiş kullanıcı";
    return {
      payments: payments.map((p) => ({
        id: p.id, userId: p.userId, userName: name(p.user), phone: p.user.phone, plan: p.plan, status: p.status,
        amountKurus: p.amountKurus, iyzicoPaymentId: p.iyzicoPaymentId, failureReason: p.failureReason,
        createdAt: p.createdAt, updatedAt: p.updatedAt,
      })),
    };
  }

  async settlePayment(id: string, status: "REFUNDED" | "FAILED", adminId: string, note?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, select: { userId: true, failureReason: true } });
    if (!payment) throw new NotFoundException("Ödeme bulunamadı.");
    const { count } = await this.prisma.payment.updateMany({
      where: { id, status: PaymentStatus.DUPLICATE },
      data: { status: status === "REFUNDED" ? PaymentStatus.REFUNDED : PaymentStatus.FAILED, ...(note ? { failureReason: `${payment.failureReason ?? ""} | ${note}` } : {}) },
    });
    if (count === 0) throw new BadRequestException("Bu ödeme iade bekliyor durumunda değil.");
    await this.prisma.adminActionLog.create({
      data: {
        adminId, action: "PAYMENT_SETTLE", targetUserId: payment.userId,
        description: `Fazla ödeme ${status === "REFUNDED" ? "iade edildi olarak" : "başarısız olarak"} sonuçlandırıldı: ${id}${note ? ` (Not: ${note})` : ""}`,
      },
    });
    return { ok: true, status };
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
    if (type === PaymentDiscountType.WINBACK) return this.winback.consume(tx, userId);
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
    return Object.entries(PLAN_CONFIG).map(([key, cfg]) => {
      const plan = key as SubscriptionPlan;
      const p = prices[plan];
      return {
        plan,
        nametr: cfg.nametr,
        label: cfg.label,
        isPrime: isPrime(plan),
        months: PRIME_MONTHS[plan] ?? null,
        groupRights: GROUP_RIGHTS[plan],
        oneOnOneRights: ONE_ON_ONE_PLANS.includes(plan) ? 1 : 0,
        kankaRights: kankaRightsOf(plan),
        webTL: p.webKurus / 100,
        mobileTL: p.mobileKurus / 100,
        webDiscountTL: p.webDiscountKurus / 100,
        mobileDiscountTL: p.mobileDiscountKurus / 100,
      };
    });
  }
}
