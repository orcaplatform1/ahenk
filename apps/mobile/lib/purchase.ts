// Uygulama içi satın alma: iOS App Store, Android Play Store (expo-iap). Platform cihazdan algılanır.
// Akış: /payment/init (satın alma kuralları + ürün kimliği) → mağaza penceresi → /payment/store/verify (sunucu
// App Store / Play API'sinden doğrular, paketi verir) → finishTransaction. Lansmana kadar pasif: backend IAP_ENABLED
// açılmadan /payment/init "henüz aktif değil" döner ve mağaza penceresi açılmaz.
// Ürün kimlikleri backend/src/payment/store.service.ts STORE_PRODUCT_IDS ile aynıdır (App Store Connect / Play Console).
import { Platform } from 'react-native';
import { deepLinkToSubscriptions, fetchProducts, finishTransaction, initConnection, purchaseErrorListener, purchaseUpdatedListener, requestPurchase, type Purchase } from 'expo-iap';
import { api } from './api';

export const PLATFORM = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

// Butonun altındaki ödeme bilgisi
export const PAY_INFO = Platform.OS === 'ios' ? 'Ödemen App Store hesabından tahsil edilir.' : 'Ödemen Play Store hesabından tahsil edilir.';

interface InitResponse { stub?: boolean; message?: string; iap?: boolean; productId?: string; type?: 'subs' | 'in-app' }

// Mağaza penceresi açılır; satın alma sunucuda doğrulanınca çözülür
export async function startPurchase(plan: string): Promise<'purchased'> {
  const init = await api.post<InitResponse>('/payment/init', { plan, platform: PLATFORM });
  if (init?.stub || !init?.iap || !init.productId) throw new Error(init?.message ?? 'Uygulama içi satın alma henüz aktif değil.');
  const sku = init.productId;
  const isSub = init.type === 'subs';
  await initConnection();

  const done = new Promise<'purchased'>((resolve, reject) => {
    const ok = purchaseUpdatedListener(async (p: Purchase) => {
      if (p.productId !== sku) return;
      try {
        const transaction = Platform.OS === 'ios' ? p.id : (p.purchaseToken ?? '');
        await api.post('/payment/store/verify', { platform: PLATFORM, productId: sku, transaction });
        await finishTransaction({ purchase: p, isConsumable: !isSub });
        resolve('purchased');
      } catch (e) {
        reject(e);
      } finally {
        ok.remove(); err.remove();
      }
    });
    const err = purchaseErrorListener((e) => { ok.remove(); err.remove(); reject(new Error(e.message || 'Satın alma tamamlanamadı.')); });
  });

  if (isSub && Platform.OS === 'android') {
    // Play abonelik: ürünün teklif anahtarı gerekir
    const products = (await fetchProducts({ skus: [sku], type: 'subs' })) as unknown as { subscriptionOfferDetailsAndroid?: { offerToken: string }[] }[] | null;
    const offerToken = products?.[0]?.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
    await requestPurchase({ request: { google: { skus: [sku], subscriptionOffers: offerToken ? [{ sku, offerToken }] : [] } }, type: 'subs' });
  } else {
    await requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: isSub ? 'subs' : 'in-app' });
  }
  return done;
}

// Mağaza aboneliği uygulama içinden iptal edilemez: mağazanın abonelik sayfası açılır
export async function openStoreSubscriptions() {
  await deepLinkToSubscriptions({});
}
