'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePlanPrices, type PlanKeyName } from '@/components/PlanPrice';
import { api } from '@/lib/api';
import { startCheckout } from '@/lib/checkout';
import { useWinback } from '@/components/winback/useWinback';
import { getKankamlaCardState, getPlanCardState, type KankamlaState, type OpenParts, type PlanKey } from '@/lib/planCards';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import MaintenanceNotice from '@/components/MaintenanceNotice';
import TcknModal from '@/components/paket/TcknModal';
import { APP_STORE_URL, PLAY_STORE_URL, devicePlatform, openAppOrStore } from '@/lib/appLinks';
import { AMBER, BuyButton, CARDS, Check, PRIME_PLANS, PaketKarti, type CardKey } from '@/components/paket/PaketKarti';

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
// Davet: kişisel kod / link, geçerli davet sayısı, sonraki ücretsiz masaya kalan davet, türü seçilmemiş ödüller
interface ReferralStats {
  totalInvites: number; availableDiscounts: number; referralCode?: string; inviteLink?: string;
  validInvites?: number; invitesToNextReward?: number; pendingRewards?: { id: string }[];
}

// Ödeme bilgisi metinleri: pkg.payInfoWeb, pkg.primeRenewInfo

interface DiscountInfo { referralDiscount: boolean; referralCount: number; inviteeDiscount: boolean; }

interface Props { maintenanceMode?: boolean; }

