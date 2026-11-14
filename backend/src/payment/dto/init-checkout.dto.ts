import { IsEnum, IsOptional, Matches, ValidateIf } from "class-validator";
import { SubscriptionPlan, PaymentPlatform } from "../../generated/prisma/client";

export class InitCheckoutDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsEnum(PaymentPlatform)
  platform: PaymentPlatform;

  @IsOptional()
  @IsEnum(['REFERRER', 'INVITEE'])
  useDiscount?: 'REFERRER' | 'INVITEE';

  // Web ödemesinde zorunlu: yalnız iyzico'ya gönderilir, veritabanına yazılmaz (mobil uygulama içi satın almada yok)
  @ValidateIf((o) => o.platform === PaymentPlatform.WEB)
  @Matches(/^\d{11}$/, { message: "T.C. kimlik numarası 11 haneli rakam olmalı" })
  identityNumber?: string;
}

// Prime otomatik yenileme formu (web): T.C. no her ödemede yeniden sorulur
export class PrimeAutoRenewDto {
  @Matches(/^\d{11}$/, { message: "T.C. kimlik numarası 11 haneli rakam olmalı" })
  identityNumber: string;
}
