// Eşleşme Paneli geri sayım sayacı (gün : saat : dakika : saniye; Serif 40, saniye yanıp söner). Profilim askı kartında da aynı sayaç.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useReduceMotion } from '@/lib/motion';
import { getNextTarget, pad } from '@/lib/masa';
import { Serif, T } from './ui';
import { ll } from '@/theme/theme';

// .ll-blink: opaklık 1 → 0,45 → 1, 1,4 sn ease-in-out; Hareketi Azalt açıkken durağan (web prefers-reduced-motion)
function Blink({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    const e = Easing.bezier(0.42, 0, 0.58, 1);
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0.45, duration: 700, easing: e, useNativeDriver: true }), Animated.timing(v, { toValue: 1, duration: 700, easing: e, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return <Animated.View style={{ opacity: v }}>{children}</Animated.View>;
}

export function Countdown({ day, targetAt }: { day: number; targetAt?: number | null }) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, (targetAt ?? getNextTarget(day).getTime()) - Date.now()));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [day, targetAt]);
  const units = [
    { label: 'live.days', value: Math.floor(left / 86_400_000) },
    { label: 'live.hours', value: Math.floor((left % 86_400_000) / 3_600_000) },
    { label: 'live.minutes', value: Math.floor((left % 3_600_000) / 60_000) },
    { label: 'live.seconds', value: Math.floor((left % 60_000) / 1000) },
  ];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 8, marginVertical: 14 }}>
      {units.map((u, i) => (
        <View key={u.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          {i > 0 && <Serif style={{ fontSize: 40, lineHeight: 40, color: '#6e6860' }}>:</Serif>}
          <View style={{ alignItems: 'center', minWidth: 52 }}>
            {u.label === 'live.seconds' ? <Blink><Serif style={{ fontSize: 40, lineHeight: 40, color: ll.red3 }}>{pad(u.value)}</Serif></Blink> : <Serif style={{ fontSize: 40, lineHeight: 40, color: ll.text }}>{pad(u.value)}</Serif>}
            <T style={{ fontSize: 10, color: ll.label, marginTop: 6 }}>{t(u.label)}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

