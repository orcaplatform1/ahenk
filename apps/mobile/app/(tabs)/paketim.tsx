// Sekme 4 — Paketim: apps/web/app/profil/tabs/TabPaket.tsx. Ödeme: uygulama içi satın alma (App Store / Play Store), mobil fiyat (mobileTL).
import React, { useCallback, useState } from 'react';
import { BackHandler, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { PAY_INFO, openStoreSubscriptions, startPurchase } from '@/lib/purchase';
import { getKankamlaCardState, getPlanCardState, type KankamlaState, type OpenParts, type PlanKey } from '@/lib/planCards';
import { Btn, BtnPrimary, Card, Head, MaintenanceNotice, SkeletonBlock, T, Glow, ScreenGlow } from '@/components/ui';
import { useWinback } from '@/components/Winback';
import { c, ll, sans, tw } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';

interface Subscription { id: string; plan: string; name: string; isPrime: boolean; autoRenew: boolean; renewCancelledAt: string | null; storePlatform: string | null }
interface Rights { group: number; oneOnOne: number; kanka: number }
type PlanKeyName = 'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA' | 'PRIME_1M' | 'PRIME_3M' | 'PRIME_6M' | 'PRIME_12M';
interface PlanPriceInfo { plan: PlanKeyName; nametr: string; webTL: number; mobileTL: number; webDiscountTL: number; mobileDiscountTL: number }

type CardKey = 'MASADA' | 'KARSIMDA' | 'KANKAMLA' | 'ICERDE' | 'PRIME';
const PRIME_PLANS = [
  { key: 'PRIME_1M', label: '1 Aylık' },
  { key: 'PRIME_3M', label: '3 Aylık' },
  { key: 'PRIME_6M', label: '6 Aylık' },
  { key: 'PRIME_12M', label: '12 Aylık' },
] as const;

// web components/paket/PaketKarti.tsx CARDS ile aynı: premium kart — aynı renk ailesinde koyudan ortaya geçişli arka plan.
// Grup yeşil, Baş Başa kırmızı, Kankamla mavi, İçerde altın; Prime siyahtan koyu antrasite, kırmızı (palet) çerçeve; rozet, ad ve ok şarap kırmızısı (#7A1F2B).
// badgeBg / badgeFg: Tinder GOLD tarzı hap rozet (kartın renk tonuna uyumlu; İçerde ve Prime altın)
const GOLD = ['#f5d76e', '#c9a227', '#a8861a'];
const CARDS: { key: CardKey; name: string; badge: string; desc: string; gradient: [string, string]; fg: string; nameColor: string; border?: string; badgeBg: string[]; badgeFg: string; arrowColor?: string; advantages: string[] }[] = [
  { key: 'MASADA', name: 'Grup Paketi', badge: 'Tek Seferlik', desc: "1 Grup Masası'nda buluşma hakkı", gradient: ['#06301c', '#1c7a49'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: ['#2e9e62'], badgeFg: '#ffffff',
    advantages: ['Kişilik testi ile sana uyumlu insanlarla eşleşme', "1 Grup Masası'nda buluşma hakkı", 'Masada erkek ve kadın eşit sayı', 'Bu hak masada sen buluşana kadar geçerli'] },
  { key: 'KARSIMDA', name: 'Baş Başa Paketi', badge: 'Tek Seferlik', desc: "1 Baş Başa Masası'nda buluşma hakkı", gradient: ['#3d0907', '#a3231b'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: ['#d6453a'], badgeFg: '#ffffff',
    advantages: ['Kişilik testi ile sana uyumlu insanlarla eşleşme', 'Daha derin çalışan algoritma ile yaş uyumu', "1 Baş Başa Masası'nda buluşma hakkı", 'Bu hak masada sen buluşana kadar geçerli'] },
  { key: 'KANKAMLA', name: 'Kankamla Paketi', badge: 'Tek Seferlik', desc: "1 Kankamla Masası'nda buluşma hakkı", gradient: ['#071a3a', '#1d4f9c'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: ['#3b7dd8'], badgeFg: '#ffffff',
    advantages: ['Kişilik testi ile sana uyumlu insanlarla eşleşme', 'Daha derin çalışan algoritma ile yaş uyumu', "1 Kankamla Masası'nda buluşma hakkı", 'Kankanı davet ederek ücretsiz çağırma', 'Bu hak masada sen buluşana kadar geçerli'] },
  { key: 'ICERDE', name: 'İçerde Paketi', badge: 'Tek Seferlik', desc: "1 Grup Masası + 1 Baş Başa Masası'nda buluşma hakkı", gradient: ['#3a2804', '#9c7412'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: GOLD, badgeFg: '#1a1406',
    advantages: ['Kişilik testi ile sana uyumlu insanlarla eşleşme', 'Daha derin çalışan algoritma ile yaş uyumu', "1 Grup Masası + 1 Baş Başa Masası'nda buluşma hakkı", 'Bu haklar masada sen buluşana kadar geçerli'] },
  { key: 'PRIME', name: 'Prime Paket', badge: 'Abonelik', desc: 'Her ay 1 Grup + 1 Baş Başa + 1 Kankamla Masası', gradient: ['#000000', '#2b2d31'], fg: '#f4f1ec', nameColor: '#7A1F2B', border: ll.red, badgeBg: ['#7A1F2B'], badgeFg: '#f4f1ec', arrowColor: '#7A1F2B',
    advantages: ['Her masada öncelikli eşleşme hakkı', 'Kişilik testi ile sana uyumlu insanlarla eşleşme', 'Daha derin çalışan algoritma ile yaş uyumu', "Her ay 1 Grup Masası + 1 Baş Başa Masası + 1 Kankamla Masası'nda buluşma hakkı", 'Aboneliği iptal etsen dahi, bu haklar masada sen buluşana kadar geçerli', 'Otomatik yenilenir, istediğin zaman iptal edebilirsin'] },
];
const PRIME_RENEW_INFO = 'İptal etmediğin sürece aboneliğin seçtiğin süre için aynı fiyatla otomatik olarak yenilenir.';

function Check() {
  return <Svg viewBox="0 0 20 20" width={16} height={16} fill={c.red}><Path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></Svg>;
}
function Arrow({ color }: { color: string }) {
  return <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M9 6l6 6-6 6" /></Svg>;
}

export default function Paketim() {
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
  const [stats, setStats] = useState<{ totalInvites: number; availableDiscounts: number } | null>(null);
  const [refPhone, setRefPhone] = useState('');
  const [refSending, setRefSending] = useState(false);
  const [refMsg, setRefMsg] = useState('');
  const [buying, setBuying] = useState('');
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

  async function sendReferral() {
    if (!refPhone || refPhone.length !== 10 || !refPhone.startsWith('5')) { setRefMsg('Geçerli bir numara girin (5 ile başlayan 10 hane).'); return; }
    setRefSending(true); setRefMsg('');
    try {
      await api.post('/referral/invite', { phoneNumber: `+90${refPhone}` });
      setRefMsg('Davet başarıyla gönderildi!'); setRefPhone('');
      setStats(await api.get('/referral/my-stats'));
    } catch (e) { setRefMsg((e as Error).message || 'Gönderilemedi.'); } finally { setRefSending(false); }
  }
  async function buy(plan: string) {
    setBuying(plan); setError('');
    try {
      const use = discount?.referralDiscount ? 'REFERRER' : discount?.inviteeDiscount ? 'INVITEE' : undefined;
      await startPurchase(plan, use);
      router.push({ pathname: '/odeme-sonuc', params: { durum: 'basarili' } });
    } catch (e) { setError((e as Error).message); } finally { setBuying(''); }
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
    if (key === 'PRIME') return primeActive ? { blocked: true, badge: 'Aktif Paketiniz' as string | null } : { blocked: false, badge: null };
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
          <Btn variant="pillRed" label="← Paketler" style={{ alignSelf: 'flex-start' }} onPress={() => { setDetail(null); setError(''); }} />
          <Card style={{ gap: 20 }}>
            <T w={700} style={{ fontSize: 28, lineHeight: 34, color: isP ? '#e8c84a' : ll.text }}>{card.name}</T>
            {isP && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
                {PRIME_PLANS.map((pl) => {
                  const on = primePlan === pl.key;
                  // 3 aylık plan: "Tercih Edilen" etiketi, altın çerçeve ve hafif altın geçişli arka plan (web TabPaket ile aynı)
                  const pref = pl.key === 'PRIME_3M';
                  return (
                    <Pressable key={pl.key} onPress={() => setPrimePlan(pl.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                      style={{ width: '48%', minHeight: 56, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? ll.red : pref ? '#c9a227' : 'rgba(255,255,255,0.12)', backgroundColor: pref ? 'transparent' : on ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.03)' }}>
                      {pref && <LinearGradient colors={['rgba(201,162,39,0.22)', 'rgba(201,162,39,0.06)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 11 }} />}
                      <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                        <T w={600} style={{ fontSize: 14, color: ll.text }}>{pl.label}</T>
                        <T style={{ fontSize: 12, color: ll.text2, marginTop: 2 }}>{priceView(pl.key).now ?? '—'} ₺</T>
                      </View>
                      {pref && (
                        <View pointerEvents="none" style={{ position: 'absolute', top: -10, left: 0, right: 0, alignItems: 'center' }}>
                          <LinearGradient colors={GOLD as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <T w={800} style={{ fontSize: 9.9, letterSpacing: 0.8, color: '#1a1406' }}>TERCİH EDİLEN</T>
                          </LinearGradient>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={{ gap: 10 }}>
              <T w={600} style={{ fontSize: 16, color: ll.text }}>Avantajlar</T>
              {card.advantages.map((a) => (
                <View key={a} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Check /><T style={{ fontSize: 14, color: ll.text2, flexShrink: 1 }}>{a}</T></View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              {priceView(planKey).old !== null && <T style={{ fontSize: 18, lineHeight: 24, color: ll.time, textDecorationLine: 'line-through' }}>{priceView(planKey).old} ₺</T>}
              <T w={700} style={{ fontSize: 36, lineHeight: 40, color: ll.text }}>{priceView(planKey).now ?? '—'} ₺</T>
            </View>
            {!!error && <T style={{ fontSize: 14, color: tw.accent }}>{error}</T>}
            <BtnPrimary full disabled={busy} style={[{ minHeight: 52 }, busy && { opacity: 0.5 }]}
              label={buying === planKey ? 'Yönlendiriliyor…' : st.blocked ? (st.badge ?? (isP ? 'Abone Ol' : 'Paket Al')) : isP ? 'Abone Ol' : 'Paket Al'}
              onPress={() => buy(planKey)} />
            <T style={{ fontSize: 12, lineHeight: 18, color: ll.label, textAlign: 'center' }}>{PAY_INFO}{isP ? ` ${PRIME_RENEW_INFO}` : ''}</T>
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
              <Head title="Sadakat Programı" style={{ marginBottom: 0 }} />
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14 }}>
                  <T style={{ color: c.t555, fontSize: 14, marginRight: 4 }}>+90</T>
                  <TextInput keyboardType="number-pad" textContentType="telephoneNumber" keyboardAppearance="dark" placeholder="5XX XXX XX XX" placeholderTextColor={tw.muted} value={refPhone}
                    onChangeText={(t) => setRefPhone(t.replace(/\D/g, '').slice(0, 10))} style={{ flex: 1, fontSize: 14, color: tw.text, paddingVertical: 11, fontFamily: sans(400) }} />
                </View>
                <BtnPrimary label={refSending ? '…' : 'Davet Gönder'} full disabled={refSending} style={refSending ? { opacity: 0.5 } : undefined} onPress={sendReferral} />
                <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <T style={{ color: c.tAaa, fontSize: 12, lineHeight: 18 }}>
                    Davet ettiğin arkadaşın herhangi bir paket aldığında veya abone olduğunda sana %10 indirim hakkı tanımlanır. Her indirim hakkı yalnızca bir paket satın alımında geçerlidir, toplu kullanılamaz ve devredilemez.
                  </T>
                </View>
              </View>
              {!!refMsg && <T style={{ fontSize: 12, color: refMsg.includes('başarı') ? c.ok : tw.accent }}>{refMsg}</T>}
              <View style={{ flexDirection: 'row', gap: 24, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                <View><T style={{ fontSize: 12, color: ll.text2 }}>Davetli Arkadaş</T><T w={600} style={{ fontSize: 16, color: ll.text }}>{stats?.totalInvites ?? '—'} kişi</T></View>
                <View><T style={{ fontSize: 12, color: ll.text2 }}>Toplam %10 İndirim Hakkı</T><T w={600} style={{ fontSize: 16, color: ll.text }}>{stats?.availableDiscounts ?? '—'} Adet</T></View>
              </View>
            </Card>

            {/* Aktif paketler ve türüne göre kalan hak adedi: yalnız aktif paketi / aboneliği olana */}
            {subs.length > 0 && (
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <T w={700} style={{ fontSize: 12, color: '#fff', letterSpacing: 0.3 }}>AKTİF PAKET</T>
                  <T w={600} style={{ fontSize: 12, color: c.tAaa, flexShrink: 1, textAlign: 'right' }}>{subs.map((s) => s.name).join(', ')}</T>
                </View>
                {([['Grup', rights.group], ['Baş Başa', rights.oneOnOne], ['Kankamla', rights.kanka]] as const).map(([label, n]) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 12, color: c.tAaa }}>{label}</T><T style={{ fontSize: 12, color: c.tAaa }}>{n}</T></View>
                ))}
                {!!prime && !prime.renewCancelledAt && (
                  <Pressable onPress={cancelPrime} disabled={cancelling} accessibilityRole="button"
                    style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', opacity: cancelling ? 0.5 : 1 }}>
                    <T w={500} style={{ fontSize: 14, color: ll.text2 }}>{cancelling ? '…' : 'Aboneliği İptal Et'}</T>
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
                  <Pressable key={card.key} onPress={() => { setDetail(card.key); setError(''); }} accessibilityRole="button" accessibilityLabel={`${card.name}, ${card.desc}`}
                    style={({ pressed }) => ({ borderRadius: 18, borderWidth: 1, borderColor: card.border ?? 'rgba(255,255,255,0.08)', overflow: 'hidden', opacity: st.blocked ? 0.55 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
                    <LinearGradient colors={card.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{ paddingVertical: 18, paddingHorizontal: 20, minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <T w={800} style={{ fontSize: 20, lineHeight: 26, color: card.nameColor }}>{card.name}</T>
                          <LinearGradient colors={(card.badgeBg.length > 1 ? card.badgeBg : [card.badgeBg[0], card.badgeBg[0]]) as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <T w={800} style={{ fontSize: 9.9, letterSpacing: 0.8, color: card.badgeFg }}>{(st.badge ?? card.badge).toLocaleUpperCase('tr-TR')}</T>
                          </LinearGradient>
                        </View>
                        <T numberOfLines={1} style={{ fontSize: 14, color: fg, opacity: 0.9 }}>{card.desc}</T>
                      </View>
                      <Arrow color={card.arrowColor ?? card.border ?? fg} />
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
