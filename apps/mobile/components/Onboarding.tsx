// Tanıtım akışı ("Nasıl Çalışır") — web components/Onboarding.tsx karşılığı (dar ekran görünümü: tam ekran).
// 8 adım, bilgilendirme amaçlı. Kayıttan sonra bir kez otomatik (sekme yerleşimi, User.onboardingSeenAt boşken),
// Profilim'deki "Nasıl Çalışır?" butonuyla her zaman. Son adımda "Başla" ya da herhangi bir adımda "Atla" → onClose(true).
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { upper } from '@/lib/i18n';
import { api } from '@/lib/api';
import { gColor } from '@/lib/masa';
import { onb as C } from '@/theme/theme';
import { Serif, T } from './ui';

const TOTAL = 8;
type PlanKeyName = 'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA' | 'PRIME_1M' | 'PRIME_3M' | 'PRIME_6M' | 'PRIME_12M';
interface PlanPriceInfo { plan: PlanKeyName; mobileTL: number }

// İnce çizgili ikonlar (stroke 1.5)
const ICONS: Record<string, React.ReactNode> = {
  clock: <><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 2" /></>,
  pin: <><Path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><Circle cx={12} cy={9} r={2.5} /></>,
  eyeOff: <><Path d="M3 3l18 18" /><Path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3 3.6M6.4 7.6C4.3 9.1 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1" /></>,
  lock: <><Rect x={5} y={11} width={14} height={10} rx={2} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  shield: <Path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" />,
  check: <><Path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><Path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  sos: <><Circle cx={12} cy={12} r={9} /><Path d="M12 7v6M12 16.5v.5" /></>,
  user: <><Circle cx={12} cy={8} r={3.5} /><Path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /><Path d="M18 4l3 3M21 4l-3 3" /></>,
  wave: <><Path d="M3 10c2 0 2-2 4.5-2S10 10 12 10s2-2 4.5-2S19 10 21 10" /><Path d="M3 15c2 0 2-2 4.5-2S10 15 12 15s2-2 4.5-2S19 15 21 15" /></>,
  sun: <><Circle cx={12} cy={12} r={4} /><Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};
function Icon({ name, size = 22, color = C.accent }: { name: keyof typeof ICONS; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</Svg>;
}

// Üç iç içe halka logo
function RingLogo({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Circle cx={36} cy={36} r={33} stroke={C.primary} strokeWidth={2} />
      <Circle cx={36} cy={36} r={23} stroke={C.accent} strokeWidth={2} opacity={0.85} />
      <Circle cx={36} cy={36} r={13} stroke={C.primary} strokeWidth={2} />
    </Svg>
  );
}

const card = { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: C.radius, paddingVertical: 14, paddingHorizontal: 16 } as const;
const H2 = ({ children, style }: { children: React.ReactNode; style?: object }) => <Serif style={[{ fontSize: 30, lineHeight: 35, color: C.text }, style]}>{children}</Serif>;
const Sub = ({ children, style }: { children: React.ReactNode; style?: object }) => <T style={[{ fontSize: 15, lineHeight: 22, color: C.muted, marginTop: 8, marginBottom: 20 }, style]}>{children}</T>;
const Small = ({ children, style }: { children: React.ReactNode; style?: object }) => <T style={[{ fontSize: 13, lineHeight: 19.5, color: C.muted }, style]}>{children}</T>;
const Strong = ({ children, style }: { children: React.ReactNode; style?: object }) => <T w={600} style={[{ fontSize: 15, color: C.text }, style]}>{children}</T>;

function Timeline({ rows }: { rows: [string, string][] }) {
  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: C.primary, paddingLeft: 16, gap: 12, marginVertical: 14 }}>
      {rows.map(([a, b]) => (
        <View key={a}>
          <View style={{ position: 'absolute', left: -23, top: 5, width: 12, height: 12, borderRadius: 6, backgroundColor: C.bg, borderWidth: 2, borderColor: C.primary }} />
          <Strong style={{ fontSize: 14 }}>{a}</Strong>
          <Small>{b}</Small>
        </View>
      ))}
    </View>
  );
}

function IconRow({ icon, title, body }: { icon: keyof typeof ICONS; title: string; body: string }) {
  return (
    <View style={[card, { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }]}>
      <View style={{ marginTop: 2 }}><Icon name={icon} /></View>
      <View style={{ flex: 1 }}><Strong>{title}</Strong><Small style={{ marginTop: 4 }}>{body}</Small></View>
    </View>
  );
}

