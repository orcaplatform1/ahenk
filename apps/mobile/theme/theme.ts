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

// ── Buton stilleri (KESİN BUTON KURALI): webdeki her buton stilinin birebir karşılığı. Ekranlar yalnız bunları kullanır.
// box: kap stili, text: yazı stili, on: seçili/aktif hali, gradient: degrade dolgu (renkler, konumlar, başlangıç/bitiş)
type Box = Record<string, unknown>;
export interface BtnSpec { box: Box; text: Box & { weight?: 400 | 500 | 600 | 700 | 800 }; on?: { box: Box; text: Box }; gradient?: { colors: string[]; locations?: number[]; start: { x: number; y: number }; end: { x: number; y: number } }; upper?: boolean; disabledOpacity?: number }
export const btn = {
  // TabPaket iade butonu (rounded-xl, kırmızı kenar)
  refund: { box: { paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderWidth: 1, borderColor: 'rgba(192,57,43,0.6)', backgroundColor: 'rgba(192,57,43,0.06)' }, text: { weight: 500, fontSize: 14, color: '#e74c3c' } },
  refundDisabled: { box: { paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, text: { weight: 500, fontSize: 14, color: 'rgba(255,255,255,0.25)' } },
  // KankaSection "Kankalıktan Çıkar" (rounded-full, kırmızı kenar)
  dangerPill: { box: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,57,43,0.6)', backgroundColor: 'rgba(192,57,43,0.06)', minHeight: 44 }, text: { weight: 600, fontSize: 14, color: '#e74c3c' }, disabledOpacity: 0.5 },
  // KankaSection "Davet Et" / "Davet Var" küçük hap butonları
  pillRed: { box: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(192,57,43,0.18)', borderColor: 'rgba(192,57,43,0.5)' }, text: { weight: 600, fontSize: 12, color: '#ff6b6b' } },
  pillGreen: { box: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.45)' }, text: { weight: 600, fontSize: 12, color: '#4ade80' } },
  // RezervasyonIptal ana buton ve pencere butonları
  resCancel: { box: { paddingVertical: 13, marginTop: 16, backgroundColor: 'rgba(192,57,43,0.2)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.5)', borderRadius: 9999, alignItems: 'center' }, text: { weight: 700, fontSize: 12, letterSpacing: 1.2, color: '#ff6b6b' }, upper: true },
  resConfirm: { box: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(192,57,43,0.25)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.55)' }, text: { weight: 700, fontSize: 14, color: '#ff6b6b' }, disabledOpacity: 0.45 },
  resBack: { box: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }, text: { weight: 700, fontSize: 14, color: '#b0b0b0' } },
  // MasaDetayKarti "Gelmedi olarak bildir"
  noShowSend: { box: { marginTop: 12, paddingVertical: 11, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(192,57,43,0.15)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.5)' }, text: { weight: 600, fontSize: 13, color: '#ff6b6b' }, disabledOpacity: 0.6 },
  // MasaDetayKarti "Acil Yardım" ve SOS formu "İhbarda Bulun"
  sos: { box: { borderRadius: 12, overflow: 'hidden', paddingVertical: 15, alignItems: 'center', shadowColor: 'rgba(192,57,43,0.45)', shadowOpacity: 1, shadowRadius: 10 }, text: { weight: 800, fontSize: 14, color: '#fff', letterSpacing: 1.68 }, upper: true, gradient: { colors: ['#7b0000', '#c0392b', '#ff6b6b'], locations: [0, 0.5, 1], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } },
  sosSubmit: { box: { borderRadius: 10, overflow: 'hidden', paddingVertical: 14, alignItems: 'center' }, text: { weight: 800, fontSize: 14, color: '#fff', letterSpacing: 1.12 }, disabledOpacity: 0.45, gradient: { colors: ['#7b0000', '#c0392b', '#ff6b6b'], locations: [0, 0.6, 1], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } },
  // MasaDetayKarti "Yola çıktığını bildirdin" (tamamlandı hali)
  doneGreen: { box: { paddingVertical: 13, backgroundColor: 'rgba(39,174,96,0.12)', borderWidth: 1, borderColor: 'rgba(39,174,96,0.35)', borderRadius: 9999, alignItems: 'center' }, text: { weight: 700, color: '#27ae60', fontSize: 12, letterSpacing: 1.2 }, upper: true },
  // TabProfilim kart başlığı "Düzenle" ve satır "Değiştir/Ekle"
  cardAction: { box: { paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }, text: { fontSize: 12, color: '#a39c93' } },
  rowAction: { box: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 6 }, text: { fontSize: 12, color: '#a39c93' } },
  // Metin bağlantı butonları ("Kodu tekrar gönder", "← Numarayı değiştir", "Temizle", "Sil")
  textLink: { box: { minHeight: 44, justifyContent: 'center' }, text: { fontSize: 13, color: '#a39c93', textAlign: 'center' } },
  textSmall: { box: { minHeight: 44, justifyContent: 'center' }, text: { fontSize: 12, color: '#a39c93' } },
  // Sohbet "Şikayet et" metin butonu
  reportLink: { box: { paddingVertical: 2, marginTop: 2 }, text: { fontSize: 10, color: '#444444' }, on: { box: {}, text: { color: '#333333' } } },
  // Geçmiş Masalarım "Değerlendir" (ll-mono bakır bağlantı) ve kart açma oku
  monoLink: { box: { alignSelf: 'flex-start', marginBottom: 8 }, text: { fontSize: 11, color: '#e8a27a', fontFamily: 'JetBrainsMono_400Regular' } },
  chevron: { box: { padding: 6 }, text: { color: '#a39c93', fontSize: 14 } },
  // Yönetim Paneli: menü bağlantısı (normal / aktif / Acil Yardım), Çıkış, "Okundu" gibi küçük butonlar, Navbar "Yönetim Paneli" rozeti
  admNav: { box: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, text: { fontSize: 13, color: '#64748b' }, on: { box: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' }, text: { color: '#93c5fd' } } },
  admNavSos: { box: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center' }, text: { weight: 600, fontSize: 13, color: '#ef4444' }, on: { box: { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.4)' }, text: { weight: 700, color: '#ef4444' } } },
  admLogout: { box: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 }, text: { fontSize: 13, color: '#64748b' } },
  admSmall: { box: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#0a1628', borderWidth: 1, borderColor: '#1a3a5c' }, text: { fontSize: 10, color: '#64748b' } },
  admClose: { box: { minWidth: 24, alignItems: 'center' }, text: { fontSize: 20, color: '#64748b' } },
  adminChip: { box: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#1a3a5c', alignSelf: 'flex-start' }, text: { weight: 700, fontSize: 11, color: '#93c5fd' }, gradient: { colors: ['#0a1628', '#0d1f3c'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } },
  admSelect: { box: { backgroundColor: '#020c1b', borderWidth: 1, borderColor: '#1a3a5c', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }, text: { fontSize: 13, color: '#64748b' }, on: { box: {}, text: { color: '#e2e8f0' } } },
  admOption: { box: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' }, text: { fontSize: 13, color: '#e2e8f0' }, on: { box: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.35)' }, text: { color: '#3b82f6' } } },
  admDateOption: { box: { paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' }, text: { fontSize: 14, color: '#e2e8f0', textAlign: 'center' }, on: { box: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.35)' }, text: { color: '#3b82f6' } } },
  admCyan: { box: { marginTop: 14, padding: 9, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)' }, text: { weight: 700, fontSize: 13, color: '#22d3ee' } },
  admOutline: { box: { marginTop: 8, padding: 7, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1a3a5c' }, text: { fontSize: 13, color: '#64748b' } },
  admPager: { box: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 99, borderWidth: 1, borderColor: '#1a3a5c' }, text: { fontSize: 11, color: '#64748b' }, disabledOpacity: 0.3 },
  admOk: { box: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }, text: { weight: 600, fontSize: 12, color: '#22c55e' }, disabledOpacity: 0.5 },
  admNo: { box: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }, text: { weight: 600, fontSize: 12, color: '#ef4444' }, disabledOpacity: 0.5 },
  admX: { box: { padding: 2 }, text: { fontSize: 15, color: '#64748b' } },
  admSegment: { box: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1a3a5c' }, text: { weight: 600, fontSize: 13, color: '#64748b' }, on: { box: { backgroundColor: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.3)' }, text: { color: '#22d3ee' } } },
  admSave: { box: { marginTop: 12, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)' }, text: { weight: 700, fontSize: 13, color: '#22d3ee' }, on: { box: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' }, text: { color: '#22c55e' } }, disabledOpacity: 0.6 },
  admReview: { box: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#1a3a5c' }, text: { fontSize: 10, color: '#64748b' }, on: { box: { backgroundColor: 'rgba(34,211,238,0.08)', borderColor: 'rgba(34,211,238,0.3)' }, text: {} } },
  admOkSm: { box: { flex: 1, padding: 7, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }, text: { weight: 600, fontSize: 11, color: '#22c55e' }, disabledOpacity: 0.5 },
  admNoSm: { box: { flex: 1, padding: 7, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }, text: { weight: 600, fontSize: 11, color: '#ef4444' }, disabledOpacity: 0.5 },
  admAdd: { box: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)' }, text: { weight: 600, fontSize: 13, color: '#22d3ee' } },
  admCyanFull: { box: { padding: 9, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)' }, text: { weight: 700, fontSize: 13, color: '#22d3ee' }, disabledOpacity: 0.5 },
  admActivate: { box: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }, text: { fontSize: 10, color: '#22c55e' }, on: { box: { backgroundColor: 'rgba(100,116,139,0.1)', borderColor: 'rgba(100,116,139,0.25)' }, text: { color: '#64748b' } }, disabledOpacity: 0.5 },
  admDetail: { box: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: '#1a3a5c' }, text: { fontSize: 10, color: '#64748b' }, on: { box: { backgroundColor: 'rgba(34,211,238,0.08)', borderColor: 'rgba(34,211,238,0.3)' }, text: { color: '#22d3ee' } } },
  admLink: { box: {}, text: { fontSize: 12, color: '#22d3ee' } },
  admAmberSm: { box: { flex: 1, padding: 7, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }, text: { weight: 600, fontSize: 11, color: '#f59e0b' }, disabledOpacity: 0.5 },
  admGreen: { box: { paddingVertical: 9, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' }, text: { weight: 600, fontSize: 13, color: '#22c55e' }, disabledOpacity: 0.5 },
  admGhost: { box: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1a3a5c' }, text: { fontSize: 13, color: '#64748b' } },
  admCheck: { box: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }, text: { fontSize: 13, color: '#e2e8f0' } },
  admChipTab: { box: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: '#1a3a5c' }, text: { weight: 700, fontSize: 11, color: '#64748b' }, on: { box: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.35)' }, text: { color: '#3b82f6' } } },
  admCancelSm: { box: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }, text: { fontSize: 11, color: '#ef4444' } },
  admRedFull: { box: { padding: 9, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }, text: { weight: 700, fontSize: 13, color: '#ef4444' }, disabledOpacity: 0.5 },
  admPageBox: { box: { backgroundColor: '#020c1b', borderWidth: 1, borderColor: '#1a3a5c', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 }, text: { fontSize: 13, color: '#e2e8f0' } },
  admTabBtn: { box: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#1a3a5c' }, text: { fontSize: 11, color: '#64748b' } },
  admOkMd: { box: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }, text: { weight: 600, fontSize: 11, color: '#22c55e' }, disabledOpacity: 0.5 },
  admRejectMd: { box: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }, text: { weight: 600, fontSize: 11, color: '#ef4444' }, on: { box: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' }, text: {} }, disabledOpacity: 0.5 },
  admCancelMd: { box: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#1a3a5c' }, text: { fontSize: 11, color: '#64748b' } },
  admSaveSm: { box: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }, text: { weight: 600, fontSize: 11, color: '#22c55e' }, disabledOpacity: 0.5 },
  // Kayıt "Kod gönder" (telefon satırı) ve numara "Ekle"
  otpSend: { box: { justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(192,57,43,0.5)', backgroundColor: 'rgba(192,57,43,0.06)' }, text: { weight: 500, fontSize: 12, color: '#e74c3c' }, disabledOpacity: 0.4 },
  addSquare: { box: { justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, text: { fontSize: 13, color: '#c9c2b8' } },
  // Giriş sayfası WhatsApp/E-posta anahtarı (segment)
  segment: { box: { flex: 1, paddingVertical: 8, minHeight: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' }, text: { weight: 500, fontSize: 13, color: '#666' }, on: { box: { backgroundColor: 'rgba(192,57,43,0.18)', borderColor: 'rgba(192,57,43,0.35)' }, text: { color: '#ff6b6b' } } },
  // AccountTabBar sekme butonu
  accountTab: { box: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' }, text: { weight: 500, fontSize: 12, color: '#666' }, on: { box: { backgroundColor: 'rgba(192,57,43,0.18)', borderColor: 'rgba(192,57,43,0.35)' }, text: { color: '#ff6b6b' } } },
  // Mekân paneli üst sekme bağlantısı
  venueTab: { box: { paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' }, text: { fontSize: 13.6, color: '#888' }, on: { box: { borderBottomColor: '#c0392b' }, text: { color: '#ff6b6b' } } },
  venueLogout: { box: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }, text: { fontSize: 13, color: '#888' } },
  // Mekân Hesap: "Hesabı Sil", "Vazgeç", "Hesabı Kapat"
  venueDelete: { box: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(192,57,43,0.5)', alignItems: 'center', justifyContent: 'center' }, text: { fontSize: 14.4, color: '#ff6b6b' } },
  venueCancel: { box: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }, text: { color: '#aaaaaa' } },
  venueConfirm: { box: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center' }, text: { color: '#fff' }, disabledOpacity: 0.6 },
  // Mekân fotoğraf ekleme (kesik çizgili)
  venueAddPhoto: { box: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10 }, text: { color: '#ff6b6b', fontSize: 14.4 } },
  // Winback "İndirimi Uygula"
  winbackCta: { box: { borderRadius: 999, padding: 16, alignItems: 'center', shadowColor: 'rgba(200,84,50,0.4)', shadowOpacity: 1, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } }, text: { weight: 700, fontSize: 16, letterSpacing: 0.32, color: '#fff' }, disabledOpacity: 0.55, gradient: { colors: ['#c0392b', '#d6453a', '#c8743c'], locations: [0, 0.4, 1], start: { x: 0, y: 0.4 }, end: { x: 1, y: 0.6 } } },
  winbackBadge: { box: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(214,69,58,0.14)', borderWidth: 1, borderColor: 'rgba(200,116,60,0.6)' }, text: { weight: 600, fontSize: 13, color: '#f5f5f5' } },
  winbackClose: { box: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }, text: { color: '#a39c93', fontSize: 14 } },
  // Seçim kartları (web'de button): OCEAN yanıtı (kayıt / test), mekan tercihi, SOS tehdidi, plan kartı seçimi
  likertForm: { box: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.08)' }, text: { fontSize: 13, color: '#a39c93' }, on: { box: { backgroundColor: 'rgba(192,57,43,0.12)', borderColor: 'rgba(192,57,43,0.55)' }, text: { color: '#ff6b6b' } } },
  likertTest: { box: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.12)' }, text: { fontSize: 14, color: '#888' }, on: { box: { backgroundColor: 'rgba(192,57,43,0.12)', borderColor: 'rgba(192,57,43,0.55)' }, text: { color: '#ff6b6b' } } },
  venuePrefForm: { box: { borderRadius: 16, padding: 20, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.08)' }, text: { weight: 500, fontSize: 15, color: '#f5f5f5' }, on: { box: { borderWidth: 1.5, backgroundColor: 'rgba(192,57,43,0.10)', borderColor: 'rgba(192,57,43,0.6)' }, text: { color: '#ff6b6b' } } },
  venuePrefProfile: { box: { borderRadius: 12, padding: 16, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.12)' }, text: { weight: 500, fontSize: 14, color: '#f5f5f5' }, on: { box: { borderWidth: 1.5, backgroundColor: 'rgba(192,57,43,0.10)', borderColor: 'rgba(192,57,43,0.5)' }, text: { color: '#ff6b6b' } } },
  sosThreat: { box: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 9, minHeight: 44, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, text: { fontSize: 13, color: '#cccccc' }, on: { box: { backgroundColor: 'rgba(192,57,43,0.2)', borderColor: 'rgba(192,57,43,0.6)' }, text: { color: '#ff6b6b', weight: 600 } } },
  winbackPlan: { box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, text: {}, on: { box: { backgroundColor: 'rgba(200,116,60,0.12)', borderColor: '#c8743c' }, text: {} } },
  // Liste seçenek satırı (şehir/ilçe/meslek seçim penceresi)
  listOption: { box: { paddingVertical: 13, paddingHorizontal: 14, borderRadius: 8 }, text: { fontSize: 15, color: '#cccccc' }, on: { box: { backgroundColor: 'rgba(192,57,43,0.12)' }, text: { color: '#ff6b6b', weight: 600 } } },
  // Form alanı açan buton (tarih / şehir / meslek seçimi)
  fieldSelect: { box: { backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 44 }, text: { fontSize: 13, color: '#a39c93' }, on: { box: {}, text: { color: '#f5f5f5' } } },
  citySelectProfile: { box: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }, text: { fontSize: 14, color: 'rgba(255,255,255,0.55)' }, on: { box: { borderColor: 'rgba(255,255,255,0.1)' }, text: { color: '#f5f5f5' } } },
  // Cinsiyet seçimi (kayıt)
  genderChip: { box: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1.5, borderColor: 'transparent' }, text: { fontSize: 13, color: '#8f887f' } },
  // Kapat (×) ikon butonları
  closeX: { box: { minWidth: 24, alignItems: 'center' }, text: { fontSize: 20, color: '#555555' } },
  lightboxClose: { box: { position: 'absolute', top: 56, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }, text: { fontSize: 18, color: '#f5f5f5' } },
  photoRemove: { box: { position: 'absolute', top: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }, text: { color: '#fff' } },
  thumbRemove: { box: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }, text: { fontSize: 12, lineHeight: 14, color: '#f5f5f5' } },
} satisfies Record<string, BtnSpec>;
export type BtnVariant = keyof typeof btn;

// Anahtar (CookieBanner Toggle): 42×24, açıkken #c0392b, kapalıyken rgba(255,255,255,0.12), beyaz 18 px düğme
export const toggleSwitch = { width: 42, height: 24, radius: 9999, onBg: '#c0392b', offBg: 'rgba(255,255,255,0.12)', knob: 18, knobColor: '#ffffff', inset: 3 } as const;

// TabProfilim ACCOUNT_BTN (btn-ghost üzerine): genişlik %72, dolgu 9/10, yazı clamp(8px, 2.5vw, 10px), harf aralığı 0.04em
export const accountBtn = { box: { width: '72%', alignSelf: 'center', paddingVertical: 9, paddingHorizontal: 10 }, text: { fontSize: 10, letterSpacing: 0.4 } } as const;
// ── Yönetim Paneli (apps/web/lib/adminTheme.ts + globals.css .admin-shell / .adm-page / .adm-table mobil kuralları) ──
export const adm = {
  bg: '#020c1b', surface: '#0a1628', card: '#0d1f3c', border: '#1a3a5c', text: '#e2e8f0', muted: '#64748b',
  red: '#ef4444', green: '#22c55e', amber: '#f59e0b', blue: '#3b82f6', cyan: '#22d3ee', navActive: '#93c5fd',
  pagePad: 16, // .adm-page ≤640px
  headerH: 52, drawerW: 208,
  label: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 11, letterSpacing: 1.1 },
  tableLabel: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: '#64748b' },
} as const;

// Yönetim Paneli Ayarlar anahtarı (admin/settings Toggle): 44×24, açıkken yeşil, kapalıyken yüzey + kenar
export const admToggle = { width: 44, height: 24, onBg: '#22c55e', offBg: '#0a1628', offBorder: '#1a3a5c', knob: 16, inset: 3, travel: 20 } as const;
