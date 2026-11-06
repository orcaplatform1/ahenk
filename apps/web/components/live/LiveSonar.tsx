'use client';

import { useEffect, useRef, useState } from 'react';
import { AhenkSonar, SONAR_CENTER as C } from '@ahenk/ui';
import { LEVELS } from './levels';
import type { LivePulse, SonarDensity, SonarState } from './types';

const RING_RADIUS: Record<SonarState, number> = { new: 50, active: 86, pool: 122 };
const DOT: Record<SonarState, { color: string; r: number }> = {
  new: { color: '#ff6b5e', r: 4.5 },
  active: { color: '#e8a27a', r: 3.5 },
  pool: { color: '#c9c2b8', r: 2.5 },
};
const FLASH_MS = 1500;

// Etiket kutusu tahmini (viewBox birimi) ve sonar sınırı
const LABEL_H = 12;
const LABEL_GAP = 3;
const EDGE = 4;
const SIZE = 300;

type Box = { x0: number; x1: number; y0: number; y1: number };
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (b: Box) => b.x0 >= EDGE && b.x1 <= SIZE - EDGE && b.y0 >= EDGE && b.y1 <= SIZE - EDGE;

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

// Etiketler seviyeler arasında da çakışmaz: her etiket için yandan, üstten ve alttan adaylar denenir;
// sonar dışına taşan, başka etikete ya da baloncuğa değen aday elenir.
function placeLabels(bubbles: ReturnType<typeof placeBubbles>) {
  const circles: Box[] = bubbles.map((b) => ({ x0: b.x - b.r - 1, x1: b.x + b.r + 1, y0: b.y - b.r - 1, y1: b.y + b.r + 1 }));
  const placed: Box[] = [];
  return bubbles.map((b, index) => {
    const width = b.name.length * (b.level <= 2 ? 6.4 : 5.9) + 2;
    const left = b.x - b.r - LABEL_GAP - width;
    const right = b.x + b.r + LABEL_GAP;
    const center = b.x - width / 2;
    const above = b.y - b.r - LABEL_GAP - LABEL_H;
    const below = b.y + b.r + LABEL_GAP;
    const beside = b.y - LABEL_H / 2;
    const towardCenter = b.x >= C ? [left, right] : [right, left];
    const candidates: { x: number; y: number }[] = [
      ...towardCenter.map((x) => ({ x, y: beside })),
      { x: center, y: b.y >= C ? above : below },
      { x: center, y: b.y >= C ? below : above },
    ];
    for (const step of [13, 26, 39]) {
      for (const x of [...towardCenter, center]) candidates.push({ x, y: beside - step }, { x, y: beside + step });
    }
    const toBox = (c: { x: number; y: number }): Box => ({ x0: c.x, x1: c.x + width, y0: c.y, y1: c.y + LABEL_H });
    const others = circles.filter((_, i) => i !== index);
    const free = (box: Box) => inside(box) && !placed.some((p) => hit(p, box)) && !others.some((p) => hit(p, box));
    const pick = candidates.find((c) => free(toBox(c))) ?? candidates.find((c) => inside(toBox(c)) && !placed.some((p) => hit(p, toBox(c)))) ?? candidates[0];
    const box = toBox(pick);
    placed.push(box);
    return { ...b, labelX: box.x0, labelY: box.y0 + LABEL_H - 2.5 };
  });
}

function DensityLayer({ density, flashes }: { density: SonarDensity; flashes: Record<string, number> }) {
  return (
    <>
      {placeLabels(placeBubbles(density)).map((b) => (
        <g key={b.name}>
          {b.level === 1 && <circle className="ll-bubble-pulse" cx={b.x} cy={b.y} r={b.r} fill={b.color} />}
          {flashes[b.name] > 0 && <circle key={flashes[b.name]} className="ll-flash" cx={b.x} cy={b.y} r={b.r} fill={b.color} />}
          <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity={b.opacity} />
          <text
            x={b.labelX}
            y={b.labelY}
            fontSize="10.5"
            fontWeight={b.level <= 2 ? 700 : 400}
            fill={b.level <= 2 ? '#f4f1ec' : '#c9c2b8'}
            style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
          >
            {b.name}
          </text>
        </g>
      ))}
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
        <h2 className="ll-title">Eşleşme Taraması</h2>
        <span className="ll-live is-green"><span className="ll-live-dot" />CANLI</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AhenkSonar
          centerPulse={centerPulse}
          ariaLabel={density
            ? `Eşleşme taraması: ilçe yoğunluğu, ${density.districts.length} ilçe. Kişisel bilgi gösterilmez.`
            : `Eşleşme taraması: bu hafta havuzda ${dots.length} kişi görünüyor, ${counts.new} yeni giriş, ${counts.active} aktif. Kişisel bilgi gösterilmez.`}
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
