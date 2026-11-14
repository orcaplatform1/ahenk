'use client';

import { useEffect, useState } from 'react';
import { usePlanPrices, type PlanKeyName } from '@/components/PlanPrice';
import { api } from '@/lib/api';
import { startCheckout } from '@/lib/checkout';
import { useWinback } from '@/components/winback/useWinback';
import { getKankamlaCardState, getPlanCardState, type KankamlaState, type OpenParts, type PlanKey } from '@/lib/planCards';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import MaintenanceNotice from '@/components/MaintenanceNotice';

// Aktif paket / abonelik (yalnız kullanıcının kendi aldıkları)
interface Subscription {
  id: string;
  plan: string;
  name: string;
  isPrime: boolean;
  autoRenew: boolean;
  renewCancelledAt: string | null;
  expiresAt: string | null;
}
interface Rights { group: number; oneOnOne: number; kanka: number }

type CardKey = 'MASADA' | 'KARSIMDA' | 'KANKAMLA' | 'ICERDE' | 'PRIME';
const PRIME_PLANS = [
  { key: 'PRIME_1M', label: '1 Aylık' },
  { key: 'PRIME_3M', label: '3 Aylık' },
  { key: 'PRIME_6M', label: '6 Aylık' },
  { key: 'PRIME_12M', label: '12 Aylık' },
] as const;

// Paket kartları: tam genişlik, tek renk; Prime altın tonunda, diğerleri tema renklerinden
const CARDS: { key: CardKey; name: string; badge: string; desc: string; color: string; advantages: string[] }[] = [
  { key: 'MASADA', name: 'Grup', badge: 'Tek Seferlik', desc: '1 Grup buluşması hakkı', color: '#d6453a', advantages: ['1 Grup buluşması hakkı', 'Hak kullanılana kadar geçerli'] },
  { key: 'KARSIMDA', name: 'Başbaşa', badge: 'Tek Seferlik', desc: '1 Başbaşa buluşması hakkı', color: '#c8743c', advantages: ['1 Başbaşa buluşması hakkı', 'Hak kullanılana kadar geçerli'] },
  { key: 'KANKAMLA', name: 'Kankamla', badge: 'Tek Seferlik', desc: '1 Kankamla buluşması hakkı', color: '#8f887f', advantages: ['1 Kankamla buluşması hakkı', 'Arkadaşın ücretsiz katılır', 'Hak kullanılana kadar geçerli'] },
  { key: 'ICERDE', name: 'İçerde', badge: 'Tek Seferlik', desc: '1 Grup + 1 Başbaşa buluşması hakkı', color: '#c0392b', advantages: ['1 Grup buluşması hakkı', '1 Başbaşa buluşması hakkı', 'Haklar kullanılana kadar geçerli'] },
  { key: 'PRIME', name: 'Prime', badge: 'Abonelik', desc: 'Her 30 günde 1 Grup + 1 Başbaşa + 1 Kankamla', color: '#c9a227', advantages: ['Her 30 günde 1 Grup buluşması hakkı', 'Her 30 günde 1 Başbaşa buluşması hakkı', 'Her 30 günde 1 Kankamla buluşması hakkı', 'Otomatik yenilenir, istediğin zaman iptal edebilirsin'] },
];

const PAY_INFO_WEB = 'Ödemen iyzico ile güvenli şekilde alınır.';
const PRIME_RENEW_INFO = 'İptal etmediğin sürece aboneliğin seçtiğin süre için aynı fiyatla otomatik olarak yenilenir.';

interface DiscountInfo { referralDiscount: boolean; referralCount: number; inviteeDiscount: boolean; }

