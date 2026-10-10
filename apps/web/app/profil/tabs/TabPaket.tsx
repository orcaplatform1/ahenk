'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

interface Subscription {
  id: string;
  plan: string;
  platform: string;
  startedAt: string;
  expiresAt?: string;
}

interface InitCheckoutResponse {
  checkoutFormContent: string;
  tokenExpireTime: number;
  token: string;
}

const PLANS = [
  { key: 'MASADA',   name: 'Masada',   price: '349', featured: false },
  { key: 'KARSIMDA', name: 'Karşımda', price: '449', featured: false },
  { key: 'ICERDE',   name: 'İçerde',   price: '679', featured: true  },
];

const PLAN_LABEL: Record<string, string> = {
  MASADA:   'Masada',
  KARSIMDA: 'Karşımda',
  ICERDE:   'İçerde',
};

const PLATFORM_LABEL: Record<string, string> = {
  WEB:    'Web',
  GOOGLE: 'Google Play',
  APPLE:  'App Store',
};

interface Props { kycApproved: boolean; onGoKyc: () => void; }

export function TabPaket({ kycApproved, onGoKyc }: Props) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState('');

  useEffect(() => {
    api.get<Subscription[]>('/payment/subscriptions')
      .then((subs) => {
        if (subs.length > 0) { setSubscription(subs[0]); setHasSubscription(true); }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleBuy(plan: string) {
    setBuying(plan);
    setError('');
    try {
      const data = await api.post<InitCheckoutResponse>('/payment/init', {
        plan,
        platform: 'WEB',
        callbackUrl: `${window.location.origin}/odeme/sonuc`,
      });
      const form = document.createElement('div');
      form.innerHTML = data.checkoutFormContent;
      document.body.appendChild(form);
      const script = form.querySelector('script');
      if (script) { const s = document.createElement('script'); s.src = script.src; document.body.appendChild(s); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuying('');
    }
  }

  if (loading) return <SkeletonBlock lines={4} />;

  if (hasSubscription && subscription) {
    return (
      <div className="glass-card p-5 flex flex-col gap-3">
        <h3 className="font-medium text-sm text-muted uppercase tracking-wide">Aktif Paket</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Paket</span>
          <span className="text-sm font-semibold text-text">{PLAN_LABEL[subscription.plan] ?? subscription.plan}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Platform</span>
          <span className="text-sm text-text">{PLATFORM_LABEL[subscription.platform] ?? subscription.platform}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Başlangıç</span>
          <span className="text-sm text-text">{new Date(subscription.startedAt).toLocaleDateString('tr-TR')}</span>
        </div>
        {subscription.expiresAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Bitiş</span>
            <span className="text-sm text-text">{new Date(subscription.expiresAt).toLocaleDateString('tr-TR')}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {!kycApproved && (
        <div className="flex items-center justify-between gap-4 bg-yellow-900/20 border border-yellow-800/40 rounded-2xl px-5 py-4">
          <p className="text-sm text-yellow-300">Paket almak için kimlik doğrulaması gereklidir.</p>
          <button onClick={onGoKyc} className="text-sm text-yellow-300 hover:text-yellow-100 font-medium whitespace-nowrap">Doğrula →</button>
        </div>
      )}
      {error && <p className="text-accent text-sm">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`relative p-6 flex flex-col gap-3 ${plan.featured ? 'glass-card-featured' : 'glass-card'}`}
          >
            {plan.featured && (
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', color: '#fff' }}
              >
                Tercih Edilen
              </span>
            )}
            <h4 className="font-serif text-xl text-[#f5f5f5]">{plan.name}</h4>
            <div className="text-3xl font-bold text-[#f5f5f5] font-variant-numeric tabular-nums">
              {plan.price}<span className="text-base font-normal text-[#888]">₺</span>
            </div>
            <div className="relative group mt-auto">
              <button
                onClick={() => kycApproved && handleBuy(plan.key)}
                disabled={!kycApproved || buying === plan.key}
                className={`w-full py-2.5 text-sm font-medium transition-all disabled:opacity-50 ${
                  plan.featured ? 'btn-grad' : ''
                } ${!kycApproved ? 'cursor-not-allowed' : ''}`}
                style={!plan.featured ? { border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9999, color: '#f5f5f5', background: 'transparent' } : {}}
              >
                {buying === plan.key ? 'Yönlendiriliyor…' : 'Satın Al'}
              </button>
              {!kycApproved && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs text-[#888] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none glass-card">
                  Önce kimlik doğrulaması yapmalısınız
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
