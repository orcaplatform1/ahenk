// Sekme 4 — Paketim: apps/web/app/profil/tabs/TabPaket.tsx. Ödeme: uygulama içi satın alma (S-13), mobil fiyat (mobileTL).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/lib/api';
import { startPurchase } from '@/lib/purchase';
import { getKankamlaCardState, getPlanCardState, type KankamlaState, type OpenParts, type PlanKey } from '@/lib/planCards';
import { useReduceMotion } from '@/lib/motion';
import { BtnPrimary, Card, Head, MaintenanceNotice, Serif, SkeletonBlock, T } from '@/components/ui';
import { clockMS, useWinback, WinbackHost } from '@/components/Winback';
import { Glow } from './index';
import { c, ll, sans, tw } from '@/theme/theme';

interface Subscription { id: string; plan: string; usedAt?: string | null; groupRights: number; groupCycles: number; oneOnOneCycles: number; kankaRights?: number; kankaCycles?: number }
type RefundOption = 'GROUP' | 'ONEONE' | 'FULL' | 'KANKA';
const REFUND_LABEL: Record<RefundOption, string> = { FULL: 'İade Talep Et (tüm paket)', GROUP: 'Grup Masası İadesi Talep Et', ONEONE: 'Başbaşa Masası İadesi Talep Et', KANKA: 'Kankamla İadesi Talep Et' };
type PlanKeyName = 'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA';
interface PlanPriceInfo { plan: PlanKeyName; nametr: string; webTL: number; mobileTL: number; webDiscountTL: number; mobileDiscountTL: number }
interface DiscountInfo { referralDiscount: boolean; referralCount: number; inviteeDiscount: boolean }

const PLANS = [
  { key: 'MASADA', name: 'Masada', desc: '2 grup masası hakkı · 4 döngü geçerli', featured: false, bg: require('@/assets/plan-masada.webp'), features: ['2 Grup Masası Hakkı', 'Doğrulanmış Profiller', 'OCEAN Kişilik Uyumu', 'Yapay Zeka Masa Raporu', 'Masa Garantili (Ücret İade)'] },
  { key: 'KARSIMDA', name: 'Karşımda', desc: '1 başbaşa masası hakkı · 4 döngü geçerli', featured: false, bg: require('@/assets/plan-karsimda.webp'), features: ['Tek Seferlik Baş Başa Masa', 'Doğrulanmış Profiller', 'OCEAN + Yaş Uyumu', 'Yapay Zeka Masa Raporu', 'Masa Garantili (Ücret İade)'] },
  { key: 'ICERDE', name: 'İçerde', desc: '2 grup + 1 başbaşa masası hakkı · tek seferlik', featured: true, bg: require('@/assets/plan-icerde.webp'), features: ['2 Grup Masası + 1 Baş Başa Masa', 'Tüm Özellikler Dahil'] },
  { key: 'KANKAMLA', name: 'Kankamla', desc: '2 Kankamla masası hakkı · kankan ücretsiz katılır', featured: false, bg: require('@/assets/plan-masada.webp'), features: ['2 Kankamla Masası Hakkı', 'Kankan Ücretsiz Katılır', '4 Kişilik Masa (2E + 2K)', 'Doğrulanmış Profiller', 'Masa Garantili (Ücret İade)'] },
];
const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla' };

