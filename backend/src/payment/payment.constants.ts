import { SubscriptionPlan } from "../generated/prisma/client";

// Paket tanımları. Fiyatlar veritabanında (PlanPrice, admin "Fiyatlar") — bkz. pricing.ts;
// haklar package-rights.ts'de, Prime dönem / yenileme kuralları prime.ts'de
export const PLAN_CONFIG: Record<SubscriptionPlan, { nametr: string; label: string | null }> = {
  [SubscriptionPlan.MASADA]: { nametr: "Grup", label: null },
  [SubscriptionPlan.KARSIMDA]: { nametr: "Başbaşa", label: null },
  [SubscriptionPlan.ICERDE]: { nametr: "İçerde", label: null },
  [SubscriptionPlan.KANKAMLA]: { nametr: "Kankamla", label: null },
  [SubscriptionPlan.PRIME_1M]: { nametr: "Prime 1 Aylık", label: null },
  [SubscriptionPlan.PRIME_3M]: { nametr: "Prime 3 Aylık", label: null },
  [SubscriptionPlan.PRIME_6M]: { nametr: "Prime 6 Aylık", label: null },
  [SubscriptionPlan.PRIME_12M]: { nametr: "Prime 12 Aylık", label: null },
};

// Prime dönem süresi (ay)
export const PRIME_MONTHS: Partial<Record<SubscriptionPlan, number>> = {
  [SubscriptionPlan.PRIME_1M]: 1,
  [SubscriptionPlan.PRIME_3M]: 3,
  [SubscriptionPlan.PRIME_6M]: 6,
  [SubscriptionPlan.PRIME_12M]: 12,
};
