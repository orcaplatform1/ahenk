// Ahenk mobil tema — tek kaynak. Tüm değerler web kaynağından birebir alınmıştır (yeni değer yok).
// Kaynaklar: packages/config/tailwind.js, packages/ui/src/theme.ts, apps/web/app/globals.css,
// apps/web/app/layout.tsx, packages/ui bileşenleri, apps/web/components.

// ── Renk kaynağı 1: Tailwind (packages/config/tailwind.js) ──────────────────
export const tw = {
  bg: '#121212',
  surface: '#222222',
  border: '#1f1f1f',
  primary: '#c0392b',
  primaryHover: '#e74c3c',
  accent: '#ff6b6b',
  text: '#f5f5f5',
  muted: '#888888',
} as const;

// ── Renk kaynağı 2: packages/ui/src/theme.ts ───────────────────────────────
export const ui = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#1f1f1f',
  primary: '#c0392b',
  primaryHover: '#e74c3c',
  accent: '#ff6b6b',
  text: '#f5f5f5',
  muted: '#888888',
} as const;

// ── Canlı Katman (.live-layer, globals.css) ───────────────────────────────
export const ll = {
  bg: '#0a0a0a',
  text: '#f4f1ec',
  text2: '#c9c2b8',
  label: '#a39c93',
  time: '#8f887f',
  red: '#d6453a',
  red2: '#ff6b5e',
  red3: '#ff8a7e',
  copper: '#e8a27a',
  copper2: '#c8743c',
  glow: 'rgba(200,56,44,0.28)',
} as const;

// ── Cinsiyet (MasalarDashboard.tsx, DetayAvatar.tsx) ──────────────────────
export const gender = {
  male: '#4fc3f7',
  female: '#f48fb1',
  maleBg: 'rgba(79,195,247,0.12)',
  femaleBg: 'rgba(244,143,177,0.12)',
} as const;

// ── Durum / yardımcı renkler (web kaynak dosyalarındaki değerler) ─────────
export const c = {
  green: '#27ae60', // MasaDetayKarti GREEN
  red: '#c0392b', // MasaDetayKarti RED
  wine: '#A21A26', // btn-primary noktası
  wineBorder: '#722F37', // TabMasalar KYC şeridi
  ghostDot: 'rgba(230,225,218,0.5)',
  ghostRedDot: '#e74c3c',
  ok: '#4ade80',
  ok2: '#22c55e',
  warnYellow: '#facc15',
  warnAmber: '#f59e0b',
  warnOrange: '#ffb347',
  maintText: '#e0b84a',
  maintBg: 'rgba(201,162,39,0.10)',
  maintBorder: 'rgba(201,162,39,0.35)',
  sheetBg: '#1a1a1a',
  planLeft: '#0c0909',
  gold1: '#c9a227',
  gold2: '#e8c84a',
  aiBg: 'rgba(8,18,44,0.75)',
  aiBorder: 'rgba(100,130,200,0.18)',
  aiTitle: 'rgba(180,200,255,0.75)',
  aiIconBg: 'rgba(100,130,200,0.14)',
  aiIconBorder: 'rgba(100,130,200,0.22)',
  aiDivider: 'rgba(100,130,200,0.12)',
  tradersText: '#e8e8e8', // SiteFooter
  tradersTR: '#4a90d9', // SiteFooter
  kycBall: '#722f37',
  white: '#ffffff',
  black: '#000000',
  t666: '#666666',
  t555: '#555555',
  t444: '#444444',
  t333: '#333333',
  tAaa: '#aaaaaa',
  tBbb: '#bbbbbb',
  tCcc: '#cccccc',
  tF0: '#f0f0f0',
  t888: '#888888',
} as const;

// ── Sekme (LiveTabs) durum noktaları ve halkaları (globals.css) ───────────
export const tabDot = {
  default: '#6e6860',
  table: '#7bc67e',
  forming: '#7bc67e',
  failed: '#ff3b30',
  cancelled: '#ff3b30',
  scanning: '#ff3b30',
  kyc: '#f5a623',
  pending: '#ffd60a',
  kanka: '#ffd60a',
  none: '#6e6860',
} as const;
export const rings = { redOff: '#4a3a3a', copperOff: '#3a2e2e', redOn: '#ff3b30', copperOn: '#e8823a', glow: 'rgba(255,59,48,0.2)' } as const;

// ── Yoğunluk seviyeleri (components/live/levels.ts) ───────────────────────
export const LEVELS = {
  1: { label: 'Çok yoğun', color: '#ff3b30', r: 9, band: 50, opacity: 1, start: 45 },
  2: { label: 'Yoğun', color: '#ff8c42', r: 7, band: 86, opacity: 0.92, start: 0 },
  3: { label: 'Orta', color: '#f2c14e', r: 5.5, band: 118, opacity: 0.8, start: 90 },
  4: { label: 'Düşük', color: '#8a8178', r: 4, band: 136, opacity: 0.6, start: 25 },
} as const;

