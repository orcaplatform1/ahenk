import { SubscriptionPlan } from "@prisma/client";

// Paket tanımları. Fiyatlar veritabanında (PlanPrice), SUPERADMIN yönetir — bkz. pricing.ts
export const PLAN_CONFIG: Record<
  SubscriptionPlan,
  { nametr: string; label: string | null; recurring: boolean }
> = {
  [SubscriptionPlan.MASADA]: {
    nametr: "Masada",
    label: null,
    recurring: true,
  },
  [SubscriptionPlan.KARSIMDA]: {
    nametr: "Karşımda",
    label: null,
    recurring: false,
  },
  [SubscriptionPlan.ICERDE]: {
    nametr: "İçerde",
    label: "Tercih Edilen",
    recurring: true,
  },
};

// Masada aboneliği kaç gün sürer
export const MASADA_DURATION_DAYS = 30;