interface Props { maintenanceMode?: boolean; }

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0, color: '#c0392b' }}>
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function TabPaket({ maintenanceMode = false }: Props) {
  const prices = usePlanPrices();
  const winback = useWinback();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [rights, setRights] = useState<Rights>({ group: 0, oneOnOne: 0, kanka: 0 });
  const [ownedPlans, setOwnedPlans] = useState<Set<PlanKey>>(new Set());
  const [openParts, setOpenParts] = useState<OpenParts>({ group: false, oneOnOne: false });
  const [primeActive, setPrimeActive] = useState(false);
  const [kankamla, setKankamla] = useState<KankamlaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [detail, setDetail] = useState<CardKey | null>(null);
  const [primePlan, setPrimePlan] = useState<(typeof PRIME_PLANS)[number]['key']>('PRIME_1M');
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo | null>(null);
  const [referralPhone, setReferralPhone] = useState('');
  const [referralSending, setReferralSending] = useState(false);
  const [referralMsg, setReferralMsg] = useState('');
  const [referralStats, setReferralStats] = useState<{ totalInvites: number; availableDiscounts: number } | null>(null);

  function loadSubs() {
    return api.get<{ subscriptions: Subscription[]; rights: Rights; hasMasada?: boolean; hasKarsimda?: boolean; primeActive?: boolean }>('/payment/subscriptions')
      .then((d) => {
        const subs = d.subscriptions ?? [];
        setSubscriptions(subs);
        setRights(d.rights ?? { group: 0, oneOnOne: 0, kanka: 0 });
        setOwnedPlans(new Set(subs.map(s => s.plan as PlanKey)));
        setOpenParts({ group: !!d.hasMasada, oneOnOne: !!d.hasKarsimda });
        setPrimeActive(!!d.primeActive);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    loadSubs().finally(() => setLoading(false));
    api.get<DiscountInfo>('/payment/discount-info').then(setDiscountInfo).catch(() => {});
    api.get<{ kankamla?: KankamlaState }>('/auth/me').then((m) => setKankamla(m.kankamla ?? null)).catch(() => {});
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

  async function handleBuy(plan: string, name: string) {
    setBuying(plan);
    setError('');
    try {
      const useDiscount = discountInfo?.referralDiscount ? 'REFERRER' : discountInfo?.inviteeDiscount ? 'INVITEE' : undefined;
      await startCheckout(plan, name, useDiscount);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuying('');
    }
  }

  async function cancelPrime() {
    setCancelling(true);
    setError('');
    try {
      await api.post('/payment/prime/cancel', {});
      await loadSubs();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <SkeletonBlock lines={4} />;

  const priceOf = (key: string) => prices?.[key as PlanKeyName];
  // İndirim: geri kazanım (100 TL) ya da davet (%10); ikisi birlikte kullanılmaz, geri kazanım önceliklidir
  const winbackOf = (key: string) => (winback.live && winback.running ? winback.state?.plans?.find((p) => p.plan === key) : undefined);
  const hasReferralDiscount = !!(discountInfo?.referralDiscount || discountInfo?.inviteeDiscount);
  const priceView = (key: string): { now: number | null; old: number | null } => {
    const w = winbackOf(key);
    if (w) return { now: w.discountedTL, old: w.listTL };
    const p = priceOf(key);
    if (!p) return { now: null, old: null };
    return hasReferralDiscount ? { now: p.webDiscountTL, old: p.webTL } : { now: p.webTL, old: null };
  };

  // Kartın satın alma durumu (backend assertCanBuy ile aynı kurallar)
  const stateOf = (key: CardKey) => {
    if (key === 'PRIME') return primeActive ? { blocked: true, badge: 'Aktif Paketiniz' as string | null, needsKanka: false } : { blocked: false, badge: null, needsKanka: false };
    if (key === 'KANKAMLA') {
      const k = getKankamlaCardState(kankamla);
      return { blocked: !k.showButton, badge: k.badge, needsKanka: k.needsKanka };
    }
    const c = getPlanCardState(key, ownedPlans, openParts);
    return { blocked: !c.showButton, badge: c.badge, needsKanka: false };
  };

  const ownSubs = subscriptions;
  const prime = ownSubs.find((s) => s.isPrime);

  // ─── Detay ekranı ──────────────────────────────────────────────────────────
  if (detail) {
    const card = CARDS.find((c) => c.key === detail)!;
    const isPrimeCard = detail === 'PRIME';
    const planKey = isPrimeCard ? primePlan : detail;
    const st = stateOf(detail);
    const pv = priceView(planKey);
    return (
      <div className="flex flex-col gap-5">
        {maintenanceMode && <MaintenanceNotice />}
        <button onClick={() => { setDetail(null); setError(''); }} className="self-start text-sm text-[#a39c93] hover:text-[#f5f5f5] transition-colors" style={{ minHeight: 44 }}>
          ← Paketler
        </button>
        <div className="ll-card flex flex-col gap-5">
          <h3 className="font-bold text-[#f5f5f5]" style={{ fontSize: '1.75rem', color: isPrimeCard ? '#e8c84a' : '#f5f5f5' }}>{card.name}</h3>

          {isPrimeCard && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIME_PLANS.map((pl) => {
                const on = primePlan === pl.key;
                const p = priceView(pl.key);
                return (
                  <button
                    key={pl.key}
                    onClick={() => setPrimePlan(pl.key)}
                    className="rounded-xl px-3 py-3 text-left transition-colors"
                    style={{ border: on ? '2px solid #c9a227' : '1px solid rgba(255,255,255,0.12)', background: on ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.03)' }}
                    aria-pressed={on}
                  >
                    <span className="block text-sm font-semibold text-[#f5f5f5]">{pl.label}</span>
                    <span className="block text-xs text-[#c9c2b8] mt-1">{p.now ?? '—'} ₺</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h4 className="text-base font-semibold text-[#f5f5f5]">Avantajlar</h4>
            <ul className="flex flex-col gap-2.5">
              {card.advantages.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm text-[#c9c2b8]"><Check />{a}</li>
              ))}
            </ul>
          </div>

          <div className="flex items-end gap-3">
            {pv.old !== null && <span className="text-lg text-[#8f887f] line-through">{pv.old} ₺</span>}
            <span className="font-bold text-[#f5f5f5]" style={{ fontSize: '2.25rem', lineHeight: 1 }}>{pv.now ?? '—'} ₺</span>
          </div>

          {error && <p className="text-accent text-sm">{error}</p>}

          <button
            onClick={() => st.needsKanka ? (window.location.href = '/profil?tab=profil') : handleBuy(planKey, isPrimeCard ? `Prime ${PRIME_PLANS.find((p) => p.key === primePlan)!.label}` : card.name)}
            disabled={st.blocked || buying === planKey || maintenanceMode}
            className="btn-primary w-full justify-center disabled:opacity-50"
            style={{ minHeight: 52, fontSize: '1rem' }}
          >
            {buying === planKey ? 'Yönlendiriliyor…' : st.blocked ? (st.badge ?? (isPrimeCard ? 'Abone Ol' : 'Paket Al')) : st.needsKanka ? 'Önce Kanka Davet Et' : isPrimeCard ? 'Abone Ol' : 'Paket Al'}
          </button>
          <p className="text-xs text-[#a39c93] text-center" style={{ lineHeight: 1.5 }}>
            {PAY_INFO_WEB}{isPrimeCard ? ` ${PRIME_RENEW_INFO}` : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {maintenanceMode && <MaintenanceNotice />}
      {/* Sadakat Programı kartı */}
      <div className="ll-card flex flex-col gap-3">
        <div className="ll-head"><h3 className="ll-title">Sadakat Programı</h3></div>
        <div className="flex flex-col gap-2">
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '0 14px' }}>
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
            className="w-full btn-primary disabled:opacity-50"
          >
            {referralSending ? '…' : 'Davet Gönder'}
          </button>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ color: '#aaa', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              Davet ettiğiniz arkadaşınız, telefon numarasını ve kimlik doğrulamasını yaptıktan sonra sistem size otomatik indirim hakkı tanımlar. Arkadaşınız da başka arkadaşlarını davet edip bu şartlar yerine geldiğinde o da indirim hakkı kazanır. İndirim hakları toplu olarak kullanılamaz ve devredilemez. <span style={{ fontWeight: 700, color: '#fff' }}>Her bir indirim hakkı, yalnızca bir paket satın alımında geçerlidir.</span>
            </p>
          </div>
        </div>
        {referralMsg && (
          <p className="text-xs" style={{ color: referralMsg.includes('başarı') ? '#4ade80' : '#ff6b6b' }}>{referralMsg}</p>
        )}
        <div className="flex gap-6 pt-1 border-t border-white/5">
          <div>
            <p className="text-xs text-[#c9c2b8]">Davetli Arkadaş</p>
            <p className="text-base font-semibold text-[#f4f1ec]">{referralStats?.totalInvites ?? '—'} kişi</p>
          </div>
          <div>
            <p className="text-xs text-[#c9c2b8]">Toplam %10 İndirim Hakkı</p>
            <p className="text-base font-semibold text-[#f4f1ec]">{referralStats?.availableDiscounts ?? '—'} Adet</p>
          </div>
        </div>
      </div>

      {/* Aktif paketler ve türüne göre kalan hak adedi: yalnız aktif paketi / aboneliği olana */}
      {ownSubs.length > 0 && (
        <div className="ll-card flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-bold text-white uppercase tracking-wide">Aktif Paket</span>
            <span className="text-xs font-semibold text-right" style={{ color: '#aaa' }}>{ownSubs.map((s) => s.name).join(', ')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#aaa' }}>Grup</span>
            <span className="text-xs" style={{ color: '#aaa' }}>{rights.group}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#aaa' }}>Başbaşa</span>
            <span className="text-xs" style={{ color: '#aaa' }}>{rights.oneOnOne}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#aaa' }}>Kankamla</span>
            <span className="text-xs" style={{ color: '#aaa' }}>{rights.kanka}</span>
          </div>
          {prime && !prime.renewCancelledAt && (
            <button
              onClick={cancelPrime}
              disabled={cancelling}
              className="w-full py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#c9c2b8', minHeight: 44 }}
            >
              {cancelling ? '…' : 'Aboneliği İptal Et'}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-accent text-sm">{error}</p>}

      <div className="flex flex-col gap-3">
        {CARDS.map((card) => {
          const st = stateOf(card.key);
          const isPrimeCard = card.key === 'PRIME';
          return (
            <button
              key={card.key}
              onClick={() => { setDetail(card.key); setError(''); window.scrollTo({ top: 0, behavior: 'instant' }); }}
              className="w-full flex items-center justify-between gap-3 text-left transition-transform active:scale-[0.99]"
              style={{
                background: card.color,
                borderRadius: 18,
                padding: '18px 20px',
                minHeight: 76,
                color: isPrimeCard ? '#1a1406' : '#fff',
                opacity: st.blocked ? 0.55 : 1,
              }}
            >
              <span className="flex flex-col gap-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold" style={{ fontSize: '1.25rem', letterSpacing: '0.01em' }}>{card.name}</span>
                  <span
                    className="rounded-full font-semibold"
                    style={{ fontSize: '0.65rem', padding: '2px 8px', background: isPrimeCard ? 'rgba(26,20,6,0.18)' : 'rgba(0,0,0,0.22)', color: isPrimeCard ? '#1a1406' : '#fff' }}
                  >
                    {st.badge ?? card.badge}
                  </span>
                </span>
                <span className="text-sm truncate" style={{ opacity: 0.9 }}>{card.desc}</span>
              </span>
              <Arrow />
            </button>
          );
        })}
      </div>
    </div>
  );
}
