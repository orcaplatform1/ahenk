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
  {
    key: 'MASADA',
    name: 'Masada',
    price: '349',
    desc: 'Aylık grup buluşma hakkı',
    featured: false,
    bgImage: '/plan-masada.webp',
    features: ['1 masa buluşması', 'Kişilik eşleşmesi', 'Şehir içi etkinlikler'],
  },
  {
    key: 'KARSIMDA',
    name: 'Karşımda',
    price: '449',
    desc: 'Tek kullanımlık başbaşa buluşma',
    featured: false,
    bgImage: '/plan-karsimda.webp',
    features: ['1 özel buluşma', 'Kişilik ve ilgi uyumu', 'Premium mekanlar'],
  },
  {
    key: 'ICERDE',
    name: 'İçerde',
    price: '679',
    desc: '1 ay Masada + 1 Karşımda hakkı',
    featured: true,
    bgImage: '/plan-icerde.webp',
    features: ['1 grup + 1 özel buluşma', 'Kişilik ve ilgi uyumu', 'Öncelikli masa seçimi', 'Premium mekanlar'],
  },
];

const PLAN_LABEL: Record<string, string> = {
  MASADA: 'Masada',
  KARSIMDA: 'Karşımda',
  ICERDE: 'İçerde',
};

const PLATFORM_LABEL: Record<string, string> = {
  WEB: 'Web',
  GOOGLE: 'Google Play',
  APPLE: 'App Store',
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
        callbackUrl: `${window.location.origin}/odeme/basarili`,
        failCallbackUrl: `${window.location.origin}/odeme/basarisiz`,
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

      <style>{`
        @keyframes _pCardGoldBorder{to{transform:rotate(360deg)}}
        .p-feat-wrap{position:relative;border-radius:18px;padding:2px;overflow:hidden;}
        .p-feat-wrap::before{content:'';position:absolute;inset:-60%;background:conic-gradient(from 0deg,transparent 68%,#c9a227 78%,#e8c84a 84%,transparent 93%);animation:_pCardGoldBorder 3s linear infinite;z-index:0;}
        .p-feat-inner{position:relative;z-index:1;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;flex:1;}
      `}</style>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const cardBody = (
            <div
              className={plan.featured ? 'p-feat-inner' : 'relative rounded-2xl flex flex-col overflow-hidden flex-1'}
              style={!plan.featured ? {
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
              } : undefined}
            >
            {/* Arka plan görseli */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${plan.bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            {/* Karartma katmanı */}
            <div className="absolute inset-0" style={{
              background: plan.featured
                ? 'linear-gradient(to top, rgba(10,5,5,0.92) 0%, rgba(10,5,5,0.55) 40%, rgba(10,5,5,0.08) 100%)'
                : 'linear-gradient(160deg, rgba(10,5,5,0.3) 0%, rgba(10,5,5,0.82) 55%)',
            }} />

            {plan.featured && (
              <span className="absolute top-4 right-4 z-10 px-3 py-1 text-xs font-semibold rounded-full text-white"
                style={{ background: 'rgba(10,5,5,0.7)', border: '1px solid rgba(255,255,255,0.18)' }}>
                Tercih Edilen
              </span>
            )}

            <div className="relative z-10 p-6 flex flex-col gap-3 flex-1">
              <div>
                <h4 className="font-serif text-xl text-[#f5f5f5] mb-1">{plan.name}</h4>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-bold text-[#f5f5f5]">{plan.price}</span>
                  <span className="text-base text-[#888] mb-0.5">₺</span>
                </div>
                <p className="text-[#888] text-sm">{plan.desc}</p>
              </div>

              <ul className="flex flex-col gap-1.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#ccc]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color: '#c0392b' }}>
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => kycApproved && handleBuy(plan.key)}
                  disabled={!kycApproved || buying === plan.key}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${!kycApproved ? 'opacity-40 cursor-not-allowed' : ''}`}
                  style={plan.featured ? {
                    background: 'linear-gradient(90deg, #b8960c 0%, #e8c84a 45%, #c9a227 100%)',
                    color: '#1a1100',
                    fontWeight: 700,
                    boxShadow: '0 4px 18px rgba(200,160,30,0.35)',
                  } : {
                    background: 'linear-gradient(90deg, #c0392b 0%, #e74c3c 100%)',
                    color: '#fff',
                    boxShadow: '0 4px 16px rgba(192,57,43,0.35)',
                  }}
                >
                  {buying === plan.key ? 'Yönlendiriliyor…' : 'Paketi Seç'}
                </button>
                {!kycApproved && (
                  <p className="text-center text-xs" style={{ color: 'rgba(192,57,43,0.8)' }}>
                    KYC doğrulaması gerekli
                  </p>
                )}
              </div>
            </div>
          </div>
          );

          return plan.featured ? (
            <div key={plan.key} className="p-feat-wrap flex flex-col" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              {cardBody}
            </div>
          ) : (
            <div key={plan.key} className="flex flex-col">{cardBody}</div>
          );
        })}
      </div>
    </div>
  );
}
