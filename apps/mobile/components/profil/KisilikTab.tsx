// apps/web/app/profil/tabs/TabTest.tsx karşılığı: PersonalityAura (canvas → SVG, aynı formül), test tarihleri, Tekrar Test Yap
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { api } from '@/lib/api';
import { OCEAN_DIMENSIONS } from '@/lib/oceanData';
import { useReduceMotion } from '@/lib/motion';
import { BtnPrimary, Card, Serif, SkeletonBlock, T } from '../ui';
import { ll, tw } from '@/theme/theme';

interface Scores { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }
interface TestResult { completed: boolean; completedAt?: string; retakeAvailableAt?: string | null; canRetakeNow?: boolean; scores?: Scores }
type RGB = { r: number; g: number; b: number };

const fmtDate = (v?: string | null) => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }); };
const getLevel = (v: number) => (v < 0.4 ? 0 : v < 0.7 ? 1 : 2);
const P = (i: RGB, m: RGB, o: RGB, a: number) => ({ i, m, o, a });
const PALETTES = [
  [P({r:30,g:10,b:80},{r:80,g:30,b:160},{r:140,g:80,b:220},0.34),P({r:20,g:5,b:60},{r:60,g:20,b:130},{r:120,g:60,b:200},0.27),P({r:40,g:15,b:90},{r:90,g:40,b:170},{r:150,g:90,b:230},0.20),P({r:15,g:5,b:50},{r:50,g:15,b:110},{r:100,g:50,b:180},0.17),P({r:25,g:8,b:70},{r:70,g:25,b:140},{r:130,g:70,b:210},0.13)],
  [P({r:5,g:20,b:50},{r:10,g:70,b:100},{r:20,g:130,b:160},0.34),P({r:3,g:15,b:40},{r:8,g:55,b:85},{r:15,g:110,b:140},0.27),P({r:5,g:30,b:60},{r:10,g:80,b:110},{r:20,g:140,b:170},0.20),P({r:2,g:10,b:35},{r:6,g:45,b:75},{r:12,g:95,b:125},0.17),P({r:4,g:22,b:48},{r:9,g:62,b:92},{r:18,g:120,b:150},0.13)],
  [P({r:80,g:20,b:5},{r:160,g:60,b:10},{r:220,g:120,b:30},0.34),P({r:60,g:15,b:3},{r:130,g:45,b:8},{r:190,g:95,b:20},0.27),P({r:90,g:25,b:6},{r:170,g:70,b:12},{r:230,g:135,b:35},0.20),P({r:50,g:12,b:2},{r:110,g:35,b:6},{r:170,g:80,b:15},0.17),P({r:70,g:18,b:4},{r:145,g:52,b:9},{r:205,g:108,b:25},0.13)],
  [P({r:5,g:50,b:45},{r:10,g:130,b:120},{r:30,g:200,b:185},0.34),P({r:3,g:38,b:34},{r:8,g:108,b:100},{r:22,g:175,b:162},0.27),P({r:6,g:58,b:52},{r:12,g:145,b:135},{r:35,g:210,b:195},0.20),P({r:2,g:30,b:27},{r:6,g:90,b:84},{r:18,g:155,b:143},0.17),P({r:4,g:44,b:40},{r:10,g:118,b:110},{r:27,g:188,b:174},0.13)],
  [P({r:8,g:20,b:70},{r:20,g:55,b:160},{r:60,g:110,b:230},0.34),P({r:5,g:15,b:55},{r:15,g:42,b:135},{r:45,g:88,b:200},0.27),P({r:9,g:24,b:80},{r:22,g:62,b:175},{r:68,g:120,b:240},0.20),P({r:4,g:12,b:48},{r:12,g:35,b:118},{r:38,g:75,b:180},0.17),P({r:6,g:18,b:62},{r:17,g:48,b:148},{r:52,g:98,b:215},0.13)],
];
const GLOWS: RGB[] = [{r:124,g:58,b:237},{r:8,g:145,b:178},{r:249,g:115,b:22},{r:45,g:212,b:191},{r:96,g:165,b:250}];
const lerp = (a: RGB, b: RGB, t: number): RGB => ({ r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) });
const rgb = (c: RGB) => `rgb(${c.r},${c.g},${c.b})`;
const ACCENT = '#e05c4c';

