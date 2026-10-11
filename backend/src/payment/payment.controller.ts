import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
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
  constructor(private paymentService: PaymentService) {}

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
    return this.paymentService.initCheckout(user.id, dto.plan, dto.platform, dto.callbackUrl, dto.useDiscount);
  }

  // İade talebi
  @Post("refund-request")
  @UseGuards(JwtAuthGuard)
  requestRefund(@Req() req: Request, @Body() dto: RequestRefundDto) {
    const user = req.user as { id: string };
    return this.paymentService.requestRefund(user.id, dto.refundType);
  }

  // iyzico callback — iyzico'dan POST gelir (auth yok, token ile doğrulama yapılır)
  @Post("callback")
  @HttpCode(HttpStatus.OK)
  async handleCallback(@Query("token") token: string, @Body() body: Record<string, string>) {
    const t = token ?? body?.token;
    if (!t) return { success: false, message: "Token eksik" };
    return this.paymentService.handleCallback(t);
  }
}
