'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
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

// Etiket genişliği tahmini (viewBox birimi) ve sonar sınırı
const LABEL_H = 12;
const LABEL_GAP = 3;
const EDGE = 4;
const SIZE = 300;
const GROUP_MS = 3000;
const LEVEL_ORDER = [1, 2, 3, 4] as const;

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

// N semt için açı aralığı 360/N; her semt ayrı açıda. Gruplar sırayla iç içe dizilir (Çok yoğun, Yoğun, Orta, Düşük, tekrar
// Çok yoğun…) → aynı gruptaki semtler birbirinden en uzak açılara düşer. Uzaklık (band) ve nokta boyu seviye kuralıyla aynı (mobil Sonar.tsx ile aynı)
function placeDistricts(density: SonarDensity) {
  const groups = LEVEL_ORDER.map((level) => density.districts.filter((d) => d.level === level));
  const order: SonarDensity['districts'] = [];
  for (let i = 0; order.length < density.districts.length; i++) groups.forEach((g) => { if (g[i]) order.push(g[i]); });
  const step = (2 * Math.PI) / Math.max(order.length, 1);
  return order.map((d, i) => {
    const angle = -Math.PI / 2 + i * step;
    const cfg = LEVELS[d.level];
    const p = point(angle, cfg.band);
    // İsim: sağ yarıdaki noktada sağa, sol yarıdakinde sola; radar dışına taşacaksa yatayda içeri çekilir ve noktanın
    // üstüne / altına (merkeze doğru) alınır. Kısaltma yok
    const right = Math.cos(angle) >= -1e-9;
    const width = d.name.length * (d.level <= 2 ? 6.4 : 5.9) + 2;
    let x0 = right ? p.x + cfg.r + LABEL_GAP : p.x - cfg.r - LABEL_GAP - width;
    let y = p.y + LABEL_H / 2 - 2.5;
    const clamped = Math.min(Math.max(x0, EDGE), SIZE - EDGE - width);
    if (clamped !== x0) {
      x0 = clamped;
      y = p.y >= C ? p.y - cfg.r - LABEL_GAP - 2.5 : p.y + cfg.r + LABEL_GAP + LABEL_H - 2.5;
    }
    return { ...d, ...cfg, ...p, labelX: right ? x0 : x0 + width, labelY: y, anchor: (right ? 'start' : 'end') as 'start' | 'end' };
  });
}

// Tarama başlamadan (idle): bütün semt noktaları "Düşük" grisinde, aynı büyüklükte ve hareketsiz (parlama / nefes / nabız yok).
// Canlıyken her semtin noktası ve adı yoğunluk seviyesinin renginde (LEVELS — mobil theme LEVELS ile aynı), noktalar yanıp söner
const WAIT_DOT = { color: LEVELS[4].color, r: LEVELS[4].r, opacity: LEVELS[4].opacity };

// Canlı tarama döngüsü: Çok yoğun → Yoğun → Orta → Düşük, her grup 3 sn, sonsuz. Her 3 sn'de yalnız <g data-active> değişir
// (React yeniden render yok); sırası gelen grubun isimleri yumuşakça belirir, noktaları büyüyüp küçülerek yanıp söner (CSS
// transform / opacity). Diğer grupların noktaları sabit, isimleri görünmez. Sekme görünmezken zamanlayıcı durur, dönünce kaldığı
// gruptan sürer; bileşen kaldırılınca temizlenir. Bekleme (idle): noktalar gri, isim yok, döngü yok
function DensityLayer({ density, flashes, idle }: { density: SonarDensity; flashes: Record<string, number>; idle: boolean }) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    const g = ref.current;
    if (!g || idle) { g?.removeAttribute('data-active'); return undefined; }
    let index = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const show = () => g.setAttribute('data-active', String(LEVEL_ORDER[index]));
    const start = () => {
      if (timer) return;
      show();
      timer = setInterval(() => { index = (index + 1) % LEVEL_ORDER.length; show(); }, GROUP_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); g.removeAttribute('data-active'); };
  }, [idle]);

  const placed = placeDistricts(density);
  return (
    <g ref={ref} className="ll-density">
      {placed.map((b) => idle ? (
        <circle key={b.name} cx={b.x} cy={b.y} r={WAIT_DOT.r} fill={WAIT_DOT.color} opacity={WAIT_DOT.opacity} />
      ) : (
        <g key={b.name} className={`ll-lv-${b.level}`}>
          {flashes[b.name] > 0 && <circle key={flashes[b.name]} className="ll-flash" cx={b.x} cy={b.y} r={b.r} fill={b.color} />}
          <circle className="ll-d-dot" style={{ ['--ll-o' as string]: b.opacity }} cx={b.x} cy={b.y} r={b.r} fill={b.color} />
          <text
            className="ll-d-name"
            x={b.labelX}
            y={b.labelY}
            textAnchor={b.anchor}
            fontSize="10.5"
            fontWeight={b.level <= 2 ? 700 : 400}
            fill={b.color}
            style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
          >
            {b.name}
          </text>
        </g>
      ))}
    </g>
  );
}

function DotLayer({ sonar, idle }: { sonar: LivePulse['sonar'] | null; idle: boolean }) {
  return (
    <>
      {(sonar?.dots ?? []).map((d) => {
        const p = point(dotAngle(d.key, d.district), RING_RADIUS[d.state]);
        const style = idle ? WAIT_DOT : DOT[d.state];
        return (
          <g key={d.key}>
            {!idle && d.state === 'new' && <circle className="ll-dot-new" cx={p.x} cy={p.y} r={style.r} fill={style.color} />}
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

// idle: tarama başlamadı ("Yeni tarama başlamasına" geri sayımı gösterilirken) — rozet "PASİF" (kırmızı), radar durur, her şey gri;
// aksi hâlde CANLI (yeşil), ışın sürekli döner. Rozet, radar ve noktalar yalnız bu tek durumdan okunur (mobil Sonar.tsx ile aynı)
export default function LiveSonar({ sonar, idle = false }: { sonar: LivePulse['sonar'] | null; idle?: boolean }) {
  const t = useTranslations();
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
    ? Object.values(LEVELS).map((l) => [t(l.label), l.color])
    : [[t('live.legendNew'), '#ff6b5e'], [t('live.legendActive'), '#e8a27a'], [t('live.legendPool'), '#c9c2b8']];

  return (
    <section>
      <div className="ll-head">
        <h2 className="ll-title">{t('live.scanTitle')}</h2>
        <span className={idle ? 'll-live is-idle' : 'll-live is-green'}><span className="ll-live-dot" />{idle ? t('live.badgeInactive') : t('live.liveBadge')}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AhenkSonar
          centerPulse={centerPulse}
          ariaLabel={density
            ? t('live.sonarDensityAria', { count: density.districts.length })
            : t('live.sonarDotsAria', { count: dots.length, fresh: counts.new, active: counts.active })}
        >
          {density ? <DensityLayer density={density} flashes={flashes} idle={idle} /> : <DotLayer sonar={sonar} idle={idle} />}
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
