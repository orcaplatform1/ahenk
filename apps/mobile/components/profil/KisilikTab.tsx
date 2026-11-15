// Kişilik Ağacım sayfası: animasyon (ortada, tam genişlik) → boyut skorları → Big Five bilgi kartı → test tarihleri + not → Tekrar Test Yap
import React, { useEffect, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { OCEAN_DIMENSIONS } from '@/lib/oceanData';
import { topDimension } from '@/lib/kisilikAgaci';
import { KisilikAgaci } from './KisilikAgaci';
import { BtnPrimary, Card, Serif, SkeletonBlock, T } from '../ui';
import { ll, tw } from '@/theme/theme';

interface Scores { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }
interface TestResult { completed: boolean; completedAt?: string; retakeAvailableAt?: string | null; canRetakeNow?: boolean; scores?: Scores }
const fmtDate = (v?: string | null) => { if (!v) return '—'; const d = new Date(v); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }); };
const ACCENT = '#e05c4c';

// Kişilik Ağacım: eski animasyonla aynı alan (ortada, genişlik ekran − 32, yükseklik genişlik × 1,05); tam üstünde başlık
// ("KİŞİLİK BOYUTLARI" etiketiyle aynı yazı tipi, boy ve renk; büyük harfe çevrilmez)
function PersonalityTree({ scores, seed, active }: { scores: Scores; seed: string; active: number }) {
  const { width } = useWindowDimensions();
  const W = Math.min(width, 896) - 32, H = Math.round(W * 1.05);
  const v = OCEAN_DIMENSIONS.map(d => Math.min(100, Math.max(0, scores[d.key] ?? 50)) / 100);
  return (
    <View style={{ gap: 4 }}>
      <T w={600} style={{ fontSize: 8, color: ACCENT, letterSpacing: 0.72 }}>Kişilik Ağacım</T>
      <KisilikAgaci values={{ O: v[0], C: v[1], E: v[2], A: v[3], D: v[4] }} seed={seed} selected={active} width={W} height={H} />
    </View>
  );
}

