// Sekme 4 — Paketim: apps/web/app/profil/tabs/TabPaket.tsx. Ödeme: uygulama içi satın alma (App Store / Play Store), mobil fiyat (mobileTL).
import React, { useCallback, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { payInfo, openStoreSubscriptions, restoreStorePurchases, startPurchase } from '@/lib/purchase';
import { openLegal } from '@/lib/links';
import { showAlert } from '@/components/AppAlert';
import { getKankamlaCardState, getPlanCardState, type KankamlaState, type OpenParts, type PlanKey } from '@/lib/planCards';
import { Btn, StdButton, Card, Head, MaintenanceNotice, Serif, SkeletonBlock, T, Glow, ScreenGlow } from '@/components/ui';
import { useWinback } from '@/components/Winback';
import { c, ll, sans, tw } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';

import { upper } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
interface Subscription { id: string; plan: string; name: string; isPrime: boolean; autoRenew: boolean; renewCancelledAt: string | null; storePlatform: string | null }
interface Rights { group: number; oneOnOne: number; kanka: number }
type PlanKeyName = 'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA' | 'PRIME_1M' | 'PRIME_3M' | 'PRIME_6M' | 'PRIME_12M';
interface PlanPriceInfo { plan: PlanKeyName; nametr: string; webTL: number; mobileTL: number; webDiscountTL: number; mobileDiscountTL: number }

type CardKey = 'MASADA' | 'KARSIMDA' | 'KANKAMLA' | 'ICERDE' | 'PRIME';
const PRIME_PLANS = [
  { key: 'PRIME_1M', label: 'card.month1' },
  { key: 'PRIME_3M', label: 'card.month3' },
  { key: 'PRIME_6M', label: 'card.month6' },
  { key: 'PRIME_12M', label: 'card.month12' },
] as const;

// web components/paket/PaketKarti.tsx CARDS ile aynı (metinler çeviri anahtarı, ekranda t()): premium kart, kart bütünüyle paket renginde
// (koyudan ortaya geçişli arka plan, çerçeve, rozet, onay ikonu, buton). Grup (Masada) mavi, Baş Başa (Karşımda) kırmızı, Kankamla mor,
// İçerde yeşil, Premium altın / amber. Rozet: tek seferlik "TEK SEFERLİK" / "ONE-TIME", Premium "ABONELİK" / "SUBSCRIPTION" (durum rozeti yok)
const AMBER = '#e0a526';
const AMBER_GRADIENT = ['#f5d76e', '#e0a526', '#b7811a'];
const CARDS: { key: CardKey; name: string; badge: string; desc: string; gradient: [string, string]; fg: string; nameColor: string; border: string; accent: string; accentFg: string; badgeBg: string[]; badgeFg: string; advantages: string[] }[] = [
  { key: 'MASADA', name: 'plans.MASADA', badge: 'card.oneTime', desc: 'card.descMASADA', gradient: ['#071a3a', '#1d4f9c'], fg: '#ffffff', nameColor: '#ffffff', border: '#3b7dd8', accent: '#3b7dd8', accentFg: '#ffffff', badgeBg: ['#3b7dd8'], badgeFg: '#ffffff',
    advantages: ['card.advMatch', 'card.descMASADA', 'card.advEqual', 'card.advValid'] },
  { key: 'KARSIMDA', name: 'plans.KARSIMDA', badge: 'card.oneTime', desc: 'card.descKARSIMDA', gradient: ['#3d0907', '#a3231b'], fg: '#ffffff', nameColor: '#ffffff', border: '#d6453a', accent: '#d6453a', accentFg: '#ffffff', badgeBg: ['#d6453a'], badgeFg: '#ffffff',
    advantages: ['card.advMatch', 'card.advAge', 'card.descKARSIMDA', 'card.advValid'] },
  { key: 'KANKAMLA', name: 'plans.KANKAMLA', badge: 'card.oneTime', desc: 'card.descKANKAMLA', gradient: ['#1f0a3a', '#5b2a9c'], fg: '#ffffff', nameColor: '#ffffff', border: '#8b5cf6', accent: '#8b5cf6', accentFg: '#ffffff', badgeBg: ['#8b5cf6'], badgeFg: '#ffffff',
    advantages: ['card.advMatch', 'card.advAge', 'card.descKANKAMLA', 'card.advKankaFree', 'card.advValid'] },
  { key: 'ICERDE', name: 'plans.ICERDE', badge: 'card.oneTime', desc: 'card.descICERDE', gradient: ['#06301c', '#1c7a49'], fg: '#ffffff', nameColor: '#ffffff', border: '#2e9e62', accent: '#2e9e62', accentFg: '#ffffff', badgeBg: ['#2e9e62'], badgeFg: '#ffffff',
    advantages: ['card.advMatch', 'card.advAge', 'card.descICERDE', 'card.advValidPlural'] },
  { key: 'PRIME', name: 'plans.PRIME', badge: 'card.subscription', desc: 'card.descPRIME', gradient: ['#3a2804', '#9c7412'], fg: '#ffffff', nameColor: '#f5d76e', border: AMBER, accent: AMBER, accentFg: '#1a1406', badgeBg: AMBER_GRADIENT, badgeFg: '#1a1406',
    advantages: ['card.advPriority', 'card.advMatch', 'card.advAge', 'card.advPrimeMonthly', 'card.advPrimeKeep', 'card.advPrimeRenew'] },
];
// Prime satın alma ekranı abonelik bilgisi (Apple 3.1.2 / Google Play abonelik açıklaması)
const STORE_NAME = Platform.OS === 'ios' ? 'Apple' : 'Google';
const STORE_ACCOUNT = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

// Avantaj maddesi başındaki V (onay) ikonu: paket renginde
function Check({ color }: { color: string }) {
  return <Svg viewBox="0 0 20 20" width={16} height={16} fill={color}><Path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></Svg>;
}
// "PAKET AL" / "ABONE OL" (paket detay ekranı): paket renginde, büyük harf; web BuyButton ile aynı
function BuyButton({ card, label, disabled, onPress }: { card: (typeof CARDS)[number]; label: string; disabled?: boolean; onPress: () => void }) {
  const colors = (card.key === 'PRIME' ? AMBER_GRADIENT : [card.accent, card.accent]) as [string, string, ...string[]];
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      style={({ pressed }) => ({ borderRadius: 999, overflow: 'hidden', opacity: disabled ? 0.5 : pressed ? 0.85 : 1 })}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 52, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}>
        <T w={700} style={{ fontSize: 12, letterSpacing: 1.7, color: card.accentFg }}>{upper(label)}</T>
      </LinearGradient>
    </Pressable>
  );
}
function Arrow({ color }: { color: string }) {
  return <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M9 6l6 6-6 6" /></Svg>;
}

