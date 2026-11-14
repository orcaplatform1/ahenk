// apps/web/components/live/LiveTabs.tsx karşılığı (GRUP / BAŞ BAŞA / KANKAMLA, halka SVG'leri, durum noktası)
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { T, Mono } from './ui';
import { llTab, rings, tabDot } from '@/theme/theme';
import type { MasaTuru } from '@/lib/masa';
import type { TabStatus } from '@/lib/useMasaTabs';
import { useReduceMotion } from '@/lib/motion';

const TABS: { type: MasaTuru; label: string }[] = [
  { type: 'GROUP', label: 'GRUP' },
  { type: 'ONE_ON_ONE', label: 'BAŞ BAŞA' },
  { type: 'KANKA', label: 'KANKAMLA' },
];

export const STATUS_TEXT: Record<TabStatus, string> = {
  TABLE: 'Masa Kuruldu', FORMING: 'Masa Oluşturuluyor', CANCELLED: 'Rez. İptal', SCANNING: 'Taramada', KYC: 'Kimlik Bekleniyor',
  KANKA: 'Kanka Bekleniyor', PENDING: 'Beklemede', FAILED: 'Başarısız', PASSIVE: 'Eşleşme Pasif', NONE: 'Abonelik Yok',
};

const SMALL_RINGS: Partial<Record<MasaTuru, { r: number; stroke: number; rings: [number, number][] }>> = {
  GROUP: { r: 9.189, stroke: 1.622, rings: [[-14.5, -8.5], [-2.9, -8.5], [8.7, -8.5], [14.5, 8.5], [2.9, 8.5], [-8.7, 8.5]] },
  KANKA: { r: 9.557, stroke: 1.686, rings: [[-14.1, -8.1], [4.7, -8.1], [14.1, 8.1], [-4.7, 8.1]] },
};

function Rings({ type, on }: { type: MasaTuru; on: boolean }) {
  const reduce = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || reduce) { spin.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on, reduce, spin]);
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

export function LiveTabs({ tab, statuses, onTab }: { tab: MasaTuru; statuses: Record<MasaTuru, TabStatus>; onTab: (t: MasaTuru) => void }) {
  return (
    <View style={s.tabs}>
      {TABS.map(({ type, label }) => {
        const status = statuses[type];
        const off = status === 'NONE';
        const on = !off && type === tab;
        return (
          <Pressable key={type} disabled={off} onPress={() => onTab(type)} accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={`${label}: ${STATUS_TEXT[status]}`}
            style={[s.tab, on && { transform: [{ translateY: llTab.liftY }] }, off && { opacity: 0.55 }]}>
            <Rings type={type} on={on} />
            <Mono w={600} style={[s.label, { color: on ? '#fff' : '#8f887f' }]}>{label}</Mono>
            <View style={s.statusRow}>
              <View style={[s.dot, { backgroundColor: tabDot[status.toLowerCase() as keyof typeof tabDot] ?? tabDot.default }]} />
              <T numberOfLines={1} style={s.status}>{STATUS_TEXT[status]}</T>
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