function PersonalityAura({ scores }: { scores: Scores }) {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const W = Math.min(width, 896) - 32, H = 290;
  const ocean = OCEAN_DIMENSIONS.map(d => ({ value: Math.min(100, Math.max(0, scores[d.key] ?? 50)) / 100, levels: d.levels }));
  const st = useRef({ active: 3, turb: 0.15, time: 0, layers: PALETTES[3].map(l => ({ i: { ...l.i }, m: { ...l.m }, o: { ...l.o }, a: l.a })), glow: { ...GLOWS[3] } });
  const [, setFrame] = useState(0);
  const [activeId, setActiveId] = useState(3);
  const [hintGone, setHintGone] = useState(false);
  const [card, setCard] = useState({ show: true, title: OCEAN_DIMENSIONS[3].label, text: ocean[3].levels[getLevel(ocean[3].value)] });

  useEffect(() => {
    const id = setInterval(() => {
      const s = st.current;
      if (!reduce) s.time += 0.011 * 2;
      s.turb += (0.13 - s.turb) * 0.1;
      s.glow = lerp(s.glow, GLOWS[s.active], 0.08);
      PALETTES[s.active].forEach((tl, li) => { const L = s.layers[li]; L.i = lerp(L.i, tl.i, 0.08); L.m = lerp(L.m, tl.m, 0.08); L.o = lerp(L.o, tl.o, 0.08); });
      setFrame(f => f + 1);
    }, 33);
    return () => clearInterval(id);
  }, [reduce]);

  function select(id: number) {
    if (!hintGone) setHintGone(true);
    st.current.active = id; st.current.turb = 1.1; setActiveId(id);
    setCard(c => ({ ...c, show: false }));
    setTimeout(() => setCard({ show: true, title: OCEAN_DIMENSIONS[id].label, text: ocean[id].levels[getLevel(ocean[id].value)] }), 200);
  }

  const s = st.current;
  const cx = W * 0.25, cy = H * 0.5, baseR = 88, t = s.time, turb = s.turb, ov = ocean.map(o => o.value), aid = s.active;
  const paths = s.layers.map((layer, li) => {
    const spd = 0.7 + li * 0.15, shrink = li * 10;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 100; i++) {
      const ang = (i / 100) * Math.PI * 2;
      let n = Math.sin(ang * 3 + t * spd + li * 0.8) * 16 * ov[0];
      n += Math.cos(ang * 5 - t * 0.75 * spd + li * 0.5) * 11 * ov[2];
      n += Math.sin(ang * 2 + t * 1.2 * spd) * 19 * ov[3];
      n += Math.cos(ang * 7 + t * 0.55 * spd + li) * 5 * ov[1];
      n += Math.sin(ang * 4 - t * spd) * 8 * ov[4];
      const aAng = (aid / 5) * Math.PI * 2 - Math.PI / 2;
      const diff = Math.min(Math.abs(ang - aAng), Math.PI * 2 - Math.abs(ang - aAng));
      if (diff < 1.3) n *= 1 + turb * (2.4 + li * 0.3);
      const r = baseR - shrink + n * turb * (3.5 + li * 0.4);
      pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
    return { d: d + ' Z', layer, r: (baseR - shrink) * 1.5 };
  });

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ width: '100%', height: H }}>
        <Svg width={W} height={H} style={{ position: 'absolute' }}>
          <Defs>
            {paths.map((p, li) => (
              <RadialGradient key={li} id={`a${li}`} cx={cx} cy={cy} r={p.r} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={rgb(p.layer.i)} /><Stop offset="0.45" stopColor={rgb(p.layer.m)} /><Stop offset="0.82" stopColor={rgb(p.layer.o)} /><Stop offset="1" stopColor="rgb(17,18,20)" stopOpacity={0} />
              </RadialGradient>
            ))}
            <RadialGradient id="core" cx={cx} cy={cy} r={baseR * 0.32} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={rgb(s.glow)} stopOpacity={0.3} /><Stop offset="0.5" stopColor={rgb(s.glow)} stopOpacity={0.1} /><Stop offset="1" stopColor="#000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {paths.map((p, li) => <Path key={li} d={p.d} fill={`url(#a${li})`} opacity={p.layer.a} />)}
          <Circle cx={cx} cy={cy} r={baseR * 0.32} fill="url(#core)" />
        </Svg>
        <View style={{ position: 'absolute', top: 10, right: 0, width: 148, gap: 4, paddingHorizontal: 8 }}>
          <T w={600} style={{ fontSize: 8, color: ACCENT, letterSpacing: 0.72, marginBottom: 2 }}>KİŞİLİK BOYUTLARI</T>
          {OCEAN_DIMENSIONS.map((d, i) => (
            <Pressable key={d.key} onPress={() => select(i)} style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderLeftWidth: 3, borderLeftColor: activeId === i ? ACCENT : 'transparent', borderRadius: 7, paddingVertical: 5, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <View>
                <T w={600} style={{ fontSize: 10, color: ACCENT, lineHeight: 12 }}>{d.label}</T>
                <T style={{ fontSize: 8, color: 'rgba(255,255,255,0.62)', marginTop: 1 }}>{d.sub}</T>
              </View>
              <T w={700} style={{ fontSize: 10, color: ACCENT }}>{Math.round(ocean[i].value * 100)}%</T>
            </Pressable>
          ))}
        </View>
      </View>
      {!hintGone && <T style={{ paddingTop: 8, paddingHorizontal: 12, paddingBottom: 3, fontSize: 11, color: '#8a8a8a' }}>Kişilik frekansını keşfetmek için bir boyuta dokun.</T>}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', borderTopLeftRadius: 10, borderTopRightRadius: 10, paddingTop: 9, paddingHorizontal: 12, paddingBottom: 13, opacity: card.show ? 1 : 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ width: 2, borderRadius: 2, backgroundColor: ACCENT, alignSelf: 'stretch', minHeight: 22 }} />
          <View style={{ flex: 1 }}>
            <Serif style={{ fontSize: 13, color: ACCENT, letterSpacing: 0.13, marginBottom: 3 }}>{card.title}</Serif>
            <T style={{ fontSize: 10, color: 'rgba(255,255,255,0.62)', lineHeight: 15.5 }}>{card.text}</T>
          </View>
        </View>
      </View>
    </Card>
  );
}

