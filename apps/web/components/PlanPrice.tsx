'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Paket fiyatları backend'den (SUPERADMIN fiyat sayfası). Web: ham + %20 KDV; mobil: + %15 mağaza komisyonu.
export type PlanKeyName = 'MASADA' | 'KARSIMDA' | 'ICERDE';
export interface PlanPriceInfo {
  plan: PlanKeyName;
  nametr: string;
  webTL: number;
  mobileTL: number;
  webDiscountTL: number;
  mobileDiscountTL: number;
}
type PlanPrices = Partial<Record<PlanKeyName, PlanPriceInfo>>;

// Sayfa başına tek istek
let cache: Promise<PlanPrices> | null = null;
function loadPrices(): Promise<PlanPrices> {
  cache ??= api.get<PlanPriceInfo[]>('/payment/plans')
    .then((list) => Object.fromEntries(list.map((p) => [p.plan, p])) as PlanPrices)
    .catch(() => { cache = null; return {}; });
  return cache;
}

export function usePlanPrices(): PlanPrices | null {
  const [prices, setPrices] = useState<PlanPrices | null>(null);
  useEffect(() => { loadPrices().then(setPrices); }, []);
  return prices;
}

// Metin içinde fiyat: <PlanPriceText plan="MASADA" suffix="₺" />
export function PlanPriceText({ plan, discounted = false, suffix = '' }: { plan: PlanKeyName; discounted?: boolean; suffix?: string }) {
  const prices = usePlanPrices();
  const p = prices?.[plan];
  if (!p) return <>—</>;
  return <>{discounted ? p.webDiscountTL : p.webTL}{suffix}</>;
}
