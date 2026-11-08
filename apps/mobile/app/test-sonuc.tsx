// apps/web/app/test/sonuc/page.tsx karşılığı: radar grafik + 5 skor kartı
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Line, Polygon, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { api } from '@/lib/api';
import { OCEAN_TRAITS } from '@/lib/oceanData';
import { Btn, BtnGhost, BtnPrimary, Mono, Serif, Spinner, T, Glow } from '@/components/ui';
import { c, glassCard, sans, tw, ll } from '@/theme/theme';

type Score = Record<'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism', number>;

function Radar({ scores }: { scores: Score }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const size = 260, cx = 130, cy = 130, maxR = 100;
  const axes = OCEAN_TRAITS.map((_, i) => { const a = (Math.PI * 2 * i) / 5 - Math.PI / 2; return { cos: Math.cos(a), sin: Math.sin(a) }; });
  const pts = OCEAN_TRAITS.map((t, i) => { const v = (scores[t.key] ?? 50) / 100; return { x: cx + axes[i].cos * v * maxR, y: cy + axes[i].sin * v * maxR }; });
  const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
  const ht = hovered !== null ? OCEAN_TRAITS[hovered] : null;
  return (
    <View style={{ width: '100%', maxWidth: 320, aspectRatio: 1 }}>
      <Svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
        <Defs><RadialGradient id="pf" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#c0392b" stopOpacity={0.45} /><Stop offset="1" stopColor="#c0392b" stopOpacity={0.08} /></RadialGradient></Defs>
        {[0.25, 0.5, 0.75, 1].map((l, i) => <Circle key={i} cx={cx} cy={cy} r={l * maxR} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />)}
        {axes.map((a, i) => <Line key={i} x1={cx} y1={cy} x2={cx + a.cos * maxR} y2={cy + a.sin * maxR} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />)}
        <Polygon points={poly} fill="url(#pf)" />
        <Polygon points={poly} fill="none" stroke="#ff6b6b" strokeWidth={2} />
        {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#ff6b6b" />)}
        {OCEAN_TRAITS.map((t, i) => (
          <SvgText key={i} x={cx + axes[i].cos * 126} y={cy + axes[i].sin * 126 + 3.5} textAnchor="middle" fill={hovered === i ? '#ff6b6b' : '#888'} fontSize={10} fontFamily={sans(400)} onPress={() => setHovered(hovered === i ? null : i)}>{t.radarLabel}</SvgText>
        ))}
      </Svg>
      {ht && (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(20,10,10,0.9)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.4)' }}>
            <T w={600} style={{ fontSize: 12, color: '#ff6b6b' }}>{ht.label}: {Math.round(scores[ht.key])}</T>
            <T style={{ fontSize: 12, color: c.t888 }}>{ht.desc}</T>
          </View>
        </View>
      )}
    </View>
  );
}

function TraitCard({ label, score, style }: { label: string; score: number; style?: object }) {
  return (
    <View style={[{ backgroundColor: glassCard.bg, borderWidth: 1, borderColor: glassCard.border, borderRadius: glassCard.radius, padding: 16 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <T w={500} style={{ fontSize: 14 }}>{label}</T>
        <Mono w={600} style={{ fontSize: 18, color: '#ff6b6b' }}>{score}</Mono>
      </View>
      <View style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: '100%', width: `${score}%`, borderRadius: 3 }} />
      </View>
    </View>
  );
}

export default function TestSonuc() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState<Score | null>(null);
  const [profile, setProfile] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get<{ completed: boolean; scores?: Score; profile?: string }>('/test/result')
      .then(r => { if (!r.completed || !r.scores) { router.replace('/test'); return; } setScore(r.scores); setProfile(r.profile ?? ''); })
      .catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [router]);
  if (loading) return <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><Glow /><Spinner /></View>;
  if (error || !score) return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}><Glow />
      <T style={{ color: tw.accent, marginBottom: 16 }}>{error || 'Sonuç bulunamadı.'}</T>
      <Btn variant="textLink" textStyle={{ fontSize: 14, color: c.t888 }} label="← Profile Dön" onPress={() => router.back()} />
    </View>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: tw.bg }} contentContainerStyle={{ maxWidth: 576, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 48 }}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Serif style={{ fontSize: 30, marginBottom: 8 }}>Kişilik Profilin</Serif>
        <T w={600} style={{ fontSize: 12, letterSpacing: 2.4, color: c.t888 }}>OCEAN · BIG FIVE MODELİ</T>
        {!!profile && <T style={{ fontSize: 14, color: c.t888, marginTop: 12, lineHeight: 22.75, textAlign: 'center' }}>{profile}</T>}
      </View>
      <View style={{ alignItems: 'center', marginBottom: 40 }}><Radar scores={score} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {OCEAN_TRAITS.slice(0, 4).map(t => <TraitCard key={t.key} label={t.label} score={Math.round(score[t.key])} style={{ width: '48%', flexGrow: 1 }} />)}
      </View>
      <TraitCard label={OCEAN_TRAITS[4].label} score={Math.round(score[OCEAN_TRAITS[4].key])} />
      <View style={{ marginTop: 32, gap: 12 }}>
        <BtnPrimary label="Dashboard'a Git →" full onPress={() => router.replace('/(tabs)')} />
        <BtnGhost label="Profile Dön" full onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}
