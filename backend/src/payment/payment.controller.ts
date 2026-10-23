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
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { IsEnum } from "class-validator";
import { PaymentService } from "./payment.service";
import { InitCheckoutDto } from "./dto/init-checkout.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { KycGuard } from "../kyc/kyc.guard";
import { TestCompletedGuard } from "../test/test.guard";
import { RefundType } from "@prisma/client";

class RequestRefundDto {
  @IsEnum(RefundType)
  refundType: RefundType;
}

@Controller("payment")
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private paymentService: PaymentService,
    private config: ConfigService,
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

  // iyzico checkout form başlat (web/android)
  // TestCompletedGuard + KycGuard zorunlu
  @Post("init")
  @UseGuards(JwtAuthGuard, TestCompletedGuard, KycGuard)
  initCheckout(@Req() req: Request, @Body() dto: InitCheckoutDto) {
    const user = req.user as { id: string };
    return this.paymentService.initCheckout(user.id, dto.plan, dto.platform, dto.useDiscount);
  }

  // İade talebi
  @Post("refund-request")
  @UseGuards(JwtAuthGuard)
  requestRefund(@Req() req: Request, @Body() dto: RequestRefundDto) {
    const user = req.user as { id: string };
    return this.paymentService.requestRefund(user.id, dto.refundType);
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
    if (t) {
      try {
        success = (await this.paymentService.handleCallback(t)).success;
      } catch (err) {
        this.logger.error(`iyzico callback hatası: ${err}`);
      }
    }
    return res.redirect(HttpStatus.SEE_OTHER, `${appUrl}/odeme/${success ? "basarili" : "basarisiz"}`);
  }
}
