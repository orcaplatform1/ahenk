import { SubscriptionPlan } from "@prisma/client";

// Fiyatlar kuruş cinsinden (1 TL = 100 kuruş)
export const PLAN_CONFIG: Record<
  SubscriptionPlan,
  { nametr: string; amountKurus: number; label: string | null; recurring: boolean }
> = {
  [SubscriptionPlan.MASADA]: {
    nametr: "Masada",
    amountKurus: 34900,
    label: null,
    recurring: true,
  },
  [SubscriptionPlan.KARSIMDA]: {
    nametr: "Karşımda",
    amountKurus: 44900,
    label: null,
    recurring: false,
  },
  [SubscriptionPlan.ICERDE]: {
    nametr: "İçerde",
    amountKurus: 67900,
    label: "Tercih Edilen",
    recurring: false,
  },
};

// Masada aboneliği kaç gün sürer
export const MASADA_DURATION_DAYS = 30;
