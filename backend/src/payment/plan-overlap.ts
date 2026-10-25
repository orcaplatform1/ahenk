import { SubscriptionPlan } from "@prisma/client";

// İçeriği çakışan paketler (Masada = grup, Karşımda = başbaşa, İçerde = ikisi).
// Admin ücretsiz paket verirse bunlardan aktif olan iptal edilir. (Satın almada açık kısma bakılır: payment.service assertCanBuy)
export const OVERLAPPING_PLANS: Record<SubscriptionPlan, SubscriptionPlan[]> = {
  [SubscriptionPlan.MASADA]: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE],
  [SubscriptionPlan.KARSIMDA]: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
  [SubscriptionPlan.ICERDE]: [SubscriptionPlan.MASADA, SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
  // Kankamla diğer paketlerle çakışmaz (çiftte tek aktif Kankamla kuralı satın almada / kanka tarafında)
  [SubscriptionPlan.KANKAMLA]: [SubscriptionPlan.KANKAMLA],
};
