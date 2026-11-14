'use client';

import { useEffect, useState } from 'react';
import { usePlanPrices, type PlanKeyName } from '@/components/PlanPrice';
import { api } from '@/lib/api';
import { startCheckout } from '@/lib/checkout';
import { clockMS, useWinback } from '@/components/winback/useWinback';
import { getKankamlaCardState, getPlanCardState, type KankamlaState, type OpenParts, type PlanKey } from '@/lib/planCards';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import MaintenanceNotice from '@/components/MaintenanceNotice';

// Tek seferlik paket: kalan grup hakkı + döngüler (her kısım 4 döngü geçerli), başbaşa hakkı usedAt ile
interface Subscription {
  id: string;
  plan: string;
  usedAt?: string | null;
  groupRights: number;
  groupCycles: number;
  oneOnOneCycles: number;
  groupTableFormed?: boolean;
  oneOnOneTableFormed?: boolean;
  kankaRights?: number;
  kankaCycles?: number;
}

type RefundOption = 'GROUP' | 'ONEONE' | 'FULL' | 'KANKA';
const REFUND_LABEL: Record<RefundOption, string> = {
  FULL: 'İade Talep Et (tüm paket)',
  GROUP: 'Grup Masası İadesi Talep Et',
  ONEONE: 'Başbaşa Masası İadesi Talep Et',
  KANKA: 'Kankamla İadesi Talep Et',
};

const PLANS = [
  {
    key: 'MASADA',
    name: 'Masada',
    desc: '2 grup masası hakkı · 4 döngü geçerli',
    featured: false,
    bgImage: '/plan-masada.webp',
    features: ['2 Grup Masası Hakkı', 'Doğrulanmış Profiller', 'OCEAN Kişilik Uyumu', 'Yapay Zeka Masa Raporu', 'Masa Garantili (Ücret İade)'],
  },
  {
    key: 'KARSIMDA',
    name: 'Karşımda',
    desc: '1 başbaşa masası hakkı · 4 döngü geçerli',
    featured: false,
    bgImage: '/plan-karsimda.webp',
    features: ['Tek Seferlik Baş Başa Masa', 'Doğrulanmış Profiller', 'OCEAN + Yaş Uyumu', 'Yapay Zeka Masa Raporu', 'Masa Garantili (Ücret İade)'],
  },
  {
    key: 'ICERDE',
    name: 'İçerde',
    desc: '2 grup + 1 başbaşa masası hakkı · tek seferlik',
    featured: true,
    bgImage: '/plan-icerde.webp',
    features: ['2 Grup Masası + 1 Baş Başa Masa', 'Tüm Özellikler Dahil'],
  },
  {
    key: 'KANKAMLA',
    name: 'Kankamla',
    desc: '2 Kankamla masası hakkı · kankan ücretsiz katılır',
    featured: false,
    // Kankamla için ayrı görsel eklenene kadar grup masası görseli
    bgImage: '/plan-masada.webp',
    features: ['2 Kankamla Masası Hakkı', 'Kankan Ücretsiz Katılır', '4 Kişilik Masa (2E + 2K)', 'Doğrulanmış Profiller', 'Masa Garantili (Ücret İade)'],
  },
];

const PLAN_LABEL: Record<string, string> = {
  MASADA: 'Masada',
  KARSIMDA: 'Karşımda',
  ICERDE: 'İçerde',
  KANKAMLA: 'Kankamla',
};

const PLATFORM_LABEL: Record<string, string> = {
  WEB: 'Web',
  GOOGLE: 'Google Play',
  APPLE: 'App Store',
};

interface DiscountInfo { referralDiscount: boolean; referralCount: number; inviteeDiscount: boolean; }

interface Props { kycApproved: boolean; onGoKyc: () => void; maintenanceMode?: boolean; }

