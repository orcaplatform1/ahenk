// packages/ui AhenkSonar + apps/web/components/live/LiveSonar.tsx karşılığı
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGrad, Path, Stop, Text as SvgText } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { LEVELS, ll, sans } from '@/theme/theme';
import { useAnimActive, useReduceMotion } from '@/lib/motion';
import type { LivePulse, SonarDensity, SonarState } from '@/lib/liveTypes';
import { Head, T } from './ui';
import { useTranslation } from 'react-i18next';

// Yoğunluk seviyesi adları (theme LEVELS sırası 1–4)
export const LEVEL_KEY = { 1: 'common.levelVeryBusy', 2: 'common.levelBusy', 3: 'common.levelMedium', 4: 'common.levelLow' } as const;

const SIZE = 300; const C = SIZE / 2; const RINGS = [140, 104, 68, 32];
const RING_RADIUS: Record<SonarState, number> = { new: 50, active: 86, pool: 122 };
const DOT: Record<SonarState, { color: string; r: number }> = { new: { color: '#ff6b5e', r: 4.5 }, active: { color: '#e8a27a', r: 3.5 }, pool: { color: '#c9c2b8', r: 2.5 } };
const LABEL_H = 12, LABEL_GAP = 3, EDGE = 4;
const LEVEL_ORDER = [1, 2, 3, 4] as const;
// Dört grubun isimleri aynı font, kalınlık (700) ve boyutta (10.5); genişlik tahmini kalın harfe göre
const LABEL_CHAR = 6.4;
const PULSE_SCALE = 1.5; // CycleDot büyüme oranı (web ll-d-pulse ile aynı)
function hashAngle(text: string) { let h = 0; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return ((h % 360) * Math.PI) / 180; }
function point(a: number, r: number) { return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }; }
function dotAngle(key: string, d: string | null) { if (!d) return hashAngle(key); return hashAngle(d) + ((hashAngle(key) / (2 * Math.PI)) - 0.5) * 0.5; }
function sweepEnd() { const a = -Math.PI / 3; return `${(C + 140 * Math.cos(a)).toFixed(1)} ${(C + 140 * Math.sin(a)).toFixed(1)}`; }

// N semt için açı aralığı 360/N; her semt ayrı açıda. Gruplar sırayla iç içe dizilir (Çok yoğun, Yoğun, Orta, Düşük, tekrar
// Çok yoğun…) → aynı gruptaki semtler birbirinden en uzak açılara düşer. Uzaklık (band) ve nokta boyu seviye kuralıyla aynı (web LiveSonar ile aynı)
// İsim: sağ yarıdaki noktada sağa, sol yarıdakinde sola; radar dışına taşacaksa yatayda içeri çekilir ve noktanın üstüne / altına
// (merkeze doğru) alınır. Bu konum bir noktaya (nabızla büyümüş hâli dahil) ya da aynı anda görünen (aynı gruptaki) başka bir isme
// değiyorsa sırasıyla sağ, sol, üst, alt denenir; hiçbiri uymazsa noktaya en yakın boş konum kullanılır. Kısaltma yok, radar dışına taşmaz
type Box = { x0: number; y0: number; x1: number; y1: number };
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (b: Box) => b.x0 >= EDGE && b.x1 <= SIZE - EDGE && b.y0 >= EDGE && b.y1 <= SIZE - EDGE;
function placeDistricts(density: SonarDensity) {
  const groups = LEVEL_ORDER.map((level) => density.districts.filter((d) => d.level === level));
  const order: SonarDensity['districts'] = [];
  for (let i = 0; order.length < density.districts.length; i++) groups.forEach((g) => { if (g[i]) order.push(g[i]); });
  const step = (2 * Math.PI) / Math.max(order.length, 1);
  const items = order.map((d, i) => {
    const angle = -Math.PI / 2 + i * step;
    const cfg = LEVELS[d.level];
    return { ...d, ...cfg, ...point(angle, cfg.band), angle };
  });
  const dots: Box[] = items.map((b) => { const R = b.r * PULSE_SCALE + 1; return { x0: b.x - R, y0: b.y - R, x1: b.x + R, y1: b.y + R }; });
  const shown: Record<number, Box[]> = {};
  return items.map((b) => {
    const width = b.name.length * LABEL_CHAR + 2;
    const R = b.r * PULSE_SCALE + 1;
    const box = (x0: number, y0: number): Box => ({ x0, y0, x1: x0 + width, y1: y0 + LABEL_H });
    const clampX = (x0: number) => Math.min(Math.max(x0, EDGE), SIZE - EDGE - width);
    const beside = b.y - LABEL_H / 2;
    // Mevcut yerleşim
    const right = Math.cos(b.angle) >= -1e-9;
    const sideX = right ? b.x + R + LABEL_GAP : b.x - R - LABEL_GAP - width;
    const current = clampX(sideX) === sideX ? box(sideX, beside)
      : box(clampX(sideX), b.y >= C ? b.y - R - LABEL_GAP - LABEL_H : b.y + R + LABEL_GAP);
    const others = shown[b.level] ?? (shown[b.level] = []);
    const free = (c: Box) => inside(c) && !dots.some((d) => hit(d, c)) && !others.some((o) => hit(o, c));
    const candidates = [
      current,
      box(b.x + R + LABEL_GAP, beside),
      box(b.x - R - LABEL_GAP - width, beside),
      box(clampX(b.x - width / 2), b.y - R - LABEL_GAP - LABEL_H),
      box(clampX(b.x - width / 2), b.y + R + LABEL_GAP),
    ];
    let pick = candidates.find(free);
    // Noktaya en yakın boş konum: merkezden dışa halkalar halinde aranır
    for (let dist = 2; !pick && dist <= SIZE; dist += 2) {
      for (let k = 0; k < 32 && !pick; k++) {
        const a = (k * Math.PI) / 16;
        const c = box(b.x + dist * Math.cos(a) - width / 2, b.y + dist * Math.sin(a) - LABEL_H / 2);
        if (free(c)) pick = c;
      }
    }
    const placed = pick ?? current;
    others.push(placed);
    return { ...b, labelX: placed.x0, labelY: placed.y1 - 2.5 };
  });
}