// Öne çıkan kartın dönen altın kenarı (.p-feat-wrap)
function GoldBorder({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => { if (reduce) return; const l = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })); l.start(); return () => l.stop(); }, [reduce, spin]);
  const d = Math.max(size.w, size.h) * 3;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ borderRadius: 18, padding: 2, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}>
      {size.w > 0 && (
        <Animated.View style={{ position: 'absolute', width: d, height: d, left: (size.w - d) / 2, top: (size.h - d) / 2, transform: [{ rotate }] }}>
          <LinearGradient colors={['transparent', 'transparent', c.gold1, c.gold2, 'transparent']} locations={[0, 0.42, 0.47, 0.5, 0.55]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      )}
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

function Check() {
  return <Svg viewBox="0 0 20 20" width={11} height={11} fill={c.red}><Path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></Svg>;
}

export default function Paketim() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const winback = useWinback();
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [openParts, setOpenParts] = useState<OpenParts>({ group: false, oneOnOne: false });
  const [refundOptions, setRefundOptions] = useState<RefundOption[]>([]);
  const [packageCycles, setPackageCycles] = useState(4);
  const [prices, setPrices] = useState<Partial<Record<PlanKeyName, PlanPriceInfo>> | null>(null);
  const [discount, setDiscount] = useState<DiscountInfo | null>(null);
  const [kankamla, setKankamla] = useState<KankamlaState | null>(null);
  const [kycApproved, setKycApproved] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [stats, setStats] = useState<{ totalInvites: number; availableDiscounts: number } | null>(null);
  const [refPhone, setRefPhone] = useState('');
  const [refSending, setRefSending] = useState(false);
  const [refMsg, setRefMsg] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMsg, setRefundMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [buying, setBuying] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<{ subscriptions: Subscription[]; hasMasada?: boolean; hasKarsimda?: boolean; refundOptions?: RefundOption[]; packageCycles?: number }>('/payment/subscriptions')
      .then((r) => { setSubs(r.subscriptions ?? []); setRefundOptions(r.refundOptions ?? []); if (r.packageCycles) setPackageCycles(r.packageCycles); })
      .catch(() => {}).finally(() => setLoading(false));
    api.get<PlanPriceInfo[]>('/payment/plans').then((l) => setPrices(Object.fromEntries(l.map((p) => [p.plan, p])))).catch(() => {});
    api.get<DiscountInfo>('/payment/discount-info').then(setDiscount).catch(() => {});
    api.get<{ kankamla?: KankamlaState; openParts?: OpenParts; kyc?: { status: string }; maintenanceMode?: boolean }>('/auth/me').then((m) => {
      setKankamla(m.kankamla ?? null); if (m.openParts) setOpenParts(m.openParts); setKycApproved(m.kyc?.status === 'APPROVED'); setMaintenance(!!m.maintenanceMode);
    }).catch(() => {});
    api.get<{ totalInvites: number; availableDiscounts: number }>('/referral/my-stats').then(setStats).catch(() => {});
  }, []);
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
  async function refund(t: RefundOption) {
    setRefundLoading(true);
    try { await api.post('/payment/refund-request', { refundType: t }); setRefundMsg({ ok: true, text: 'İade talebiniz alındı, en kısa sürede size ulaşacağız.' }); }
    catch (e) { setRefundMsg({ ok: false, text: (e as Error).message || 'İşlem başarısız oldu.' }); } finally { setRefundLoading(false); }
  }
  async function buy(plan: string) {
    setBuying(plan); setError('');
    try {
      const use = discount?.referralDiscount ? 'REFERRER' : discount?.inviteeDiscount ? 'INVITEE' : undefined;
      await startPurchase(plan, use);
      router.push({ pathname: '/odeme-sonuc', params: { durum: 'basarili' } });
    } catch (e) { setError((e as Error).message); } finally { setBuying(''); }
  }

  const owned = new Set(subs.map((s) => s.plan).filter((p): p is PlanKey => p === 'MASADA' || p === 'KARSIMDA' || p === 'ICERDE'));
  const shownRefunds: RefundOption[] = refundOptions.includes('FULL') ? ['FULL'] : refundOptions.filter((o) => o !== 'FULL');
  const priceOf = (k: string) => prices?.[k as PlanKeyName];
  const winOf = (k: string) => (winback.live && winback.running ? winback.state?.plans?.find((p) => p.plan === k) : undefined);

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
      <Glow />
      <WinbackHost />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: insets.top + 32, paddingHorizontal: 16, paddingBottom: 32, gap: 20, maxWidth: 896, width: '100%', alignSelf: 'center' }}>
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
                <BtnPrimary label={refSending ? '…' : 'Davet Gönder'} full disabled={refSending} onPress={sendReferral} />
                <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <T style={{ color: c.tAaa, fontSize: 11, lineHeight: 16.5 }}>
                    Davet ettiğiniz arkadaşınız, telefon numarasını ve kimlik doğrulamasını yaptıktan sonra sistem size otomatik indirim hakkı tanımlar. Arkadaşınız da başka arkadaşlarını davet edip bu şartlar yerine geldiğinde o da indirim hakkı kazanır. İndirim hakları toplu olarak kullanılamaz ve devredilemez. <T w={700} style={{ fontSize: 11, color: '#fff' }}>Her bir indirim hakkı, yalnızca bir paket satın alımında geçerlidir.</T>
                  </T>
                </View>
              </View>
              {!!refMsg && <T style={{ fontSize: 12, color: refMsg.includes('başarı') ? c.ok : tw.accent }}>{refMsg}</T>}
              <View style={{ flexDirection: 'row', gap: 24, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
                <View><T style={{ fontSize: 12, color: ll.text2 }}>Davetli Arkadaş</T><T w={600} style={{ fontSize: 16, color: ll.text }}>{stats?.totalInvites ?? '—'} kişi</T></View>
                <View><T style={{ fontSize: 12, color: ll.text2 }}>Toplam %10 İndirim Hakkı</T><T w={600} style={{ fontSize: 16, color: ll.text }}>{stats?.availableDiscounts ?? '—'} Adet</T></View>
              </View>
            </Card>

            {(subs.length > 0 || shownRefunds.length > 0) && (
              <Card style={{ gap: 12 }}>
                {subs.map((s) => {
                  const g = s.plan === 'MASADA' || s.plan === 'ICERDE', o = s.plan === 'KARSIMDA' || s.plan === 'ICERDE', k = s.plan === 'KANKAMLA';
                  return (
                    <View key={s.id} style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <T w={500} style={{ fontSize: 12, color: ll.label, letterSpacing: 0.3 }}>AKTİF PAKET</T>
                        <T w={600} style={{ fontSize: 14, color: ll.text }}>{PLAN_LABEL[s.plan] ?? s.plan}</T>
                      </View>
                      {g && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 12, color: ll.label }}>Grup masası hakkı</T><T style={{ fontSize: 12, color: ll.text }}>{s.groupCycles >= packageCycles ? 'Süresi doldu' : `${s.groupRights}/2 kaldı · ${s.groupCycles}/${packageCycles} döngü`}</T></View>}
                      {k && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 12, color: ll.label }}>Kankamla masası hakkı</T><T style={{ fontSize: 12, color: ll.text }}>{(s.kankaCycles ?? 0) >= packageCycles ? 'Süresi doldu' : `${s.kankaRights ?? 0}/2 kaldı · ${s.kankaCycles ?? 0}/${packageCycles} döngü`}</T></View>}
                      {o && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 12, color: ll.label }}>Başbaşa masası hakkı</T><T style={{ fontSize: 12, color: ll.text }}>{s.usedAt ? 'Kullanıldı' : s.oneOnOneCycles >= packageCycles ? 'Süresi doldu' : `1/1 kaldı · ${s.oneOnOneCycles}/${packageCycles} döngü`}</T></View>}
                    </View>
                  );
                })}
                <T style={{ fontSize: 12, color: ll.time, lineHeight: 19, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12, marginTop: 4 }}>
                  Paketler tek seferliktir; her masa hakkı {packageCycles} döngü (yaklaşık 1 ay) geçerlidir. Bu süre içinde hiç masa kurulamazsa tam iade talep edebilirsin. Bir masa kurulduysa kalan hakkın olsa da hizmet alınmış sayılır ve iade yapılmaz. İade talepleri 5 iş günü içinde değerlendirilir.
                </T>
                {refundMsg ? <T style={{ fontSize: 14, color: refundMsg.ok ? c.ok : tw.accent }}>{refundMsg.text}</T>
                  : shownRefunds.length > 0 ? shownRefunds.map((o) => (
                    <Pressable key={o} disabled={refundLoading} onPress={() => refund(o)} style={{ paddingVertical: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(192,57,43,0.6)', backgroundColor: 'rgba(192,57,43,0.06)', minHeight: 44, justifyContent: 'center' }}>
                      <T w={500} style={{ fontSize: 14, color: c.ghostRedDot }}>{refundLoading ? 'Gönderiliyor…' : REFUND_LABEL[o]}</T>
                    </Pressable>
                  )) : (
                    <View style={{ paddingVertical: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minHeight: 44, justifyContent: 'center' }}>
                      <T w={500} style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>İade Talep Et</T>
                    </View>
                  )}
              </Card>
            )}

            {!!error && <T style={{ fontSize: 14, color: tw.accent }}>{error}</T>}

            <View style={{ gap: 16 }}>
              {PLANS.map((plan) => {
                const isK = plan.key === 'KANKAMLA';
                const cs = isK ? getKankamlaCardState(kankamla) : { ...getPlanCardState(plan.key, owned, openParts), needsKanka: false };
                const p = priceOf(plan.key), w = winOf(plan.key);
                const body = (
                  <View style={[{ flexDirection: 'row', minHeight: 240 }, !plan.featured && { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, cs.dimmed && { opacity: 0.45 }]} pointerEvents={cs.dimmed ? 'none' : 'auto'}>
                    <View style={{ width: '55%', backgroundColor: c.planLeft, paddingVertical: 16, paddingHorizontal: 12, gap: 8 }}>
                      {!!cs.badge && (
                        <View style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1,
                          backgroundColor: cs.badgeRed ? 'rgba(192,57,43,0.85)' : 'rgba(40,40,40,0.85)', borderColor: cs.badgeRed ? 'rgba(192,57,43,0.6)' : 'rgba(255,255,255,0.12)' }}>
                          <T w={600} style={{ fontSize: 10.4, textAlign: 'center', color: cs.badgeRed ? '#fff' : c.tAaa }}>{cs.badge}</T>
                        </View>
                      )}
                      <View style={{ marginTop: cs.badge ? 20 : 0 }}>
                        <Serif style={{ fontSize: 16, marginBottom: 3 }}>{plan.name}</Serif>
                        {w ? (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 2 }}>
                              <T w={700} style={{ fontSize: 24 }}>{w.discountedTL}</T><T style={{ color: c.t888, fontSize: 13.6, marginBottom: 1 }}>₺</T>
                              <T style={{ color: c.t555, fontSize: 12, textDecorationLine: 'line-through', marginBottom: 1 }}>{w.listTL}₺</T>
                            </View>
                            <T style={{ color: ll.copper, fontSize: 10.9, marginBottom: 2, fontVariant: ['tabular-nums'] }}>İndirim bitimine {clockMS(winback.remaining)}</T>
                          </>
                        ) : discount?.referralDiscount ? (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 2 }}>
                              <T w={700} style={{ fontSize: 24 }}>{p?.mobileDiscountTL ?? '—'}</T><T style={{ color: c.t888, fontSize: 13.6, marginBottom: 1 }}>₺</T>
                              <T style={{ color: c.t555, fontSize: 12, textDecorationLine: 'line-through', marginBottom: 1 }}>{p?.mobileTL ?? '—'}₺</T>
                            </View>
                            <T style={{ color: c.ok, fontSize: 10.9, marginBottom: 2 }}>Kalan İndirim Hakkı: {discount.referralCount}</T>
                          </>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 2 }}>
                            <T w={700} style={{ fontSize: 24 }}>{p?.mobileTL ?? '—'}</T><T style={{ color: c.t888, fontSize: 13.6, marginBottom: 1 }}>₺</T>
                          </View>
                        )}
                        <T style={{ fontSize: 10.9 }}>{plan.desc}</T>
                      </View>
                      <View style={{ gap: 4, flex: 1 }}>
                        {plan.features.map((f) => (
                          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Check /><T style={{ fontSize: 11.2, color: c.tCcc, lineHeight: 14.5, flexShrink: 1 }}>{f}</T></View>
                        ))}
                      </View>
                      {cs.showButton && (
                        <BtnPrimary full disabled={buying === plan.key || maintenance}
                          label={buying === plan.key ? 'Yönlendiriliyor…' : !kycApproved ? 'Paket Seç' : cs.needsKanka ? 'Önce Kanka Davet Et' : 'Paketi Seç'}
                          onPress={() => !kycApproved ? router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'kyc' } }) : cs.needsKanka ? router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'profil' } }) : buy(plan.key)} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Image source={plan.bg} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={plan.name} />
                      {plan.featured && !cs.badge && (
                        <View style={{ position: 'absolute', top: 12, right: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(10,5,5,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
                          <T w={600} style={{ fontSize: 12, color: '#fff' }}>Tercih Edilen</T>
                        </View>
                      )}
                    </View>
                  </View>
                );
                return plan.featured ? <GoldBorder key={plan.key}>{body}</GoldBorder> : <View key={plan.key}>{body}</View>;
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
