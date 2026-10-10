'use client';

import { useEffect, useState, useRef } from 'react';
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

const TRAITS = [
  { key: 'openness',         label: 'Açıklık',          short: 'A' },
  { key: 'conscientiousness',label: 'Özdisiplin',        short: 'Ö' },
  { key: 'extraversion',     label: 'Dışadönüklük',      short: 'D' },
  { key: 'agreeableness',    label: 'Uyumluluk',         short: 'U' },
  { key: 'neuroticism',      label: 'Duygusal Denge',    short: 'DD' },
] as const;

/* ── Radar Chart SVG ──────────────────────────────────────────────────── */
function RadarChart({ scores }: { scores: OceanScore }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 100;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  // 5 eksen — Açıklık üstten başlar, saat yönünde
  const axes = TRAITS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return { cos: Math.cos(angle), sin: Math.sin(angle) };
  });

  // Polygon noktaları
  const vals = TRAITS.map(t => (scores[t.key] ?? 50) / 100);
  const points = vals.map((v, i) => ({
    x: cx + axes[i].cos * v * maxR,
    y: cy + axes[i].sin * v * maxR,
  }));
  const polyStr = points.map(p => `${p.x},${p.y}`).join(' ');

  // Grid circles
  const gridCircles = gridLevels.map(l => l * maxR);

  // Axis label positions (slightly outside)
  const labelR = maxR + 24;
  const axisLabels = TRAITS.map((t, i) => ({
    label: t.label,
    x: cx + axes[i].cos * labelR,
    y: cy + axes[i].sin * labelR,
  }));

  return (
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

      {/* Grid circles */}
      {gridCircles.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      ))}

      {/* Axis lines */}
      {axes.map((a, i) => (
        <line key={i}
          x1={cx} y1={cy}
          x2={cx + a.cos * maxR} y2={cy + a.sin * maxR}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1"
        />
      ))}

      {/* Polygon fill */}
      <motion.polygon
        points={polyStr}
        fill="url(#polygonFill)"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Polygon stroke */}
      <motion.polygon
        points={polyStr}
        fill="none"
        stroke="#ff6b6b"
        strokeWidth="2"
        filter="url(#radarGlow)"
        initial={{ opacity: 0, pathLength: 0 }}
        animate={{ opacity: 1, pathLength: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Vertex dots */}
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

      {/* Axis labels */}
      {axisLabels.map((l, i) => (
        <text key={i}
          x={l.x} y={l.y}
          textAnchor="middle" dominantBaseline="middle"
          fill="#888" fontSize="10" fontFamily="Inter, sans-serif"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}

/* ── Progress bar kartı ───────────────────────────────────────────────── */
function TraitCard({ label, score, delay }: { label: string; score: number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(255,60,40,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[#f5f5f5] font-medium">{label}</span>
        <span className="text-lg font-bold font-mono" style={{ fontVariantNumeric: 'tabular-nums', color: '#ff6b6b' }}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg,#c0392b 0%,#ff6b6b 100%)', boxShadow: '0 0 6px rgba(192,57,43,0.5)' }}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = api.getToken();
    if (!t) { router.replace('/giris'); return; }

    api.get<OceanScore>('/test/my-score')
      .then(setScore)
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
      {/* Arka plan glow */}
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

        {/* Trait kartları — 2 kolon */}
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
            className="w-full py-4 rounded-2xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', boxShadow: '0 0 24px rgba(192,57,43,0.4)' }}
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
