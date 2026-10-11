'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

type ActivePlan = 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;

function getPlanCardState(cardKey: string, activePlan: ActivePlan) {
  if (!activePlan) return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
  if (activePlan === 'ICERDE') {
    return { dimmed: true, badge: 'Bu paketin tüm özelliklerine sahipsiniz.', badgeRed: false, showButton: false };
  }
  if (activePlan === 'MASADA') {
    if (cardKey === 'MASADA') return { dimmed: true, badge: 'Aktif Paketiniz', badgeRed: true, showButton: false };
    if (cardKey === 'KARSIMDA') return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
    return { dimmed: true, badge: 'Bu paketin özelliğinden birine zaten sahipsiniz.', badgeRed: false, showButton: false };
  }
  if (activePlan === 'KARSIMDA') {
    if (cardKey === 'KARSIMDA') return { dimmed: true, badge: 'Aktif Paketiniz', badgeRed: true, showButton: false };
    if (cardKey === 'MASADA') return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
    return { dimmed: true, badge: 'Bu paketin özelliğinden birine zaten sahipsiniz.', badgeRed: false, showButton: false };
  }
  return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
}

interface Subscription {
  id: string;
  plan: string;
  platform: string;
  startedAt: string;
  expiresAt?: string;
  missedGroupCycles: number;
  missedOneonOneCycles: number;
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
  const [activePlan, setActivePlan] = useState<ActivePlan>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMsg, setRefundMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get<{ subscriptions: Subscription[]; hasMasada?: boolean; hasKarsimda?: boolean }>('/payment/subscriptions')
      .then((d) => {
        const subs: Subscription[] = Array.isArray(d) ? d : (d.subscriptions ?? []);
        if (subs.length > 0) {
          setSubscription(subs[0]);
          const hasIcerde = subs.some(s => s.plan === 'ICERDE');
          const hasMasada = subs.some(s => s.plan === 'MASADA' || s.plan === 'ICERDE');
          const hasKarsimda = subs.some(s => s.plan === 'KARSIMDA' || s.plan === 'ICERDE');
          setActivePlan(hasIcerde ? 'ICERDE' : hasMasada ? 'MASADA' : hasKarsimda ? 'KARSIMDA' : null);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleRefund(refundType: string) {
    setRefundLoading(true);
    setRefundMsg(null);
    try {
      await api.post('/payment/refund-request', { refundType });
      setRefundMsg({ ok: true, text: 'İade talebiniz alındı, en kısa sürede size ulaşacağız.' });
    } catch (e: any) {
      setRefundMsg({ ok: false, text: e.message ?? 'İşlem başarısız oldu.' });
    } finally {
      setRefundLoading(false);
    }
  }

  function getRefundType(sub: Subscription): string | null {
    const g = sub.missedGroupCycles ?? 0;
    const o = sub.missedOneonOneCycles ?? 0;
    if (sub.plan === 'MASADA' && g >= 4) return 'GROUP';
    if (sub.plan === 'KARSIMDA' && o >= 4) return 'ONEONE';
    if (sub.plan === 'ICERDE') {
      if (g >= 4 && o >= 4) return 'FULL';
      if (g >= 4) return 'GROUP';
      if (o >= 4) return 'ONEONE';
    }
    return null;
  }

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

  const refundType = subscription ? getRefundType(subscription) : null;
  const canRefund = refundType !== null;

  return (
    <div className="flex flex-col gap-5">
      {/* Aktif abonelik varsa iade bölümü */}
      {subscription && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Aktif Paket</span>
            <span className="text-sm font-semibold text-text">{PLAN_LABEL[subscription.plan] ?? subscription.plan}</span>
          </div>
          {subscription.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Bitiş</span>
              <span className="text-xs text-text">{new Date(subscription.expiresAt).toLocaleDateString('tr-TR')}</span>
            </div>
          )}
          <p className="text-xs text-[#555] leading-relaxed border-t border-white/5 pt-3 mt-1">
            Eşleşme 4 döngü boyunca gerçekleşmezse iade talep edebilirsiniz. İade talepleri 5 iş günü içinde değerlendirilir.
          </p>
          {refundMsg ? (
            <p className={`text-sm ${refundMsg.ok ? 'text-green-400' : 'text-accent'}`}>{refundMsg.text}</p>
          ) : (
            <button
              disabled={!canRefund || refundLoading}
              onClick={() => canRefund && handleRefund(refundType!)}
              className="w-full py-2 rounded-xl text-sm font-medium border transition-colors"
              style={canRefund ? {
                border: '1px solid rgba(192,57,43,0.6)',
                color: '#e74c3c',
                background: 'rgba(192,57,43,0.06)',
              } : {
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.25)',
                cursor: 'not-allowed',
              }}
            >
              {refundLoading ? 'Gönderiliyor…' : 'İade Talep Et'}
            </button>
          )}
          {!canRefund && !refundMsg && (
            <p className="text-xs text-[#444]">4 kaçırılmış döngü gerekli (mevcut: grup {subscription.missedGroupCycles ?? 0}, başbaşa {subscription.missedOneonOneCycles ?? 0})</p>
          )}
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
          const cs = getPlanCardState(plan.key, activePlan);
          const cardBody = (
            <div
              className={plan.featured ? 'p-feat-inner' : 'relative rounded-2xl flex flex-col overflow-hidden flex-1'}
              style={{
                ...((!plan.featured) ? {
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
                } : {}),
                ...(cs.dimmed ? { opacity: 0.45, pointerEvents: 'none' as const } : {}),
              }}
            >
            {/* Arka plan görseli */}
            <div className="absolute inset-0" style={{ backgroundImage: `url(${plan.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            {/* Karartma katmanı — sadece featured (İçerde) için */}
            {plan.featured && (
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,5,5,0.92) 0%, rgba(10,5,5,0.55) 40%, rgba(10,5,5,0.08) 100%)' }} />
            )}

            {plan.featured && !cs.badge && (
              <span className="absolute top-4 right-4 z-10 px-3 py-1 text-xs font-semibold rounded-full text-white"
                style={{ background: 'rgba(10,5,5,0.7)', border: '1px solid rgba(255,255,255,0.18)' }}>
                Tercih Edilen
              </span>
            )}
            {cs.badge && (
              <span className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-2 py-1 text-xs font-semibold rounded-full text-center leading-tight"
                style={{
                  maxWidth: '90%',
                  ...(cs.badgeRed
                    ? { background: 'rgba(192,57,43,0.85)', color: '#fff', border: '1px solid rgba(192,57,43,0.6)' }
                    : { background: 'rgba(40,40,40,0.85)', color: '#aaa', border: '1px solid rgba(255,255,255,0.12)' }),
                }}>
                {cs.badge}
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

              {cs.showButton && (
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => kycApproved ? handleBuy(plan.key) : onGoKyc()}
                    disabled={buying === plan.key}
                    className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={!kycApproved ? {
                      background: 'rgba(192,57,43,0.12)',
                      color: '#e74c3c',
                      border: '1px solid rgba(192,57,43,0.4)',
                    } : plan.featured ? {
                      background: 'linear-gradient(90deg, #b8960c 0%, #e8c84a 45%, #c9a227 100%)',
                      color: '#1a1100', fontWeight: 700,
                      boxShadow: '0 4px 18px rgba(200,160,30,0.35)',
                    } : {
                      background: 'linear-gradient(90deg, #c0392b 0%, #e74c3c 100%)',
                      color: '#fff', boxShadow: '0 4px 16px rgba(192,57,43,0.35)',
                    }}
                  >
                    {buying === plan.key ? 'Yönlendiriliyor…' : !kycApproved ? 'Paket Seç' : 'Paketi Seç'}
                  </button>
                </div>
              )}
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
