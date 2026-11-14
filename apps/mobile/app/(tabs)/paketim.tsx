// Sekme 4 — Paketim: apps/web/app/profil/tabs/TabPaket.tsx. Ödeme: uygulama içi satın alma (App Store / Play Store), mobil fiyat (mobileTL).
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/lib/api';
import { PAY_INFO, openStoreSubscriptions, startPurchase } from '@/lib/purchase';
import { getKankamlaCardState, getPlanCardState, type KankamlaState, type OpenParts, type PlanKey } from '@/lib/planCards';
import { BtnPrimary, Card, Head, MaintenanceNotice, SkeletonBlock, T, Glow, ScreenGlow } from '@/components/ui';
import { c, ll, sans, tw } from '@/theme/theme';

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

// web TabPaket CARDS ile aynı: tam genişlik tek renk kart; Prime altın tonunda, diğerleri tema renklerinden
const CARDS: { key: CardKey; name: string; badge: string; desc: string; color: string; advantages: string[] }[] = [
  { key: 'MASADA', name: 'Grup', badge: 'Tek Seferlik', desc: '1 Grup buluşması hakkı', color: '#d6453a', advantages: ['1 Grup buluşması hakkı', 'Hak kullanılana kadar geçerli'] },
  { key: 'KARSIMDA', name: 'Başbaşa', badge: 'Tek Seferlik', desc: '1 Başbaşa buluşması hakkı', color: '#c8743c', advantages: ['1 Başbaşa buluşması hakkı', 'Hak kullanılana kadar geçerli'] },
  { key: 'KANKAMLA', name: 'Kankamla', badge: 'Tek Seferlik', desc: '1 Kankamla buluşması hakkı', color: '#8f887f', advantages: ['1 Kankamla buluşması hakkı', 'Arkadaşın ücretsiz katılır', 'Hak kullanılana kadar geçerli'] },
  { key: 'ICERDE', name: 'İçerde', badge: 'Tek Seferlik', desc: '1 Grup + 1 Başbaşa buluşması hakkı', color: '#c0392b', advantages: ['1 Grup buluşması hakkı', '1 Başbaşa buluşması hakkı', 'Haklar kullanılana kadar geçerli'] },
  { key: 'PRIME', name: 'Prime', badge: 'Abonelik', desc: 'Her 30 günde 1 Grup + 1 Başbaşa + 1 Kankamla', color: '#c9a227', advantages: ['Her 30 günde 1 Grup buluşması hakkı', 'Her 30 günde 1 Başbaşa buluşması hakkı', 'Her 30 günde 1 Kankamla buluşması hakkı', 'Otomatik yenilenir, istediğin zaman iptal edebilirsin'] },
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
  const [kycApproved, setKycApproved] = useState(false);
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

  const loadSubs = useCallback(() => api.get<{ subscriptions: Subscription[]; rights: Rights; hasMasada?: boolean; hasKarsimda?: boolean; primeActive?: boolean }>('/payment/subscriptions')
    .then((r) => {
      setSubs(r.subscriptions ?? []); setRights(r.rights ?? { group: 0, oneOnOne: 0, kanka: 0 });
      setOpenParts({ group: !!r.hasMasada, oneOnOne: !!r.hasKarsimda }); setPrimeActive(!!r.primeActive);
    }).catch(() => {}), []);

  const load = useCallback(() => {
    loadSubs().finally(() => setLoading(false));
    api.get<PlanPriceInfo[]>('/payment/plans').then((l) => setPrices(Object.fromEntries(l.map((p) => [p.plan, p])))).catch(() => {});
    api.get<{ kankamla?: KankamlaState; kyc?: { status: string }; maintenanceMode?: boolean }>('/auth/me').then((m) => {
      setKankamla(m.kankamla ?? null); setKycApproved(m.kyc?.status === 'APPROVED'); setMaintenance(!!m.maintenanceMode);
    }).catch(() => {});
    api.get<{ totalInvites: number; availableDiscounts: number }>('/referral/my-stats').then(setStats).catch(() => {});
  }, [loadSubs]);
  useFocusEffect(load);

  async function sendReferral() {
    if (!refPhone || refPhone.length !== 10 || !refPhone.startsWith('5')) { setRefMsg('Geçerli bir numara girin (5 ile başlayan 10 hane).'); return; }
    setRefSending(true); setRefMsg('');
    try {
      await api.post('/referral/invite', { phoneNumber: `+90${refPhone}` });
      setRefMsg('Davet başarıyla gönderildi!'); setRefPhone('');
      setStats(await api.get('/referral/my-stats'));
    } catch (e) { setRefMsg((e as Error).message || 'Gönderilemedi.'); } finally { setRefSending(false); }
  }
  // Ödeme başarılı olur olmaz: KYC onaylı değilse hemen KYC ekranı
  async function buy(plan: string) {
    setBuying(plan); setError('');
    try {
      await startPurchase(plan);
      if (!kycApproved) router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'kyc' } });
      else router.push({ pathname: '/odeme-sonuc', params: { durum: 'basarili' } });
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

  // Mobil fiyat: mağazada tahsil edilen tutar (mobileTL)
  const priceOf = (k: string) => prices?.[k as PlanKeyName]?.mobileTL ?? null;
  const stateOf = (key: CardKey) => {
    if (key === 'PRIME') return primeActive ? { blocked: true, badge: 'Aktif Paketiniz' as string | null, needsKanka: false } : { blocked: false, badge: null, needsKanka: false };
    if (key === 'KANKAMLA') { const k = getKankamlaCardState(kankamla); return { blocked: !k.showButton, badge: k.badge, needsKanka: k.needsKanka }; }
    const owned = new Set(subs.map((s) => s.plan).filter((p): p is PlanKey => p === 'MASADA' || p === 'KARSIMDA' || p === 'ICERDE'));
    const cs = getPlanCardState(key, owned, openParts);
    return { blocked: !cs.showButton, badge: cs.badge, needsKanka: false };
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
          {maintenance && <MaintenanceNotice />}
          <Pressable onPress={() => { setDetail(null); setError(''); }} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <T style={{ fontSize: 14, color: ll.label }}>← Paketler</T>
          </Pressable>
          <Card style={{ gap: 20 }}>
            <T w={700} style={{ fontSize: 28, lineHeight: 34, color: isP ? '#e8c84a' : ll.text }}>{card.name}</T>
            {isP && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PRIME_PLANS.map((pl) => {
                  const on = primePlan === pl.key;
                  return (
                    <Pressable key={pl.key} onPress={() => setPrimePlan(pl.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                      style={{ width: '48%', minHeight: 56, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: on ? 2 : 1, borderColor: on ? '#c9a227' : 'rgba(255,255,255,0.12)', backgroundColor: on ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.03)' }}>
                      <T w={600} style={{ fontSize: 14, color: ll.text }}>{pl.label}</T>
                      <T style={{ fontSize: 12, color: ll.text2, marginTop: 2 }}>{priceOf(pl.key) ?? '—'} ₺</T>
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
            <T w={700} style={{ fontSize: 36, lineHeight: 40, color: ll.text }}>{priceOf(planKey) ?? '—'} ₺</T>
            {!!error && <T style={{ fontSize: 14, color: tw.accent }}>{error}</T>}
            <BtnPrimary full disabled={busy} style={[{ minHeight: 52 }, busy && { opacity: 0.5 }]}
              label={buying === planKey ? 'Yönlendiriliyor…' : st.blocked ? (st.badge ?? (isP ? 'Abone Ol' : 'Paket Al')) : st.needsKanka ? 'Önce Kanka Davet Et' : isP ? 'Abone Ol' : 'Paket Al'}
              onPress={() => st.needsKanka ? router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'profil' } }) : buy(planKey)} />
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
                    Davet ettiğiniz arkadaşınız, telefon numarasını ve kimlik doğrulamasını yaptıktan sonra sistem size otomatik indirim hakkı tanımlar. Arkadaşınız da başka arkadaşlarını davet edip bu şartlar yerine geldiğinde o da indirim hakkı kazanır. İndirim hakları toplu olarak kullanılamaz ve devredilemez. <T w={700} style={{ fontSize: 12, color: '#fff' }}>Her bir indirim hakkı, yalnızca bir paket satın alımında geçerlidir.</T>
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
                {([['Grup', rights.group], ['Başbaşa', rights.oneOnOne], ['Kankamla', rights.kanka]] as const).map(([label, n]) => (
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
                const isP = card.key === 'PRIME';
                const fg = isP ? '#1a1406' : '#fff';
                return (
                  <Pressable key={card.key} onPress={() => { setDetail(card.key); setError(''); }} accessibilityRole="button" accessibilityLabel={`${card.name}, ${card.desc}`}
                    style={({ pressed }) => ({ backgroundColor: card.color, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 20, minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, opacity: st.blocked ? 0.55 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <T w={800} style={{ fontSize: 20, lineHeight: 26, color: fg }}>{card.name}</T>
                        <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: isP ? 'rgba(26,20,6,0.18)' : 'rgba(0,0,0,0.22)' }}>
                          <T w={600} style={{ fontSize: 10.4, color: fg }}>{st.badge ?? card.badge}</T>
                        </View>
                      </View>
                      <T numberOfLines={1} style={{ fontSize: 14, color: fg, opacity: 0.9 }}>{card.desc}</T>
                    </View>
                    <Arrow color={fg} />
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
