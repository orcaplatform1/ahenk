// packages/ui AhenkSonar + apps/web/components/live/LiveSonar.tsx karşılığı
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGrad, Path, Stop, Text as SvgText, G } from 'react-native-svg';
import { LEVELS, ll, sans } from '@/theme/theme';
import { useReduceMotion } from '@/lib/motion';
import type { LivePulse, SonarDensity, SonarState } from '@/lib/liveTypes';
import { Head, T } from './ui';

const SIZE = 300; const C = SIZE / 2; const RINGS = [140, 104, 68, 32];
const RING_RADIUS: Record<SonarState, number> = { new: 50, active: 86, pool: 122 };
const DOT: Record<SonarState, { color: string; r: number }> = { new: { color: '#ff6b5e', r: 4.5 }, active: { color: '#e8a27a', r: 3.5 }, pool: { color: '#c9c2b8', r: 2.5 } };
const LABEL_H = 12, LABEL_GAP = 3, EDGE = 4;
type Box = { x0: number; x1: number; y0: number; y1: number };
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (b: Box) => b.x0 >= EDGE && b.x1 <= SIZE - EDGE && b.y0 >= EDGE && b.y1 <= SIZE - EDGE;
function hashAngle(text: string) { let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return ((h % 360) * Math.PI) / 180; }
function point(a: number, r: number) { return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }; }
function dotAngle(key: string, d: string | null) { if (!d) return hashAngle(key); return hashAngle(d) + ((hashAngle(key) / (2 * Math.PI)) - 0.5) * 0.5; }
function sweepEnd() { const a = -Math.PI / 3; return `${(C + 140 * Math.cos(a)).toFixed(1)} ${(C + 140 * Math.sin(a)).toFixed(1)}`; }

function placeBubbles(density: SonarDensity) {
  return ([1, 2, 3, 4] as const).flatMap((level) => {
    const rows = density.districts.filter((d) => d.level === level);
    const cfg = LEVELS[level];
    return rows.map((d, i) => ({ ...d, ...cfg, ...point(((cfg.start + (i * 360) / rows.length) * Math.PI) / 180, cfg.band) }));
  });
}
function placeLabels(bubbles: ReturnType<typeof placeBubbles>) {
  const circles: Box[] = bubbles.map((b) => ({ x0: b.x - b.r - 1, x1: b.x + b.r + 1, y0: b.y - b.r - 1, y1: b.y + b.r + 1 }));
  const placed: Box[] = [];
  return bubbles.map((b, index) => {
    const width = b.name.length * (b.level <= 2 ? 6.4 : 5.9) + 2;
    const left = b.x - b.r - LABEL_GAP - width, right = b.x + b.r + LABEL_GAP, center = b.x - width / 2;
    const above = b.y - b.r - LABEL_GAP - LABEL_H, below = b.y + b.r + LABEL_GAP, beside = b.y - LABEL_H / 2;
    const toward = b.x >= C ? [left, right] : [right, left];
    const cands: { x: number; y: number }[] = [...toward.map((x) => ({ x, y: beside })), { x: center, y: b.y >= C ? above : below }, { x: center, y: b.y >= C ? below : above }];
    for (const step of [13, 26, 39]) for (const x of [...toward, center]) cands.push({ x, y: beside - step }, { x, y: beside + step });
    const toBox = (c: { x: number; y: number }): Box => ({ x0: c.x, x1: c.x + width, y0: c.y, y1: c.y + LABEL_H });
    const others = circles.filter((_, i) => i !== index);
    const free = (box: Box) => inside(box) && !placed.some((p) => hit(p, box)) && !others.some((p) => hit(p, box));
    const pick = cands.find((c) => free(toBox(c))) ?? cands.find((c) => inside(toBox(c)) && !placed.some((p) => hit(p, toBox(c)))) ?? cands[0];
    const box = toBox(pick); placed.push(box);
    return { ...b, labelX: box.x0, labelY: box.y0 + LABEL_H - 2.5 };
  });
}

