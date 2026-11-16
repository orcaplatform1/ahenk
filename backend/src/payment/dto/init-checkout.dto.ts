import { IsEnum, IsIn, IsOptional, Matches, ValidateIf } from "class-validator";
import { SubscriptionPlan, PaymentPlatform } from "../../generated/prisma/client";

export class InitCheckoutDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsEnum(PaymentPlatform)
  platform: PaymentPlatform;

  @IsOptional()
  @IsEnum(['REFERRER', 'INVITEE'])
  useDiscount?: 'REFERRER' | 'INVITEE';

  // Web ödemesinde zorunlu kimlik türü: TC / YKN / Pasaport (varsayılan TC)
  @IsOptional()
  @IsIn(["TC", "YKN", "PASSPORT"])
  identityType?: "TC" | "YKN" | "PASSPORT";

  // Web ödemesinde zorunlu: yalnız iyzico'ya gönderilir, veritabanına yazılmaz (mobil uygulama içi satın almada yok).
  // TC: 11 hane rakam; YKN: 11 hane rakam, 99 ile başlar; Pasaport: 6–9 harf / rakam (payment.service doğrular)
  @ValidateIf((o) => o.platform === PaymentPlatform.WEB)
  @Matches(/^[A-Za-z0-9]{6,11}$/, { message: "Kimlik numarası geçersiz / Invalid ID number" })
  identityNumber?: string;
}

// Kimlik numarası, seçilen türe göre
export function validIdentityNumber(type: string | undefined, value: string | undefined): boolean {
  const v = value ?? "";
  if (type === "YKN") return /^99\d{9}$/.test(v);
  if (type === "PASSPORT") return /^[A-Za-z0-9]{6,9}$/.test(v);
  return /^\d{11}$/.test(v);
}

// Prime otomatik yenileme formu (web): T.C. no her ödemede yeniden sorulur
export class PrimeAutoRenewDto {
  @IsOptional()
  @IsIn(["TC", "YKN", "PASSPORT"])
  identityType?: "TC" | "YKN" | "PASSPORT";

  @Matches(/^[A-Za-z0-9]{6,11}$/, { message: "Kimlik numarası geçersiz / Invalid ID number" })
  identityNumber: string;
}
