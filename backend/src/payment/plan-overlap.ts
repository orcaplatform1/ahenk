import { SubscriptionPlan } from "@prisma/client";

// İçeriği çakışan paketler (Masada = grup, Karşımda = başbaşa, İçerde = ikisi).
// Satın almada: bunlardan biri aktifse paket alınamaz. Admin ücretsiz verirse: bunlardan aktif olan iptal edilir.
export const OVERLAPPING_PLANS: Record<SubscriptionPlan, SubscriptionPlan[]> = {
  [SubscriptionPlan.MASADA]: [SubscriptionPlan.MASADA, SubscriptionPlan.ICERDE],
  [SubscriptionPlan.KARSIMDA]: [SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
  [SubscriptionPlan.ICERDE]: [SubscriptionPlan.MASADA, SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE],
};
