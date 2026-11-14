// Lansmanda bir kez çalıştırılır: iyzico'da "Ahenk Prime" ürünü ve 4 Prime fiyatlandırma planı tanımlanır.
// Çalıştırma (iyzico hesabı açıldıktan sonra): node dist/src/payment/iyzico/create-prime-plans.js
// Fiyat: admin "Fiyatlar" tablosundaki güncel web fiyatı (ham × 1,20). Deneme süresi = ilk dönem (ilk dönem standart
// ödeme formuyla alınır, abonelik ilk tahsilatı dönem sonunda tam tutarla yapar). Dönen referans kodları
// IYZICO_PRIME_<1M|3M|6M|12M>_PLAN_REF env değişkenlerine yazılır, sonra IYZICO_SUBSCRIPTION_ENABLED=true yapılır.
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { SubscriptionPlan } from "../../generated/prisma/client";
import { PricingService } from "../pricing.service";
import { IyzicoService } from "./iyzico.service";

const PLANS: { plan: SubscriptionPlan; name: string; months: number; trialDays: number }[] = [
  { plan: SubscriptionPlan.PRIME_1M, name: "Prime 1 Aylık", months: 1, trialDays: 30 },
  { plan: SubscriptionPlan.PRIME_3M, name: "Prime 3 Aylık", months: 3, trialDays: 90 },
  { plan: SubscriptionPlan.PRIME_6M, name: "Prime 6 Aylık", months: 6, trialDays: 180 },
  { plan: SubscriptionPlan.PRIME_12M, name: "Prime 12 Aylık", months: 12, trialDays: 365 },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  const pricing = app.get(PricingService);
  const iyzico = app.get(IyzicoService);
  const prices = await pricing.all();
  const result = await iyzico.createPrimePlans(
    PLANS.map((p) => ({ code: p.plan, name: p.name, months: p.months, trialDays: p.trialDays, priceKurus: prices[p.plan].webKurus })),
  );
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

void main();
