// Kişilik Ağacı — üretim ve animasyon formülleri (platformdan bağımsız).
// apps/web/lib/kisilikAgaci.ts ve apps/mobile/lib/kisilikAgaci.ts birebir aynı dosyadır; aynı kullanıcı için iki platformda aynı ağaç çıkar.
// Çizim katmanı (web canvas / mobil Skia) yalnız frameOf() çıktısındaki çizgi ve elipsleri çizer.
// 'worklet' satırları mobilde (Reanimated) fonksiyonu UI thread'de çalıştırır; web'de etkisiz bir dizedir.

export interface AgacDegerleri { O: number; C: number; E: number; A: number; D: number } // 0–1 (yüzde / 100)

export interface Yaprak { pos: number; side: number; size: number; color: string; phase: number }
export interface Dal { depth: number; parent: number; angle: number; len: number; phase: number; leaves: Yaprak[] }
export interface Agac { branches: Dal[]; maxDepth: number; swayAmp: number }

export const RENK = {
  coral: '#ff7a63', leafCoral: '#e8604c', leafA: '#22a896', leafB: '#36c7b0',
  trunk: '#1d8f80', branch: '#25a593', ground: '#22a896', disc: '#3cc9b2', agree: '#4fd6bf', glow: '#e8604c',
} as const;

export const INTRO_MS = 2800;
export const DIM = 0.28;
const LEAF_ALPHA = 0.82;

// Kullanıcı id'sinin string hash'i (32 bit, h = h * 31 + karakter kodu)
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// mulberry32: 0–1 arası sayı üreteci
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(v: number) { 'worklet'; return v < 0 ? 0 : v > 1 ? 1 : v; }
function easeOutCubic(v: number) { 'worklet'; return 1 - Math.pow(1 - v, 3); }

// Deterministik ağaç üretimi. Sayı üreteci sırası: gövde eğim işareti, gövde fazı; ardından her dal için derinlik öncelikli
// (önce yapraklar: adet, her yaprak için konum, yan açı, boy, renk, faz; sonra çocuk sayısı, her çocuk için açı, uzunluk, faz ve alt dalları)
export function buildTree(v: AgacDegerleri, seed: string): Agac {
  const r = mulberry32(hashString(seed));
  const maxDepth = 5 + Math.round(v.O * 3);
  const spread = 0.28 + v.E * 0.62;
  const dev = (1 - v.C) * 0.55;
  let tilt = (1 - v.D) * 0.2;
  if (r() < 0.5) tilt = -tilt;
  const swayAmp = 0.015 + (1 - v.D) * 0.07;
  const branches: Dal[] = [{ depth: 0, parent: -1, angle: tilt, len: 100, phase: r() * Math.PI * 2, leaves: [] }];

  const grow = (idx: number) => {
    const b = branches[idx];
    if (b.depth >= maxDepth - 2) {
      const count = Math.round(1 + v.A * 4 + r() * v.A * 3);
      for (let k = 0; k < count; k++) {
        const pos = 0.3 + r() * 0.7;
        const side = (r() - 0.5) * 2.4;
        const size = (2.2 + v.A * 3.2) * (0.7 + r() * 0.6);
        const cr = r();
        const color = cr < 0.13 ? RENK.leafCoral : cr < 0.565 ? RENK.leafA : RENK.leafB;
        b.leaves.push({ pos, side, size, color, phase: r() * Math.PI * 2 });
      }
    }
    if (b.depth < maxDepth) {
      const n = b.depth > 0 && r() < v.O * 0.55 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        let base = -spread + (2 * spread * i) / (n - 1);
        if (b.depth === 0) base *= 0.85;
        const angle = base + (r() - 0.5) * 2 * dev * 0.6;
        let mult = 0.7 + (r() - 0.5) * dev * 0.5;
        if (b.depth === 0) mult -= 0.04;
        branches.push({ depth: b.depth + 1, parent: idx, angle, len: b.len * mult, phase: r() * Math.PI * 2, leaves: [] });
        grow(branches.length - 1);
      }
    }
  };
  grow(0);
  return { branches, maxDepth, swayAmp };
}

