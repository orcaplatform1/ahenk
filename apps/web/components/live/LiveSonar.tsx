'use client';

import type { LivePulse, SonarState } from './types';

const SIZE = 300;
const C = SIZE / 2;
const RINGS = [140, 104, 68, 32];
const RING_RADIUS: Record<SonarState, number> = { new: 50, active: 86, pool: 122 };
const DOT: Record<SonarState, { color: string; r: number }> = {
  new: { color: '#ff6b5e', r: 4.5 },
  active: { color: '#e8a27a', r: 3.5 },
  pool: { color: '#c9c2b8', r: 2.5 },
};

// Rastgele değil: aynı anahtar her yenilemede aynı açıda kalır
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

const SWEEP_END = point(-Math.PI / 3, 140);

export default function LiveSonar({ sonar }: { sonar: LivePulse['sonar'] | null }) {
  const dots = sonar?.dots ?? [];
  const labels = sonar?.labels ?? [];
  const counts = { new: 0, active: 0, pool: 0 };
  dots.forEach((d) => { counts[d.state] += 1; });

  return (
    <section>
      <div className="ll-head">
        <h2 className="ll-title">Ahenk Sonarı</h2>
        <span className="ll-note">tarama · canlı</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width="100%"
          style={{ maxWidth: SIZE, display: 'block' }}
          role="img"
          aria-label={`Ahenk sonarı: bu hafta havuzda ${dots.length} kişi görünüyor, ${counts.new} yeni giriş, ${counts.active} aktif. Kişisel bilgi gösterilmez.`}
        >
          <defs>
            <linearGradient id="ll-sweep-fill" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#d6453a" stopOpacity="0" />
              <stop offset="1" stopColor="#d6453a" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          {RINGS.map((r, i) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#e8a27a" strokeOpacity={0.18 - (i * 0.04) / 3} />
          ))}
          <line x1={C - 140} y1={C} x2={C + 140} y2={C} stroke="rgba(255,255,255,0.05)" />
          <line x1={C} y1={C - 140} x2={C} y2={C + 140} stroke="rgba(255,255,255,0.05)" />
          <path
            className="ll-sweep"
            d={`M ${C} ${C} L ${C + 140} ${C} A 140 140 0 0 0 ${SWEEP_END.x.toFixed(1)} ${SWEEP_END.y.toFixed(1)} Z`}
            fill="url(#ll-sweep-fill)"
          />
          {dots.map((d) => {
            const p = point(dotAngle(d.key, d.district), RING_RADIUS[d.state]);
            const style = DOT[d.state];
            return (
              <g key={d.key}>
                {d.state === 'new' && <circle className="ll-dot-new" cx={p.x} cy={p.y} r={style.r} fill={style.color} />}
                <circle cx={p.x} cy={p.y} r={style.r} fill={style.color} />
              </g>
            );
          })}
          {labels.map((l) => {
            const angle = hashAngle(l.name);
            const p = point(angle, 104);
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
          <circle cx={C} cy={C} r={5} fill="#e8a27a" />
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
        {([['yeni giriş', '#ff6b5e'], ['aktif', '#e8a27a'], ['havuzda', '#c9c2b8']] as const).map(([label, color]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#c9c2b8' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{label}
          </span>
        ))}
      </div>
    </section>
  );
}
