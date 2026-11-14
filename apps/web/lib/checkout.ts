import { api } from '@/lib/api';
import { rememberPendingPurchase } from '@/lib/analytics';

interface InitCheckoutResponse {
  checkoutFormContent: string;
  tokenExpireTime: number;
  token: string;
  plan: { amountKurus: number };
}

// iyzico ödeme formunu açar. Tutar backend'de hesaplanır (geri kazanım indirimi süresi içindeyse otomatik uygulanır).
export async function startCheckout(plan: string, planName: string, useDiscount?: 'REFERRER' | 'INVITEE') {
  const data = await api.post<InitCheckoutResponse>('/payment/init', {
    plan,
    platform: 'WEB',
    ...(useDiscount ? { useDiscount } : {}),
  });
  rememberPendingPurchase(plan, planName, data.plan.amountKurus);
  mountIyzicoForm(data.checkoutFormContent);
}

// iyzico formunu (ödeme ya da Prime abonelik formu) sayfaya yerleştirir
export function mountIyzicoForm(checkoutFormContent: string) {
  // iyzico formu bu div'e yerleşir
  let container = document.getElementById('iyzipay-checkout-form');
  if (!container) {
    container = document.createElement('div');
    container.id = 'iyzipay-checkout-form';
    container.className = 'popup';
    document.body.appendChild(container);
  }
  // innerHTML ile eklenen script çalışmaz; her script yeniden oluşturulup eklenir
  const tmp = document.createElement('div');
  tmp.innerHTML = checkoutFormContent;
  tmp.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script');
    if (old.src) s.src = old.src;
    else s.text = old.textContent ?? '';
    document.body.appendChild(s);
  });
}