export interface Yerlesim { scale: number; ox: number; oy: number; areaW: number; leafBox: { cx: number; cy: number; rx: number; ry: number }; top: number; width: number }

// Salınımsız, tam büyümüş ağacı ölçüp alana sığdırır: genişlik ≤ %92, yükseklik ≤ %86, yatayda ortalı, kök alttan %7 yukarıda
export function layoutTree(t: Agac, W: number, H: number): Yerlesim {
  const n = t.branches.length;
  const ax = new Float64Array(n), ay = new Float64Array(n), ex = new Float64Array(n), ey = new Float64Array(n), abs = new Float64Array(n);
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const b = t.branches[i];
    const pa = b.parent < 0 ? 0 : abs[b.parent];
    abs[i] = pa + b.angle;
    ax[i] = b.parent < 0 ? 0 : ex[b.parent];
    ay[i] = b.parent < 0 ? 0 : ey[b.parent];
    ex[i] = ax[i] + Math.sin(abs[i]) * b.len;
    ey[i] = ay[i] - Math.cos(abs[i]) * b.len;
    minX = Math.min(minX, ex[i]); maxX = Math.max(maxX, ex[i]); minY = Math.min(minY, ey[i]); maxY = Math.max(maxY, ey[i]);
    for (const lf of b.leaves) {
      const px = ax[i] + (ex[i] - ax[i]) * lf.pos, py = ay[i] + (ey[i] - ay[i]) * lf.pos;
      const la = abs[i] + lf.side;
      // Yaprak elipsi: x yarıçapı boy×0,5, y yarıçapı boy; merkez yaprak ekseninde bağlantıdan boy×0,9 uzakta
      const cx = px + Math.sin(la) * lf.size * 0.9, cy = py - Math.cos(la) * lf.size * 0.9;
      const h = lf.size;
      minX = Math.min(minX, cx - h); maxX = Math.max(maxX, cx + h); minY = Math.min(minY, cy - h); maxY = Math.max(maxY, cy + h);
      lMinX = Math.min(lMinX, cx - h); lMaxX = Math.max(lMaxX, cx + h); lMinY = Math.min(lMinY, cy - h); lMaxY = Math.max(lMaxY, cy + h);
    }
  }
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  const scale = Math.min((W * 0.92) / bw, (H * 0.86) / bh);
  const ox = W / 2 - ((minX + maxX) / 2) * scale;
  const oy = H * 0.93;
  if (!isFinite(lMinX)) { lMinX = minX; lMaxX = maxX; lMinY = minY; lMaxY = maxY; }
  // Dışadönüklük elipsi: bütün yaprakları çevreler, her yönde 10 birim pay
  const leafBox = {
    cx: ox + ((lMinX + lMaxX) / 2) * scale, cy: oy + ((lMinY + lMaxY) / 2) * scale,
    rx: ((lMaxX - lMinX) / 2 + 10) * scale, ry: ((lMaxY - lMinY) / 2 + 10) * scale,
  };
  return { scale, ox, oy, areaW: W, leafBox, top: oy + minY * scale, width: bw * scale };
}

// glow: bulanıklık (px), 0 ise yok; parıltı rengi RENK.glow (#e8604c)
export interface Cizgi { x1: number; y1: number; x2: number; y2: number; w: number; color: string; alpha: number; glow: number }
export interface Elips { x: number; y: number; rot: number; rx: number; ry: number; color: string; alpha: number; glow: number }
export interface Kare {
  ground: { x: number; y: number; rx: number; ry: number; alpha: number }; // radyal gradyan: merkezde alpha, kenarda 0
  mirror: Cizgi[]; segs: Cizgi[]; leaves: Elips[]; falling: Elips[];
  rootDot: { x: number; y: number; r: number; alpha: number } | null; // #ff7a63, blur 18 px
  axis: { x: number; y1: number; y2: number; alpha: number } | null; // kesikli 3/4 px, 1 px, #e8604c
  ring: { x: number; y: number; rx: number; ry: number; alpha: number; dashOffset: number; glow: number } | null; // kesikli 5/5 px, 1,6 px, #e8604c
}