// Web .ll-bubble-breathe karşılığı: 2,5 sn'de %85 ↔ %115, noktalar kaydırmalı
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
function BreathingCircle({ cx, cy, r, fill, opacity, index }: { cx: number; cy: number; r: number; fill: string; opacity: number; index: number }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const half = { duration: 1250, easing: Easing.inOut(Easing.ease), useNativeDriver: false };
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, ...half }), Animated.timing(v, { toValue: 0, ...half })]));
    const t = setTimeout(() => loop.start(), (index * 370) % 2500);
    return () => { clearTimeout(t); loop.stop(); };
  }, [reduce, v, index]);
  if (reduce) return <Circle cx={cx} cy={cy} r={r} fill={fill} opacity={opacity} />;
  return <AnimatedCircle cx={cx} cy={cy} r={v.interpolate({ inputRange: [0, 1], outputRange: [r * 0.85, r * 1.15] })} fill={fill} opacity={opacity} />;
}

export function AhenkSonar({ width = SIZE, children, sweep = true, scanOff = false }: { width?: number; children?: React.ReactNode; sweep?: boolean; scanOff?: boolean }) {
  const reduce = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!sweep || scanOff || reduce) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [sweep, scanOff, reduce, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ width, height: width }}>
      <Svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={width} height={width} style={{ position: 'absolute' }}>
        {RINGS.map((r, i) => <Circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#e8a27a" strokeOpacity={0.18 - (i * 0.04) / 3} />)}
        <Line x1={C - 140} y1={C} x2={C + 140} y2={C} stroke="rgba(255,255,255,0.05)" />
        <Line x1={C} y1={C - 140} x2={C} y2={C + 140} stroke="rgba(255,255,255,0.05)" />
      </Svg>
      {sweep && (
        <Animated.View style={{ position: 'absolute', width, height: width, transform: [{ rotate }] }}>
          <Svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={width} height={width}>
            <Defs>
              <SvgGrad id="sw" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor="#d6453a" stopOpacity="0" />
                <Stop offset="1" stopColor="#d6453a" stopOpacity="0.45" />
              </SvgGrad>
            </Defs>
            <Path d={`M ${C} ${C} L ${C + 140} ${C} A 140 140 0 0 0 ${sweepEnd()} Z`} fill="url(#sw)" />
          </Svg>
        </Animated.View>
      )}
      <Svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={width} height={width} style={{ position: 'absolute' }}>
        {children}
        <Circle cx={C} cy={C} r={5} fill="#e8a27a" />
      </Svg>
    </View>
  );
}

export function LiveSonar({ sonar, scanOff }: { sonar: LivePulse['sonar'] | null; scanOff?: boolean }) {
  const dots = sonar?.dots ?? [];
  const density = sonar?.density ?? null;
  const legend: [string, string][] = density ? Object.values(LEVELS).map((l) => [l.label, l.color]) : [['yeni giriş', '#ff6b5e'], ['aktif', '#e8a27a'], ['havuzda', '#c9c2b8']];
  return (
    <View>
      <Head title="Eşleşme Taraması" right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,107,94,0.35)' }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e' }} />
          <T w={600} style={{ fontSize: 11, color: '#22c55e' }}>CANLI</T>
        </View>
      } />
      <View style={{ alignItems: 'center' }}>
        <AhenkSonar scanOff={scanOff}>
          {density ? placeLabels(placeBubbles(density)).map((b, i) => (
            <G key={b.name}>
              <BreathingCircle index={i} cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity={b.opacity} />
              <SvgText x={b.labelX} y={b.labelY} fontSize={10.5} fontWeight={b.level <= 2 ? '700' : '400'} fill={b.level <= 2 ? ll.text : ll.text2} fontFamily={sans(b.level <= 2 ? 700 : 400)}>{b.name}</SvgText>
            </G>
          )) : (
            <>
              {dots.map((d) => { const p = point(dotAngle(d.key, d.district), RING_RADIUS[d.state]); const st = DOT[d.state]; return <Circle key={d.key} cx={p.x} cy={p.y} r={st.r} fill={st.color} />; })}
              {(sonar?.labels ?? []).map((l) => {
                const p = point(hashAngle(l.name), 104);
                return <SvgText key={l.name} x={p.x} y={p.y - 8} textAnchor={p.x > C + 40 ? 'end' : p.x < C - 40 ? 'start' : 'middle'} fontSize={10.5} fill={l.active ? ll.text : ll.text2} fontFamily={sans(l.active ? 700 : 400)}>{l.name}</SvgText>;
              })}
            </>
          )}
        </AhenkSonar>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: 10 }}>
        {legend.map(([label, color]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <T style={{ fontSize: 11, color: ll.text2 }}>{label}</T>
          </View>
        ))}
      </View>
    </View>
  );
}
