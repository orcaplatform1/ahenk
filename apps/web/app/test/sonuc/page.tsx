'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface OceanScore {
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
  scores?: OceanScore;
  profile?: string;
  canRetakeNow?: boolean;
}

const TRAITS = [
  {
    key: 'openness' as keyof OceanScore,
    label: 'Açıklık',
    radarLabel: 'Açıklık',
    desc: 'Yeni deneyimlere, fikirlere ve yaratıcılığa açıklık',
  },
  {
    key: 'conscientiousness' as keyof OceanScore,
    label: 'Özdisiplin',
    radarLabel: 'Özdisiplin',
    desc: 'Düzen, planlama ve hedef odaklılık',
  },
  {
    key: 'extraversion' as keyof OceanScore,
    label: 'Dışadönüklük',
    radarLabel: 'Dışadönüklük',
    desc: 'Sosyal enerji, girişkenlik ve sohbet isteği',
  },
  {
    key: 'agreeableness' as keyof OceanScore,
    label: 'Uyumluluk',
    radarLabel: 'Uyumluluk',
    desc: 'Empati, iş birliği ve güvenilirlik',
  },
  {
    key: 'neuroticism' as keyof OceanScore,
    label: 'Duygusal Denge',
    radarLabel: 'Denge',
    desc: 'Duygusal istikrar ve stres toleransı',
  },
] as const;

/* ── Radar Chart SVG ──────────────────────────────────────────────────── */
function RadarChart({ scores }: { scores: OceanScore }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 100;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const axes = TRAITS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return { cos: Math.cos(angle), sin: Math.sin(angle) };
  });

  const vals = TRAITS.map(t => (scores[t.key] ?? 50) / 100);
  const points = vals.map((v, i) => ({
    x: cx + axes[i].cos * v * maxR,
    y: cy + axes[i].sin * v * maxR,
  }));
  const polyStr = points.map(p => `${p.x},${p.y}`).join(' ');

  const gridCircles = gridLevels.map(l => l * maxR);

  const labelR = maxR + 26;
  const axisLabels = TRAITS.map((t, i) => ({
    label: t.radarLabel,
    desc: t.desc,
    score: Math.round(scores[t.key]),
    x: cx + axes[i].cos * labelR,
    y: cy + axes[i].sin * labelR,
  }));

  const hoveredTrait = hoveredIndex !== null ? TRAITS[hoveredIndex] : null;
  const hoveredScore = hoveredTrait ? Math.round(scores[hoveredTrait.key]) : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxWidth: 320 }}>
        <defs>
          <radialGradient id="polygonFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c0392b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#c0392b" stopOpacity="0.08" />
          </radialGradient>
          <filter id="radarGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {gridCircles.map((r, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        ))}

        {axes.map((a, i) => (
          <line key={i}
            x1={cx} y1={cy}
            x2={cx + a.cos * maxR} y2={cy + a.sin * maxR}
            stroke="rgba(255,255,255,0.08)" strokeWidth="1"
          />
        ))}

        <motion.polygon
          points={polyStr}
          fill="url(#polygonFill)"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        <motion.polygon
          points={polyStr}
          fill="none"
          stroke="#ff6b6b"
          strokeWidth="2"
          filter="url(#radarGlow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
        />

        {points.map((p, i) => (
          <motion.circle
            key={i} cx={p.x} cy={p.y} r={4}
            fill="#ff6b6b"
            filter="url(#radarGlow)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.07, duration: 0.3 }}
            style={{ transformOrigin: `${p.x}px ${p.y}px` }}
          />
        ))}

        {axisLabels.map((l, i) => (
          <text
            key={i}
            x={l.x} y={l.y}
            textAnchor="middle" dominantBaseline="middle"
            fill={hoveredIndex === i ? '#ff6b6b' : '#888'}
            fontSize="10" fontFamily="Inter, sans-serif"
            style={{ cursor: 'default', transition: 'fill 0.2s' }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {l.label}
          </text>
        ))}
      </svg>

      {/* Hover tooltip */}
      {hoveredTrait && hoveredScore !== null && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 pointer-events-none text-center"
          style={{ zIndex: 10 }}
        >
          <div
            className="inline-flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl"
            style={{
              background: 'rgba(20,10,10,0.9)',
              border: '1px solid rgba(192,57,43,0.4)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="text-xs font-semibold" style={{ color: '#ff6b6b' }}>
              {hoveredTrait.label} — {hoveredScore}
            </span>
            <span className="text-xs text-[#888]">{hoveredTrait.desc}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Skor kartı ───────────────────────────────────────────────────────── */
function TraitCard({ label, score, delay }: { label: string; score: number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[#f5f5f5] font-medium">{label}</span>
        <span className="text-lg font-bold font-mono" style={{ color: '#ff6b6b' }}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full progress-grad"
          initial={{ width: '0%' }}
          animate={{ width: `${score}%` }}
          transition={{ delay: delay + 0.2, duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

/* ── Ana bileşen ──────────────────────────────────────────────────────── */
export default function TestSonucPage() {
  const router = useRouter();
  const [score, setScore] = useState<OceanScore | null>(null);
  const [profile, setProfile] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = api.getToken();
    if (!t) { router.replace('/giris'); return; }

    api.get<TestResult>('/test/result')
      .then((res) => {
        if (!res.completed || !res.scores) {
          router.replace('/test');
          return;
        }
        setScore(res.scores);
        setProfile(res.profile ?? '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !score) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[#ff6b6b] mb-4">{error || 'Sonuç bulunamadı.'}</p>
          <button onClick={() => router.push('/profil')} className="text-sm text-[#888]">← Profile Dön</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.12) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative max-w-xl mx-auto px-5 py-12" style={{ zIndex: 1 }}>
        {/* Başlık */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-2">Kişilik Profilin</h1>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#888] uppercase">OCEAN · Big Five Modeli</p>
          {profile && (
            <p className="text-sm text-[#888] mt-3 leading-relaxed">{profile}</p>
          )}
        </motion.div>

        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex justify-center mb-10"
        >
          <RadarChart scores={score} />
        </motion.div>

        {/* Skor kartları — 2 kolon */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {TRAITS.slice(0, 4).map((t, i) => (
            <TraitCard
              key={t.key}
              label={t.label}
              score={Math.round(score[t.key])}
              delay={0.3 + i * 0.08}
            />
          ))}
        </div>
        {/* 5. kart tam genişlik */}
        <TraitCard
          label={TRAITS[4].label}
          score={Math.round(score[TRAITS[4].key])}
          delay={0.62}
        />

        {/* Alt buton */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8 flex flex-col gap-3"
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-4 rounded-2xl text-sm font-medium text-white btn-grad"
          >
            Dashboard'a Git →
          </button>
          <button
            onClick={() => router.push('/profil')}
            className="w-full py-3 rounded-2xl text-sm text-[#888] hover:text-[#f5f5f5] transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Profile Dön
          </button>
        </motion.div>
      </div>
    </div>
  );
}
