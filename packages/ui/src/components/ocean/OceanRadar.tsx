'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface OceanScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

const AXES = [
  { key: 'openness'         as const, label: 'Açıklık',        desc: 'Yeni deneyimlere ve fikirlere açıklık' },
  { key: 'conscientiousness'as const, label: 'Öz-Disiplin',    desc: 'Düzen, sorumluluk ve hedef odaklılık' },
  { key: 'extraversion'     as const, label: 'Dışadönüklük',   desc: 'Sosyal enerji ve çevresiyle etkileşim' },
  { key: 'agreeableness'    as const, label: 'Uyumluluk',      desc: 'Empati, işbirliği ve güven' },
  { key: 'neuroticism'      as const, label: 'Nevrotiklik',    desc: 'Duygusal dalgalanma ve stres tepkisi' },
];

interface Props {
  scores: OceanScores;
  size?: number;
}

function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function OceanRadar({ scores, size = 200 }: Props) {
  const [hovered, setHovered] = useState<(typeof AXES)[number] | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.44;
  const STEPS = 4;

  // Grid rings
  const rings = Array.from({ length: STEPS }, (_, i) => ((i + 1) / STEPS) * maxR);

  // Axis endpoints
  const axisPoints = AXES.map((_, i) => {
    const angle = (i * 360) / AXES.length;
    return polarToXY(angle, maxR, cx, cy);
  });

  // Score polygon
  const scorePoints = AXES.map((ax, i) => {
    const angle = (i * 360) / AXES.length;
    const r = (scores[ax.key] / 100) * maxR;
    return polarToXY(angle, r, cx, cy);
  });
  const polyStr = scorePoints.map((p) => `${p.x},${p.y}`).join(' ');

  const filterId = 'neon-glow';

  return (
    <div className="relative inline-block" style={{ width: size, height: size + 48 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible">
        <defs>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="1 0 0 0 0.75  0 0 0 0 0.21  0 0 0 0 0.17  0 0 0 1 0" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#c0392b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#b5651d" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Grid rings */}
        {rings.map((r, i) => (
          <polygon key={i}
            points={AXES.map((_, j) => { const a = (j * 360) / AXES.length; const p = polarToXY(a, r, cx, cy); return `${p.x},${p.y}`; }).join(' ')}
            fill="none" stroke="rgba(192,57,43,0.55)" strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {axisPoints.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(192,57,43,0.35)" strokeWidth="1" />
        ))}

        {/* Score polygon — spring from center */}
        <motion.polygon
          points={polyStr}
          fill="url(#radarGrad)"
          stroke="#c0392b"
          strokeWidth="1.5"
          filter={`url(#${filterId})`}
          initial={{ scale: 0, originX: `${cx}px`, originY: `${cy}px` }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.1 }}
        />

        {/* Axis labels + hover targets */}
        {AXES.map((ax, i) => {
          const angle = (i * 360) / AXES.length;
          const labelR = maxR + 22;
          const lp = polarToXY(angle, labelR, cx, cy);
          const hitP = polarToXY(angle, maxR * 0.5, cx, cy);
          const score = Math.round(scores[ax.key]);
          return (
            <g key={ax.key}
              onMouseEnter={() => setHovered(ax)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}>
              <circle cx={hitP.x} cy={hitP.y} r={maxR * 0.5} fill="transparent" />
              <text x={lp.x} y={lp.y - size * 0.028} textAnchor="middle" dominantBaseline="middle"
                fontSize={size * 0.048} fill="#e87070" fontFamily="Inter, sans-serif"
                fontWeight="700" style={{ letterSpacing: '0.09em' }}>
                {ax.label.toUpperCase()}
              </text>
              <text x={lp.x} y={lp.y + size * 0.042} textAnchor="middle" dominantBaseline="middle"
                fontSize={size * 0.072} fill="#c0392b" fontFamily="Inter, sans-serif" fontWeight="800">
                {score}
              </text>
            </g>
          );
        })}

        {/* Score dots */}
        {scorePoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#c0392b"
            filter={`url(#${filterId})`} />
        ))}
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key={hovered.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full px-2"
          >
            <div className="bg-surface border border-border rounded-xl px-3 py-2 text-center">
              <p className="text-sm font-medium text-text">{hovered.label} — <span className="text-primary">{Math.round(scores[hovered.key])}</span></p>
              <p className="text-xs text-muted mt-0.5">{hovered.desc}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
