import { IsEnum, IsOptional } from "class-validator";
import { SubscriptionPlan, PaymentPlatform } from "@prisma/client";

export class InitCheckoutDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsEnum(PaymentPlatform)
  platform: PaymentPlatform;

  @IsOptional()
  @IsEnum(['REFERRER', 'INVITEE'])
  useDiscount?: 'REFERRER' | 'INVITEE';
}
