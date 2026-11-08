// S-13: iOS Apple uygulama içi satın alma, Android Google Play Billing (expo-iap).
// /payment/init isteğine PaymentPlatform tipine uygun IOS / ANDROID gönderilir.
// RAPORLANDI: Apple/Google makbuz doğrulama backend ucu ve mağaza ürün kimlikleri yok; ürün kimlikleri
// tanımlanana kadar mağaza penceresi açılmaz ve backend'in yanıt mesajı gösterilir.
import { Platform } from 'react-native';
import { initConnection, requestPurchase } from 'expo-iap';
import { api } from './api';

// Mağaza ürün kimlikleri (App Store Connect / Play Console) — henüz yok
export const PRODUCT_IDS: Partial<Record<'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA', string>> = {};

export const PLATFORM = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

interface InitResponse { stub?: boolean; message?: string }

export async function startPurchase(plan: string, useDiscount?: 'REFERRER' | 'INVITEE'): Promise<'store-opened'> {
  const init = await api.post<InitResponse>('/payment/init', { plan, platform: PLATFORM, ...(useDiscount ? { useDiscount } : {}) });
  if (init?.stub) throw new Error(init.message ?? 'Uygulama içi satın alma henüz aktif değil.');
  const sku = PRODUCT_IDS[plan as keyof typeof PRODUCT_IDS];
  if (!sku) throw new Error('Uygulama içi satın alma henüz aktif değil.');
  await initConnection();
  await requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'in-app' });
  return 'store-opened';
}
