'use client';

import React, { useId } from 'react';

export const SONAR_SIZE = 300;
export const SONAR_CENTER = SONAR_SIZE / 2;
const RINGS = [140, 104, 68, 32];

function sweepEnd() {
  const a = -Math.PI / 3;
  return `${(SONAR_CENTER + 140 * Math.cos(a)).toFixed(1)} ${(SONAR_CENTER + 140 * Math.sin(a)).toFixed(1)}`;
}

// Tek sonar görünümü: halkalar, eksenler, dönen kırmızı dilim, merkez noktası.
// Veriyi çağıran bileşen verir (children: SVG katmanı, overlay: üstteki HTML katmanı).
// Animasyonlar globals.css'teki .ll-sweep sınıfındadır (hareketi azalt açıkken durur).
export function AhenkSonar({ width = SONAR_SIZE, ariaLabel, children, overlay, center = true, centerPulse = 0 }: {
  width?: number | string;
  ariaLabel: string;
  children?: React.ReactNode;
  overlay?: React.ReactNode;
  center?: boolean;
  centerPulse?: number; // Değişince merkezde kısa nabız oynar
}) {
  const gradientId = useId();
  const c = SONAR_CENTER;
  return (
    <div style={{ position: 'relative', width, maxWidth: '100%', aspectRatio: '1' }}>
      <svg viewBox={`0 0 ${SONAR_SIZE} ${SONAR_SIZE}`} width="100%" style={{ display: 'block', position: 'absolute', inset: 0 }} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#d6453a" stopOpacity="0" />
            <stop offset="1" stopColor="#d6453a" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {RINGS.map((r, i) => (
          <circle key={r} cx={c} cy={c} r={r} fill="none" stroke="#e8a27a" strokeOpacity={0.18 - (i * 0.04) / 3} />
        ))}
        <line x1={c - 140} y1={c} x2={c + 140} y2={c} stroke="rgba(255,255,255,0.05)" />
        <line x1={c} y1={c - 140} x2={c} y2={c + 140} stroke="rgba(255,255,255,0.05)" />
        <path className="ll-sweep" d={`M ${c} ${c} L ${c + 140} ${c} A 140 140 0 0 0 ${sweepEnd()} Z`} fill={`url(#${gradientId})`} />
        {children}
        {centerPulse > 0 && <circle key={centerPulse} className="ll-flash" cx={c} cy={c} r={7} fill="#ff6b5e" />}
        {center && <circle cx={c} cy={c} r={5} fill="#e8a27a" />}
      </svg>
      {overlay}
    </div>
  );
}