// Canlı tarama döngüsü: Çok yoğun → Yoğun → Orta → Düşük, her grup 3 sn, sonsuz. Tek paylaşılan saat (0 → 4, 12 sn, doğrusal,
// tekrar) UI thread'de (reanimated, native) döner; aktif grup = saatin tam kısmı. React yeniden render ve JS zamanlayıcısı yok.
// Sırası gelen grubun isimleri yumuşakça belirip kaybolur (opacity), noktaları 3 sn boyunca büyüyüp küçülerek yanıp söner
// (transform scale + opacity); diğer gruplar sabit, isimsiz. Ekran odakta değilken / arka planda saat durur, dönünce kaldığı yerden
// sürer; bileşen kaldırılınca iptal edilir. Hareketi Azalt açıkken noktalar büyümez, isimler yalnız yumuşakça belirir (HIG crossfade)
const GROUP_MS = 3000;
const FADE_MS = 400;
const PULSES = 3;
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);
// groups: döngüdeki (semti olan) grup sayısı; semti olmayan grup atlanır
function useCycleClock(active: boolean, groups: number) {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!active || groups === 0) { cancelAnimation(clock); return undefined; }
    const from = clock.value % groups;
    clock.value = from;
    clock.value = withRepeat(withTiming(from + groups, { duration: GROUP_MS * groups, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [active, groups, clock]);
  return clock;
}
// slot: grubun döngüdeki sırası, groups: döngüdeki grup sayısı
function CycleDot({ x, y, r, color, opacity, slot, groups, clock, reduce }: { x: number; y: number; r: number; color: string; opacity: number; slot: number; groups: number; clock: SharedValue<number>; reduce: boolean }) {
  const style = useAnimatedStyle(() => {
    const c = clock.value % groups;
    if (reduce || Math.floor(c) !== slot) return { opacity, transform: [{ scale: 1 }] };
    const v = 0.5 - 0.5 * Math.cos(2 * Math.PI * PULSES * (c - Math.floor(c)));
    return { opacity: opacity * (1 - 0.65 * v), transform: [{ scale: 1 + 0.5 * v }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: color }, style]} />;
}
function CycleLabel({ x, y, slot, groups, color, name, clock }: { x: number; y: number; slot: number; groups: number; color: string; name: string; clock: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    const c = clock.value % groups;
    if (Math.floor(c) !== slot) return { opacity: 0 };
    const ms = (c - Math.floor(c)) * GROUP_MS;
    return { opacity: Math.min(1, ms / FADE_MS, (GROUP_MS - ms) / FADE_MS) };
  });
  return <AnimatedSvgText x={x} y={y} fontSize={10.5} fontWeight="700" fill={color} fontFamily={sans(700)} animatedProps={animatedProps}>{name}</AnimatedSvgText>;
}

// idle: tek PASSIVE / LIVE durumu — PASSIVE'de ışın bulunduğu açıda durur, LIVE'da sürekli döner
export function AhenkSonar({ width = SIZE, children, overlay, sweep = true, idle = false }: { width?: number; children?: React.ReactNode; overlay?: React.ReactNode; sweep?: boolean; idle?: boolean }) {
  const reduce = useReduceMotion();
  // Işın dönüşü UI thread'de (reanimated); ekran odakta değilken / uygulama arka plandayken durur, dönünce kaldığı açıdan sürer
  const active = useAnimActive();
  const deg = useSharedValue(0);
  const spinning = sweep && !idle && !reduce && active;
  useEffect(() => {
    if (!spinning) { cancelAnimation(deg); return undefined; }
    const from = deg.value % 360;
    deg.value = from;
    deg.value = withRepeat(withTiming(from + 360, { duration: 6000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(deg);
  }, [spinning, deg]);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${deg.value}deg` }] }));
  return (
    <View style={{ width, height: width }}>
      <Svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={width} height={width} style={{ position: 'absolute' }}>
        {RINGS.map((r, i) => <Circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#e8a27a" strokeOpacity={0.18 - (i * 0.04) / 3} />)}
        <Line x1={C - 140} y1={C} x2={C + 140} y2={C} stroke="rgba(255,255,255,0.05)" />
        <Line x1={C} y1={C - 140} x2={C} y2={C + 140} stroke="rgba(255,255,255,0.05)" />
      </Svg>
      {sweep && (
        <Animated.View style={[{ position: 'absolute', width, height: width }, sweepStyle]}>
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
      {overlay && <View pointerEvents="none" style={{ position: 'absolute', width, height: width }}>{overlay}</View>}
    </View>
  );
}

// Tarama başlamadan (idle): dönen ışık bulunduğu açıda durur; bütün semt noktaları "Düşük" grisinde, aynı büyüklükte ve hareketsiz
const WAIT_DOT = { color: LEVELS[4].color, r: LEVELS[4].r, opacity: LEVELS[4].opacity };

// idle: tarama başlamadı (Eşleşme Paneli "Yeni tarama başlamasına" geri sayımı gösterilirken) — rozet "PASİF", radar durur.
// Aksi hâlde tarama canlı: rozet "CANLI", ışın sürekli döner; her semtin noktası ve adı yoğunluk seviyesinin renginde
// (theme LEVELS: Çok yoğun kırmızı, Yoğun turuncu, Orta sarı, Düşük gri — lejant renkleri), noktalar yanıp söner.
export function LiveSonar({ sonar, idle = false }: { sonar: LivePulse['sonar'] | null; idle?: boolean }) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const active = useAnimActive();
  const dots = sonar?.dots ?? [];
  const density = sonar?.density ?? null;
  const placed = useMemo(() => (density ? placeDistricts(density) : []), [density]);
  // Semti olmayan grup döngüde atlanır
  const cycle: number[] = LEVEL_ORDER.filter((level) => placed.some((b) => b.level === level));
  const clock = useCycleClock(!idle && active, cycle.length);
  const legend: [string, string][] = density ? (Object.entries(LEVELS) as unknown as [keyof typeof LEVEL_KEY, (typeof LEVELS)[1]][]).map(([k, l]) => [t(LEVEL_KEY[k]), l.color]) : [[t('live.legendNew'), '#ff6b5e'], [t('live.legendActive'), '#e8a27a'], [t('live.legendPool'), '#c9c2b8']];
  return (
    <View>
      <Head title={t('live.scanTitle')} right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9999, borderWidth: 1, borderColor: idle ? '#ff3b30' : '#22c55e' }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: idle ? '#ff3b30' : '#22c55e' }} />
          <T w={600} style={{ fontSize: 11, color: idle ? '#ff3b30' : '#22c55e' }}>{idle ? t('live.badgeInactive') : t('live.liveBadge')}</T>
        </View>
      } />
      <View style={{ alignItems: 'center' }}>
        <AhenkSonar idle={idle} overlay={density ? placed.map((b) => idle
          ? <View key={b.name} style={{ position: 'absolute', left: b.x - WAIT_DOT.r, top: b.y - WAIT_DOT.r, width: WAIT_DOT.r * 2, height: WAIT_DOT.r * 2, borderRadius: WAIT_DOT.r, backgroundColor: WAIT_DOT.color, opacity: WAIT_DOT.opacity }} />
          : <CycleDot key={b.name} x={b.x} y={b.y} r={b.r} color={b.color} opacity={b.opacity} slot={cycle.indexOf(b.level)} groups={cycle.length} clock={clock} reduce={reduce} />) : undefined}>
          {density ? (idle ? null : placed.map((b) => (
            <CycleLabel key={b.name} x={b.labelX} y={b.labelY} slot={cycle.indexOf(b.level)} groups={cycle.length} color={b.color} name={b.name} clock={clock} />
          ))) : (
            <>
              {dots.map((d) => { const p = point(dotAngle(d.key, d.district), RING_RADIUS[d.state]); const st = idle ? WAIT_DOT : DOT[d.state]; return <Circle key={d.key} cx={p.x} cy={p.y} r={st.r} fill={st.color} />; })}
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
