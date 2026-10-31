'use client';

import { useEffect, useRef, useState } from 'react';
import { AhenkSonar, SONAR_CENTER as C } from '@ahenk/ui';
import type { LivePulse, SonarDensity, SonarState } from './types';

const RING_RADIUS: Record<SonarState, number> = { new: 50, active: 86, pool: 122 };
const DOT: Record<SonarState, { color: string; r: number }> = {
  new: { color: '#ff6b5e', r: 4.5 },
  active: { color: '#e8a27a', r: 3.5 },
  pool: { color: '#c9c2b8', r: 2.5 },
};
const FLASH_MS = 1500;

export const LEVELS = {
  1: { label: 'Çok yoğun', color: '#ff4a3d', r: 9, band: 50, opacity: 1, start: 45 },
  2: { label: 'Yoğun', color: '#d6453a', r: 7, band: 86, opacity: 0.92, start: 0 },
  3: { label: 'Orta', color: '#e8823a', r: 5.5, band: 118, opacity: 0.8, start: 90 },
  4: { label: 'Düşük', color: '#c9a227', r: 4, band: 136, opacity: 0.6, start: 25 },
} as const;

function hashAngle(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 360) * Math.PI) / 180;
}

function point(angle: number, radius: number) {
  return { x: C + radius * Math.cos(angle), y: C + radius * Math.sin(angle) };
}

function dotAngle(key: string, district: string | null) {
  // Aynı ilçenin noktaları, ilçe etiketinin çevresinde toplanır
  if (!district) return hashAngle(key);
  return hashAngle(district) + ((hashAngle(key) / (2 * Math.PI)) - 0.5) * 0.5;
}

// Her seviye kendi bandında eşit açılarla dizilir
function placeBubbles(density: SonarDensity) {
  return ([1, 2, 3, 4] as const).flatMap((level) => {
    const rows = density.districts.filter((d) => d.level === level);
    const cfg = LEVELS[level];
    return rows.map((d, i) => {
      const angle = ((cfg.start + (i * 360) / rows.length) * Math.PI) / 180;
      return { ...d, ...cfg, ...point(angle, cfg.band) };
    });
  });
}

function DensityLayer({ density, flashes }: { density: SonarDensity; flashes: Record<string, number> }) {
  return (
    <>
      {placeBubbles(density).map((b) => {
        const right = b.x >= C;
        // Dış bantlarda yazı içeri, iç bantlarda dışarı bakar; sonarın dışına taşmaz
        const inward = b.band >= 118;
        const anchorEnd = inward ? right : !right;
        return (
          <g key={b.name}>
            {b.level === 1 && <circle className="ll-bubble-pulse" cx={b.x} cy={b.y} r={b.r} fill={b.color} />}
            {flashes[b.name] > 0 && <circle key={flashes[b.name]} className="ll-flash" cx={b.x} cy={b.y} r={b.r} fill={b.color} />}
            <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity={b.opacity} />
            <text
              x={b.x + (anchorEnd ? -(b.r + 3) : b.r + 3)}
              y={b.y + 3.5}
              textAnchor={anchorEnd ? 'end' : 'start'}
              fontSize="10.5"
              fontWeight={b.level <= 2 ? 700 : 400}
              fill={b.level <= 2 ? '#f4f1ec' : '#c9c2b8'}
              style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
            >
              {b.name}
            </text>
          </g>
        );
      })}
    </>
  );
}

function DotLayer({ sonar }: { sonar: LivePulse['sonar'] | null }) {
  return (
    <>
      {(sonar?.dots ?? []).map((d) => {
        const p = point(dotAngle(d.key, d.district), RING_RADIUS[d.state]);
        const style = DOT[d.state];
        return (
          <g key={d.key}>
            {d.state === 'new' && <circle className="ll-dot-new" cx={p.x} cy={p.y} r={style.r} fill={style.color} />}
            <circle cx={p.x} cy={p.y} r={style.r} fill={style.color} />
          </g>
        );
      })}
      {(sonar?.labels ?? []).map((l) => {
        const p = point(hashAngle(l.name), 104);
        return (
          <text
            key={l.name}
            x={p.x}
            y={p.y - 8}
            textAnchor={p.x > C + 40 ? 'end' : p.x < C - 40 ? 'start' : 'middle'}
            fontSize="10.5"
            fontWeight={l.active ? 700 : 400}
            fill={l.active ? '#f4f1ec' : '#c9c2b8'}
            style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
          >
            {l.name}
          </text>
        );
      })}
    </>
  );
}

export default function LiveSonar({ sonar }: { sonar: LivePulse['sonar'] | null }) {
  const dots = sonar?.dots ?? [];
  const density = sonar?.density ?? null;
  const counts = { new: 0, active: 0, pool: 0 };
  dots.forEach((d) => { counts[d.state] += 1; });

  // Yeni giriş: ilçesi listedeyse baloncuğu, değilse merkez kısa parlar
  const seen = useRef<Set<string> | null>(null);
  const [flashes, setFlashes] = useState<Record<string, number>>({});
  const [centerPulse, setCenterPulse] = useState(0);
  useEffect(() => {
    if (!sonar) return;
    const known = seen.current;
    seen.current = new Set(sonar.dots.map((d) => d.key));
    if (!known || !density) return; // İlk yüklemede eskiler parlamaz
    const names = new Set(density.districts.map((d) => d.name));
    const fresh = sonar.dots.filter((d) => d.state === 'new' && !known.has(d.key));
    if (fresh.length === 0) return;
    const stamp = Date.now();
    const hits = fresh.filter((d) => d.district && names.has(d.district)).map((d) => d.district as string);
    if (hits.length) {
      setFlashes((f) => ({ ...f, ...Object.fromEntries(hits.map((h) => [h, stamp])) }));
      setTimeout(() => setFlashes((f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== stamp))), FLASH_MS);
    }
    if (hits.length < fresh.length) setCenterPulse(stamp);
  }, [sonar, density]);

  const legend: [string, string][] = density
    ? Object.values(LEVELS).map((l) => [l.label, l.color])
    : [['yeni giriş', '#ff6b5e'], ['aktif', '#e8a27a'], ['havuzda', '#c9c2b8']];

  return (
    <section>
      <div className="ll-head">
        <h2 className="ll-title">Ahenk Sonarı</h2>
        <span className="ll-note">tarama · canlı</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AhenkSonar
          centerPulse={centerPulse}
          ariaLabel={density
            ? `Ahenk sonarı: ilçe yoğunluğu, ${density.districts.length} ilçe. Kişisel bilgi gösterilmez.`
            : `Ahenk sonarı: bu hafta havuzda ${dots.length} kişi görünüyor, ${counts.new} yeni giriş, ${counts.active} aktif. Kişisel bilgi gösterilmez.`}
        >
          {density ? <DensityLayer density={density} flashes={flashes} /> : <DotLayer sonar={sonar} />}
        </AhenkSonar>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
        {legend.map(([label, color]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#c9c2b8' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{label}
          </span>
        ))}
      </div>
    </section>
  );
}
