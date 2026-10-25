// Paket fiyat hesabı (web admin önizlemesi apps/web/app/admin/fiyatlar ile aynı formül)
export const VAT_RATE = 0.2;          // KDV %20 (web + mobil)
export const STORE_FEE_RATE = 0.15;   // mobil mağaza komisyonu: hesapta Apple ve Google için sabit %15
export const REFERRAL_DISCOUNT = 0.1; // davet indirimi %10

// Kuruşsuz: en yakın tam TL
const roundTL = (kurus: number) => Math.round(kurus / 100) * 100;

export type ComputedPrices = {
  netKurus: number;
  webKurus: number;
  mobileKurus: number;
  webDiscountKurus: number;
  mobileDiscountKurus: number;
};

// web = ham × 1,20; mobil = ham × 1,20 ÷ 0,85 (mağaza kesintisinden sonra KDV dahil web fiyatı kalır); indirimli = son fiyat × 0,90
export function computePrices(netKurus: number): ComputedPrices {
  const webKurus = roundTL(netKurus * (1 + VAT_RATE));
  const mobileKurus = roundTL((netKurus * (1 + VAT_RATE)) / (1 - STORE_FEE_RATE));
  return {
    netKurus,
    webKurus,
    mobileKurus,
    webDiscountKurus: roundTL(webKurus * (1 - REFERRAL_DISCOUNT)),
    mobileDiscountKurus: roundTL(mobileKurus * (1 - REFERRAL_DISCOUNT)),
  };
}

// KDV dahil tutarın içindeki KDV
export const vatOfGrossKurus = (grossKurus: number) => Math.round((grossKurus * VAT_RATE) / (1 + VAT_RATE));
