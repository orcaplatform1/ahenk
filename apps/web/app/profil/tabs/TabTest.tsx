'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { OCEAN_DIMENSIONS } from '@ahenk/ui';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { buildTree, frameOf, layoutTree, newAnimState, restart, tick, topDimension, RENK, type Cizgi, type Elips } from '@/lib/kisilikAgaci';

interface Scores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface TestResult {
  completed: boolean;
  completedAt?: string;
  retakeAvailableAt?: string | null;
  canRetakeNow?: boolean;
  scores?: Scores;
}

function fmtDate(val?: string | null) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
}


const DIMENSIONS = OCEAN_DIMENSIONS;

/* ── Kişilik Ağacı canvas bileşeni (eski blob animasyonunun yerinde; formüller lib/kisilikAgaci.ts) ── */
// Ağaç alanı: canvas'ın sağdaki boyut listesi (148 px) dışında kalan kısmı, yükseklik 290
const LIST_W = 148;
function PersonalityAura({ scores, seed }: { scores: Scores; seed: string }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const topRef     = useRef<HTMLDivElement>(null);

  const ocean = DIMENSIONS.map(d => ({
    value: Math.min(100, Math.max(0, scores[d.key] ?? 50)) / 100,
    levels: d.levels,
  }));
  const percents = ocean.map(o => Math.round(o.value * 100));
  // Varsayılan seçim: en yüksek puanlı boyut (eşitlikte listedeki ilk boyut)
  const top = topDimension(percents);

  const [activeId,  setActiveId]  = useState(top);

  const O = ocean[0].value, C = ocean[1].value, E = ocean[2].value, A = ocean[3].value, D = ocean[4].value;
  // Ağaç yapısı yalnız değerler veya tohum değişince yeniden üretilir
  const tree = useMemo(() => buildTree({ O, C, E, A, D }, seed), [O, C, E, A, D, seed]);
  const anim = useRef(newAnimState());
  const selRef = useRef(activeId);
  selRef.current = activeId;

  const handleSelect = (id: number) => { if (id !== activeId) setActiveId(id); };

  useEffect(() => {
    const canvas = canvasRef.current;
    const box    = topRef.current;
    if (!canvas || !box) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0, layout = layoutTree(tree, 1, 1);

    // Canvas devicePixelRatio'ya göre ölçeklenir
    function resize() {
      if (!canvas || !box) return;
      const dpr = window.devicePixelRatio || 1;
      W = box.offsetWidth || 380; H = box.offsetHeight || 290;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout = layoutTree(tree, Math.max(1, W - LIST_W), H);
    }
    resize();
    window.addEventListener('resize', resize);
    // Yeni değerlerle ağaç baştan büyür
    restart(anim.current);

    const line = (c: Cizgi) => {
      ctx.globalAlpha = c.alpha; ctx.strokeStyle = c.color; ctx.lineWidth = c.w;
      ctx.shadowBlur = c.glow; ctx.shadowColor = c.glow ? RENK.glow : 'transparent';
      ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2); ctx.stroke();
    };
    const ell = (e: Elips) => {
      if (e.ry <= 0) return;
      ctx.globalAlpha = e.alpha; ctx.fillStyle = e.color;
      ctx.shadowBlur = e.glow; ctx.shadowColor = e.glow ? RENK.glow : 'transparent';
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.rx, e.ry, e.rot, 0, Math.PI * 2); ctx.fill();
    };

    let raf = 0, last = 0;
    function draw(now: number) {
      raf = requestAnimationFrame(draw);
      const dt = last ? (now - last) / 1000 : 0; last = now;
      tick(anim.current, dt);
      const f = frameOf(tree, layout, anim.current, selRef.current);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      // Zemin: kökte teal yumuşak elips parıltı
      const g = f.ground;
      ctx.save(); ctx.translate(g.x, g.y); ctx.scale(1, g.ry / g.rx);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, g.rx);
      rg.addColorStop(0, RENK.ground); rg.addColorStop(1, 'rgba(34,168,150,0)'); // merkezde g.alpha, kenarda 0
      ctx.globalAlpha = g.alpha; ctx.shadowBlur = 0; ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(0, 0, g.rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      f.mirror.forEach(line);
      if (f.axis) {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.globalAlpha = f.axis.alpha; ctx.strokeStyle = RENK.glow; ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(f.axis.x, f.axis.y1); ctx.lineTo(f.axis.x, f.axis.y2); ctx.stroke(); ctx.restore();
      }
      f.segs.forEach(line);
      f.leaves.forEach(ell);
      f.falling.forEach(ell);
      if (f.ring) {
        ctx.save(); ctx.setLineDash([5, 5]); ctx.lineDashOffset = f.ring.dashOffset; ctx.globalAlpha = f.ring.alpha;
        ctx.strokeStyle = RENK.glow; ctx.lineWidth = 1.6; ctx.shadowBlur = f.ring.glow; ctx.shadowColor = RENK.glow;
        ctx.beginPath(); ctx.ellipse(f.ring.x, f.ring.y, f.ring.rx, f.ring.ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (f.rootDot) {
        ctx.globalAlpha = f.rootDot.alpha; ctx.fillStyle = RENK.coral; ctx.shadowBlur = 18; ctx.shadowColor = RENK.coral;
        ctx.beginPath(); ctx.arc(f.rootDot.x, f.rootDot.y, f.rootDot.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    // Sekme gizliyken animasyon durur
    const start = () => { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(draw); } };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    start();

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [tree]);

  return (
    <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Animasyon alanının üstünde başlık: "Kişilik Boyutları" etiketiyle aynı yazı tipi, boy ve renk (büyük harfe çevrilmez) */}
      <div style={{ padding: '10px 8px 0', fontSize: 8, color: '#e05c4c', letterSpacing: '0.09em', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
        Kişilik Ağacım
      </div>
      {/* Canvas + sağ liste; ağaca tıklayınca baştan büyür */}
      <div ref={topRef} style={{ position: 'relative', width: '100%', height: 290 }}>
        <canvas ref={canvasRef} onClick={() => restart(anim.current)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor: 'pointer' }} />
        <div style={{
          position: 'absolute', top: 10, right: 0, width: 148,
          display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px', zIndex: 4,
        }}>
          <div style={{ fontSize: 8, color: '#e05c4c', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 2, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
            Kişilik Boyutları
          </div>
          {DIMENSIONS.map((d, i) => (
            <div
              key={i}
              onClick={() => handleSelect(i)}
              onMouseEnter={() => handleSelect(i)}
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: 'none',
                borderLeft: `3px solid ${activeId === i ? '#e05c4c' : 'transparent'}`,
                borderRadius: 7, padding: '5px 7px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                cursor: 'pointer', transition: 'border-left-color .2s',
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#e05c4c', lineHeight: 1.2, fontFamily: 'Inter, sans-serif' }}>{d.label}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.62)', marginTop: 1, fontFamily: 'Inter, sans-serif' }}>{d.sub}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#e05c4c', flexShrink: 0, fontFamily: 'Inter, sans-serif' }}>
                {Math.round(ocean[i].value * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ── "Ocean Big Five Kişilik Testi" bilgi kartı (mobil KisilikTab ile aynı metin ve sınırlar) ── */
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
    <div className="ll-card flex flex-col gap-3.5">
      <h3 className="font-serif text-xl text-[#f4f1ec]">Ocean Big Five Kişilik Testi</h3>
      <p className="text-[13px] leading-relaxed text-[#c9c2b8]">Kişilik boyutları; bireylerin düşünme, hissetme, davranma ve diğer insanlarla etkileşim kurma eğilimlerini anlamaya yardımcı olan beş temel özelliği ifade eder.</p>
      {BIG_FIVE_INFO.map((dim, i) => {
        const band = bandOf(percents[i]);
        return (
          <div key={dim.title} className="flex flex-col gap-1.5">
            <p className="text-sm font-bold" style={{ color: '#e05c4c' }}>{dim.title}</p>
            {dim.texts.map((txt, b) => (
              // Kullanıcının skoruna denk gelen metin vurgulu, diğer ikisi soluk
              <p key={b} className="text-xs leading-normal" style={{ color: b === band ? '#f4f1ec' : '#8f887f', opacity: b === band ? 1 : 0.45 }}>
                <span className="font-bold">{BAND_LABELS[b]}</span> {txt}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── Ana bileşen ── */
export function TabTest() {
  const [result,  setResult]  = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Ağacın tohum değeri: kullanıcı id'si
  const [userId, setUserId] = useState('');

  useEffect(() => {
    // Ağaç kullanıcı id'si gelmeden çizilmez (tohum değişip ağaç yeniden büyümesin)
    Promise.all([api.get<TestResult>('/test/result'), api.get<{ id?: string }>('/auth/me').catch(() => null)])
      .then(([r, u]) => { setUserId(u?.id ?? ''); setResult(r); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock lines={6} />;
  if (error) return <p className="text-accent text-sm">{error === '__rate_limit__' ? 'Çok fazla istek gönderildi. Lütfen sayfayı yeniden yükleyin.' : error}</p>;

  if (!result || !result.completed || !result.scores) {
    return (
      <div className="ll-card flex flex-col items-center gap-4 text-center">
        <p className="text-[#a39c93] text-sm">Henüz kişilik testini yapmadın.</p>
        <Link href="/test" className="btn-primary">
          Teste Başla →
        </Link>
      </div>
    );
  }

  const { scores, completedAt, retakeAvailableAt, canRetakeNow } = result;
  const percents = DIMENSIONS.map(d => Math.round(Math.min(100, Math.max(0, scores[d.key] ?? 50))));

  return (
    <div className="flex flex-col gap-5">
      <PersonalityAura scores={scores} seed={userId} />
      <BigFiveInfoCard percents={percents} />

      <div className="flex flex-col gap-2">
      <div className="ll-card flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#a39c93]">Test Tarihi</span>
          <span className="text-sm text-[#c9c2b8]">{fmtDate(completedAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#a39c93]">Sonraki Test</span>
          <span className="text-sm text-[#c9c2b8]">{retakeAvailableAt ? fmtDate(retakeAvailableAt) : 'Şimdi yapabilirsin'}</span>
        </div>
      </div>
      <p className="text-[11px] leading-normal text-[#a39c93]">Kişilik özellikleri genellikle kısa sürede köklü biçimde değişmez. Bu yüzden test 6 ayda bir tekrarlanır.</p>
      </div>

      {/* Sonraki test tarihine (test tarihi + 6 takvim ayı, backend) kadar pasif */}
      {canRetakeNow ? (
        <Link href="/test" className="btn-primary mx-auto">
          Tekrar Test Yap
        </Link>
      ) : (
        <button type="button" disabled className="btn-primary mx-auto disabled:opacity-40 disabled:cursor-not-allowed">
          Tekrar Test Yap
        </button>
      )}
    </div>
  );
}
