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

// Mobil indirim teklifleri (backend store.service.ts): tek seferlikte indirimli ayrı ürün kimliği gelir; Prime'da
// iOS promosyon teklifi (sunucu imzalı) / Google Play abonelik teklifi (offerId). Davet %10 ve 100 TL birlikte kullanılmaz.
interface StoreOffer { offerId: string; identifier?: string; keyIdentifier?: string; nonce?: string; signature?: string; timestamp?: number }
interface InitResponse { stub?: boolean; message?: string; iap?: boolean; productId?: string; type?: 'subs' | 'in-app'; offer?: StoreOffer | null }

// Mağaza penceresi açılır; satın alma sunucuda doğrulanınca çözülür
export async function startPurchase(plan: string, useDiscount?: 'REFERRER' | 'INVITEE'): Promise<'purchased'> {
  const init = await api.post<InitResponse>('/payment/init', { plan, platform: PLATFORM, ...(useDiscount ? { useDiscount } : {}) });
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

  const offer = init.offer ?? null;
  if (isSub && Platform.OS === 'android') {
    // Play abonelik: indirim teklifi varsa o teklifin, yoksa temel planın teklif anahtarı
    const products = (await fetchProducts({ skus: [sku], type: 'subs' })) as unknown as { subscriptionOfferDetailsAndroid?: { offerId?: string | null; offerToken: string }[] }[] | null;
    const offers = products?.[0]?.subscriptionOfferDetailsAndroid ?? [];
    const chosen = (offer ? offers.find((o) => o.offerId === offer.offerId) : offers.find((o) => !o.offerId)) ?? offers[0];
    await requestPurchase({ request: { google: { skus: [sku], subscriptionOffers: chosen ? [{ sku, offerToken: chosen.offerToken }] : [] } }, type: 'subs' });
  } else if (isSub && offer?.signature && offer.keyIdentifier && offer.nonce && offer.timestamp) {
    // App Store promosyon teklifi (yalnız ilk dönem indirimli)
    await requestPurchase({
      request: { apple: { sku, withOffer: { identifier: offer.offerId, keyIdentifier: offer.keyIdentifier, nonce: offer.nonce, signature: offer.signature, timestamp: offer.timestamp } } },
      type: 'subs',
    });
  } else {
    await requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: isSub ? 'subs' : 'in-app' });
  }
  return done;
}

// Mağaza aboneliği uygulama içinden iptal edilemez: mağazanın abonelik sayfası açılır
export async function openStoreSubscriptions() {
  await deepLinkToSubscriptions({});
}
