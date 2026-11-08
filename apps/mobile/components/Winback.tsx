// apps/web/components/winback/* karşılığı: rozet + tam ekran teklif
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { api } from '@/lib/api';
import { startPurchase } from '@/lib/purchase';
import { useReduceMotion } from '@/lib/motion';
import { Btn, Serif, T } from './ui';
import { btn, ll, tw, winbackShine } from '@/theme/theme';

export interface WinbackPlan { plan: string; name: string; listTL: number; discountedTL: number; needsKanka: boolean }
export interface WinbackState { active: boolean; amountTL?: number; plans?: WinbackPlan[]; kycApproved?: boolean; lapsed?: boolean; durationSeconds?: number; expiresAt?: string | null; serverNow?: string; autoOpen?: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
export const clockHMS = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
export const clockMS = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

const listeners = new Set<() => void>();

export function useWinback() {
  const [state, setState] = useState<WinbackState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const skew = useRef(0);
  const apply = useCallback((s: WinbackState | null) => { if (s?.serverNow) skew.current = new Date(s.serverNow).getTime() - Date.now(); setState(s); }, []);
  const load = useCallback(() => { api.get<WinbackState>('/payment/winback').then(apply).catch(() => {}); }, [apply]);
  useEffect(() => { load(); listeners.add(load); return () => { listeners.delete(load); }; }, [load]);
  const markShown = useCallback(async () => { const s = await api.post<WinbackState>('/payment/winback/open', {}); apply(s); listeners.forEach((l) => l()); }, [apply]);
  const running = !!state?.active && !!state.expiresAt;
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [running]);
  const remaining = running ? Math.max(0, Math.floor((new Date(state!.expiresAt!).getTime() - (now + skew.current)) / 1000)) : state?.durationSeconds ?? 0;
  const live = !!state?.active && (!running || remaining > 0);
  return { state, live, running, remaining, markShown };
}