export function TabPaket({ kycApproved, onGoKyc, maintenanceMode = false }: Props) {
  const prices = usePlanPrices();
  const winback = useWinback();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [refundOptions, setRefundOptions] = useState<RefundOption[]>([]);
  const [packageCycles, setPackageCycles] = useState(4);
  const [ownedPlans, setOwnedPlans] = useState<Set<PlanKey>>(new Set());
  const [openParts, setOpenParts] = useState<OpenParts>({ group: false, oneOnOne: false });
  const [kankamla, setKankamla] = useState<KankamlaState | null>(null);
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
    api.get<{ subscriptions: Subscription[]; hasMasada?: boolean; hasKarsimda?: boolean; refundOptions?: RefundOption[]; packageCycles?: number }>('/payment/subscriptions')
      .then((d) => {
        const subs = d.subscriptions ?? [];
        setSubscriptions(subs);
        setOwnedPlans(new Set(subs.map(s => s.plan as PlanKey)));
        setOpenParts({ group: !!d.hasMasada, oneOnOne: !!d.hasKarsimda });
        setRefundOptions(d.refundOptions ?? []);
        if (d.packageCycles) setPackageCycles(d.packageCycles);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));

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

  async function handleBuy(plan: string) {
    setBuying(plan);
    setError('');
    try {
      const useDiscount = discountInfo?.referralDiscount ? 'REFERRER' : discountInfo?.inviteeDiscount ? 'INVITEE' : undefined;
      await startCheckout(plan, PLANS.find((p) => p.key === plan)?.name ?? plan, useDiscount);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuying('');
    }
  }

  if (loading) return <SkeletonBlock lines={4} />;

  // İçerde'nin iki kısmı da iade edilebiliyorsa tek "tüm paket" butonu
  const shownRefunds: RefundOption[] = refundOptions.includes('FULL')
    ? ['FULL']
    : refundOptions.filter((o) => o !== 'FULL');

  const hasReferralDiscount = !!(discountInfo?.referralDiscount);

  // Fiyatlar backend'den (SUPERADMIN fiyat sayfası); indirimli fiyat da backend'de hesaplanır
  const priceOf = (key: string) => prices?.[key as PlanKeyName];
  // Geri kazanım indirimi: süre boyunca seçili paketlerde indirimli fiyat + sayaç (ödemede otomatik uygulanır)
  const winbackOf = (key: string) => (winback.live && winback.running ? winback.state?.plans?.find((p) => p.plan === key) : undefined);

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

      {/* Aktif paketler: kalan haklar ve döngüler; iade (süresi dolmuş paket için de) */}
      {subscriptions.length > 0 && (
        <div className="ll-card flex flex-col gap-3">
          {subscriptions.map((sub) => {
            const hasGroup = sub.plan === 'MASADA' || sub.plan === 'ICERDE';
            const hasOneOnOne = sub.plan === 'KARSIMDA' || sub.plan === 'ICERDE';
            const isKankamla = sub.plan === 'KANKAMLA';
            const totalGroup = 2;
            return (
              <div key={sub.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wide">Aktif Paket</span>
                  <span className="text-xs font-semibold" style={{ color: '#aaa' }}>{PLAN_LABEL[sub.plan] ?? sub.plan}</span>
                </div>
                {hasGroup && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#aaa' }}>Grup masası hakkı</span>
                    <span className="text-xs" style={{ color: '#aaa' }}>
                      {sub.groupCycles >= packageCycles ? 'Süresi doldu' : `${sub.groupRights}/${totalGroup} kaldı · ${sub.groupCycles}/${packageCycles} döngü`}
                    </span>
                  </div>
                )}
                {isKankamla && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#aaa' }}>Kankamla masası hakkı</span>
                    <span className="text-xs" style={{ color: '#aaa' }}>
                      {(sub.kankaCycles ?? 0) >= packageCycles ? 'Süresi doldu' : `${sub.kankaRights ?? 0}/2 kaldı · ${sub.kankaCycles ?? 0}/${packageCycles} döngü`}
                    </span>
                  </div>
                )}
                {hasOneOnOne && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#aaa' }}>Başbaşa masası hakkı</span>
                    <span className="text-xs" style={{ color: '#aaa' }}>
                      {sub.usedAt ? 'Kullanıldı' : sub.oneOnOneCycles >= packageCycles ? 'Süresi doldu' : `1/1 kaldı · ${sub.oneOnOneCycles}/${packageCycles} döngü`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {/* Not: Sadakat Programı notuyla aynı kutu, yazı rengi ve boyu */}
          <div className="mt-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ color: '#aaa', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              Paketler tek seferliktir; her masa hakkı {packageCycles} döngü (yaklaşık 1 ay) geçerlidir. Bu süre içinde hiç masa kurulamazsa
              tam iade talep edebilirsin. Bir masa kurulduysa kalan hakkın olsa da hizmet alınmış sayılır ve iade yapılmaz.
              İade talepleri 5 iş günü içinde değerlendirilir.
            </p>
          </div>
          {refundMsg ? (
            <p className={`text-sm ${refundMsg.ok ? 'text-green-400' : 'text-accent'}`}>{refundMsg.text}</p>
          ) : shownRefunds.length > 0 ? (
            shownRefunds.map((opt) => (
              <button
                key={opt}
                disabled={refundLoading}
                onClick={() => handleRefund(opt)}
                className="w-full py-2 rounded-xl text-sm font-medium border transition-colors"
                style={{ border: '1px solid rgba(192,57,43,0.6)', color: '#e74c3c', background: 'rgba(192,57,43,0.06)' }}
              >
                {refundLoading ? 'Gönderiliyor…' : REFUND_LABEL[opt]}
              </button>
            ))
          ) : (
            <button
              disabled
              className="w-full py-2 rounded-xl text-sm font-medium border"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}
            >
              İade Talep Et
            </button>
          )}
        </div>
      )}

      {error && <p className="text-accent text-sm">{error}</p>}

      <style>{`
        @keyframes _pCardGoldBorder{to{transform:rotate(360deg)}}
        .p-feat-wrap{position:relative;border-radius:18px;padding:2px;overflow:hidden;}
        .p-feat-wrap::before{content:'';position:absolute;width:300%;height:300%;top:-100%;left:-100%;background:conic-gradient(from 0deg,transparent 68%,#c9a227 78%,#e8c84a 84%,transparent 93%);animation:_pCardGoldBorder 3s linear infinite;z-index:0;}
        .p-feat-wrap::after{content:'';position:absolute;inset:2px;border-radius:16px;background:#0c0909;z-index:0;}
        .p-feat-inner{position:relative;z-index:1;border-radius:16px;overflow:hidden;display:flex;flex-direction:row;flex:1;}
      `}</style>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => {
          const isKankamlaCard = plan.key === 'KANKAMLA';
          const cs = isKankamlaCard
            ? getKankamlaCardState(kankamla)
            : { ...getPlanCardState(plan.key, ownedPlans, openParts), needsKanka: false };
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
                {winbackOf(plan.key) ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 2 }}>
                      <span className="font-bold text-[#f5f5f5]" style={{ fontSize: '1.5rem' }}>{winbackOf(plan.key)!.discountedTL}</span>
                      <span style={{ color: '#888', fontSize: '0.85rem', marginBottom: 1 }}>₺</span>
                      <span style={{ color: '#555', fontSize: '0.75rem', textDecoration: 'line-through', marginBottom: 1 }}>{winbackOf(plan.key)!.listTL}₺</span>
                    </div>
                    <p style={{ color: '#e8a27a', fontSize: '0.68rem', marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>İndirim bitimine {clockMS(winback.remaining)}</p>
                  </>
                ) : hasReferralDiscount ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 2 }}>
                      <span className="font-bold text-[#f5f5f5]" style={{ fontSize: '1.5rem' }}>{priceOf(plan.key)?.webDiscountTL ?? '—'}</span>
                      <span style={{ color: '#888', fontSize: '0.85rem', marginBottom: 1 }}>₺</span>
                      <span style={{ color: '#555', fontSize: '0.75rem', textDecoration: 'line-through', marginBottom: 1 }}>{priceOf(plan.key)?.webTL ?? '—'}₺</span>
                    </div>
                    <p style={{ color: '#4ade80', fontSize: '0.68rem', marginBottom: 2 }}>Kalan İndirim Hakkı: {discountInfo!.referralCount}</p>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 2 }}>
                    <span className="font-bold text-[#f5f5f5]" style={{ fontSize: '1.5rem' }}>{priceOf(plan.key)?.webTL ?? '—'}</span>
                    <span style={{ color: '#888', fontSize: '0.85rem', marginBottom: 1 }}>₺</span>
                  </div>
                )}
                <p style={{ color: '#f5f5f5', fontSize: '0.68rem' }}>{plan.desc}</p>
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
                  // Kankamla: kanka seçmeden satın alınamaz → önce Profilim'de kanka daveti
                  onClick={() => !kycApproved ? onGoKyc() : cs.needsKanka ? (window.location.href = '/profil?tab=profil') : handleBuy(plan.key)}
                  disabled={buying === plan.key || maintenanceMode}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  {buying === plan.key ? 'Yönlendiriliyor…' : !kycApproved ? 'Paket Seç' : cs.needsKanka ? 'Önce Kanka Davet Et' : 'Paketi Al'}
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
