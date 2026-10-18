'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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

const DIMENSIONS = [
  { key: 'openness'          as keyof Scores, label: 'Açıklık',       radarLabel: 'Açıklık' },
  { key: 'conscientiousness' as keyof Scores, label: 'Öz-Disiplin',   radarLabel: 'Özdisiplin' },
  { key: 'extraversion'      as keyof Scores, label: 'Dışadönüklük',  radarLabel: 'Dışadönüklük' },
  { key: 'agreeableness'     as keyof Scores, label: 'Uyumluluk',     radarLabel: 'Uyumluluk' },
  { key: 'neuroticism'       as keyof Scores, label: 'Nevrotiklik',   radarLabel: 'Denge' },
];

function fmtDate(val?: string | null) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR');
}

/* ── Radar Chart ──────────────────────────────────────────────────────── */
function RadarChart({ scores }: { scores: Scores }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 96;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const axes = DIMENSIONS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return { cos: Math.cos(angle), sin: Math.sin(angle) };
  });

  const vals = DIMENSIONS.map(d => Math.min(100, Math.max(0, scores[d.key] ?? 50)) / 100);
  const points = vals.map((v, i) => ({
    x: cx + axes[i].cos * v * maxR,
    y: cy + axes[i].sin * v * maxR,
  }));
  const polyStr = points.map(p => `${p.x},${p.y}`).join(' ');

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const labelR = maxR + 26;
  const axisLabels = DIMENSIONS.map((d, i) => ({
    label: d.radarLabel,
    x: cx + axes[i].cos * labelR,
    y: cy + axes[i].sin * labelR,
  }));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxWidth: 300 }}>
      <defs>
        <radialGradient id="tabRadarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.08" />
        </radialGradient>
        <filter id="tabRadarGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Grid circles — stagger fade in */}
      {gridLevels.map((l, i) => (
        <motion.circle
          key={i}
          cx={cx} cy={cy} r={l * maxR}
          fill="none"
          stroke="rgba(192,57,43,0.55)"
          strokeWidth="1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
        />
      ))}

      {/* Axis lines */}
      {axes.map((a, i) => (
        <motion.line
          key={i}
          x1={cx} y1={cy}
          x2={cx + a.cos * maxR} y2={cy + a.sin * maxR}
          stroke="rgba(192,57,43,0.35)"
          strokeWidth="1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
        />
      ))}

      {/* Polygon fill */}
      <motion.polygon
        points={polyStr}
        fill="url(#tabRadarFill)"
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Polygon stroke — pathLength (stroke-dasharray effect) */}
      <motion.path
        d={pathD}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#tabRadarGlow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.55, duration: 1.1, ease: 'easeInOut' }}
      />

      {/* Vertex dots */}
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x} cy={p.y} r={3.5}
          fill="#22c55e"
          filter="url(#tabRadarGlow)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.0 + i * 0.07, duration: 0.25 }}
          style={{ transformOrigin: `${p.x}px ${p.y}px` }}
        />
      ))}

      {/* Axis labels */}
      {axisLabels.map((l, i) => (
        <text
          key={i}
          x={l.x} y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#e87070"
          fontSize="9"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );
}

/* ── Ana bileşen ──────────────────────────────────────────────────────── */
export function TabTest() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        <Link href="/test" className="px-6 py-3 text-sm btn-grad">
          Teste Başla →
        </Link>
      </div>
    );
  }

  const { scores, completedAt, retakeAvailableAt } = result;

  return (
    <div className="flex flex-col gap-5">
      {/* Radar chart */}
      <div className="glass-card p-5 flex flex-col items-center gap-1">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#555] uppercase self-start mb-3">KİŞİLİK PROFİLİ</p>
        <RadarChart scores={scores} />
      </div>

      {/* Progress bar skorlar */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-semibold tracking-[0.16em] text-[#555] uppercase mb-4">OCEAN SKORUM</h3>
        <div className="flex flex-col gap-4">
          {DIMENSIONS.map(({ key, label }, i) => {
            const val = scores[key];
            const pct = Math.min(100, Math.max(0, Math.round(val)));
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-[#ccc]">{label}</span>
                  <motion.span
                    className="text-sm font-semibold"
                    style={{ color: '#ff6b6b' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                  >
                    {pct}
                  </motion.span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full progress-grad rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.4 + i * 0.08, duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tarihler */}
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
