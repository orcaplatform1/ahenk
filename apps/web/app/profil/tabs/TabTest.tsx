'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

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
  scores?: Scores;
}

function fmtDate(val?: string | null) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR');
}

function getLevel(v: number) { return v < 0.4 ? 0 : v < 0.7 ? 1 : 2; }

const DIMENSIONS = [
  { key: 'openness'          as keyof Scores, label: 'Açıklık',      sub: 'Yaratıcılık & Deneyim',   levels: [
    'Yeni fikir ve deneyimlere karşı temkinlisin. Tanıdık ortamlar seni rahatlatıyor, belirsizlik ise zorlayabiliyor. Masalarda güvenli konularda güçlüsün.',
    'Merakın var ama seçici davranıyorsun. Bazı konularda derinleşmeyi seviyorsun, ancak her fikre kapı aralamıyorsun. Masalarda dengeli bir katkı sunuyorsun.',
    'Fikir ve deneyimlere tamamen açıksın. Masalarda entelektüel derinliği, sanatı ve sıra dışı bakış açılarını tetikleyen ana jeneratör sensin.',
  ]},
  { key: 'conscientiousness' as keyof Scores, label: 'Özdisiplin',   sub: 'Hedef & Düzen',            levels: [
    'Anlık kararlarla hareket etmeyi seviyorsun. Planlama yerine spontanlık seni tanımlıyor. Masalarda sürpriz enerji getiriyorsun ama tutarlılık zor olabiliyor.',
    'Belirli alanlarda düzenlisin, ancak esnekliğini de koruyorsun. Masalarda gerektiğinde organize olabilen, gerektiğinde akışa bırakabilen birisin.',
    'Hedef odaklı ve tutarlısın. Grup dinamiklerinde güven veren, masanın dengesini ve akışını koruyan sessiz organizatör sensin.',
  ]},
  { key: 'extraversion'      as keyof Scores, label: 'Dışadönüklük', sub: 'Sosyal Enerji',             levels: [
    'Sosyal ortamlar seni yoruyor, yalnız zaman enerji veriyor. Masalarda derin bire bir bağlantılarda parıldassan da kalabalık dinamikler zorlayabiliyor.',
    'Ne tam içedönük ne tam dışadönüksün — ortam ve insanlara göre değişiyorsun. Masalarda seçici ama kaliteli bir enerji yayıyorsun.',
    'Sosyal ortamlardan enerji alıyorsun. Masaya oturduğun andan itibaren buzları eriten, konuşmaları başlatan ve ortamı ısıtan birisin.',
  ]},
  { key: 'agreeableness'     as keyof Scores, label: 'Uyumluluk',    sub: 'Empati & İşbirliği',        levels: [
    'Kendi bakış açın güçlü ve bunu kolayca bırakmıyorsun. Masalarda tartışmayı canlandırıyorsun ancak ortak zemin bulmak zaman alıyor.',
    'İşbirliğine açıksın ama sınırların da var. Masalarda hem kendi sesini duyurabiliyorsun hem de diğerlerini dinleyebiliyorsun.',
    'Empatik frekansın çok yüksek. İnsanları dinleme ve ortak paydada buluşturma yeteneğinle dahil olduğun her masada derin bir konfor alanı yaratıyorsun.',
  ]},
  { key: 'neuroticism'       as keyof Scores, label: 'Denge',         sub: 'Duygusal Esneklik',         levels: [
    'Duygular seni güçlü etkiliyor ve bunu çevrene yansıtıyorsun. Masalarda yoğun anlarda dengeyi korumak zorlaşabiliyor, ama bu aynı zamanda özgünlüğünün bir parçası.',
    'Duygusal esnekliğin gelişiyor. Çoğu durumda sakin kalabiliyorsun, ancak beklenmedik anlarda zaman zaman sendeleyebiliyorsun.',
    'Duygusal zemin sağlam. Hararetli tartışmalarda bile sakin kalabiliyor, masadaki en dengeli ve rasyonel frekansı sen yayıyorsun.',
  ]},
];