// auto: ekranı hakkı olan kullanıcıya ilk açılışta gösterir (uygulamada tek yerde, sekme yerleşiminde). badge: canlı sayaçlı rozet (Eşleşme Paneli)
export function WinbackHost({ badge = false, auto = true }: { badge?: boolean; auto?: boolean }) {
  const { state, live, remaining, markShown } = useWinback();
  const [open, setOpen] = useState(false);
  const [merged, setMerged] = useState(false);
  const autoDone = useRef(false);
  useEffect(() => {
    if (!auto || !state?.active || !state.autoOpen || autoDone.current) return;
    autoDone.current = true; setOpen(true); markShown().catch(() => {});
  }, [auto, state, markShown]);
  if (!state?.active || !live) return null;
  return (
    <>
      {badge && (
        <View style={{ alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
          <Btn variant="winbackBadge" onPress={() => setOpen(true)} label={`${state.amountTL}₺ indirimin · ${clockMS(remaining)}`} textStyle={{ fontVariant: ['tabular-nums'] }} />
        </View>
      )}
      {open && <WinbackScreen state={state} remaining={remaining} merged={merged} onMerge={() => setMerged(true)} onClose={() => setOpen(false)} />}
    </>
  );
}

function WinbackScreen({ state, remaining, merged, onMerge, onClose }: { state: WinbackState; remaining: number; merged: boolean; onMerge: () => void; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plans = state.plans ?? [];
  // Web .wb-ring: 0.9 sn cubic-bezier(.65,0,.25,1) birleşme; .wb-amt: 0.7 sn gecikme + 0.4 sn belirme
  const m = useRef(new Animated.Value(merged ? 1 : 0)).current;
  const amt = useRef(new Animated.Value(merged ? 1 : 0)).current;
  useEffect(() => {
    if (!merged) return;
    Animated.timing(m, { toValue: 1, duration: reduce ? 0 : 900, easing: Easing.bezier(0.65, 0, 0.25, 1), useNativeDriver: true }).start();
    Animated.timing(amt, { toValue: 1, delay: reduce ? 0 : 700, duration: reduce ? 0 : 400, easing: Easing.ease, useNativeDriver: true }).start();
  }, [merged, m, amt, reduce]);

  async function apply() {
    if (!selected || busy) return;
    if (!state.kycApproved) { onClose(); router.push({ pathname: '/(tabs)/profilim', params: { tab: 'kyc' } }); return; }
    const plan = plans.find((p) => p.plan === selected);
    if (!plan) return;
    if (plan.needsKanka) { onClose(); router.push({ pathname: '/(tabs)/profilim', params: { tab: 'profil' } }); return; }
    setBusy(true); setError('');
    try { await startPurchase(plan.plan); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const ax = m.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] });
  const bx = m.interpolate({ inputRange: [0, 1], outputRange: [46, 0] });
  const ringColor = merged ? '#c8743c' : '#d6453a';
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        {/* .wb-screen::before: radial-gradient(ellipse 70% 45% at 50% 30%, rgba(214,69,58,.16), transparent 70%) */}
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs><RadialGradient id="wbg" cx="50%" cy="30%" rx="70%" ry="45%"><Stop offset="0" stopColor="rgb(214,69,58)" stopOpacity={0.16} /><Stop offset="0.7" stopColor="rgb(214,69,58)" stopOpacity={0} /></RadialGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#wbg)" />
        </Svg>
        <ScrollView contentContainerStyle={{ maxWidth: 440, width: '100%', alignSelf: 'center', paddingTop: 22 + insets.top, paddingHorizontal: 20, paddingBottom: 32 + insets.bottom, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
            <T w={700} style={st.pill}>SANA ÖZEL İNDİRİM</T>
            <Btn variant="winbackClose" accessibilityLabel="Kapat" label="×" onPress={onClose} />
          </View>
          <Serif style={{ fontSize: 34, lineHeight: 39, textAlign: 'center', marginBottom: 16 }}>{state.lapsed ? 'Birkaç masa daha?' : 'Uyumlu bir masa?'}</Serif>
          <View style={st.strip}>
            <T w={700} style={{ fontSize: 11, letterSpacing: 1.3, color: '#ff8a7e' }}>TEKLİFİN BİTMESİNE</T>
            <T w={700} style={{ fontSize: 19, letterSpacing: 0.76, fontVariant: ['tabular-nums'] }}>{clockHMS(remaining)}</T>
          </View>
          <T style={{ marginTop: 18, marginBottom: 6, fontSize: 14, color: ll.text2, textAlign: 'center' }}>{merged ? 'İndirimin tanımlandı, şimdi eşleşme zamanı.' : 'Halkalara dokun, indirimini ortaya çıkar.'}</T>
          <Pressable disabled={merged} onPress={onMerge} accessibilityLabel="Halkalar" style={{ width: 250, height: 190, marginVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[st.ring, { borderColor: ringColor, transform: [{ translateX: ax }] }, merged && st.ringMerged]} />
            <Animated.View style={[st.ring, { borderColor: ringColor, transform: [{ translateX: bx }] }, merged && st.ringMerged]} />
            <Animated.View style={{ position: 'absolute', alignItems: 'center', opacity: amt }}>
              <Serif style={{ fontSize: 36, lineHeight: 36 }}>{state.amountTL}₺</Serif>
              <T w={700} style={{ fontSize: 11, letterSpacing: 1.76, color: '#e8a27a', marginTop: 5 }}>İNDİRİM</T>
            </Animated.View>
          </Pressable>
          {merged && (
            <View style={{ width: '100%' }}>
              <T w={700} style={{ fontSize: 12, letterSpacing: 1.68, color: ll.label, marginTop: 12, marginBottom: 10, textAlign: 'center' }}>PAKETİNİ SEÇ</T>
              {plans.map((p) => (
                <Btn key={p.plan} variant="winbackPlan" selected={selected === p.plan} accessibilityLabel={p.name} onPress={() => setSelected(p.plan)}>
                  <Serif style={{ fontSize: 18 }}>{p.name}</Serif>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <T style={{ fontSize: 12, color: '#8f887f', textDecorationLine: 'line-through', marginRight: 8 }}>{p.listTL}₺</T>
                    <T w={700} style={{ fontSize: 20 }}>{p.discountedTL}₺</T>
                  </View>
                </Btn>
              ))}
              <T numberOfLines={1} style={{ fontSize: 11, color: '#8f887f', textAlign: 'center', marginTop: 2, marginBottom: 14 }}>Referans indirimi bu indirimle birleşmez.</T>
              <WinbackCta disabled={!selected || busy} reduce={reduce} onPress={apply} />
              {!selected && <T style={st.hint}>Önce paketini seç</T>}
              {!state.kycApproved && <T style={st.hint}>Kimlik doğrulamanız onaylanana kadar indiriminizi koruyoruz.</T>}
              {!!error && <T style={{ fontSize: 13, color: tw.accent, textAlign: 'center', marginTop: 10 }}>{error}</T>}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// .wb-cta + ::after parlama: yazı stili tema winbackCta'dan, parlama tema winbackShine'dan. w: buton tam genişliği (içerik + iki yan dolgu)
function WinbackCta({ disabled, reduce, onPress }: { disabled: boolean; reduce: boolean; onPress: () => void }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || !w) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(x, { toValue: 1, duration: winbackShine.moveMs, easing: Easing.bezier(0.42, 0, 0.58, 1), useNativeDriver: true }),
      Animated.delay(winbackShine.restMs),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, w, x]);
  const { weight, ...text } = btn.winbackCta.text;
  return (
    <Btn variant="winbackCta" disabled={disabled} accessibilityLabel="İndirimi Uygula" onPress={onPress}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width + 2 * (btn.winbackCta.box.padding as number))} style={{ alignSelf: 'stretch', alignItems: 'center' }}>
        <T w={weight} style={text}>İndirimi Uygula</T>
      </View>
      {!reduce && w > 0 && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: w * winbackShine.widthRatio,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [w * winbackShine.from, w * winbackShine.to] }) }, { skewX: winbackShine.skew }] }}>
          <LinearGradient colors={winbackShine.colors as unknown as [string, string, string]} start={winbackShine.start} end={winbackShine.end} style={{ flex: 1 }} />
        </Animated.View>
      )}
    </Btn>
  );
}

const st = StyleSheet.create({
  pill: { fontSize: 11, letterSpacing: 1.54, paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, color: '#ff8a7e', backgroundColor: 'rgba(214,69,58,0.12)', borderWidth: 1, borderColor: 'rgba(214,69,58,0.45)', overflow: 'hidden' },
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(214,69,58,0.75)', backgroundColor: 'rgba(214,69,58,0.08)' },
  ring: { position: 'absolute', width: 148, height: 148, borderRadius: 74, borderWidth: 10, shadowColor: 'rgba(214,69,58,0.35)', shadowOpacity: 1, shadowRadius: 13 },
  ringMerged: { shadowColor: 'rgba(200,116,60,0.5)', shadowRadius: 17 },
  hint: { fontSize: 12, color: ll.label, textAlign: 'center', marginTop: 10 },
});
