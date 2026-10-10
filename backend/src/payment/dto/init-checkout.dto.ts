import { IsEnum, IsString, IsOptional } from "class-validator";
import { SubscriptionPlan, PaymentPlatform } from "@prisma/client";

export class InitCheckoutDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsEnum(PaymentPlatform)
  platform: PaymentPlatform;

  // Callback sonrası yönlendirilecek frontend URL (opsiyonel, .env'deki varsayılan kullanılır)
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}