export function TabPaket({ maintenanceMode = false }: Props) {
  const t = useTranslations();
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
  const [storeCancelMsg, setStoreCancelMsg] = useState(false);
  const [payFor, setPayFor] = useState<{ plan: string; name: string } | null>(null);
  const [detail, setDetail] = useState<CardKey | null>(null);
  const [primePlan, setPrimePlan] = useState<(typeof PRIME_PLANS)[number]['key']>('PRIME_1M');
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);

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
    api.get<ReferralStats>('/referral/my-stats').then(setReferralStats).catch(() => {});
  }, []);

  const [copied, setCopied] = useState(false);
  const [rewardMsg, setRewardMsg] = useState('');
  const [claiming, setClaiming] = useState(false);

  function copyCode() {
    if (!referralStats?.referralCode) return;
    navigator.clipboard?.writeText(referralStats.referralCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  async function shareInvite() {
    if (!referralStats?.inviteLink) return;
    const text = t('loyalty.shareText', { link: referralStats.inviteLink });
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  // Kazanılan ücretsiz masa hakkının türünü seç: tek seferlik hak olarak Paketim'e eklenir
  async function claimReward(rewardId: string, type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA') {
    setClaiming(true); setRewardMsg('');
    try {
      await api.post(`/referral/rewards/${rewardId}/claim`, { type });
      setRewardMsg(t('loyalty.rewardDone'));
      setReferralStats(await api.get<ReferralStats>('/referral/my-stats'));
      await loadSubs();
    } catch (e) { setRewardMsg((e as Error).message); }
    finally { setClaiming(false); }
  }

  // "Paket Al" / "Abone Ol": önce T.C. No penceresi, sonra iyzico ödeme formu
  function handleBuy(plan: string, name: string) {
    setError('');
    setPayFor({ plan, name });
  }

  async function pay(identityNumber: string, identityType: string) {
    if (!payFor) return;
    const { plan, name } = payFor;
    setBuying(plan);
    setError('');
    try {
      const useDiscount = discountInfo?.referralDiscount ? 'REFERRER' : discountInfo?.inviteeDiscount ? 'INVITEE' : undefined;
      await startCheckout(plan, name, identityNumber, useDiscount, identityType);
      setPayFor(null);
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
      // Mağazadan (App Store / Play Store) alınan abonelik web'den iptal edilemez
      const r = await api.post<{ storeManaged?: string }>('/payment/prime/cancel', {});
      if (r?.storeManaged) setStoreCancelMsg(true);
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
    if (key === 'PRIME') return primeActive ? { blocked: true, badge: 'plan.badgeActive' as string | null } : { blocked: false, badge: null };
    if (key === 'KANKAMLA') {
      const k = getKankamlaCardState(kankamla);
      return { blocked: !k.showButton, badge: k.badge };
    }
    const c = getPlanCardState(key, ownedPlans, openParts);
    return { blocked: !c.showButton, badge: c.badge };
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
          {t('pkg.backToPackages')}
        </button>
        <div className="ll-card flex flex-col gap-5">
          <h3 className="font-bold text-[#f5f5f5]" style={{ fontSize: '1.75rem', color: isPrimeCard ? AMBER : '#f5f5f5' }}>{t(card.name)}</h3>

          {isPrimeCard && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {PRIME_PLANS.map((pl) => {
                const on = primePlan === pl.key;
                const p = priceView(pl.key);
                // 3 aylık plan: "Tercih Edilen" etiketi, altın / amber çerçeve ve hafif amber geçişli arka plan
                const pref = pl.key === 'PRIME_3M';
                return (
                  <button
                    key={pl.key}
                    onClick={() => setPrimePlan(pl.key)}
                    className="relative rounded-xl px-3 py-3 text-left transition-colors"
                    style={{
                      // Seçili plan çerçevesi: Ahenk paleti kırmızısı (#d6453a), aynen
                      border: on ? '2px solid #d6453a' : pref ? `1px solid ${AMBER}` : '1px solid rgba(255,255,255,0.12)',
                      background: pref ? 'linear-gradient(135deg, rgba(224,165,38,0.22), rgba(224,165,38,0.06))' : on ? 'rgba(214,69,58,0.12)' : 'rgba(255,255,255,0.03)',
                    }}
                    aria-pressed={on}
                  >
                    {pref && (
                      <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 rounded-full font-extrabold whitespace-nowrap" style={{ fontSize: '0.62rem', letterSpacing: '0.08em', padding: '2px 8px', background: '#000000', color: '#f4f1ec' }}>
                        {t('pkg.preferred')}
                      </span>
                    )}
                    <span className="block text-sm font-semibold text-[#f5f5f5]">{t(pl.label)}</span>
                    <span className="block text-xs text-[#c9c2b8] mt-1">{p.now ?? '—'} ₺</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h4 className="text-base font-semibold text-[#f5f5f5]">{t('pkg.advantages')}</h4>
            <ul className="flex flex-col gap-2.5">
              {card.advantages.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm text-[#c9c2b8]"><Check color={card.accent} />{t(a)}</li>
              ))}
            </ul>
          </div>

          <div className="flex items-end justify-end gap-3">
            {pv.old !== null && <span className="text-lg text-[#8f887f] line-through">{pv.old} ₺</span>}
            <span className="font-bold text-[#f5f5f5]" style={{ fontSize: '2.25rem', lineHeight: 1 }}>{pv.now ?? '—'} ₺</span>
          </div>

          {error && <p className="text-accent text-sm">{error}</p>}

          <BuyButton
            card={card}
            onClick={() => handleBuy(planKey, isPrimeCard ? `${t('plans.PRIME')} ${t(PRIME_PLANS.find((p) => p.key === primePlan)!.label)}` : t(card.name))}
            disabled={st.blocked || buying === planKey || maintenanceMode}
            minHeight={52}
            label={buying === planKey ? t('pay.redirecting') : st.blocked ? (st.badge ? t(st.badge) : (isPrimeCard ? t('pkg.subscribe') : t('pkg.buy'))) : isPrimeCard ? t('pkg.subscribe') : t('pkg.buy')}
          />
          <p className="text-xs text-[#a39c93] text-center" style={{ lineHeight: 1.5 }}>
            {t('pkg.payInfoWeb')}{isPrimeCard ? ` ${t('pkg.primeRenewInfo')}` : ''}
          </p>
        </div>
        <TcknModal open={!!payFor} busy={!!buying} error={error} onCancel={() => setPayFor(null)} onSubmit={pay} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {maintenanceMode && <MaintenanceNotice />}
      {/* Sadakat Programı kartı */}
      <div className="ll-card flex flex-col gap-3">
        <div className="ll-head"><h3 className="ll-title">{t('loyalty.title')}</h3></div>
        {referralStats?.referralCode && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[#c9c2b8]">{t('loyalty.myCode')}</p>
            <div className="flex gap-2 items-center">
              <span className="ll-mono" style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 15, letterSpacing: '0.12em', color: '#f5f5f5' }}>
                {referralStats.referralCode}
              </span>
              <button type="button" onClick={copyCode} className="btn-ghost justify-center" style={{ minHeight: 44 }}>{copied ? t('loyalty.copied') : t('loyalty.copy')}</button>
              <button type="button" onClick={shareInvite} className="btn-primary justify-center" style={{ minHeight: 44 }}>{t('loyalty.share')}</button>
            </div>
            <p className="text-xs text-[#a39c93]" style={{ wordBreak: 'break-all' }}>{referralStats.inviteLink}</p>
            <p className="text-sm font-semibold text-[#f4f1ec]">{t('loyalty.toNext', { count: referralStats.invitesToNextReward ?? 3 })}</p>
            <p style={{ color: '#aaa', fontSize: 12, lineHeight: 1.5, margin: 0 }}>{t('loyalty.rule')}</p>
            {referralStats.pendingRewards?.map((r) => (
              <div key={r.id} className="flex flex-col gap-2" style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(46,158,98,0.10)', border: '1px solid rgba(46,158,98,0.4)' }}>
                <p className="text-sm font-semibold text-[#f4f1ec]" style={{ margin: 0 }}>{t('loyalty.rewardTitle')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([['GROUP', 'loyalty.rewardGroup'], ['ONE_ON_ONE', 'loyalty.rewardOne'], ['KANKA', 'loyalty.rewardKanka']] as const).map(([type, label]) => (
                    <button key={type} type="button" disabled={claiming} onClick={() => claimReward(r.id, type)} className="btn-ghost justify-center disabled:opacity-50" style={{ minHeight: 44, fontSize: 12 }}>
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {rewardMsg && <p className="text-xs" style={{ color: rewardMsg === t('loyalty.rewardDone') ? '#4ade80' : '#ff6b6b' }}>{rewardMsg}</p>}
          </div>
        )}
        <div className="flex gap-6 pt-1 border-t border-white/5">
          <div>
            <p className="text-xs text-[#c9c2b8]">{t('loyalty.validInvites')}</p>
            <p className="text-base font-semibold text-[#f4f1ec]">{t('loyalty.people', { count: referralStats?.validInvites ?? '—' })}</p>
          </div>
        </div>
      </div>

      {/* Aktif paketler ve türüne göre kalan hak adedi: yalnız aktif paketi / aboneliği olana */}
      {ownSubs.length > 0 && (
        <div className="ll-card flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-bold text-white uppercase tracking-wide">{t('pkg.activePackage')}</span>
            <span className="text-xs font-semibold text-right" style={{ color: '#aaa' }}>{ownSubs.map((s) => (t.has(`plans.${s.plan}`) ? t(`plans.${s.plan}`) : s.name)).join(', ')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#aaa' }}>{t('pkg.group')}</span>
            <span className="text-xs" style={{ color: '#aaa' }}>{rights.group}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#aaa' }}>{t('pkg.oneOnOne')}</span>
            <span className="text-xs" style={{ color: '#aaa' }}>{rights.oneOnOne}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#aaa' }}>{t('pkg.kanka')}</span>
            <span className="text-xs" style={{ color: '#aaa' }}>{rights.kanka}</span>
          </div>
          {prime && !prime.renewCancelledAt && (
            <button
              onClick={cancelPrime}
              disabled={cancelling}
              className="w-full py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#c9c2b8', minHeight: 44 }}
            >
              {cancelling ? '…' : t('pkg.cancelSub')}
            </button>
          )}
          {storeCancelMsg && (
            <div className="flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ color: '#c9c2b8', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                {t('pkg.storeCancel')}
              </p>
              {/* Mobil: önce ahenk:// ile uygulama, 1,5 sn'de açılmazsa mağaza; masaüstü: iki mağaza butonu */}
              {devicePlatform() === 'desktop' ? (
                <div className="flex gap-2">
                  <a href={APP_STORE_URL || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!APP_STORE_URL} className="btn-primary flex-1 justify-center" style={{ minHeight: 44, ...(APP_STORE_URL ? {} : { opacity: 0.5, pointerEvents: 'none' as const }) }}>App Store</a>
                  <a href={PLAY_STORE_URL || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!PLAY_STORE_URL} className="btn-primary flex-1 justify-center" style={{ minHeight: 44, ...(PLAY_STORE_URL ? {} : { opacity: 0.5, pointerEvents: 'none' as const }) }}>Play Store</a>
                </div>
              ) : (
                <button onClick={() => openAppOrStore(devicePlatform() === 'ios' ? 'ios' : 'android')} className="btn-primary w-full justify-center" style={{ minHeight: 44 }}>{t('pkg.openApp')}</button>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-accent text-sm">{error}</p>}

      {/* 2 sütunlu grid: Grup + Baş Başa, Kankamla + İçerde, Prime Paket tam genişlik; dar ekranda tek sütun */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {CARDS.map((card) => {
          const st = stateOf(card.key);
          return (
            <div key={card.key} className={card.key === 'PRIME' ? 'sm:col-span-2' : undefined}>
            <PaketKarti card={card} blocked={st.blocked} onClick={() => { setDetail(card.key); setError(''); window.scrollTo({ top: 0, behavior: 'instant' }); }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