const PALETTES = [
  [{i:{r:30,g:10,b:80},m:{r:80,g:30,b:160},o:{r:140,g:80,b:220},a:0.34},{i:{r:20,g:5,b:60},m:{r:60,g:20,b:130},o:{r:120,g:60,b:200},a:0.27},{i:{r:40,g:15,b:90},m:{r:90,g:40,b:170},o:{r:150,g:90,b:230},a:0.20},{i:{r:15,g:5,b:50},m:{r:50,g:15,b:110},o:{r:100,g:50,b:180},a:0.17},{i:{r:25,g:8,b:70},m:{r:70,g:25,b:140},o:{r:130,g:70,b:210},a:0.13}],
  [{i:{r:5,g:20,b:50},m:{r:10,g:70,b:100},o:{r:20,g:130,b:160},a:0.34},{i:{r:3,g:15,b:40},m:{r:8,g:55,b:85},o:{r:15,g:110,b:140},a:0.27},{i:{r:5,g:30,b:60},m:{r:10,g:80,b:110},o:{r:20,g:140,b:170},a:0.20},{i:{r:2,g:10,b:35},m:{r:6,g:45,b:75},o:{r:12,g:95,b:125},a:0.17},{i:{r:4,g:22,b:48},m:{r:9,g:62,b:92},o:{r:18,g:120,b:150},a:0.13}],
  [{i:{r:80,g:20,b:5},m:{r:160,g:60,b:10},o:{r:220,g:120,b:30},a:0.34},{i:{r:60,g:15,b:3},m:{r:130,g:45,b:8},o:{r:190,g:95,b:20},a:0.27},{i:{r:90,g:25,b:6},m:{r:170,g:70,b:12},o:{r:230,g:135,b:35},a:0.20},{i:{r:50,g:12,b:2},m:{r:110,g:35,b:6},o:{r:170,g:80,b:15},a:0.17},{i:{r:70,g:18,b:4},m:{r:145,g:52,b:9},o:{r:205,g:108,b:25},a:0.13}],
  [{i:{r:5,g:50,b:45},m:{r:10,g:130,b:120},o:{r:30,g:200,b:185},a:0.34},{i:{r:3,g:38,b:34},m:{r:8,g:108,b:100},o:{r:22,g:175,b:162},a:0.27},{i:{r:6,g:58,b:52},m:{r:12,g:145,b:135},o:{r:35,g:210,b:195},a:0.20},{i:{r:2,g:30,b:27},m:{r:6,g:90,b:84},o:{r:18,g:155,b:143},a:0.17},{i:{r:4,g:44,b:40},m:{r:10,g:118,b:110},o:{r:27,g:188,b:174},a:0.13}],
  [{i:{r:8,g:20,b:70},m:{r:20,g:55,b:160},o:{r:60,g:110,b:230},a:0.34},{i:{r:5,g:15,b:55},m:{r:15,g:42,b:135},o:{r:45,g:88,b:200},a:0.27},{i:{r:9,g:24,b:80},m:{r:22,g:62,b:175},o:{r:68,g:120,b:240},a:0.20},{i:{r:4,g:12,b:48},m:{r:12,g:35,b:118},o:{r:38,g:75,b:180},a:0.17},{i:{r:6,g:18,b:62},m:{r:17,g:48,b:148},o:{r:52,g:98,b:215},a:0.13}],
];

const GLOWS = [
  {r:124,g:58,b:237},
  {r:8,g:145,b:178},
  {r:249,g:115,b:22},
  {r:45,g:212,b:191},
  {r:96,g:165,b:250},
];

type RGB = {r:number;g:number;b:number};
function lerp(a:RGB,b:RGB,t:number):RGB{return{r:Math.round(a.r+(b.r-a.r)*t),g:Math.round(a.g+(b.g-a.g)*t),b:Math.round(a.b+(b.b-a.b)*t)};}
function rgb(c:RGB){return`rgb(${c.r},${c.g},${c.b})`;}