interface Dusen { x0: number; y0: number; rot0: number; size: number; color: string; born: number }
export interface AnimDurumu { clock: number; start: number; falling: Dusen[]; nextDrop: number; selAt: number; lastSel: number }

export function newAnimState(): AnimDurumu { 'worklet'; return { clock: 0, start: 0, falling: [], nextDrop: 0, selAt: 0, lastSel: -1 }; }
// Ağaç baştan büyür (dokunma / yeni değerler)
export function restart(s: AnimDurumu) { 'worklet'; s.start = s.clock; s.falling = []; s.nextDrop = 0; }
// Saat ilerler (sn); sekme gizliyken / ekran odakta değilken çağrılmaz, uzun aralar 50 ms ile sınırlanır
export function tick(s: AnimDurumu, dtSec: number) { 'worklet'; s.clock += Math.min(Math.max(dtSec, 0), 0.05); }

// Seçili boyut: 0 Açıklık, 1 Özdisiplin, 2 Dışadönüklük, 3 Uyumluluk, 4 Denge (null: seçim yok)
export function frameOf(t: Agac, L: Yerlesim, s: AnimDurumu, sel: number | null): Kare {
  'worklet';
  const T = s.clock;
  const selKey = sel === null ? -1 : sel;
  if (selKey !== s.lastSel) { s.lastSel = selKey; s.selAt = T; }
  const elapsed = (T - s.start) * 1000;
  const p = clamp01(elapsed / INTRO_MS);
  const introDone = p >= 1;
  const hl = introDone && sel !== null;
  // Nabız = 0,5 + 0,5 × sin((şimdi − seçimZamanı) / 320 ms)
  const pulse = 0.5 + 0.5 * Math.sin(((T - s.selAt) * 1000) / 320);
  const glowPx = 10 * pulse + 4;
  const { scale: k, ox, oy } = L;
  const md = t.maxDepth;
  const step = 0.82 / (md + 1.8);
  const leafGrow = easeOutCubic(clamp01((p - 0.68) / 0.28));
  const global = Math.sin(T * 0.37) * t.swayAmp * 0.4;

  const n = t.branches.length;
  const abs = new Float64Array(n), ex = new Float64Array(n), ey = new Float64Array(n);
  const segs: Cizgi[] = [], mirror: Cizgi[] = [], leaves: Elips[] = [];
  const leafPos: { x: number; y: number; rot: number; size: number; color: string }[] = [];

  for (let i = 0; i < n; i++) {
    const b = t.branches[i];
    const d = b.depth;
    const add = Math.sin(T * 1.1 + d * 0.8 + b.phase) * t.swayAmp * (d / md + 0.15) + global;
    abs[i] = (b.parent < 0 ? 0 : abs[b.parent]) + b.angle + add;
    const sx = b.parent < 0 ? ox : ex[b.parent], sy = b.parent < 0 ? oy : ey[b.parent];
    const g = easeOutCubic(clamp01((p - d * step) / (1.8 * step)));
    const len = b.len * g * k;
    ex[i] = sx + Math.sin(abs[i]) * len;
    ey[i] = sy - Math.cos(abs[i]) * len;
    if (g > 0) {
      const baseW = Math.max(0.6, 7.5 * Math.pow(0.69, d)) * k;
      let color: string = d < 2 ? RENK.trunk : RENK.branch;
      let w = baseW;
      let alpha = 0.55 + 0.45 * (1 - d / md);
      let glow = 0;
      let lit = false;
      if (hl && sel === 0 && d >= md - 1) { color = RENK.coral; glow = glowPx; lit = true; }
      if (hl && sel === 1) { color = RENK.disc; glow = glowPx; lit = true; }
      if (hl && sel === 4 && d <= 1) { color = RENK.coral; glow = glowPx; w *= 1.15; lit = true; }
      if (hl && !lit) alpha = DIM;
      segs.push({ x1: sx, y1: sy, x2: ex[i], y2: ey[i], w, color, alpha, glow });
      if (hl && sel === 1) mirror.push({ x1: 2 * ox - sx, y1: sy, x2: 2 * ox - ex[i], y2: ey[i], w: baseW, color: RENK.glow, alpha: 0.18 + 0.12 * pulse, glow: 0 });
    }
    if (b.leaves.length && leafGrow > 0) {
      for (let j = 0; j < b.leaves.length; j++) {
        const lf = b.leaves[j];
        const px = sx + (ex[i] - sx) * lf.pos, py = sy + (ey[i] - sy) * lf.pos;
        const rot = abs[i] + lf.side + Math.sin(T * 2 + lf.phase) * 0.12;
        let size = lf.size * k * leafGrow;
        let color = lf.color;
        let alpha = LEAF_ALPHA;
        let glow = 0;
        if (hl && sel === 3) {
          if (color !== RENK.leafCoral) color = RENK.agree;
          size *= 1.15 + 0.25 * Math.sin((T * 1000) / 260 + lf.phase);
          alpha = 0.95; glow = 8;
        } else if (hl) alpha = DIM;
        const cx = px + Math.sin(rot) * size * 0.9, cy = py - Math.cos(rot) * size * 0.9;
        leaves.push({ x: cx, y: cy, rot, rx: size * 0.5, ry: size, color, alpha, glow });
        leafPos.push({ x: cx, y: cy, rot, size: lf.size * k, color: lf.color });
      }
    }
  }

  // Bekleme: büyüme bittikten sonra 1,7–3,2 sn'de bir rastgele bir yaprak kopar ve düşer; 5 sn'de ya da kök hizasını geçince kaybolur
  if (introDone && leafPos.length) {
    if (s.nextDrop === 0) s.nextDrop = T + 1.7 + Math.random() * 1.5;
    if (T >= s.nextDrop) {
      const lp = leafPos[Math.floor(Math.random() * leafPos.length)];
      s.falling.push({ x0: lp.x, y0: lp.y, rot0: lp.rot, size: lp.size, color: lp.color, born: T });
      s.nextDrop = T + 1.7 + Math.random() * 1.5;
    }
  }
  const falling: Elips[] = [];
  const keep: Dusen[] = [];
  for (let i = 0; i < s.falling.length; i++) {
    const f = s.falling[i];
    const a = T - f.born;
    const y = f.y0 + (a * a * 4 + a * 14) * k;
    if (a > 5 || y > oy) continue;
    const x = f.x0 + (Math.sin(a * 2.2) * 12 + a * 6) * k;
    const fade = Math.max(0, 0.8 - 0.16 * a);
    const alpha = hl && sel !== 3 ? Math.min(fade, DIM) : fade;
    falling.push({ x, y, rot: f.rot0 + a * 1.5, rx: f.size * 0.5, ry: f.size, color: f.color, alpha, glow: 0 });
    keep.push(f);
  }
  s.falling = keep;

  const sa = 1 - p / 0.25;
  return {
    ground: { x: ox, y: oy, rx: L.areaW * 0.45, ry: 14, alpha: hl && sel === 4 ? 0.35 : 0.18 },
    mirror, segs, leaves, falling,
    rootDot: p < 0.25 ? { x: ox, y: oy, r: 4 + 3 * sa, alpha: sa } : null,
    axis: hl && sel === 1 ? { x: ox, y1: oy + 10, y2: oy - (oy - L.top) * 1.02, alpha: 0.6 } : null,
    ring: hl && sel === 2 ? { x: L.leafBox.cx, y: L.leafBox.cy, rx: L.leafBox.rx, ry: L.leafBox.ry, alpha: 0.55 + 0.4 * pulse, dashOffset: (T * 1000) / 40, glow: 8 } : null,
  };
}

// Varsayılan seçim: en yüksek puanlı boyut; eşitlikte listedeki ilk boyut
export function topDimension(percents: number[]): number {
  return percents.reduce((best, v, i) => (v > percents[best] ? i : best), 0);
}
