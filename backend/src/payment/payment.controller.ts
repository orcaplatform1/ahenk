import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  HttpCode,
  Headers,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { IsEnum, IsString } from "class-validator";
import { PaymentService } from "./payment.service";
import { InitCheckoutDto } from "./dto/init-checkout.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TestCompletedGuard } from "../test/test.guard";
import { PaymentPlatform } from "../generated/prisma/client";
import { WinbackService } from "./winback.service";

class VerifyStoreDto {
  @IsEnum(PaymentPlatform)
  platform: PaymentPlatform;

  @IsString()
  productId: string;

  // iOS: transactionId, Android: purchaseToken
  @IsString()
  transaction: string;
}

@Controller("payment")
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private paymentService: PaymentService,
    private config: ConfigService,
    private winback: WinbackService,
  ) {}

  // Herkese açık — paket listesi
  @Get("plans")
  getPlans() {
    return this.paymentService.getPlans();
  }

  // Kullanıcının aktif abonelikleri
  @Get("subscriptions")
  @UseGuards(JwtAuthGuard)
  getSubscriptions(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.paymentService.getSubscriptions(user.id);
  }

  // İndirim bilgisi — kullanıcının aktif referral/invitee indirimi var mı
  @Get("discount-info")
  @UseGuards(JwtAuthGuard)
  getDiscountInfo(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.paymentService.getDiscountInfo(user.id);
  }

  // Geri kazanım indirimi durumu
  @Get("winback")
  @UseGuards(JwtAuthGuard)
  getWinback(@Req() req: Request) {
    return this.winback.state((req.user as { id: string }).id);
  }

  // İndirim ekranı gösterildi: sayaç sunucuda başlar, tekrar çağrı sıfırlamaz
  @Post("winback/open")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  openWinback(@Req() req: Request) {
    return this.winback.markShown((req.user as { id: string }).id);
  }

  // Ödeme başlat: web iyzico checkout form, mobil uygulama içi satın alma ürünü.
  // KYC satın almadan önce istenmez; ödeme başarılı olunca kullanıcı KYC ekranına yönlendirilir.
  @Post("init")
  @UseGuards(JwtAuthGuard, TestCompletedGuard)
  initCheckout(@Req() req: Request, @Body() dto: InitCheckoutDto) {
    const user = req.user as { id: string };
    return this.paymentService.initCheckout(user.id, dto.plan, dto.platform, dto.useDiscount, req.ip ?? "");
  }

  // Mobil uygulama içi satın alma doğrulama (App Store / Play Store)
  @Post("store/verify")
  @UseGuards(JwtAuthGuard, TestCompletedGuard)
  verifyStore(@Req() req: Request, @Body() dto: VerifyStoreDto) {
    return this.paymentService.verifyStorePurchase((req.user as { id: string }).id, dto.platform, dto.productId, dto.transaction);
  }

  // App Store Server Notifications V2
  @Post("store/apple-notification")
  @HttpCode(HttpStatus.OK)
  async appleNotification(@Body() body: { signedPayload?: string }) {
    if (body?.signedPayload) await this.paymentService.handleAppleNotification(body.signedPayload).catch((e) => this.logger.error(`App Store bildirimi: ${e}`));
    return { ok: true };
  }

  // Google Play RTDN (Pub/Sub push); ?token= GOOGLE_RTDN_TOKEN ile korunur
  @Post("store/google-notification")
  @HttpCode(HttpStatus.OK)
  async googleNotification(@Query("token") token: string, @Body() body: { message?: { data?: string } }) {
    const expected = this.config.get<string>("GOOGLE_RTDN_TOKEN");
    if (expected && token === expected && body?.message?.data) {
      await this.paymentService.handleGoogleNotification(body.message.data).catch((e) => this.logger.error(`Play bildirimi: ${e}`));
    }
    return { ok: true };
  }

  // Prime: "Aboneliği İptal Et" — otomatik yenileme durur, haklar dönem sonuna kadar kullanılır, iade yapılmaz
  @Post("prime/cancel")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  cancelPrime(@Req() req: Request) {
    return this.paymentService.cancelPrimeRenewal((req.user as { id: string }).id);
  }

  // Prime (web): ilk dönem ödendikten sonra otomatik yenileme için iyzico abonelik formu
  @Post("prime/autorenew/init")
  @UseGuards(JwtAuthGuard)
  initPrimeAutoRenew(@Req() req: Request) {
    return this.paymentService.initPrimeAutoRenew((req.user as { id: string }).id);
  }

  @Post("prime/autorenew/callback")
  async primeAutoRenewCallback(@Query("sid") sid: string, @Body() body: Record<string, string>, @Res() res: Response) {
    const appUrl = this.config.get<string>("APP_URL") ?? "https://ahenk.co";
    const token = body?.token;
    if (token && sid) {
      try {
        await this.paymentService.handlePrimeAutoRenewCallback(token, sid);
      } catch (err) {
        this.logger.error(`iyzico abonelik formu dönüşü hatası: ${err}`);
      }
    }
    return res.redirect(HttpStatus.SEE_OTHER, `${appUrl}/odeme/basarili`);
  }

  // iyzico abonelik webhook'u (yenileme sonucu)
  @Post("prime/iyzico-webhook")
  @HttpCode(HttpStatus.OK)
  async iyzicoWebhook(@Headers("x-iyz-signature-v3") signature: string, @Body() body: Record<string, string>) {
    await this.paymentService.handleIyzicoSubscriptionWebhook(body, signature).catch((e) => this.logger.error(`iyzico webhook: ${e}`));
    return { ok: true };
  }

  // iyzico callback — kullanıcının tarayıcısı iyzico'dan buraya POST eder (auth yok, token iyzico'dan doğrulanır).
  // Sonuca göre kullanıcı web'deki başarılı / başarısız sayfasına yönlendirilir.
  @Post("callback")
  async handleCallback(
    @Query("token") token: string,
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    const appUrl = this.config.get<string>("APP_URL") ?? "https://ahenk.co";
    const t = token ?? body?.token;
    let success = false;
    let prime = false;
    if (t) {
      try {
        const r = await this.paymentService.handleCallback(t);
        success = r.success;
        prime = !!r.prime;
      } catch (err) {
        this.logger.error(`iyzico callback hatası: ${err}`);
      }
    }
    // Prime: önce otomatik yenileme kart kaydı, sonra KYC
    return res.redirect(HttpStatus.SEE_OTHER, `${appUrl}/odeme/${success ? (prime ? "basarili?prime=1" : "basarili") : "basarisiz"}`);
  }
}