export function KisilikTab() {
  const router = useRouter();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { api.get<TestResult>('/test/result').then(setResult).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  if (loading) return <SkeletonBlock lines={6} />;
  if (error) return <T style={{ color: tw.accent, fontSize: 14 }}>{error === '__rate_limit__' ? 'Çok fazla istek gönderildi. Lütfen sayfayı yeniden yükleyin.' : error}</T>;
  if (!result || !result.completed || !result.scores) {
    return (
      <Card style={{ alignItems: 'center', gap: 16 }}>
        <T style={{ color: ll.label, fontSize: 14, textAlign: 'center' }}>Henüz kişilik testini yapmadın.</T>
        <BtnPrimary label="Teste Başla →" style={{ alignSelf: 'center' }} onPress={() => router.push('/test')} />
      </Card>
    );
  }
  return (
    <View style={{ gap: 20 }}>
      <PersonalityAura scores={result.scores} />
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 14, color: ll.label }}>Test Tarihi</T><T style={{ fontSize: 14, color: ll.text2 }}>{fmtDate(result.completedAt)}</T></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 14, color: ll.label }}>Sonraki Test</T><T style={{ fontSize: 14, color: ll.text2 }}>{result.retakeAvailableAt ? fmtDate(result.retakeAvailableAt) : 'Şimdi yapabilirsin'}</T></View>
      </Card>
      <BtnPrimary label="Tekrar Test Yap" style={{ alignSelf: 'center' }} disabled={!result.canRetakeNow} onPress={() => router.push('/test')} />
    </View>
  );
}