// ── AccountTabBar (alt sekme çubuğu renkleri) ─────────────────────────────
export const tabBar = {
  bg: '#0a0a0a',
  border: 'rgba(255,255,255,0.12)',
  activeBg: 'rgba(192,57,43,0.18)',
  active: '#ff6b6b',
  activeBorder: 'rgba(192,57,43,0.35)',
  inactive: '#666666',
} as const;

// ── Yazı tipleri (app/layout.tsx: DM Serif Display, Inter, JetBrains Mono) ──
export const fonts = {
  serif: 'DMSerifDisplay_400Regular',
  sans400: 'Inter_400Regular',
  sans500: 'Inter_500Medium',
  sans600: 'Inter_600SemiBold',
  sans700: 'Inter_700Bold',
  sans800: 'Inter_800ExtraBold',
  mono400: 'JetBrainsMono_400Regular',
  mono500: 'JetBrainsMono_500Medium',
  mono600: 'JetBrainsMono_600SemiBold',
} as const;

export function sans(weight: 400 | 500 | 600 | 700 | 800 = 400): string {
  return ({ 400: fonts.sans400, 500: fonts.sans500, 600: fonts.sans600, 700: fonts.sans700, 800: fonts.sans800 } as const)[weight];
}
export function mono(weight: 400 | 500 | 600 = 400): string {
  return ({ 400: fonts.mono400, 500: fonts.mono500, 600: fonts.mono600 } as const)[weight];
}

// ── Bileşen ölçüleri (globals.css) ────────────────────────────────────────
export const llCard = { radius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.025)', padding: 18 } as const;
export const llMetric = { radius: 16, borderColor: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.03)', padV: 12, padH: 10 } as const;
export const llColumn = { maxWidth: 480, padTop: 16, padH: 20, padBottom: 28, gap: 28 } as const;
export const llHead = { gap: 12, marginBottom: 12 } as const;
export const llTitle = { size: 23, lineHeight: 1.2 } as const;
export const llEyebrow = { size: 11, letterSpacing: 1.6 } as const;
export const llNote = { size: 11 } as const;
export const llCta = {
  minHeight: 56, radius: 16, size: 16,
  gradient: ['#c7342a', '#d9603f', '#e8a27a'] as const, locations: [0, 0.55, 1] as const,
  shadow: 'rgba(214,69,58,0.35)',
} as const;
export const btnPrimary = {
  radius: 999, padV: 9, padH: 24, size: 11, letterSpacing: 0.14, bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.12)',
  dot: 4, dotColor: '#A21A26', gap: 8, disabledOpacity: 0.4, blur: 12,
} as const;
export const btnGhost = {
  radius: 999, padV: 9, padH: 24, size: 11, letterSpacing: 0.14, border: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.88)',
  dot: 4, dotColor: 'rgba(230,225,218,0.5)', gap: 8, disabledOpacity: 0.4,
} as const;
export const inputGlass = {
  bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.10)', radius: 12, color: '#f5f5f5', placeholder: '#888888',
  focusBorder: 'rgba(192,57,43,0.6)', blur: 8,
  // .ll-form içinde (kayıt): bg rgba(255,255,255,0.025), border rgba(255,255,255,0.08)
  formBg: 'rgba(255,255,255,0.025)', formBorder: 'rgba(255,255,255,0.08)',
} as const;
export const glassCard = { bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.10)', radius: 16, blur: 20 } as const;
export const sheet = { bg: '#1a1a1a', border: 'rgba(255,255,255,0.08)', radius: 20, padTop: 24, padH: 20, padBottom: 36, overlay: 'rgba(0,0,0,0.72)', maxWidth: 560 } as const;
export const accountTab = { size: 12, padV: 6, padH: 12, radius: 8, gap: 4, barPadH: 12, barPadV: 8 } as const;
export const heat = { height: 84, radius: 12, padding: 10, gap: 6 } as const;
export const llTab = { minHeight: 44, padV: 8, padH: 2, gap: 6, labelSize: 11, labelLetter: 0.14, statusSize: 10.5, liftY: -3 } as const;

// ── DetayAvatar (packages/ui/src/components/tables/DetayAvatar.tsx) ───────
export const detayAvatar = { d: 48, strokeWidth: 2.5, fontSize: 11, fontSizeLong: 10, textColor: '#f0f0f0', letterSpacing: 0.02 } as const;

// ── Sekme ikonu (S-09: 28 pt, oranlar DetayAvatar'dan) ────────────────────
export const tabIcon = { size: 28, inactiveOpacity: 0.55 } as const;
// Not: soluk görünüm opaklığı webde seçili olmayan .ll-tab.is-off opaklığıdır (0.55).

// ── Animasyon süreleri (globals.css) ──────────────────────────────────────
export const anim = { pulse: 1800, blink: 1400, sonarSpin: 6000, tabSpin: 3200, ringDrift: 1600, fade: 350, flash: 1400 } as const;

// ── Gölge / glow ──────────────────────────────────────────────────────────
export const shadow = {
  card: 'rgba(0,0,0,0.5)',
  red: 'rgba(192,57,43,0.45)',
} as const;
