'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

type ActivePlan = 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;

function getPlanCardState(cardKey: string, activePlan: ActivePlan) {
  const none = { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
  if (!activePlan) return none;

  if (activePlan === 'MASADA') {
    if (cardKey === 'MASADA')   return { dimmed: true,  badge: 'Aktif Paketiniz',        badgeRed: true,  showButton: false };
    if (cardKey === 'KARSIMDA') return { dimmed: false, badge: null,                      badgeRed: false, showButton: true  };
    /* ICERDE */                return { dimmed: true,  badge: 'Grup Masasına Sahipsin',  badgeRed: false, showButton: false };
  }
  if (activePlan === 'KARSIMDA') {
    if (cardKey === 'KARSIMDA') return { dimmed: true,  badge: 'Aktif Paketiniz',              badgeRed: true,  showButton: false };
    if (cardKey === 'MASADA')   return { dimmed: false, badge: null,                            badgeRed: false, showButton: true  };
    /* ICERDE */                return { dimmed: true,  badge: 'Baş Başa Masasına Sahipsin',   badgeRed: false, showButton: false };
  }
  if (activePlan === 'ICERDE') {
    if (cardKey === 'ICERDE')   return { dimmed: true,  badge: 'Aktif Paketiniz',              badgeRed: true,  showButton: false };
    if (cardKey === 'MASADA')   return { dimmed: true,  badge: 'Grup Masasına Sahipsin',       badgeRed: false, showButton: false };
    /* KARSIMDA */              return { dimmed: true,  badge: 'Baş Başa Masasına Sahipsin',   badgeRed: false, showButton: false };
  }
  return none;
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
    features: ['Her Hafta Grup Masası', 'Doğrulanmış Profiller', 'OCEAN Kişilik Uyumu', 'Yapay Zeka Masa Raporu', 'Masa Garantili (Ücret İade)'],
  },
  {
    key: 'KARSIMDA',
    name: 'Karşımda',
    price: '449',
    desc: 'Tek kullanımlık başbaşa buluşma',
    featured: false,
    bgImage: '/plan-karsimda.webp',
    features: ['Tek Seferlik Baş Başa Masa', 'Doğrulanmış Profiller', 'OCEAN + Yaş Uyumu', 'Yapay Zeka Masa Raporu', 'Masa Garantili (Ücret İade)'],
  },
  {
    key: 'ICERDE',
    name: 'İçerde',
    price: '679',
    desc: '1 ay Masada + 1 Karşımda hakkı',
    featured: true,
    bgImage: '/plan-icerde.webp',
    features: ['4 Grup Masası + 1 Baş Başa Masa', 'Tüm Özellikler Dahil'],
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

interface DiscountInfo { referralDiscount: boolean; referralCount: number; inviteeDiscount: boolean; }

interface Props { kycApproved: boolean; onGoKyc: () => void; }

export function TabPaket({ kycApproved, onGoKyc }: Props) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [activePlan, setActivePlan] = useState<ActivePlan>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMsg, setRefundMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo | null>(null);
  const [referralPhone, setReferralPhone] = useState('');
  const [referralSending, setReferralSending] = useState(false);
  const [referralMsg, setReferralMsg] = useState('');
  const [referralStats, setReferralStats] = useState<{ totalInvites: number; availableDiscounts: number } | null>(null);

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

    api.get<DiscountInfo>('/payment/discount-info').then(setDiscountInfo).catch(() => {});
    api.get<{ totalInvites: number; availableDiscounts: number }>('/referral/my-stats').then(setReferralStats).catch(() => {});
  }, []);

  async function sendReferralInvite() {
    if (!referralPhone || referralPhone.length !== 10 || !referralPhone.startsWith('5')) {
      setReferralMsg('Geçerli bir numara girin (5 ile başlayan 10 hane).');
      return;
    }
    setReferralSending(true); setReferralMsg('');
    try {
      await api.post('/referral/invite', { phoneNumber: `+90${referralPhone}` });
      setReferralMsg('Davet başarıyla gönderildi!');
      setReferralPhone('');
      const d = await api.get<{ totalInvites: number; availableDiscounts: number }>('/referral/my-stats');
      setReferralStats(d);
    } catch (e) { setReferralMsg((e as Error).message || 'Gönderilemedi.'); }
    finally { setReferralSending(false); }
  }

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
      const useDiscount = discountInfo?.referralDiscount ? 'REFERRER' : discountInfo?.inviteeDiscount ? 'INVITEE' : undefined;
      const data = await api.post<InitCheckoutResponse>('/payment/init', {
        plan,
        platform: 'WEB',
        callbackUrl: `${window.location.origin}/odeme/basarili`,
        failCallbackUrl: `${window.location.origin}/odeme/basarisiz`,
        ...(useDiscount ? { useDiscount } : {}),
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

  const hasReferralDiscount = !!(discountInfo?.referralDiscount);

  function discountedPrice(price: string): string {
    const kurus = Math.round(parseFloat(price) * 100 * 0.9);
    const tl = kurus / 100;
    return tl % 1 === 0 ? String(tl) : tl.toFixed(2).replace('.', ',');
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sadakat Programı kartı */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 flex flex-col gap-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Sadakat Programı</p>
        <div className="flex flex-col gap-2">
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '0 14px' }}>
            <span style={{ color: '#555', fontSize: 14, marginRight: 4 }}>+90</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="5XX XXX XX XX"
              value={referralPhone}
              onChange={e => setReferralPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#f5f5f5', padding: '11px 0' }}
            />
          </div>
          <button
            onClick={sendReferralInvite}
            disabled={referralSending}
            className="w-full py-2.5 text-sm btn-grad disabled:opacity-50"
          >
            {referralSending ? '…' : 'Davet Gönder'}
          </button>
          <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
              <span style={{ fontWeight: 700 }}>BİLGİ:</span> Davet ettiğiniz arkadaşınız, telefon numarasını ve kimlik doğrulamasını yaptıktan sonra sistem size otomatik indirim hakkı tanımlar. Arkadaşınız da başka arkadaşlarını davet edip bu şartlar yerine geldiğinde o da indirim hakkı kazanır. İndirim hakları toplu olarak kullanılamaz ve devredilemez. Her bir indirim hakkı, yalnızca bir paket satın alımında geçerlidir.
            </p>
          </div>
        </div>
        {referralMsg && (
          <p className="text-xs" style={{ color: referralMsg.includes('başarı') ? '#4ade80' : '#ff6b6b' }}>{referralMsg}</p>
        )}
        <div className="flex gap-6 pt-1 border-t border-white/5">
          <div>
            <p className="text-xs text-[#555]">Davetli Arkadaş</p>
            <p className="text-base font-semibold text-text">{referralStats?.totalInvites ?? '—'} kişi</p>
          </div>
          <div>
            <p className="text-xs text-[#555]">Toplam %10 İndirim Hakkı</p>
            <p className="text-base font-semibold text-text">{referralStats?.availableDiscounts ?? '—'} Adet</p>
          </div>
        </div>
      </div>

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
        .p-feat-wrap::before{content:'';position:absolute;width:300%;height:300%;top:-100%;left:-100%;background:conic-gradient(from 0deg,transparent 68%,#c9a227 78%,#e8c84a 84%,transparent 93%);animation:_pCardGoldBorder 3s linear infinite;z-index:0;}
        .p-feat-inner{position:relative;z-index:1;border-radius:16px;overflow:hidden;display:flex;flex-direction:row;flex:1;}
      `}</style>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const cs = getPlanCardState(plan.key, activePlan);
          const cardBody = (
            <div
              className={plan.featured ? 'p-feat-inner' : 'relative rounded-2xl overflow-hidden flex-1'}
              style={{
                display: 'flex',
                flexDirection: 'row',
                minHeight: 240,
                ...((!plan.featured) ? {
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
                } : {}),
                ...(cs.dimmed ? { opacity: 0.45, pointerEvents: 'none' as const } : {}),
              }}
            >
            {/* Sol: metin */}
            <div style={{ width: '55%', flexShrink: 0, background: '#0c0909', display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 8, position: 'relative' }}>
              {cs.badge && (
                <span className="absolute top-2 inset-x-2 z-10 px-2 py-0.5 text-center leading-tight rounded-full"
                  style={{
                    fontSize: '0.65rem', fontWeight: 600,
                    ...(cs.badgeRed
                      ? { background: 'rgba(192,57,43,0.85)', color: '#fff', border: '1px solid rgba(192,57,43,0.6)' }
                      : { background: 'rgba(40,40,40,0.85)', color: '#aaa', border: '1px solid rgba(255,255,255,0.12)' }),
                  }}>
                  {cs.badge}
                </span>
              )}
              <div style={{ marginTop: cs.badge ? 20 : 0 }}>
                <h4 className="font-serif text-[#f5f5f5]" style={{ fontSize: '1rem', marginBottom: 3 }}>{plan.name}</h4>
                {hasReferralDiscount ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 2 }}>
                      <span className="font-bold text-[#f5f5f5]" style={{ fontSize: '1.5rem' }}>{discountedPrice(plan.price)}</span>
                      <span style={{ color: '#888', fontSize: '0.85rem', marginBottom: 1 }}>₺</span>
                      <span style={{ color: '#555', fontSize: '0.75rem', textDecoration: 'line-through', marginBottom: 1 }}>{plan.price}₺</span>
                    </div>
                    <p style={{ color: '#4ade80', fontSize: '0.68rem', marginBottom: 2 }}>Kalan İndirim Hakkı: {discountInfo!.referralCount}</p>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 2 }}>
                    <span className="font-bold text-[#f5f5f5]" style={{ fontSize: '1.5rem' }}>{plan.price}</span>
                    <span style={{ color: '#888', fontSize: '0.85rem', marginBottom: 1 }}>₺</span>
                  </div>
                )}
                <p style={{ color: '#666', fontSize: '0.68rem' }}>{plan.desc}</p>
              </div>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#ccc', lineHeight: 1.3 }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 11, height: 11, flexShrink: 0, color: '#c0392b' }}>
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {cs.showButton && (
                <button
                  onClick={() => kycApproved ? handleBuy(plan.key) : onGoKyc()}
                  disabled={buying === plan.key}
                  style={!kycApproved ? {
                    background: 'rgba(192,57,43,0.12)',
                    color: '#e74c3c',
                    border: '1px solid rgba(192,57,43,0.4)',
                    borderRadius: 10,
                    padding: '7px 0',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                  } : {
                    background: 'linear-gradient(90deg,#c0392b 0%,#e74c3c 100%)',
                    color: '#fff',
                    boxShadow: '0 4px 16px rgba(192,57,43,0.35)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '7px 0',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  {buying === plan.key ? 'Yönlendiriliyor…' : !kycApproved ? 'Paket Seç' : 'Paketi Seç'}
                </button>
              )}
            </div>

            {/* Sağ: görsel */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={plan.bgImage} alt={plan.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
              {plan.featured && !cs.badge && (
                <span className="absolute top-3 right-2 z-10 px-2 py-0.5 text-xs font-semibold rounded-full text-white"
                  style={{ background: 'rgba(10,5,5,0.75)', border: '1px solid rgba(255,255,255,0.18)' }}>
                  Tercih Edilen
                </span>
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
