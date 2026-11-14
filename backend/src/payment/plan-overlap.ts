import { SubscriptionPlan } from "../generated/prisma/client";

const PRIME_ALL = [SubscriptionPlan.PRIME_1M, SubscriptionPlan.PRIME_3M, SubscriptionPlan.PRIME_6M, SubscriptionPlan.PRIME_12M];

// İçeriği çakışan paketler (Grup = MASADA, Başbaşa = KARSIMDA, İçerde = ikisi).
// Admin ücretsiz paket verirse bunlardan aktif olan iptal edilir. (Satın almada açık kısma bakılır: payment.service assertCanBuy)
export const OVERLAPPING_PLANS: Record<SubscriptionPlan, SubscriptionPlan[]> = {
  [SubscriptionPlan.MASADA]: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE],
  [SubscriptionPlan.KARSIMDA]: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
  [SubscriptionPlan.ICERDE]: [SubscriptionPlan.MASADA, SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
  // Kankamla diğer paketlerle çakışmaz (çiftte tek aktif Kankamla kuralı satın almada / kanka tarafında)
  [SubscriptionPlan.KANKAMLA]: [SubscriptionPlan.KANKAMLA],
  // Prime planları birbirini kapsar (aynı anda tek aktif Prime)
  [SubscriptionPlan.PRIME_1M]: PRIME_ALL,
  [SubscriptionPlan.PRIME_3M]: PRIME_ALL,
  [SubscriptionPlan.PRIME_6M]: PRIME_ALL,
  [SubscriptionPlan.PRIME_12M]: PRIME_ALL,
};
