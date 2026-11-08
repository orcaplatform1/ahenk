// apps/web/app/test/page.tsx karşılığı. S-25: test sırasında geri kaydırmada uyarı gösterilir.
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { usePreventRemove, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/lib/api';
import { LIKERT, type Question } from '@/components/TestFlow';
import { Btn, BtnGhost, BtnPrimary, Mono, PageGlow, Serif, Spinner, T, Glow } from '@/components/ui';
import { c, glassCard, tw, ll } from '@/theme/theme';

export default function Test() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get<{ sections: { questions: Question[] }[] }>('/test/questions').then(r => setQuestions(r.sections.flatMap(s => s.questions))).catch((e: Error) => setError(e.message));
  }, []);

  const [allowLeave, setAllowLeave] = useState(false);
  usePreventRemove(!allowLeave && !done && Object.keys(answers).length > 0, ({ repeat }) => {
    Alert.alert('Testten çıkılsın mı?', 'Verdiğin cevaplar kaydedilmeyecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çık', style: 'destructive', onPress: () => { setAllowLeave(true); setTimeout(repeat, 0); } },
    ]);
  });

  async function submit() {
    setSubmitting(true); setError('');
    try { await api.post('/test/submit', { answers: questions.map(q => ({ questionId: q.id, score: answers[q.id] ?? 3 })) }); setDone(true); }
    catch (e) { setError((e as Error).message); } finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}><Glow />
        <View style={{ width: '100%', maxWidth: 384, alignItems: 'center' }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(192,57,43,0.1)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.3)' }}>
            <Svg viewBox="0 0 24 24" width={40} height={40} fill="none"><Path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} stroke={c.red} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></Svg>
          </View>
          <Serif style={{ fontSize: 30, marginBottom: 12 }}>Test Tamamlandı</Serif>
          <T style={{ color: c.t888, fontSize: 14, lineHeight: 22.75, textAlign: 'center', marginBottom: 8 }}>OCEAN profilin oluşturuldu. Algoritma artık seni doğru insanlarla eşleştirebilir.</T>
          <Mono style={{ fontSize: 12, letterSpacing: 1.2, color: c.t555, marginBottom: 32 }}>⏱ Sonraki test: 180 gün sonra</Mono>
          <BtnPrimary label="Profilimi Gör" full style={{ marginBottom: 12 }} onPress={() => router.replace('/test-sonuc')} />
          <BtnGhost label="Dashboard'a Dön" full onPress={() => router.replace('/(tabs)')} />
        </View>
      </View>
    );
  }
  if (error && questions.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}><Glow />
        <T style={{ color: tw.accent, fontSize: 16, marginBottom: 16 }}>{error}</T>
        <Btn variant="textLink" textStyle={{ fontSize: 14, color: c.t888 }} onPress={() => router.back()} label="← Dashboard" />
      </View>
    );
  }
  const q = questions[current];
  if (!q) return <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><Glow /><Spinner /></View>;
  const total = questions.length;
  const progress = (Object.keys(answers).length / total) * 100;
  const has = answers[q.id] !== undefined;
  return (
    <View style={{ flex: 1, backgroundColor: tw.bg }}>
    {/* web: sağ üst 40vw rgba(192,57,43,.1) ve sol alt 35vw rgba(192,57,43,.07), şeffaf %65 */}
    <PageGlow top={0.2} right={-0.05} w={0.4} h={0.4} color="rgb(192,57,43)" opacity={0.1} stop={0.65} />
    <PageGlow bottom={0.1} left={-0.05} w={0.35} h={0.35} color="rgb(192,57,43)" opacity={0.07} stop={0.65} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ maxWidth: 576, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <T w={600} style={{ flex: 1, fontSize: 12, letterSpacing: 2.16, color: c.t888 }}>BÖLÜM {String(q.section ?? 1).padStart(2, '0')}: {(q.sectionTitle ?? '').toLocaleUpperCase('tr-TR')}</T>
        <Mono style={{ fontSize: 12, color: c.t888 }}>{current + 1} / {total}</Mono>
      </View>
      <View style={{ height: 4, borderRadius: 2, marginBottom: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: '100%', width: `${progress}%`, borderRadius: 2 }} />
      </View>
      <View style={{ gap: 16 }}>
        <View style={{ backgroundColor: glassCard.bg, borderWidth: 1, borderColor: glassCard.border, borderRadius: glassCard.radius, padding: 24 }}>
          <Mono style={{ fontSize: 12, color: c.t555, marginBottom: 12 }}>Soru {current + 1}</Mono>
          <Serif style={{ fontSize: 24, lineHeight: 33 }}>{q.text}</Serif>
        </View>
        <View style={{ gap: 8 }}>
          {LIKERT.map(({ v, label }) => {
            const sel = answers[q.id] === v;
            return (
              <Btn key={v} variant="likertTest" selected={sel} label={label} onPress={() => setAnswers(p => ({ ...p, [q.id]: v }))} />
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
        <BtnGhost label="← Geri" disabled={current === 0} style={current === 0 ? { opacity: 0.3 } : undefined} onPress={() => setCurrent(x => Math.max(0, x - 1))} />
        <BtnPrimary label={submitting ? '…' : current === total - 1 ? 'Testi Bitir' : 'İleri →'} style={[{ flex: 1 }, (!has || submitting) && { opacity: 0.3 }]} disabled={!has || submitting}
          onPress={() => { if (!has) return; if (current === total - 1) submit(); else setCurrent(x => x + 1); }} />
      </View>
      {!!error && <T style={{ color: tw.accent, fontSize: 12, textAlign: 'center', marginTop: 16 }}>{error}</T>}
    </ScrollView>
    </View>
  );
}