export default function Paketim() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [rights, setRights] = useState<Rights>({ group: 0, oneOnOne: 0, kanka: 0 });
  const [openParts, setOpenParts] = useState<OpenParts>({ group: false, oneOnOne: false });
  const [primeActive, setPrimeActive] = useState(false);
  const [prices, setPrices] = useState<Partial<Record<PlanKeyName, PlanPriceInfo>> | null>(null);
  const [kankamla, setKankamla] = useState<KankamlaState | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  // Davet: kişisel kod / link, geçerli davet sayısı, sonraki ücretsiz masaya kalan davet, türü seçilmemiş ödüller
  const [stats, setStats] = useState<{ totalInvites: number; availableDiscounts: number; referralCode?: number | null; inviteLink?: string | null; validInvites?: number; invitesToNextReward?: number; pendingRewards?: { id: string }[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [rewardMsg, setRewardMsg] = useState('');
  const [rewardOk, setRewardOk] = useState(false);
  const [buying, setBuying] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [detail, setDetail] = useState<CardKey | null>(null);
  const [primePlan, setPrimePlan] = useState<(typeof PRIME_PLANS)[number]['key']>('PRIME_1M');
  const [error, setError] = useState('');
  const [discount, setDiscount] = useState<{ referralDiscount: boolean; inviteeDiscount: boolean } | null>(null);
  const winback = useWinback();

  const loadSubs = useCallback(() => api.get<{ subscriptions: Subscription[]; rights: Rights; hasMasada?: boolean; hasKarsimda?: boolean; primeActive?: boolean }>('/payment/subscriptions')
    .then((r) => {
      setSubs(r.subscriptions ?? []); setRights(r.rights ?? { group: 0, oneOnOne: 0, kanka: 0 });
      setOpenParts({ group: !!r.hasMasada, oneOnOne: !!r.hasKarsimda }); setPrimeActive(!!r.primeActive);
    }).catch(() => {}), []);

  const load = useCallback(() => {
    loadSubs().finally(() => setLoading(false));
    api.get<PlanPriceInfo[]>('/payment/plans').then((l) => setPrices(Object.fromEntries(l.map((p) => [p.plan, p])))).catch(() => {});
    api.get<{ kankamla?: KankamlaState; maintenanceMode?: boolean }>('/auth/me').then((m) => {
      setKankamla(m.kankamla ?? null); setMaintenance(!!m.maintenanceMode);
    }).catch(() => {});
    api.get<{ totalInvites: number; availableDiscounts: number }>('/referral/my-stats').then(setStats).catch(() => {});
    api.get<{ referralDiscount: boolean; inviteeDiscount: boolean }>('/payment/discount-info').then(setDiscount).catch(() => {});
  }, [loadSubs]);
  useFocusEffect(load);
  // Paket detay ekranında Android geri tuşu / hareketi Eşleşme Paneli'ne değil, Paketim'deki paket listesine döner
  useFocusEffect(useCallback(() => {
    if (!detail) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setDetail(null); setError(''); return true; });
    return () => sub.remove();
  }, [detail]));

  function copyCode() {
    if (!stats?.inviteLink) return;
    Clipboard.setStringAsync(stats.inviteLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }
  function shareInvite() {
    if (!stats?.inviteLink) return;
    Share.share({ message: t('loyalty.shareText', { link: stats.inviteLink }) }).catch(() => {});
  }
  // Kazanılan ücretsiz masa hakkının türünü seç: tek seferlik hak olarak Paketim'e eklenir
  async function claimReward(rewardId: string, type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA') {
    setClaiming(true); setRewardMsg('');
    try {
      await api.post(`/referral/rewards/${rewardId}/claim`, { type });
      setRewardMsg(t('loyalty.rewardDone')); setRewardOk(true);
      setStats(await api.get('/referral/my-stats'));
      await loadSubs();
    } catch (e) { setRewardMsg((e as Error).message); setRewardOk(false); } finally { setClaiming(false); }
  }

  async function buy(plan: string) {
    setBuying(plan); setError('');
    try {
      const use = discount?.referralDiscount ? 'REFERRER' : discount?.inviteeDiscount ? 'INVITEE' : undefined;
      await startPurchase(plan, use);
      router.push({ pathname: '/odeme-sonuc', params: { durum: 'basarili' } });
    } catch (e) { setError((e as Error).message); } finally { setBuying(''); }
  }
  // "Satın Alımları Geri Yükle": IAP kapalıyken işlem yapmadan uyarı
  async function restore() {
    setRestoring(true);
    try {
      const r = await restoreStorePurchases();
      if (r === 'unavailable') { showAlert(t('pkg.unavailable')); return; }
      await loadSubs();
      showAlert(r > 0 ? t('pkg.restored') : t('pkg.nothingToRestore'));
    } catch (e) { showAlert((e as Error).message || t('pkg.restoreFailed')); } finally { setRestoring(false); }
  }
  async function cancelPrime() {
    setCancelling(true); setError('');
    try {
      const r = await api.post<{ storeManaged?: string }>('/payment/prime/cancel', {});
      if (r?.storeManaged) await openStoreSubscriptions();
      await loadSubs();
    } catch (e) { setError((e as Error).message); } finally { setCancelling(false); }
  }

  // Mobil fiyat: mağazada tahsil edilen tutar. İndirim teklifi (100 TL ya da davet %10, birlikte değil) varsa indirimli fiyat
  const winOf = (k: string) => (winback.live && winback.running ? winback.state?.plans?.find((p) => p.plan === k) : undefined);
  const hasReferral = !!(discount?.referralDiscount || discount?.inviteeDiscount);
  const priceView = (k: string): { now: number | null; old: number | null } => {
    const w = winOf(k);
    if (w) return { now: w.mobileDiscountedTL, old: w.mobileListTL };
    const p = prices?.[k as PlanKeyName];
    if (!p) return { now: null, old: null };
    return hasReferral ? { now: p.mobileDiscountTL, old: p.mobileTL } : { now: p.mobileTL, old: null };
  };
  const stateOf = (key: CardKey) => {
    if (key === 'PRIME') return primeActive ? { blocked: true, badge: 'plan.badgeActive' as string | null } : { blocked: false, badge: null };
    if (key === 'KANKAMLA') { const k = getKankamlaCardState(kankamla); return { blocked: !k.showButton, badge: k.badge }; }
    const owned = new Set(subs.map((s) => s.plan).filter((p): p is PlanKey => p === 'MASADA' || p === 'KARSIMDA' || p === 'ICERDE'));
    const cs = getPlanCardState(key, owned, openParts);
    return { blocked: !cs.showButton, badge: cs.badge };
  };
  const prime = subs.find((s) => s.isPrime);

  // ─── Detay ekranı ─────────────────────────────────────────────────────────
  if (detail) {
    const card = CARDS.find((x) => x.key === detail)!;
    const isP = detail === 'PRIME';
    const planKey = isP ? primePlan : detail;
    const st = stateOf(detail);
    const busy = st.blocked || buying === planKey || maintenance;
    return (
      <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
        <ScreenGlow />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 32, gap: 16, maxWidth: 896, width: '100%', alignSelf: 'center' }}>
          <KycNoticeCard />
          {maintenance && <MaintenanceNotice />}
          {/* "← Paketler": Paketim'deki paket listesine döner; mevcut pillRed etiket stili (yuvarlak köşeli) */}
          <Btn variant="pillRed" label={t('pkg.backToPackages')} style={{ alignSelf: 'flex-start' }} onPress={() => { setDetail(null); setError(''); }} />
          <Card style={{ gap: 20 }}>
            <T w={700} style={{ fontSize: 28, lineHeight: 34, color: isP ? AMBER : ll.text }}>{t(card.name)}</T>
            {isP && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
                {PRIME_PLANS.map((pl) => {
                  const on = primePlan === pl.key;
                  // 3 aylık plan: yalnız "Tercih Edilen" etiketi; kart diğer süre kartlarıyla aynı düz görünüm (seçili kartta kırmızı çerçeve)
                  const pref = pl.key === 'PRIME_3M';
                  return (
                    <Pressable key={pl.key} onPress={() => setPrimePlan(pl.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                      style={{ width: '48%', minHeight: 56, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? ll.red : 'rgba(255,255,255,0.12)', backgroundColor: on ? 'rgba(214,69,58,0.12)' : 'rgba(255,255,255,0.03)' }}>
                      <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                        <T w={600} style={{ fontSize: 14, color: ll.text }}>{t(pl.label)}</T>
                        <T style={{ fontSize: 12, color: ll.text2, marginTop: 2 }}>{priceView(pl.key).now ?? '—'} ₺</T>
                      </View>
                      {pref && (
                        <View pointerEvents="none" style={{ position: 'absolute', top: -10, left: 0, right: 0, alignItems: 'center' }}>
                          <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.black }}>
                            <T w={800} style={{ fontSize: 9.9, letterSpacing: 0.8, color: '#f4f1ec' }}>{upper(t('pkg.preferred'))}</T>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={{ gap: 10 }}>
              <T w={600} style={{ fontSize: 16, color: ll.text }}>{t('landing.advantages')}</T>
              {card.advantages.map((a) => (
                <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Check color={card.accent} /><T style={{ fontSize: 14, color: ll.text2, flexShrink: 1 }}>{t(a)}</T></View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 12 }}>
              {priceView(planKey).old !== null && <T style={{ fontSize: 18, lineHeight: 24, color: ll.time, textDecorationLine: 'line-through' }}>{priceView(planKey).old} ₺</T>}
              <T w={700} style={{ fontSize: 36, lineHeight: 40, color: ll.text }}>{priceView(planKey).now ?? '—'} ₺</T>
            </View>
            {!!error && <T style={{ fontSize: 14, color: tw.accent }}>{error}</T>}
            <BuyButton card={card} disabled={busy}
              label={buying === planKey ? t('pay.redirecting') : st.blocked ? (st.badge ? t(st.badge) : (isP ? t('pkg.subscribe') : t('pkg.buy'))) : isP ? t('pkg.subscribe') : t('pkg.buy')}
              onPress={() => buy(planKey)} />
            <T style={{ fontSize: 12, lineHeight: 18, color: ll.label, textAlign: 'center' }}>{payInfo()}{isP ? ` ${t('pkg.primeRenewInfo')}` : ''}</T>
            {isP && (
              <View style={{ gap: 10 }}>
                <T w={600} style={{ fontSize: 13, color: ll.text, textAlign: 'center' }}>
                  {t('pkg.primeSummary', { name: t(card.name), period: t(PRIME_PLANS.find((pl) => pl.key === primePlan)?.label ?? 'card.month1'), price: priceView(primePlan).now ?? '—' })}
                </T>
                <T style={{ fontSize: 12, lineHeight: 18, color: ll.label, textAlign: 'center' }}>{t('pkg.primeStoreInfo', { store: STORE_NAME, account: STORE_ACCOUNT })}</T>
                <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 20 }}>
                  <Pressable onPress={() => { openLegal('/kullanim-kosullari').catch(() => {}); }} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <T style={{ fontSize: 12, color: ll.text, textDecorationLine: 'underline' }}>{t('pkg.eula')}</T>
                  </Pressable>
                  <Pressable onPress={() => { openLegal('/gizlilik-politikasi').catch(() => {}); }} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <T style={{ fontSize: 12, color: ll.text, textDecorationLine: 'underline' }}>{t('footer.privacy')}</T>
                  </Pressable>
                </View>
                <StdButton variant="ghost" full label={restoring ? t('pkg.restoring') : t('pkg.restore')} disabled={restoring} onPress={restore} />
              </View>
            )}
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
      <ScreenGlow />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: insets.top + 32, paddingHorizontal: 16, paddingBottom: 32, gap: 20, maxWidth: 896, width: '100%', alignSelf: 'center' }}>
        <Glow />
        <KycNoticeCard />
        {loading ? <SkeletonBlock lines={4} /> : (
          <>
            {maintenance && <MaintenanceNotice />}
            <Card style={{ gap: 12 }}>
              <Head title={t('loyalty.title')} style={{ marginBottom: 0 }} />
              {stats?.referralCode != null && (
                <View style={{ gap: 8 }}>
                  <T style={{ fontSize: 12, color: ll.text2 }}>{t('loyalty.myCode')}</T>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    {/* Tam davet linki; sağdaki kopyala ikonu linkin tamamını panoya kopyalar */}
                    <View style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingLeft: 14 }}>
                      <T w={600} selectable style={{ flex: 1, fontSize: 13, color: ll.text, paddingVertical: 11 }}>{stats.inviteLink}</T>
                      <Pressable onPress={copyCode} accessibilityRole="button" accessibilityLabel={t('loyalty.copy')}
                        style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={ll.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                          <Rect x={9} y={9} width={12} height={12} rx={2} />
                          <Path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                        </Svg>
                      </Pressable>
                      {copied && (
                        <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', right: 6, top: -30, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: ll.bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
                          <T style={{ fontSize: 12, color: ll.text }}>{t('loyalty.copied')}</T>
                        </View>
                      )}
                    </View>
                    <StdButton variant="primary" label={t('loyalty.share')} onPress={shareInvite} />
                  </View>
                  <T w={600} style={{ fontSize: 14, color: ll.text }}>{t('loyalty.toNext', { count: stats.invitesToNextReward ?? 3 })}</T>
                  <T style={{ color: c.tAaa, fontSize: 12, lineHeight: 18 }}>{t('loyalty.rule')}</T>
                  {stats.pendingRewards?.map((r) => (
                    <View key={r.id} style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(46,158,98,0.10)', borderWidth: 1, borderColor: 'rgba(46,158,98,0.4)' }}>
                      <T w={600} style={{ fontSize: 14, color: ll.text }}>{t('loyalty.rewardTitle')}</T>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {([['GROUP', 'loyalty.rewardGroup'], ['ONE_ON_ONE', 'loyalty.rewardOne'], ['KANKA', 'loyalty.rewardKanka']] as const).map(([type, label]) => (
                          <StdButton variant="ghost" key={type} label={t(label)} disabled={claiming} style={{ flex: 1, opacity: claiming ? 0.5 : 1 }} onPress={() => claimReward(r.id, type)} />
                        ))}
                      </View>
                    </View>
                  ))}
                  {!!rewardMsg && <T style={{ fontSize: 12, color: rewardOk ? c.ok : tw.accent }}>{rewardMsg}</T>}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 24, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                <View><T style={{ fontSize: 12, color: ll.text2 }}>{t('loyalty.validInvites')}</T><T w={600} style={{ fontSize: 16, color: ll.text }}>{t('loyalty.people', { count: stats?.validInvites ?? '—' })}</T></View>
                <View><T style={{ fontSize: 12, color: ll.text2 }}>{t('loyalty.discounts')}</T><T w={600} style={{ fontSize: 16, color: ll.text }}>{t('loyalty.pieces', { count: stats?.availableDiscounts ?? '—' })}</T></View>
              </View>
            </Card>

            {/* Aktif paketler ve türüne göre kalan hak adedi: yalnız aktif paketi / aboneliği olana */}
            {subs.length > 0 && (
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <T w={700} style={{ fontSize: 12, color: '#fff', letterSpacing: 0.3 }}>{t('pkg.activeUpper')}</T>
                  <T w={600} style={{ fontSize: 12, color: c.tAaa, flexShrink: 1, textAlign: 'right' }}>{subs.map((s) => s.name).join(', ')}</T>
                </View>
                {([['pkg.group', rights.group], ['pkg.oneOnOne', rights.oneOnOne], ['pkg.kanka', rights.kanka]] as const).map(([label, n]) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 12, color: c.tAaa }}>{t(label)}</T><T style={{ fontSize: 12, color: c.tAaa }}>{n}</T></View>
                ))}
                {!!prime && !prime.renewCancelledAt && (
                  <Pressable onPress={cancelPrime} disabled={cancelling} accessibilityRole="button"
                    style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', opacity: cancelling ? 0.5 : 1 }}>
                    <T w={500} style={{ fontSize: 14, color: ll.text2 }}>{cancelling ? '…' : t('pkg.cancelSub')}</T>
                  </Pressable>
                )}
              </Card>
            )}

            {!!error && <T style={{ fontSize: 14, color: tw.accent }}>{error}</T>}

            <View style={{ gap: 12 }}>
              {CARDS.map((card) => {
                const st = stateOf(card.key);
                const fg = card.fg;
                return (
                  <Pressable key={card.key} onPress={() => { setDetail(card.key); setError(''); }} accessibilityRole="button" accessibilityLabel={`${t(card.name)}, ${t(card.desc)}`}
                    style={({ pressed }) => ({ borderRadius: 18, borderWidth: 1, borderColor: card.border, overflow: 'hidden', opacity: st.blocked ? 0.55 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
                    <LinearGradient colors={card.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{ paddingVertical: 18, paddingHorizontal: 20, minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {/* Tipografi: web PaketKarti / landing "Premium Paket Abonelik Detayları" başlığıyla aynı (serif, normal ağırlık, 24/32); açıklama 14 sans */}
                          <Serif style={{ fontSize: 24, lineHeight: 32, color: card.nameColor }}>{t(card.name)}</Serif>
                          <LinearGradient colors={(card.badgeBg.length > 1 ? card.badgeBg : [card.badgeBg[0], card.badgeBg[0]]) as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <T w={800} style={{ fontSize: 9.9, letterSpacing: 0.8, color: card.badgeFg }}>{upper(t(card.badge))}</T>
                          </LinearGradient>
                        </View>
                        <T numberOfLines={1} style={{ fontSize: 14, color: fg, opacity: 0.9 }}>{t(card.desc)}</T>
                      </View>
                      <Arrow color={card.accent} />
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
