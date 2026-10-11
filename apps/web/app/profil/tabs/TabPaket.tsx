'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
        @keyframes _pRotGrad{to{transform:rotate(360deg)}}
        .p-tercih-badge::before{content:'';position:absolute;inset:-1.5px;border-radius:9999px;background:conic-gradient(#c0392b,#ff6b6b,#e74c3c,#c0392b);animation:_pRotGrad 3s linear infinite;z-index:-1;}
      `}</style>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className="relative rounded-2xl flex flex-col overflow-hidden"
            style={plan.featured ? {
              border: '1px solid rgba(192,57,43,0.5)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5), 0 0 32px rgba(192,57,43,0.2)',
            } : {
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
            }}
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
                ? 'linear-gradient(160deg, rgba(120,20,10,0.45) 0%, rgba(10,5,5,0.85) 55%)'
                : 'linear-gradient(160deg, rgba(80,15,10,0.35) 0%, rgba(10,5,5,0.85) 55%)',
            }} />
            {/* Sağ üst smoke */}
            {plan.featured ? (
              <motion.div
                className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at top right, rgba(192,57,43,0.45) 0%, transparent 65%)' }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            ) : (
              <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(192,57,43,0.3) 0%, transparent 65%)' }} />
            )}

            {plan.featured && (
              <span
                className="p-tercih-badge absolute top-4 right-4 z-10 px-3 py-1 text-xs font-semibold rounded-full text-white"
                style={{ background: '#0a0a0a' }}
              >
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

              <div className="relative group mt-2">
                <button
                  onClick={() => kycApproved && handleBuy(plan.key)}
                  disabled={!kycApproved || buying === plan.key}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 ${!kycApproved ? 'cursor-not-allowed' : ''}`}
                  style={plan.featured ? {
                    background: 'linear-gradient(90deg, #c0392b 0%, #e74c3c 100%)',
                    color: '#fff',
                    boxShadow: '0 4px 16px rgba(192,57,43,0.4)',
                  } : {
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#aaa',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={e => { if (!plan.featured && kycApproved) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(192,57,43,0.5)'; (e.currentTarget as HTMLElement).style.color = '#ff6b6b'; } }}
                  onMouseLeave={e => { if (!plan.featured) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.color = '#aaa'; } }}
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
          </div>
        ))}
      </div>
    </div>
  );
}