/* ── Aura Canvas bileşeni ── */
function PersonalityAura({ scores }: { scores: Scores }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const topRef     = useRef<HTMLDivElement>(null);
  const activeRef  = useRef(3);
  const turbRef    = useRef(0.15);
  const timeRef    = useRef(0);
  const rafRef     = useRef<number>(0);
  const layersRef  = useRef(PALETTES[3].map(l => ({i:{...l.i},m:{...l.m},o:{...l.o},a:l.a})));
  const glowRef    = useRef({...GLOWS[3]});

  const [activeId,  setActiveId]  = useState(3);
  const [hintGone,  setHintGone]  = useState(false);
  const [cardShow,  setCardShow]  = useState(true);
  const [cardTitle, setCardTitle] = useState(DIMENSIONS[3].label);
  const [cardText,  setCardText]  = useState('');

  const ocean = DIMENSIONS.map(d => ({
    value: Math.min(100, Math.max(0, scores[d.key] ?? 50)) / 100,
    levels: d.levels,
  }));

  useEffect(() => {
    setCardText(ocean[3].levels[getLevel(ocean[3].value)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: number) => {
    if (!hintGone) setHintGone(true);
    activeRef.current = id;
    turbRef.current = 1.1;
    setActiveId(id);
    setCardShow(false);
    setTimeout(() => {
      setCardTitle(DIMENSIONS[id].label);
      setCardText(ocean[id].levels[getLevel(ocean[id].value)]);
      setCardShow(true);
    }, 200);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const top    = topRef.current;
    if (!canvas || !top) return;

    function resize() {
      if (!canvas || !top) return;
      canvas.width  = top.offsetWidth  || 380;
      canvas.height = top.offsetHeight || 290;
    }
    resize();
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d')!;

    function draw() {
      if (!canvas) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      timeRef.current  += 0.011;
      turbRef.current  += (0.13 - turbRef.current) * 0.05;
      const aid = activeRef.current;

      glowRef.current = lerp(glowRef.current, GLOWS[aid], 0.04);
      PALETTES[aid].forEach((tl, li) => {
        layersRef.current[li].i = lerp(layersRef.current[li].i, tl.i, 0.04);
        layersRef.current[li].m = lerp(layersRef.current[li].m, tl.m, 0.04);
        layersRef.current[li].o = lerp(layersRef.current[li].o, tl.o, 0.04);
      });

      const cx = W * 0.25, cy = H * 0.5, baseR = 88;
      const t = timeRef.current, turb = turbRef.current;
      const ov = ocean.map(o => o.value);

      layersRef.current.forEach((layer, li) => {
        const spd = 0.7 + li * 0.15, shrink = li * 10;
        const pts: {x:number;y:number}[] = [];
        for (let i = 0; i <= 200; i++) {
          const ang = (i / 200) * Math.PI * 2;
          let n = Math.sin(ang*3+t*spd+li*0.8)*16*ov[0];
          n += Math.cos(ang*5-t*0.75*spd+li*0.5)*11*ov[2];
          n += Math.sin(ang*2+t*1.2*spd)*19*ov[3];
          n += Math.cos(ang*7+t*0.55*spd+li)*5*ov[1];
          n += Math.sin(ang*4-t*spd)*8*ov[4];
          const aAng = (aid / 5) * Math.PI * 2 - Math.PI / 2;
          const diff = Math.min(Math.abs(ang-aAng), Math.PI*2-Math.abs(ang-aAng));
          if (diff < 1.3) n *= (1 + turb * (2.4 + li * 0.3));
          const r = baseR - shrink + n * turb * (3.5 + li * 0.4);
          pts.push({x: cx + Math.cos(ang)*r, y: cy + Math.sin(ang)*r});
        }
        ctx.shadowBlur  = li === 0 ? 30 : 0;
        ctx.shadowColor = `rgba(${glowRef.current.r},${glowRef.current.g},${glowRef.current.b},0.55)`;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i+1].x)/2, my = (pts[i].y + pts[i+1].y)/2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, (baseR-shrink)*1.5);
        g.addColorStop(0, rgb(layer.i));
        g.addColorStop(0.45, rgb(layer.m));
        g.addColorStop(0.82, rgb(layer.o));
        g.addColorStop(1, 'rgba(17,18,20,0)');
        ctx.fillStyle = g; ctx.globalAlpha = layer.a; ctx.fill();
      });

      ctx.shadowBlur = 0;
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.32);
      core.addColorStop(0, `rgba(${glowRef.current.r},${glowRef.current.g},${glowRef.current.b},0.3)`);
      core.addColorStop(0.5, `rgba(${glowRef.current.r},${glowRef.current.g},${glowRef.current.b},0.1)`);
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(cx, cy, baseR*0.32, 0, Math.PI*2); ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ background: '#111214', borderRadius: 12, overflow: 'hidden' }}>
      {/* Canvas + sağ liste */}
      <div ref={topRef} style={{ position: 'relative', width: '100%', height: 290 }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
        <div style={{
          position: 'absolute', top: 10, right: 0, width: 148,
          display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px', zIndex: 4,
        }}>
          <div style={{ fontSize: 8, color: '#5a2030', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 2, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
            Kişilik Boyutları
          </div>
          {DIMENSIONS.map((d, i) => (
            <div
              key={i}
              onClick={() => handleSelect(i)}
              onMouseEnter={() => handleSelect(i)}
              style={{
                background: activeId === i ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                border: 'none',
                borderLeft: `3px solid ${activeId === i ? '#e05c4c' : 'transparent'}`,
                borderRadius: 7, padding: '5px 7px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                cursor: 'pointer', transition: 'background .2s, border-left-color .2s',
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#d4a0aa', lineHeight: 1.2, fontFamily: 'Inter, sans-serif' }}>{d.label}</div>
                <div style={{ fontSize: 8, color: '#6b3040', marginTop: 1, fontFamily: 'Inter, sans-serif' }}>{d.sub}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: activeId === i ? '#e05c4c' : '#9b1e3a', flexShrink: 0, fontFamily: 'Inter, sans-serif' }}>
                {Math.round(ocean[i].value * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div style={{
        padding: '8px 12px 3px', fontSize: 11, color: '#8a8a8a',
        fontFamily: 'Inter, sans-serif',
        opacity: hintGone ? 0 : 1, pointerEvents: hintGone ? 'none' : undefined,
        transition: 'opacity .4s', height: hintGone ? 0 : undefined, overflow: 'hidden',
      }}>
        Kişilik frekansını keşfetmek için bir boyuta dokun.
      </div>

      {/* Açıklama kartı */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px 10px 0 0', padding: '9px 12px 13px',
        opacity: cardShow ? 1 : 0, transform: cardShow ? 'translateY(0)' : 'translateY(5px)',
        transition: 'opacity .3s, transform .3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ width: 2, borderRadius: 2, background: '#e05c4c', alignSelf: 'stretch', flexShrink: 0, minHeight: 22 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 400, color: '#e05c4c', letterSpacing: '0.01em', marginBottom: 3, fontFamily: 'var(--font-serif, "DM Serif Display", serif)' }}>{cardTitle}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, margin: 0, fontFamily: 'Inter, sans-serif' }}>{cardText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Ana bileşen ── */
export function TabTest() {
  const [result,  setResult]  = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get<TestResult>('/test/result')
      .then(setResult)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock lines={6} />;
  if (error) return <p className="text-accent text-sm">{error === '__rate_limit__' ? 'Çok fazla istek gönderildi. Lütfen sayfayı yeniden yükleyin.' : error}</p>;

  if (!result || !result.completed || !result.scores) {
    return (
      <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
        <p className="text-[#888] text-sm">Henüz kişilik testini yapmadın.</p>
        <Link href="/test" className="btn-primary">
          Teste Başla →
        </Link>
      </div>
    );
  }

  const { scores, completedAt, retakeAvailableAt } = result;

  return (
    <div className="flex flex-col gap-5">
      <PersonalityAura scores={scores} />

      <div className="glass-card p-5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Test Tarihi</span>
          <span className="text-sm text-[#ccc]">{fmtDate(completedAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Sonraki Test</span>
          <span className="text-sm text-[#ccc]">{retakeAvailableAt ? fmtDate(retakeAvailableAt) : 'Şimdi yapabilirsin'}</span>
        </div>
      </div>
    </div>
  );
}