function Step({ n, prices }: { n: number; prices: Partial<Record<PlanKeyName, PlanPriceInfo>> | null }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'tomorrow' | 'weekend'>('tomorrow');
  const price = (p: PlanKeyName) => (prices?.[p] ? `${prices[p]!.mobileTL}₺` : '—');

  if (n === 1) return (
    <View style={{ alignItems: 'center', paddingTop: 24 }}>
      <RingLogo size={88} />
      <T w={600} style={{ fontSize: 16, letterSpacing: 2.9, color: C.text, marginTop: 16, marginBottom: 4 }}>{t('onb.brand')}</T>
      <T style={{ fontSize: 11, letterSpacing: 1.8, color: C.muted, marginBottom: 28 }}>{t('onb.taglineUpper')}</T>
      <H2 style={{ fontSize: 36, lineHeight: 42, textAlign: 'center' }}>{t('onb.s1Title')}</H2>
      <T style={{ fontSize: 16, lineHeight: 25.6, color: C.text, textAlign: 'center', marginTop: 14, marginBottom: 10 }}>{t('onb.s1Body')}</T>
      <Small style={{ fontSize: 14, textAlign: 'center' }}>{t('onb.s1Sub')}</Small>
    </View>
  );

  if (n === 2) return (
    <View>
      <H2>{t('onb.s2Title')}</H2>
      <Sub>{t('onb.s2Sub')}</Sub>
      <View style={{ gap: 10 }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[card, { flexDirection: 'row', gap: 14, alignItems: 'flex-start' }]}>
            <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Serif style={{ fontSize: 17, color: C.accent }}>{i}</Serif>
            </View>
            <View style={{ flex: 1 }}><Strong>{t(`onb.s2c${i}t`)}</Strong><Small style={{ marginTop: 4 }}>{t(`onb.s2c${i}b`)}</Small></View>
          </View>
        ))}
      </View>
    </View>
  );

  if (n === 3) {
    const oneOff: [string, string, PlanKeyName][] = [['onb.pkGroup', 'onb.pGroupD', 'MASADA'], ['onb.pkOne', 'onb.pOneD', 'KARSIMDA'], ['onb.pKanka', 'onb.pKankaD', 'KANKAMLA'], ['onb.pIcerde', 'onb.pIcerdeD', 'ICERDE']];
    const prime: [string, PlanKeyName][] = [['onb.m1', 'PRIME_1M'], ['onb.m3', 'PRIME_3M'], ['onb.m6', 'PRIME_6M'], ['onb.m12', 'PRIME_12M']];
    return (
      <View>
        <H2>{t('onb.s3Title')}</H2>
        <Sub>{t('onb.s3Sub')}</Sub>
        <T style={{ fontSize: 11, letterSpacing: 1.5, color: C.muted, marginBottom: 8 }}>{t('onb.s3OneOff')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {oneOff.map(([name, desc, plan]) => (
            <View key={plan} style={[card, { width: '48.5%', borderColor: C.pkgColor[plan] }]}>
              {/* Rozet: "TEK SEFERLİK" / "ONE-TIME", paket renginde */}
              <View style={{ alignSelf: 'flex-start', backgroundColor: C.pkgColor[plan], borderRadius: C.pill, paddingVertical: 2, paddingHorizontal: 8, marginBottom: 6 }}>
                <T w={700} style={{ fontSize: 10, letterSpacing: 0.8, color: '#ffffff' }}>{upper(t('card.oneTime'))}</T>
              </View>
              <Strong>{t(name)}</Strong>
              <Small style={{ fontSize: 12, marginTop: 2, marginBottom: 6 }}>{t(desc)}</Small>
              <T w={700} style={{ fontSize: 15, color: C.accent }}>{price(plan)}</T>
            </View>
          ))}
        </View>
        <View style={[card, { borderWidth: 1.5, borderColor: C.primeBorder, marginTop: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Serif style={{ fontSize: 20, color: C.text }}>{t('onb.prime')}</Serif>
            <LinearGradient colors={C.primeTagBg as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: C.pill, paddingVertical: 2, paddingHorizontal: 8 }}>
              <T w={700} style={{ fontSize: 10, letterSpacing: 0.8, color: C.primeTagText }}>{t('onb.primeTag')}</T>
            </LinearGradient>
          </View>
          <Small style={{ marginTop: 6, marginBottom: 10 }}>{t('onb.primeBody')}</Small>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {prime.map(([m, plan]) => (
              <View key={plan} style={{ flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center' }}>
                <Small style={{ fontSize: 12 }}>{t(m)}</Small>
                <T w={700} style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{price(plan)}</T>
              </View>
            ))}
          </View>
          <Small style={{ fontSize: 12, marginTop: 8 }}>{t('onb.primeCancel')}</Small>
        </View>
        <Small style={{ marginTop: 12 }}>{t('onb.s3Foot')}</Small>
      </View>
    );
  }

  if (n === 4) return (
    <View>
      <H2>{t('onb.s4Title')}</H2>
      <Sub>{t('onb.s4Sub')}</Sub>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: C.pill, padding: 4, gap: 4 }}>
        {(['tomorrow', 'weekend'] as const).map(k => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)}
            style={{ flex: 1, minHeight: 44, borderRadius: C.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === k ? C.primary : 'transparent' }}>
            <T w={600} style={{ fontSize: 14, color: tab === k ? '#ffffff' : C.muted }}>{t(k === 'tomorrow' ? 'onb.tabTomorrow' : 'onb.tabWeekend')}</T>
          </Pressable>
        ))}
      </View>
      {tab === 'tomorrow' ? (
        <View style={{ marginTop: 14 }}>
          <T style={{ fontSize: 14, color: C.text }}>{t('onb.tmIntro')}</T>
          <Timeline rows={[[t('onb.tm1t'), t('onb.tm1b')], [t('onb.tm2t'), t('onb.tm2b')], [t('onb.tm3t'), t('onb.tm3b')], [t('onb.tm4t'), t('onb.tm4b')]]} />
          <View style={card}><Small>{t('onb.tmNote')}</Small></View>
        </View>
      ) : (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[['onb.pGroup', 'onb.wkFri'], ['onb.pOne', 'onb.wkSat'], ['onb.pKanka', 'onb.wkSun']].map(([a, b]) => (
              <View key={a} style={[card, { flex: 1, paddingHorizontal: 6, paddingVertical: 10, alignItems: 'center' }]}>
                <Strong style={{ fontSize: 14, textAlign: 'center' }}>{t(a)}</Strong>
                <Small style={{ fontSize: 12 }}>{t(b)}</Small>
              </View>
            ))}
          </View>
          <Timeline rows={[[t('onb.wk1t'), t('onb.wk1b')], [t('onb.wk2t'), t('onb.tm2b')], [t('onb.wk3t'), t('onb.tm3b')], [t('onb.wk4t'), t('onb.tm4b')]]} />
        </View>
      )}
      <Small style={{ marginTop: 4 }}>{t('onb.s4Foot')}</Small>
    </View>
  );

  if (n === 5) return (
    <View>
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: C.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, marginBottom: 12 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.accent }} />
        <T style={{ fontSize: 12, color: C.accent }}>{t('onb.s5Tag')}</T>
      </View>
      <H2>{t('onb.s5Title')}</H2>
      <Sub>{t('onb.s5Sub')}</Sub>
      <View style={{ gap: 10 }}>
        {(['clock', 'pin', 'eyeOff', 'lock'] as const).map((ic, i) => <IconRow key={ic} icon={ic} title={t(`onb.s5r${i + 1}t`)} body={t(`onb.s5r${i + 1}b`)} />)}
      </View>
    </View>
  );

  if (n === 6) {
    const people: [string, string][] = [['A.K.', 'MALE'], ['E.Y.', 'FEMALE'], ['M.D.', 'MALE'], ['S.T.', 'FEMALE'], ['C.A.', 'MALE'], ['D.Ö.', 'FEMALE']];
    const D = 52, SW = 5, R = (D - SW) / 2, CIRC = 2 * Math.PI * R;
    return (
      <View>
        <H2>{t('onb.s6Title')}</H2>
        <Sub>{t('onb.s6Sub')}</Sub>
        <View style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden' }}>
          <View style={{ height: 120, backgroundColor: C.card }}>
            <View style={{ position: 'absolute', top: 10, left: 10, paddingVertical: 3, paddingHorizontal: 9, borderRadius: C.pill, backgroundColor: 'rgba(192,57,43,0.85)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.5)' }}>
              <T w={700} style={{ fontSize: 10, color: '#ffffff' }}>{t('onb.s6Type')}</T>
            </View>
            <View style={{ position: 'absolute', top: 10, right: 10, paddingVertical: 3, paddingHorizontal: 9, borderRadius: C.pill, borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(18,18,18,0.6)' }}>
              <T w={600} style={{ fontSize: 10, color: C.muted }}>{t('onb.s6Sample')}</T>
            </View>
            <View style={{ position: 'absolute', left: 12, bottom: 10 }}>
              <Serif style={{ fontSize: 20, color: C.text }}>{t('onb.s6Venue')}</Serif>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="pin" size={12} /><Small style={{ fontSize: 12 }}>{t('onb.s6District')}</Small></View>
            </View>
          </View>
          <View style={{ padding: 12, gap: 10 }}>
            <View style={[card, { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 }]}>
              <T w={700} style={{ fontSize: 13, color: C.text }}>{t('onb.s6Time')}</T>
              <Small style={{ fontSize: 12, flexShrink: 1, textAlign: 'right' }}>{t('onb.s6People')}</Small>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {people.map(([ini, g]) => (
                <View key={ini} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: gColor(g), alignItems: 'center', justifyContent: 'center' }}>
                  <T w={700} style={{ fontSize: 9, color: '#f0f0f0' }}>{ini}</T>
                </View>
              ))}
            </View>
            <View style={[card, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }]}>
              <View style={{ width: D, height: D }}>
                <Svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke={C.ringTrack} strokeWidth={SW} />
                  <Circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke={C.ring} strokeWidth={SW} strokeLinecap="round" strokeDasharray={`${CIRC}`} strokeDashoffset={CIRC * 0.13} />
                </Svg>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <T w={700} style={{ fontSize: 13, color: C.text }}>%87</T>
                </View>
              </View>
              <View style={{ flex: 1 }}><Strong style={{ fontSize: 13 }}>{t('onb.s6AiTitle')}</Strong><Small style={{ fontSize: 12 }}>{t('onb.s6AiSub')}</Small></View>
            </View>
          </View>
        </View>
        <View style={{ marginTop: 14, gap: 8 }}>
          {[1, 2].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, marginTop: 8 }} />
              <T style={{ flex: 1, fontSize: 14, lineHeight: 21, color: C.text }}>{t(`onb.s6b${i}`)}</T>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (n === 7) return (
    <View>
      <Icon name="shield" size={40} />
      <H2 style={{ marginTop: 12 }}>{t('onb.s7Title')}</H2>
      <Sub>{t('onb.s7Sub')}</Sub>
      <View style={{ gap: 10 }}>
        {(['check', 'sos', 'user'] as const).map((ic, i) => <IconRow key={ic} icon={ic} title={t(`onb.s7c${i + 1}t`)} body={t(`onb.s7c${i + 1}b`)} />)}
      </View>
    </View>
  );

  return (
    <View>
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: C.pill, borderWidth: 1, borderColor: C.primary, marginBottom: 12 }}>
        <Icon name="sun" size={14} />
        <T style={{ fontSize: 12, color: C.accent }}>{t('onb.s8Tag')}</T>
      </View>
      <H2>{t('onb.s8Title')}</H2>
      <Sub style={{ color: C.text }}>{t('onb.s8Body')}</Sub>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={[card, { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Icon name="wave" />
            <Strong style={{ flexShrink: 1 }}>{t(`onb.s8c${i}`)}</Strong>
          </View>
        ))}
      </View>
      <Small style={{ marginTop: 14 }}>{t('onb.s8Foot')}</Small>
    </View>
  );
}

