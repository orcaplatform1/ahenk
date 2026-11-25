'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

// Etiket genişliği tahmini (viewBox birimi) ve sonar sınırı
const LABEL_H = 12;
const LABEL_GAP = 3;
const EDGE = 4;
const SIZE = 300;
const GROUP_MS = 3000;
const LEVEL_ORDER = [1, 2, 3, 4] as const;
// Dört grubun isimleri aynı font, kalınlık (700) ve boyutta (10.5); genişlik tahmini kalın harfe göre
const LABEL_CHAR = 6.4;
const PULSE_SCALE = 1.5; // ll-d-pulse büyüme oranı (globals.css)

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
// İsim: sağ yarıdaki noktada sağa, sol yarıdakinde sola; radar dışına taşacaksa yatayda içeri çekilir ve noktanın üstüne / altına
// (merkeze doğru) alınır. Bu konum bir noktaya (nabızla büyümüş hâli dahil) ya da aynı anda görünen (aynı gruptaki) başka bir isme
// değiyorsa sırasıyla sağ, sol, üst, alt denenir; hiçbiri uymazsa noktaya en yakın boş konum kullanılır. Kısaltma yok, radar dışına taşmaz
type Box = { x0: number; y0: number; x1: number; y1: number };
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (b: Box) => b.x0 >= EDGE && b.x1 <= SIZE - EDGE && b.y0 >= EDGE && b.y1 <= SIZE - EDGE;
function placeDistricts(density: SonarDensity) {
  const groups = LEVEL_ORDER.map((level) => density.districts.filter((d) => d.level === level));
  const order: SonarDensity['districts'] = [];
  for (let i = 0; order.length < density.districts.length; i++) groups.forEach((g) => { if (g[i]) order.push(g[i]); });
  const step = (2 * Math.PI) / Math.max(order.length, 1);
  const items = order.map((d, i) => {
    const angle = -Math.PI / 2 + i * step;
    const cfg = LEVELS[d.level];
    return { ...d, ...cfg, ...point(angle, cfg.band), angle };
  });
  const dots: Box[] = items.map((b) => { const R = b.r * PULSE_SCALE + 1; return { x0: b.x - R, y0: b.y - R, x1: b.x + R, y1: b.y + R }; });
  const shown: Record<number, Box[]> = {};
  return items.map((b) => {
    const width = b.name.length * LABEL_CHAR + 2;
    const R = b.r * PULSE_SCALE + 1;
    const box = (x0: number, y0: number): Box => ({ x0, y0, x1: x0 + width, y1: y0 + LABEL_H });
    const clampX = (x0: number) => Math.min(Math.max(x0, EDGE), SIZE - EDGE - width);
    const beside = b.y - LABEL_H / 2;
    // Mevcut yerleşim
    const right = Math.cos(b.angle) >= -1e-9;
    const sideX = right ? b.x + R + LABEL_GAP : b.x - R - LABEL_GAP - width;
    const current = clampX(sideX) === sideX ? box(sideX, beside)
      : box(clampX(sideX), b.y >= C ? b.y - R - LABEL_GAP - LABEL_H : b.y + R + LABEL_GAP);
    const others = shown[b.level] ?? (shown[b.level] = []);
    const free = (c: Box) => inside(c) && !dots.some((d) => hit(d, c)) && !others.some((o) => hit(o, c));
    const candidates = [
      current,
      box(b.x + R + LABEL_GAP, beside),
      box(b.x - R - LABEL_GAP - width, beside),
      box(clampX(b.x - width / 2), b.y - R - LABEL_GAP - LABEL_H),
      box(clampX(b.x - width / 2), b.y + R + LABEL_GAP),
    ];
    let pick = candidates.find(free);
    // Noktaya en yakın boş konum: merkezden dışa halkalar halinde aranır
    for (let dist = 2; !pick && dist <= SIZE; dist += 2) {
      for (let k = 0; k < 32 && !pick; k++) {
        const a = (k * Math.PI) / 16;
        const c = box(b.x + dist * Math.cos(a) - width / 2, b.y + dist * Math.sin(a) - LABEL_H / 2);
        if (free(c)) pick = c;
      }
    }
    const placed = pick ?? current;
    others.push(placed);
    return { ...b, labelX: placed.x0, labelY: placed.y1 - 2.5 };
  });
}

// Tarama başlamadan (idle): bütün semt noktaları "Düşük" grisinde, aynı büyüklükte ve hareketsiz (parlama / nefes / nabız yok).
// Canlıyken her semtin noktası ve adı yoğunluk seviyesinin renginde (LEVELS — mobil theme LEVELS ile aynı), noktalar yanıp söner
const WAIT_DOT = { color: LEVELS[4].color, r: LEVELS[4].r, opacity: LEVELS[4].opacity };

// Canlı tarama döngüsü: Çok yoğun → Yoğun → Orta → Düşük, her grup 3 sn, sonsuz. Her 3 sn'de yalnız <g data-active> değişir
// (React yeniden render yok); sırası gelen grubun isimleri yumuşakça belirir, noktaları büyüyüp küçülerek yanıp söner (CSS
// transform / opacity). Diğer grupların noktaları sabit, isimleri görünmez. Sekme görünmezken zamanlayıcı durur, dönünce kaldığı
// gruptan sürer; bileşen kaldırılınca temizlenir. Bekleme (idle): noktalar gri, isim yok, döngü yok
function DensityLayer({ density, idle }: { density: SonarDensity; idle: boolean }) {
  const ref = useRef<SVGGElement>(null);
  const placed = useMemo(() => placeDistricts(density), [density]);
  // Semti olmayan grup döngüde atlanır
  const cycle = LEVEL_ORDER.filter((level) => density.districts.some((d) => d.level === level)).join(',');
  useEffect(() => {
    const g = ref.current;
    const levels = cycle ? cycle.split(',') : [];
    if (!g || idle || levels.length === 0) { g?.removeAttribute('data-active'); return undefined; }
    let index = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const show = () => g.setAttribute('data-active', levels[index]);
    const start = () => {
      if (timer) return;
      show();
      timer = setInterval(() => { index = (index + 1) % levels.length; show(); }, GROUP_MS);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); g.removeAttribute('data-active'); };
  }, [idle, cycle]);

  return (
    <g ref={ref} className="ll-density">
      {placed.map((b) => idle ? (
        <circle key={b.name} cx={b.x} cy={b.y} r={WAIT_DOT.r} fill={WAIT_DOT.color} opacity={WAIT_DOT.opacity} />
      ) : (
        <g key={b.name} className={`ll-lv-${b.level}`}>
          <circle className="ll-d-dot" style={{ ['--ll-o' as string]: b.opacity }} cx={b.x} cy={b.y} r={b.r} fill={b.color} />
          <text
            className="ll-d-name"
            x={b.labelX}
            y={b.labelY}
            fontSize="10.5"
            fontWeight={700}
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

  // Yeni giriş: ilçesi listede değilse merkez kısa parlar (semt noktası parlaması kaldırıldı, mobil ile aynı)
  const seen = useRef<Set<string> | null>(null);
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
    const hits = fresh.filter((d) => d.district && names.has(d.district));
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
          {density ? <DensityLayer density={density} idle={idle} /> : <DotLayer sonar={sonar} idle={idle} />}
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
