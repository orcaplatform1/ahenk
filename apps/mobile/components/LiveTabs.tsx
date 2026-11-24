// apps/web/components/live/LiveTabs.tsx karşılığı (GRUP / BAŞ BAŞA / KANKAMLA, halka SVG'leri, durum noktası)
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { T, Mono } from './ui';
import { llTab, rings, tabDot } from '@/theme/theme';
import type { MasaTuru } from '@/lib/masa';
import type { TabStatus } from '@/lib/useMasaTabs';
import { useReduceMotion } from '@/lib/motion';
import { useTranslation } from 'react-i18next';

const TABS: { type: MasaTuru; label: string }[] = [
  { type: 'GROUP', label: 'live.tabGROUP' },
  { type: 'ONE_ON_ONE', label: 'live.tabONE_ON_ONE' },
  { type: 'KANKA', label: 'live.tabKANKA' },
];

// Durum metni anahtarı: live.st<DURUM>
export const statusKey = (st: TabStatus) => `live.st${st}`;

const SMALL_RINGS: Partial<Record<MasaTuru, { r: number; stroke: number; rings: [number, number][] }>> = {
  GROUP: { r: 9.189, stroke: 1.622, rings: [[-14.5, -8.5], [-2.9, -8.5], [8.7, -8.5], [14.5, 8.5], [2.9, 8.5], [-8.7, 8.5]] },
  KANKA: { r: 9.557, stroke: 1.686, rings: [[-14.1, -8.1], [4.7, -8.1], [14.1, 8.1], [-4.7, 8.1]] },
};

// still: renkli (açık) hâl, dönmez — haftalık seçim kartları
export function Rings({ type, on, still }: { type: MasaTuru; on: boolean; still?: boolean }) {
  const reduce = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || reduce || still) { spin.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on, reduce, spin, still]);
  const red = on ? rings.redOn : rings.redOff;
  const copper = on ? rings.copperOn : rings.copperOff;
  const small = SMALL_RINGS[type];
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={[{ width: 58, height: 58, transform: [{ rotate }] }, on && { shadowColor: rings.redOn, shadowOpacity: 0.55, shadowRadius: 6 }]}>
      <Svg width={58} height={58} viewBox="0 0 58 58" fill="none">
        {small ? (
          <G strokeWidth={small.stroke}>
            {small.rings.map(([x, y], i) => <Circle key={i} cx={29 + x} cy={29 + y} r={small.r} stroke={i % 2 === 0 ? copper : red} />)}
          </G>
        ) : (
          <G strokeWidth={3} strokeLinecap="round">
            <Circle cx={23} cy={29} r={17} stroke={copper} />
            <Circle cx={35} cy={29} r={17} stroke={red} />
            <Path d="M24.69 12.08A17 17 0 0 1 32.93 15.19" stroke={copper} />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}

// Seçili sekmenin arka plan vurgusu (web .ll-tab::before: radial-gradient(circle at 50% 40%, rgba(255,59,48,0.2) 0%, transparent 68%), üst / alt 6 px taşar)
function TabGlow() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -6, bottom: -6 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="llTabGlow" cx="50%" cy="40%" r="68%">
            <Stop offset="0" stopColor="#ff3b30" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#ff3b30" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#llTabGlow)" />
      </Svg>
    </View>
  );
}

// noRings: Masalarım'da üstteki 3 masa türü ikonu (halkalar) gösterilmez; sekme adı ve durumu kalır (web LiveTabs noRings)
// even: Eşleşme Paneli (web LiveTabs even): üç sekmenin yazısı aynı renk ve parlaklıkta, basılabilir görünür; seçili sekme yalnız
// arka plan vurgusuyla ayrılır. HIG: en az 44 pt dokunma alanı (llTab.minHeight)
export function LiveTabs({ tab, statuses, onTab, noRings = false, even = false }: { tab: MasaTuru; statuses: Record<MasaTuru, TabStatus>; onTab: (t: MasaTuru) => void; noRings?: boolean; even?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={s.tabs}>
      {TABS.map(({ type, label: labelKey }) => {
        const label = t(labelKey);
        const status = statuses[type];
        // Eşleşme Paneli'nde (even) "Abonelik Yok" sekmesi de basılabilir: o türün paket alma kartı açılır
        const off = status === 'NONE' && !even;
        const on = !off && type === tab;
        return (
          <Pressable key={type} disabled={off} onPress={() => onTab(type)} accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={`${label}: ${t(statusKey(status))}`}
            style={[s.tab, !even && on && { transform: [{ translateY: llTab.liftY }] }, !even && off && { opacity: 0.55 }]}>
            {even && on && <TabGlow />}
            {!noRings && <Rings type={type} on={on} />}
            <Mono w={600} style={[s.label, { color: even || on ? '#fff' : '#8f887f' }]}>{label}</Mono>
            <View style={s.statusRow}>
              <View style={[s.dot, { backgroundColor: tabDot[status.toLowerCase() as keyof typeof tabDot] ?? tabDot.default }]} />
              <T numberOfLines={1} style={s.status}>{t(statusKey(status))}</T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, minWidth: 0, minHeight: llTab.minHeight, paddingVertical: llTab.padV, paddingHorizontal: llTab.padH, alignItems: 'center', gap: llTab.gap },
  label: { fontSize: llTab.labelSize, letterSpacing: llTab.labelSize * llTab.labelLetter },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  status: { fontSize: llTab.statusSize, lineHeight: llTab.statusSize * 1.2, color: '#a39c93', flexShrink: 1 },
});
