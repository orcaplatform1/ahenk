import { SubscriptionPlan } from "@prisma/client";

// Paket tanımları (tek seferlik). Fiyatlar veritabanında (PlanPrice), SUPERADMIN yönetir — bkz. pricing.ts;
// haklar ve döngü süresi package-rights.ts'de
export const PLAN_CONFIG: Record<SubscriptionPlan, { nametr: string; label: string | null }> = {
  [SubscriptionPlan.MASADA]: { nametr: "Masada", label: null },
  [SubscriptionPlan.KARSIMDA]: { nametr: "Karşımda", label: null },
  [SubscriptionPlan.ICERDE]: { nametr: "İçerde", label: "Tercih Edilen" },
  [SubscriptionPlan.KANKAMLA]: { nametr: "Kankamla", label: null },
};
