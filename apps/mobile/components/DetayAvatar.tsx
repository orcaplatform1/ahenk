// packages/ui/src/components/tables/DetayAvatar.tsx karşılığı (48px, 2.5 kenar, 11px yazı)
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { detayAvatar, sans } from '@/theme/theme';
import { gBg, gColor, initialsLabel } from '@/lib/masa';
import { useReduceMotion } from '@/lib/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function DetayAvatar({ participant, delay = 0, size = detayAvatar.d, animated = true }: {
  participant: { initials?: string | null; gender?: string | null }; delay?: number; size?: number; animated?: boolean;
}) {
  const reduce = useReduceMotion();
  const anim = animated && !reduce;
  const k = size / detayAvatar.d;
  const R = size / 2;
  const BR = R - detayAvatar.strokeWidth * k;
  const circ = 2 * Math.PI * BR;
  const color = gColor(participant.gender);
  const bg = gBg(participant.gender);
  const label = initialsLabel(participant.initials);

  const scale = useRef(new Animated.Value(anim ? 0.5 : 1)).current;
  const dash = useRef(new Animated.Value(anim ? circ : 0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!anim) return;
    Animated.timing(scale, { toValue: 1, duration: 600, delay: delay * 1000, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }).start();
    Animated.timing(dash, { toValue: 0, duration: 800, delay: (delay + 0.5) * 1000, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.85, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0.35, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    const t = setTimeout(() => { glow.setValue(0.35); loop.start(); }, (delay + 1.35) * 1000);
    return () => { clearTimeout(t); loop.stop(); };
  }, [anim]); // eslint-disable-line react-hooks/exhaustive-deps

  const fontSize = (label.length > 4 ? detayAvatar.fontSizeLong : detayAvatar.fontSize) * k;
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={R} cy={R} r={R - 1 * k} fill={bg} />
        <AnimatedCircle cx={R} cy={R} r={BR} fill="none" stroke={color} strokeWidth={detayAvatar.strokeWidth * k}
          strokeLinecap="round" strokeDasharray={`${circ}`} strokeDashoffset={dash} rotation={-90} origin={`${R}, ${R}`} />
        {anim && <AnimatedCircle cx={R} cy={R} r={BR} fill="none" stroke={color} strokeWidth={detayAvatar.strokeWidth * k} opacity={glow} />}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text numberOfLines={1} style={{ fontFamily: sans(700), fontSize, color: detayAvatar.textColor, letterSpacing: fontSize * detayAvatar.letterSpacing }}>{label}</Text>
      </View>
    </Animated.View>
  );
}