export function Onboarding({ visible, onClose }: { visible: boolean; onClose: (completed: boolean) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [prices, setPrices] = useState<Partial<Record<PlanKeyName, PlanPriceInfo>> | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => { if (visible) setStep(1); }, [visible]);
  useEffect(() => {
    if (!visible || prices) return;
    api.get<PlanPriceInfo[]>('/payment/plans').then((l) => setPrices(Object.fromEntries(l.map((p) => [p.plan, p])))).catch(() => {});
  }, [visible, prices]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);

  const go = (n: number) => setStep(Math.min(TOTAL, Math.max(1, n)));
  const primaryLabel = step === 1 ? t('onb.letsStart') : step === TOTAL ? t('onb.finish') : t('onb.next');

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => (step > 1 ? go(step - 1) : onClose(true))}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {/* Üst: 8 parçalı ilerleme çubuğu + Atla */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: C.padH, paddingTop: 8 }}>
          <View accessibilityRole="progressbar" accessibilityLabel={t('onb.stepOf', { n: step })} style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: TOTAL }, (_, i) => <View key={i} style={{ flex: 1, height: C.barH, borderRadius: 2, backgroundColor: i < step ? C.primary : C.rest }} />)}
          </View>
          <Pressable onPress={() => onClose(true)} accessibilityRole="button" hitSlop={6} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontSize: 14, color: C.muted }}>{t('onb.skip')}</T>
          </Pressable>
        </View>
        {/* İçerik: sığmazsa kaydırılır, butonlar sabit */}
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: C.padH, paddingTop: 8, paddingBottom: 16 }}>
          <Step key={step} n={step} prices={prices} />
        </ScrollView>
        {/* Alt: solda Geri (1. adımda yok), sağda yuvarlak kırmızı ana buton */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: C.padH, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: C.border }}>
          {step > 1 ? (
            <Pressable onPress={() => go(step - 1)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}>
              <T style={{ fontSize: 15, color: C.muted }}>{t('onb.back')}</T>
            </Pressable>
          ) : <View />}
          <Pressable onPress={() => (step === TOTAL ? onClose(true) : go(step + 1))} accessibilityRole="button"
            style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 28, borderRadius: C.pill, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
            <T w={700} style={{ fontSize: 15, color: '#ffffff' }}>{primaryLabel}</T>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