// Boyut skorları listesi (animasyonun altında, tam genişlik; eski sağ liste stili)
function DimensionList({ percents, active, onSelect }: { percents: number[]; active: number; onSelect: (i: number) => void }) {
  return (
    <View style={{ gap: 4 }}>
      <T w={600} style={{ fontSize: 8, color: ACCENT, letterSpacing: 0.72, marginBottom: 2 }}>KİŞİLİK BOYUTLARI</T>
      {OCEAN_DIMENSIONS.map((d, i) => (
        <Pressable key={d.key} onPress={() => onSelect(i)} accessibilityRole="button" accessibilityState={{ selected: active === i }} style={{ minHeight: 44, backgroundColor: 'rgba(255,255,255,0.025)', borderLeftWidth: 3, borderLeftColor: active === i ? ACCENT : 'transparent', borderRadius: 7, paddingVertical: 5, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <View>
            <T w={600} style={{ fontSize: 10, color: ACCENT, lineHeight: 12 }}>{d.label}</T>
            <T style={{ fontSize: 8, color: 'rgba(255,255,255,0.62)', marginTop: 1 }}>{d.sub}</T>
          </View>
          <T w={700} style={{ fontSize: 10, color: ACCENT }}>{percents[i]}%</T>
        </Pressable>
      ))}
    </View>
  );
}

// "Ocean Big Five Kişilik Testi" bilgi kartı: sıra OCEAN_DIMENSIONS ile aynı (Açıklık, Özdisiplin, Dışadönüklük, Uyumluluk, Denge)
const BIG_FIVE_INFO: { title: string; texts: [string, string, string] }[] = [
  { title: '1. Açıklık – Yaratıcılık ve Deneyim', texts: [
    'Yeniliklere açık, meraklı, yaratıcı ve keşfetmeyi seven bir yapıya sahipsin. Farklı fikirlere, deneyimlere ve bakış açılarına kolayca ilgi duyarsın.',
    'Yenilik ile alışkanlık arasında dengeli bir yapıya sahipsin. Yeni deneyimlere ilgi duyarken bildiğin ve güvendiğin yöntemlerden de vazgeçmezsin.',
    'Daha geleneksel, alışkanlıklarına bağlı, somut ve alışılmış yöntemleri tercih eden bir yapıya sahip olabilirsin.'] },
  { title: '2. Özdisiplin – Hedef ve Düzen', texts: [
    'Planlı, sorumluluk sahibi, organize ve hedef odaklısın. Başladığın işleri tamamlama ve uzun vadeli hedeflerine bağlı kalma eğilimin yüksektir.',
    'Plan ile esneklik arasında denge kurarsın. Gerektiğinde düzenli ve hedef odaklı, gerektiğinde anlık kararlarla hareket edebilirsin.',
    'Daha spontane, esnek ve anlık kararlarla hareket eden bir yapıya sahip olabilirsin. Planlama ve işleri düzenli sürdürmekte zorlanabilirsin.'] },
  { title: '3. Dışadönüklük – Sosyal Enerji', texts: [
    'Sosyal ortamlardan enerji alan, iletişim kurmayı seven, girişken ve kendini ifade etmekten çekinmeyen bir yapıya sahipsin.',
    'Hem sosyal ortamlardan hem de yalnız geçirdiğin zamandan keyif alabilirsin. Ortama göre girişken ya da sakin ve gözlemci olabilirsin.',
    'Daha içe dönük, sakin ve gözlemci olabilirsin. Yalnız vakit geçirmekten hoşlanabilir, sosyal enerjini daha kontrollü kullanabilirsin.'] },
  { title: '4. Uyumluluk – Empati ve İşbirliği', texts: [
    'Empatik, anlayışlı, yardımsever ve işbirliğine açık bir yapıya sahipsin. İnsanların duygularını önemser, ilişkilerinde uyumu korumaya çalışırsın.',
    'İşbirliğine açıksın ama sınırların da var. Başkalarının duygularını önemserken kendi fikirlerini savunmaktan da çekinmezsin.',
    'Daha rekabetçi, sorgulayıcı, bağımsız ve doğrudan bir yaklaşım sergileyebilirsin. Kendi fikirlerini savunmaktan çekinmezsin.'] },
  { title: '5. Denge – Duygusal Esneklik', texts: [
    'Duygusal açıdan dengeli, stres karşısında dayanıklı ve zorlayıcı durumlarda sakin kalabilen bir yapıya sahipsin. Duygularını yönetme konusunda daha istikrarlı olabilirsin.',
    'Çoğu durumda sakin kalabilirsin, ancak yoğun stres anlarında duygusal olarak etkilenebilirsin. Genel olarak duygularını dengeli yönetirsin.',
    'Duygusal dalgalanmalara, kaygıya ve stresli durumlara karşı daha hassas olabilirsin. Olaylardan duygusal olarak daha fazla etkilenebilirsin.'] },
];
const BAND_LABELS = ['Skorun %55+ ise:', 'Skorun %45–55 ise:', 'Skorun %45- ise:'] as const;
// 55 ve üzeri → %55+; 45 dahil 55 hariç → %45–55; 45 altı → %45-
const bandOf = (p: number) => (p >= 55 ? 0 : p >= 45 ? 1 : 2);

function BigFiveInfoCard({ percents }: { percents: number[] }) {
  return (
    <Card style={{ gap: 14 }}>
      <Serif style={{ fontSize: 20, lineHeight: 26, color: ll.text }}>Ocean Big Five Kişilik Testi</Serif>
      <T style={{ fontSize: 13, lineHeight: 19.5, color: ll.text2 }}>Kişilik boyutları; bireylerin düşünme, hissetme, davranma ve diğer insanlarla etkileşim kurma eğilimlerini anlamaya yardımcı olan beş temel özelliği ifade eder.</T>
      {BIG_FIVE_INFO.map((dim, i) => {
        const band = bandOf(percents[i]);
        return (
          <View key={dim.title} style={{ gap: 6 }}>
            <T w={700} style={{ fontSize: 14, lineHeight: 20, color: ACCENT }}>{dim.title}</T>
            {dim.texts.map((txt, b) => (
              // Kullanıcının skoruna denk gelen metin vurgulu, diğer ikisi soluk
              <T key={b} style={{ fontSize: 12, lineHeight: 18, color: b === band ? ll.text : ll.time, opacity: b === band ? 1 : 0.45 }}>
                <T w={700} style={{ fontSize: 12, lineHeight: 18, color: b === band ? ll.text : ll.time }}>{BAND_LABELS[b]}</T> {txt}
              </T>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

export function KisilikTab() {
  const router = useRouter();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  // Tekrar test sonraki test tarihinde TR 00:01'de açılır; sayfa açıkken dakikada bir yeniden değerlendirilir
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id); }, []);
  // Ağacın tohum değeri: kullanıcı id'si (ağaç id gelmeden çizilmez, tohum değişip yeniden büyümesin)
  const [userId, setUserId] = useState('');
  useEffect(() => {
    Promise.all([api.get<TestResult>('/test/result'), api.get<{ id?: string }>('/auth/me').catch(() => null)])
      .then(([r, u]) => { setUserId(u?.id ?? ''); setResult(r); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);
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
  const scores = result.scores;
  const percents = OCEAN_DIMENSIONS.map(d => Math.round(Math.min(100, Math.max(0, scores[d.key] ?? 50))));
  // Varsayılan seçim: en yüksek puanlı boyut; eşitlikte listedeki ilk boyut
  const top = topDimension(percents);
  const active = selected ?? top;
  const retakeAt = result.retakeAvailableAt ? new Date(result.retakeAvailableAt).getTime() : null;
  const canRetake = !!result.canRetakeNow || (retakeAt !== null && now >= retakeAt);
  return (
    <View style={{ gap: 20 }}>
      <PersonalityTree scores={scores} seed={userId} active={active} />
      <DimensionList percents={percents} active={active} onSelect={setSelected} />
      <BigFiveInfoCard percents={percents} />
      <View style={{ gap: 8 }}>
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 14, color: ll.label }}>Test Tarihi</T><T style={{ fontSize: 14, color: ll.text2 }}>{fmtDate(result.completedAt)}</T></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T style={{ fontSize: 14, color: ll.label }}>Sonraki Test</T><T style={{ fontSize: 14, color: ll.text2 }}>{result.retakeAvailableAt ? fmtDate(result.retakeAvailableAt) : 'Şimdi yapabilirsin'}</T></View>
        </Card>
        <T style={{ fontSize: 11, lineHeight: 16.5, color: ll.label }}>Kişilik özellikleri genellikle kısa sürede köklü biçimde değişmez. Bu yüzden test 6 ayda bir tekrarlanır.</T>
      </View>
      <BtnPrimary label="Tekrar Test Yap" style={{ alignSelf: 'center' }} disabled={!canRetake} onPress={() => router.push('/test')} />
    </View>
  );
}
