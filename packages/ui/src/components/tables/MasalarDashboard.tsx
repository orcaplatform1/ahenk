'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MasaDetayKarti, type MasaDetayData } from './MasaDetayKarti';
import { RezervasyonIptal, type ModalPortal } from './RezervasyonIptal';
import { AhenkSonar } from '../sonar/AhenkSonar';

// ── Sabitler ───────────────────────────────────────────────────────────────
const RADAR_SZ   = 340;
const CX         = RADAR_SZ / 2;
const CY         = RADAR_SZ / 2;
const ORBIT_R    = 142;
const AV_D       = 52;
const AV_R       = AV_D / 2;
const AV_BR      = AV_R - 3;
const CIRCUMF    = 2 * Math.PI * AV_BR;

const SCAN_CLR   = '#c0392b';
const MALE_CLR   = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';

const SCAN_DUR    = 1.8;
const FIRST_DELAY = 1800;
const STAGGER     = 1100;

// ── Orbit konumları ─────────────────────────────────────────────────────────
function orbitPts(n: number): Array<{ x: number; y: number }> {
  const step = (2 * Math.PI) / n;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + i * step;
    return { x: CX + ORBIT_R * Math.cos(a), y: CY + ORBIT_R * Math.sin(a) };
  });
}

// ── Sweep path ──────────────────────────────────────────────────────────────
function buildSweepPath(): string {
  const startRad = (-210 * Math.PI) / 180;
  const sx = CX + ORBIT_R * Math.cos(startRad);
  const sy = CY + ORBIT_R * Math.sin(startRad);
  return `M ${CX},${CY} L ${sx.toFixed(1)},${sy.toFixed(1)} A ${ORBIT_R},${ORBIT_R} 0 0,1 ${CX},${CY - ORBIT_R} Z`;
}
const SWEEP_PATH = buildSweepPath();

// ── Cinsiyet yardımcıları ──────────────────────────────────────────────────
export function gColor(g?: string | null) {
  if (g === 'FEMALE') return FEMALE_CLR;
  return MALE_CLR;
}
function gBg(g?: string | null) {
  if (g === 'FEMALE') return 'rgba(244,143,177,0.12)';
  return 'rgba(79,195,247,0.12)';
}

// ── Baş harf üretimi ── "Ayşe Yılmaz" → "A.Y." ─────────────────────────────
export function buildInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? '').trim()[0] ?? '?';
  const l = (lastName  ?? '').trim()[0] ?? '?';
  return `${f.toUpperCase()}.${l.toUpperCase()}.`;
}

// ── Kapanış sayacı — GROUP=Perşembe, ONE_ON_ONE=Cuma ─────────────────────────
// Masa türü başlığı
function tableTitleOf(type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'): string {
  return type === 'ONE_ON_ONE' ? 'BAŞ BAŞA MASA' : type === 'KANKA' ? 'KANKAMLA MASASI' : 'GRUP MASASI';
}

function nextDeadline(type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'): Date {
  const targetDay = type === 'GROUP' ? 4 : type === 'KANKA' ? 6 : 5;
  const now = Date.now();
  const nowTRms = now + 3 * 60 * 60 * 1000;
  const nowTR   = new Date(nowTRms);
  const dayTR   = nowTR.getUTCDay();
  const daysTo  = (targetDay - dayTR + 7) % 7;

  const tgtTR = new Date(nowTRms);
  tgtTR.setUTCDate(tgtTR.getUTCDate() + daysTo);
  tgtTR.setUTCHours(23, 59, 0, 0);

  const tgtUTC = new Date(tgtTR.getTime() - 3 * 60 * 60 * 1000);
  if (tgtUTC.getTime() <= now) tgtUTC.setUTCDate(tgtUTC.getUTCDate() + 7);
  return tgtUTC;
}



// ── Eşleşme kapalı mı? (TR saati) — Grup: Perşembe 23:59 → Pazar 23:59, Başbaşa: Cuma 23:59 → Pazar 23:59 ──
export function isMatchingClosed(type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'): boolean {
  const dayTR = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCDay(); // 0=Pazar … 6=Cumartesi
  if (type === 'KANKA') return dayTR === 0; // Kankamla: Cumartesi 23:59 → Pazar 23:59
  return type === 'GROUP' ? (dayTR === 5 || dayTR === 6 || dayTR === 0) : (dayTR === 6 || dayTR === 0);
}

// Yeni taramanın başlayacağı Pazar 23:59 (TR) — örn. "1 Kasım Pazar 23:59"
function nextScanStartLabel(): string {
  const nowTR = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const sunTR = new Date(nowTR);
  sunTR.setUTCDate(nowTR.getUTCDate() + ((7 - nowTR.getUTCDay()) % 7));
  const date = sunTR.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
  return `${date} 23:59`;
}

function CenterCountdown({ type }: { type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA' }) {
  const [msLeft, setMsLeft] = useState(() => Math.max(0, nextDeadline(type).getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setMsLeft(Math.max(0, nextDeadline(type).getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [type]);

  const totalSec = Math.floor(msLeft / 1000);
  const days  = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;
  const pad   = (n: number) => String(n).padStart(2, '0');

  const isDay      = totalSec < 86400;  // son 1 gün
  const is12h      = totalSec < 43200;  // son 12 saat
  const isHour     = totalSec < 3600;   // son 1 saat
  const is15min    = totalSec < 900;    // son 15 dakika

  const numColor =
    is15min ? '#e74c3c' :
    isHour  ? '#c0392b' :
    is12h   ? '#e67e22' :
    isDay   ? '#c9a227' :
    '#f5f5f5';

  const glowColor =
    is15min ? 'rgba(231,76,60,0.55)' :
    isHour  ? 'rgba(192,57,43,0.4)'  :
    is12h   ? 'rgba(230,126,34,0.4)' :
    isDay   ? 'rgba(201,162,39,0.35)' :
    'rgba(192,57,43,0.18)';

  const isPulse = is15min;

  const units = [
    { val: pad(days),  lbl: 'GÜN' },
    { val: pad(hours), lbl: 'SA'  },
    { val: pad(mins),  lbl: 'DK'  },
    { val: pad(secs),  lbl: 'SN'  },
  ];

  return (
    <div style={{ textAlign: 'center' }}>
      <style>{`
        @keyframes _cdglow{0%,100%{opacity:.85}50%{opacity:1}}
        .cd-ctr-pulse{animation:_cdglow 0.6s ease-in-out infinite}
      `}</style>
      {/* Arka plan: cam efekti */}
      <div style={{
        background: 'rgba(8,3,3,0.72)',
        border: `1px solid ${glowColor}`,
        borderRadius: 12,
        padding: '7px 10px 6px',
        boxShadow: `0 0 22px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        minWidth: 116,
      }}>
        {/* Üst etiket */}
        <p style={{
          margin: '0 0 7px',
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontFamily: 'Inter, sans-serif',
          color: 'rgba(192,57,43,0.85)',
        }}>
          KAPANIŞA KALAN
        </p>
        {/* 4 birim */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end', justifyContent: 'center' }}>
          {units.map(({ val, lbl }, i) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  className={isPulse ? 'cd-ctr-pulse' : undefined}
                  style={{
                    fontFamily: '"SF Mono","Fira Code",monospace',
                    fontSize: 16,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: numColor,
                    letterSpacing: '-0.02em',
                    textShadow: isHour ? `0 0 12px ${numColor}` : 'none',
                    transition: 'color 0.4s',
                  }}
                >
                  {val}
                </span>
                <span style={{
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'Inter, sans-serif',
                  marginTop: 3,
                }}>
                  {lbl}
                </span>
              </div>
              {i < 3 && (
                <span style={{
                  fontSize: 12, fontWeight: 700, color: 'rgba(192,57,43,0.45)',
                  fontFamily: 'monospace', lineHeight: 1, marginBottom: 10, padding: '0 1px',
                }}>:</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ── Tarih formatlama ────────────────────────────────────────────────────────
function formatMasaDate(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
      weekday: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    });
  } catch {
    return isoStr;
  }
}

// ── Tipler ─────────────────────────────────────────────────────────────────
export interface Participant {
  id?: string;
  initials: string;
  gender: 'MALE' | 'FEMALE' | string | null;
  // Kankamla: kişinin kendi çifti (kendisi + kankası) MINE, karşı çift OTHER
  pair?: 'MINE' | 'OTHER';
  joinedAt?: string; // Masaya giriş zamanı (Katılım listesi sırası)
  cancelled?: boolean; // İptal etti ama iptal son anına kadar listede dönüyor (Katılım alanında sayılmaz)
}

export interface MasaData {
  id: string;
  type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  scheduledAt: string;
  maxParticipants?: number;
  locationName?: string | null;
  locationText?: string | null;
  locationMapsUrl?: string | null;
  locationAddress?: string;
  venuePhotoUrl?: string | null;
  participants: Participant[];
}

export type MasaTuru = 'GROUP' | 'ONE_ON_ONE' | 'KANKA';

export interface DashboardItem {
  phase: 'WAITING' | 'REVEALED';
  meeting: {
    id: string;
    type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
    maxParticipants?: number;
    scheduledAt: string;
    participants: Participant[];
    sat10UTC?: string;
    venueName?: string;
    venueAddress?: string;
    venueMapsUrl?: string;
    venuePhotos?: Array<{ url: string; caption?: string }>;
    aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
    cancelRightUsed?: boolean;
  };
}

interface DashboardResponse {
  items: DashboardItem[];
}

interface Props {
  apiBase?: string;
  token?: string;
  pollIntervalMs?: number;
  selfParticipant?: Participant;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
  kycApproved?: boolean;
  // Kankamla: çiftte açık paket (kendisi ya da kankası) — Kankamla sekmesinde tarama görünür
  kankamlaActive?: boolean;
  // Rezervasyon iptal penceresini sayfanın üst katmanında açmak için (kart bulanıklığı pencereyi kırpmasın)
  modalPortal?: ModalPortal;
  // Verilirse sekme sayfa tarafından yönetilir ve içeride sekme çubuğu gösterilmez
  activeTabOverride?: MasaTuru;
  // Her polling sonucu sayfaya da iletilir (ayrı istek açılmaz)
  onItems?: (items: DashboardItem[]) => void;
}

// ── Avatar bileşeni ────────────────────────────────────────────────────────
interface BubbleProps {
  participant: Participant;
  cx: number;
  cy: number;
  delayMs: number;
}

function AvatarBubble({ participant, cx, cy, delayMs }: BubbleProps) {
  const color = gColor(participant.gender);
  const bg    = gBg(participant.gender);
  const ds    = delayMs / 1000;
  const isFem = participant.gender === 'FEMALE';

  const pulseMin = isFem ? 0.4  : 0.45;
  const pulseMax = isFem ? 0.95 : 1.0;
  const pulseDur = isFem ? 2.8  : 2.4;
  const shadow   = isFem
    ? 'drop-shadow(0 0 5px rgba(244,143,177,0.45))'
    : participant.gender === 'MALE'
    ? 'drop-shadow(0 0 5px rgba(79,195,247,0.5))'
    : 'drop-shadow(0 0 4px rgba(136,136,136,0.3))';

  const label = (() => {
    const raw = (participant.initials ?? '').trim();
    if (!raw) return '?.';
    if (/^[A-ZÇĞİÖŞÜa-zçğışöşü]\.[A-ZÇĞİÖŞÜa-zçğışöşü]\.?$/.test(raw)) return raw.toUpperCase();
    if (raw.length === 2 && !raw.includes('.')) return `${raw[0].toUpperCase()}.${raw[1].toUpperCase()}.`;
    return raw.toUpperCase();
  })();

  return (
    <motion.div
      style={{ position: 'absolute', left: cx - AV_R, top: cy - AV_R, width: AV_D, height: AV_D }}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: ds, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <svg width={AV_D} height={AV_D} viewBox={`0 0 ${AV_D} ${AV_D}`} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={AV_R} cy={AV_R} r={AV_R - 1} fill={bg} />
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={CIRCUMF}
          style={{ rotate: '-90deg', transformOrigin: `${AV_R}px ${AV_R}px` }}
          initial={{ strokeDashoffset: CIRCUMF }} animate={{ strokeDashoffset: 0 }}
          transition={{ delay: ds + 0.65, duration: 0.9, ease: 'easeOut' }}
        />
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR} fill="none" stroke={color} strokeWidth={2.5}
          style={{ filter: shadow }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [pulseMin, pulseMax, pulseMin] }}
          transition={{ delay: ds + 0.65 + 0.9, duration: pulseDur, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#f0f0f0', letterSpacing: '0.03em',
        fontFamily: 'Inter, sans-serif', userSelect: 'none', pointerEvents: 'none',
      }}>
        {label}
      </div>
    </motion.div>
  );
}

// ── Responsive radar scale hook ──────────────────────────────────────────────
function useIsDesktop() {
  const [v, setV] = useState(false);
  useEffect(() => {
    const check = () => setV(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return v;
}

function useRadarScale(maxScale = 1) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.min(maxScale, Math.max(0.5, el.offsetWidth / RADAR_SZ)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxScale]);
  return { wrapRef, scale };
}

// ── Radar sweep ──────────────────────────────────────────────────────────────
// KULLANILMIYOR: radar ortak AhenkSonar'a geçti, temizlikte kaldırılabilir
function RadarSweep({ running, cx, cy, sweepPath }: { running: boolean; cx: number; cy: number; sweepPath: string }) {
  const gRef = useRef<SVGGElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    let last = 0;
    function tick(ts: number) {
      const dt = last ? ts - last : 0;
      last = ts;
      angleRef.current = (angleRef.current + (dt / (SCAN_DUR * 1000)) * 360) % 360;
      if (gRef.current) gRef.current.setAttribute('transform', `rotate(${angleRef.current} ${cx} ${cy})`);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, cx, cy]);

  return (
    <g ref={gRef}>
      <path d={sweepPath} fill="url(#swpRG)" />
      <line x1={cx} y1={cy} x2={cx} y2={cy - ORBIT_R} stroke={SCAN_CLR} strokeWidth={1.5} opacity={0.9} />
      <circle cx={cx} cy={cy - ORBIT_R} r={3.5} fill={SCAN_CLR} />
    </g>
  );
}

// KULLANILMIYOR: tarama/kilitli radar /dashboard'dan kaldırıldı (RadarCanvas, buildScanningSlots, ScanningView)
// ── Canvas Radar ─────────────────────────────────────────────────────────────
const AVATAR_RIM = 134;   // avatar orbit yarıçapı (340px canvas)

const SLOT_ANGLES_6 = [270, 330, 30, 90, 150, 210];
const SLOT_ANGLES_2 = [270, 90];

interface RadarCanvasHandle {
  addAvatar: (initials: string, gender: string) => void;
}

const RadarCanvas = forwardRef<RadarCanvasHandle, {
  type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  children?: React.ReactNode;
}>(function RadarCanvas({ type, children }, ref) {
  const profilesRef = useRef<HTMLDivElement>(null);
  const stateRef    = useRef({ nextSlot: 0 });

  const slots = type === 'ONE_ON_ONE' ? SLOT_ANGLES_2 : SLOT_ANGLES_6;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  function slotPos(idx: number) {
    const a = (slotsRef.current[idx] * Math.PI) / 180;
    return { x: CX + AVATAR_RIM * Math.cos(a), y: CY + AVATAR_RIM * Math.sin(a) };
  }

  useImperativeHandle(ref, () => ({
    addAvatar(initials: string, gender: string) {
      const s     = stateRef.current;
      const maxSl = type === 'ONE_ON_ONE' ? 2 : 6;
      if (s.nextSlot >= maxSl) return;
      const idx = s.nextSlot++;
      const pos = slotPos(idx);
      const profiles = profilesRef.current;
      if (!profiles) return;

      const el = document.createElement('div');
      const g  = (gender ?? '').toLowerCase();
      el.className = `av-rc ${g === 'female' ? 'av-female' : 'av-male'}`;
      el.textContent = initials;
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';
      profiles.appendChild(el);

      requestAnimationFrame(() => {
        el.classList.add('av-arriving');
        setTimeout(() => el.classList.add('av-glow'), 100);
        setTimeout(() => el.classList.remove('av-glow'), 900);
      });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [type]);

  return (
    <div style={{ position: 'relative', width: RADAR_SZ, height: RADAR_SZ, flexShrink: 0 }}>
      <style>{`
        .av-rc {
          position: absolute; width: 46px; height: 46px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
          transform: translate(-50%, -50%);
          opacity: 0; background: #14141c; border: 2px solid transparent;
          font-family: Inter, system-ui, sans-serif;
        }
        .av-rc.av-male   { color: #4a9eff; border-color: #4a9eff; }
        .av-rc.av-female { color: #ff7eb3; border-color: #ff7eb3; }
        .av-rc.av-arriving { animation: avRcIn 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes avRcIn {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.3); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        }
        .av-rc::after { content:''; position:absolute; inset:-6px; border-radius:50%; opacity:0; transition:opacity 0.4s; }
        .av-rc.av-male::after   { box-shadow: 0 0 16px 4px rgba(74,158,255,0.6); }
        .av-rc.av-female::after { box-shadow: 0 0 16px 4px rgba(255,126,179,0.6); }
        .av-rc.av-glow::after   { opacity: 1; }
      `}</style>
      <div style={{ position: 'absolute', inset: 0 }}>
        <AhenkSonar width="100%" ariaLabel="Eşleşme taraması" />
      </div>
      <div ref={profilesRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      {children}
    </div>
  );
});

// ── Slot tabanlı E-K-E-K yerleşim ────────────────────────────────────────────
function buildScanningSlots(allParts: Participant[], maxP: number): Array<Participant | null> {
  const slots: Array<Participant | null> = Array(maxP).fill(null);
  const males   = allParts.filter(p => p.gender === 'MALE');
  const females = allParts.filter(p => p.gender === 'FEMALE');
  const others  = allParts.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');

  let mi = 0, fi = 0;
  for (let i = 0; i < maxP; i++) {
    if (i % 2 === 0 && mi < males.length)   slots[i] = males[mi++];
    if (i % 2 === 1 && fi < females.length) slots[i] = females[fi++];
  }
  let oi = 0;
  for (let i = 0; i < maxP && oi < others.length; i++) {
    if (!slots[i]) slots[i] = others[oi++];
  }
  return slots;
}

// ── SCANNING ekranı ──────────────────────────────────────────────────────────
// KULLANILMIYOR
function ScanningView({ type = 'GROUP', participants, selfParticipant, isDesktop }: {
  type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  participants?: Participant[];
  selfParticipant?: Participant;
  isDesktop?: boolean;
}) {
  const radarRef = useRef<RadarCanvasHandle>(null);
  const seenIds  = useRef<Set<string>>(new Set());
  const { wrapRef: radarWrapRef, scale: radarScale } = useRadarScale(isDesktop ? 1.5 : 1);

  const maxP  = type === 'ONE_ON_ONE' ? 2 : 6;
  const title = tableTitleOf(type);

  const rawParts = participants ?? [];
  const allParts: Participant[] = (() => {
    if (!selfParticipant) return rawParts;
    const alreadyIn = rawParts.some(p => p.initials === selfParticipant.initials);
    return alreadyIn ? rawParts : [selfParticipant, ...rawParts];
  })();

  const filledCount = allParts.length;
  const isFull      = filledCount >= maxP;

  // Backend'den eşleşme gelince addAvatar çağrılır
  useEffect(() => {
    allParts.forEach((p, i) => {
      const key = p.id ?? `${p.initials}-${i}`;
      if (seenIds.current.has(key)) return;
      seenIds.current.add(key);
      radarRef.current?.addAvatar(p.initials, (p.gender ?? '').toLowerCase());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, selfParticipant]);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
          fontSize: 22, fontWeight: 400, color: '#f5f5f5',
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px',
        }}>
          {title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <motion.span
            style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: isFull ? '#27ae60' : SCAN_CLR }}
            animate={isFull ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: isFull ? 0 : Infinity }}
          />
          <motion.span
            key={isFull ? 'full' : 'scan'}
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: isFull ? '#27ae60' : SCAN_CLR, fontFamily: 'Inter, sans-serif' }}
          >
            {isFull ? 'MASA OLUŞTURULDU' : 'EŞLEŞME TARANIYOR'}
          </motion.span>
        </div>
      </div>

      <div ref={radarWrapRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
        <div style={{
          transform: `scale(${radarScale})`, transformOrigin: 'top center',
          marginBottom: RADAR_SZ * (radarScale - 1), flexShrink: 0,
        }}>
          <RadarCanvas ref={radarRef} type={type}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 6, pointerEvents: 'none' }}>
              <CenterCountdown type={type} />
            </div>
          </RadarCanvas>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <span style={{ fontSize: 14, color: '#666', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}>
          Katılımcı:{' '}
          <motion.span
            key={filledCount}
            initial={{ scale: 1.4, color: '#ff6b6b' }}
            animate={{ scale: 1, color: SCAN_CLR }}
            transition={{ duration: 0.4 }}
            style={{ fontWeight: 700, display: 'inline-block' }}
          >
            {filledCount}
          </motion.span>
          <span style={{ color: '#444', margin: '0 4px' }}>/</span>
          <span style={{ fontWeight: 700, color: SCAN_CLR }}>{maxP}</span>
        </span>
      </div>
    </div>
  );
}

// ── Onaylı Radar Görünümü ─────────────────────────────────────────────────────
interface ConfirmedRadarProps {
  participants: Participant[];
  maxParticipants?: number;
  type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  scheduledAt: string;
  infoText: string;
}

export function ConfirmedRadarView({ participants, maxParticipants, type, scheduledAt, infoText, isDesktop }: ConfirmedRadarProps & { isDesktop?: boolean }) {
  const isOneOnOne = type === 'ONE_ON_ONE';
  const title      = tableTitleOf(type);
  const maxP       = maxParticipants ?? (isOneOnOne ? 2 : 6);
  const { wrapRef: radarWrapRef, scale: radarScale } = useRadarScale(isDesktop ? 1.5 : 1);

  const males   = participants.filter(p => p.gender === 'MALE');
  const females = participants.filter(p => p.gender === 'FEMALE');
  const others  = participants.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const ordered: Participant[] = [];
  const mfLen = Math.max(males.length, females.length);
  for (let i = 0; i < mfLen; i++) {
    if (i < males.length)   ordered.push(males[i]);
    if (i < females.length) ordered.push(females[i]);
  }
  ordered.push(...others);

  const positions = orbitPts(maxP);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
          fontSize: 22, fontWeight: 400, color: '#f5f5f5',
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px',
        }}>
          {title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#27ae60' }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#27ae60', fontFamily: 'Inter, sans-serif' }}>
            MASA OLUŞTURULDU
          </span>
        </div>
      </div>

      <div ref={radarWrapRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
        <div style={{
          position: 'relative', width: RADAR_SZ, height: RADAR_SZ, flexShrink: 0,
          transform: `scale(${radarScale})`, transformOrigin: 'top center',
          marginBottom: RADAR_SZ * (radarScale - 1),
        }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <AhenkSonar width="100%" ariaLabel="Masa oluşturuldu" />
          </div>
          <AnimatePresence>
            {ordered.map((p, i) => {
              const pos = positions[i];
              if (!pos) return null;
              return <AvatarBubble key={p.id ?? `${p.initials}-${i}`} participant={p} cx={pos.x} cy={pos.y} delayMs={i * 120} />;
            })}
          </AnimatePresence>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <span style={{ fontSize: 14, color: '#666', fontFamily: 'Inter, sans-serif' }}>
          Katılımcı: <span style={{ fontWeight: 700, color: '#27ae60' }}>{ordered.length}</span>
          <span style={{ color: '#444', margin: '0 4px' }}>/</span>
          <span style={{ fontWeight: 700, color: '#27ae60' }}>{maxP}</span>
        </span>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20, padding: '0 4px' }}>
        <p style={{ margin: '0 0 6px', fontFamily: 'var(--font-serif, "DM Serif Display", serif)', fontSize: 18, fontWeight: 400, color: '#27ae60' }}>
          Masanız Kuruldu!
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888', fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em' }}>
          Masa bulunma tarihi: {formatMasaDate(scheduledAt)}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#555', fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}>
          {infoText}
        </p>
      </div>
    </div>
  );
}

// ── Kapalı ekran (kapanıştan sonra, masası olmayan aboneler) ─────────────────
function ClosedView({ type = 'GROUP', isDesktop, icon = '/clock-icon.png', message, action }: {
  type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  isDesktop?: boolean;
  icon?: string;
  message?: React.ReactNode;
  action?: { label: string; href: string };
}) {
  const { wrapRef: radarWrapRef, scale: radarScale } = useRadarScale(isDesktop ? 1.5 : 1);
  const c = RADAR_SZ / 2;

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
          fontSize: 22, fontWeight: 400, color: '#f5f5f5',
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0,
        }}>
          {tableTitleOf(type)}
        </h2>
      </div>

      {/* Hareketsiz radar */}
      <div ref={radarWrapRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
        <div style={{
          transform: `scale(${radarScale})`, transformOrigin: 'top center',
          marginBottom: RADAR_SZ * (radarScale - 1), flexShrink: 0,
        }}>
          <div style={{ position: 'relative', width: RADAR_SZ, height: RADAR_SZ }}>
            <svg width={RADAR_SZ} height={RADAR_SZ} viewBox={`0 0 ${RADAR_SZ} ${RADAR_SZ}`} aria-hidden>
              {[0.92, 0.68, 0.44, 0.2].map((f, i) => (
                <circle key={i} cx={c} cy={c} r={c * f} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              ))}
              <line x1={c} y1={c * 0.08} x2={c} y2={RADAR_SZ - c * 0.08} stroke="rgba(255,255,255,0.04)" />
              <line x1={c * 0.08} y1={c} x2={RADAR_SZ - c * 0.08} y2={c} stroke="rgba(255,255,255,0.04)" />
            </svg>
            {/* Saat ikonu */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon} width={64} height={64} style={{ display: 'block' }} alt="" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20, padding: '0 8px' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, margin: action ? '0 0 22px' : 0 }}>
          {message ?? <>Yeni eşleşme taraması <span style={{ color: '#f5f5f5', fontWeight: 600 }}>{nextScanStartLabel()}</span>&apos;da başlayacak.</>}
        </p>
        {action && <a href={action.href} className="btn-primary">{action.label}</a>}
      </div>
    </div>
  );
}

// ── Kilitli ekran (yanlış/eksik paket) ────────────────────────────────────────
const LOCK_CLR      = '#e8850c';
const LOCK_ICON_CLR = '#7bc67e';

function LockedView({ type = 'GROUP' }: { type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'; neededPlan?: 'MASADA' | 'KARSIMDA' | 'KANKAMLA' | null; isDesktop?: boolean }) {
  const isGroup = type === 'GROUP';
  const line1 = isGroup
    ? 'Eşleşme taraması aktif.'
    : 'Eşleşme taraması daha derin ve hassas çalışıyor.';
  const line2 = type === 'KANKA'
    ? 'Kankanla birlikte karşı cinsten bir kanka çiftiyle eşleşmek için Kankamla paketi almalısınız. Paketi birinizin alması yeterli.'
    : isGroup
      ? 'Kişilik testiniz ile uyumlu insanlarla eşleşmenizi görmek için paket almalısınız.'
      : 'Kişilik testi ve Yaşınızla uyumlu bir insanla eşleşmenizi görmek için paket almalısınız.';

  return (
    <div>
      <style>{`
        @keyframes lockDot   { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes lockSweep { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes lockShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 50%{transform:translateX(0)} 75%{transform:translateX(3px)} }
      `}</style>

      {/* Başlık */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
          fontSize: 22, fontWeight: 400, color: '#f5f5f5',
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px',
        }}>
          {tableTitleOf(type)}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <CenterCountdown type={type} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: LOCK_CLR, animation: 'lockDot 1.2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 300, letterSpacing: '0.08em', color: LOCK_CLR, fontFamily: 'Inter, sans-serif' }}>
            TARAMA DEVAM EDİYOR
          </span>
        </div>
      </div>

      {/* Alt yazı + buton */}
      <div style={{ textAlign: 'center', marginTop: 20, padding: '0 8px' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#f5f5f5', lineHeight: 1.65, margin: '0 0 4px' }}>
          {line1}
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 1.65, margin: '0 0 22px' }}>
          {line2}
        </p>
        <a href="/profil?tab=paket" className="btn-primary">
          Paket Seç
        </a>
      </div>

    </div>
  );
}

// ── Tek kart içeriği ──────────────────────────────────────────────────────────
function MasaKarti({
  type, item, selfParticipant, isDesktop, apiBase, token, onCancelled, modalPortal,
}: {
  type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  item?: DashboardItem;
  selfParticipant?: Participant;
  isDesktop?: boolean;
  apiBase?: string;
  token?: string;
  onCancelled?: () => void;
  modalPortal?: ModalPortal;
}) {
  if (!item) {
    if (isMatchingClosed(type)) return <ClosedView type={type} isDesktop={isDesktop} />;
    return null; // Tarama durumu /dashboard'daki Katılım alanında
  }

  if (item.phase === 'REVEALED' && item.meeting.venueName) {
    const detayData: MasaDetayData = {
      id:             item.meeting.id,
      type:           item.meeting.type,
      maxParticipants: item.meeting.maxParticipants,
      scheduledAt:    item.meeting.scheduledAt,
      venueName:      item.meeting.venueName,
      venueAddress:   item.meeting.venueAddress,
      venueMapsUrl:   item.meeting.venueMapsUrl,
      venuePhotos:    item.meeting.venuePhotos,
      participants:   item.meeting.participants,
      aiReport:       item.meeting.aiReport,
    };
    return <MasaDetayKarti masa={detayData} />;
  }

  if (item.phase === 'WAITING') {
    return (
      <>
        <ConfirmedRadarView
          participants={item.meeting.participants}
          maxParticipants={item.meeting.maxParticipants}
          type={item.meeting.type}
          scheduledAt={item.meeting.scheduledAt}
          infoText="Masalar bölümünden detaylı bilgiye ulaşabilirsiniz."
          isDesktop={isDesktop}
        />
        {/* Rezervasyon iptali: kilit günü 20:00'ye kadar (masa kartı açıldığında iptal yok) */}
        {apiBase && (
          <RezervasyonIptal
            meetingId={item.meeting.id}
            type={item.meeting.type ?? type}
            scheduledAt={item.meeting.scheduledAt}
            cancelRightUsed={item.meeting.cancelRightUsed}
            apiBase={apiBase}
            token={token}
            onCancelled={onCancelled}
            modalPortal={modalPortal}
          />
        )}
      </>
    );
  }

  return null;
}

// ── Premium Toggle ─────────────────────────────────────────────────────────────
// KULLANILMIYOR: /dashboard sekmesi components/live/LiveTabs oldu; yalnızca kullanılmayan MasalarDashboard çağırıyor
export function PremiumToggle({
  activeTab,
  onSwitch,
  shineKey,
  visible,
}: {
  activeTab: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  onSwitch: (tab: 'GROUP' | 'ONE_ON_ONE' | 'KANKA') => void;
  shineKey: number;
  visible?: MasaTuru[]; // Boşsa üç sekme de görünür
}) {
  const tabs = [
    { key: 'GROUP' as const,      label: 'Grup Masası' },
    { key: 'ONE_ON_ONE' as const, label: 'Baş Başa Masa' },
    { key: 'KANKA' as const,      label: 'Kankamla' },
  ].filter((t) => !visible?.length || visible.includes(t.key));

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <style>{`
        @keyframes toggleShine {
          0%   { left: -60%; }
          100% { left: 140%; }
        }
      `}</style>
      <div style={{
        position: 'relative',
        display: 'flex',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(114,47,55,0.55)',
        borderRadius: 100,
        padding: 4,
        gap: 2,
        boxShadow: '0 0 40px rgba(114,47,55,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        {tabs.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onSwitch(key)}
              style={{
                position: 'relative',
                padding: '11px clamp(12px, 4vw, 26px)',
                whiteSpace: 'nowrap',
                borderRadius: 100,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                letterSpacing: isActive ? '0.04em' : '0.01em',
                transition: 'color 0.3s, font-weight 0.2s',
                WebkitTapHighlightColor: 'transparent',
                zIndex: 1,
                overflow: 'hidden',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabBg"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 100,
                    background: 'linear-gradient(135deg, #722F37 0%, #8B1A2A 50%, #9B2335 100%)',
                    boxShadow: '0 0 28px rgba(114,47,55,0.65), 0 0 60px rgba(114,47,55,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
                    overflow: 'hidden',
                  }}
                  transition={{ type: 'spring', stiffness: 480, damping: 36, mass: 0.8 }}
                >
                  {/* Shine sweep on tab change */}
                  <motion.div
                    key={shineKey}
                    style={{
                      position: 'absolute',
                      top: '-20%',
                      width: '45%',
                      height: '140%',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                      transform: 'skewX(-15deg)',
                    }}
                    initial={{ left: '-60%' }}
                    animate={{ left: '140%' }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                  />
                </motion.div>
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Ana bileşen ──────────────────────────────────────────────────────────────
// KULLANILMIYOR: /dashboard'dan kaldırıldı; ClosedView, LockedView ve MasaKarti yalnızca bu bileşenden çağrılıyor. Masa detayları Profil > Masalarım'da.
export function MasalarDashboard({
  apiBase,
  token,
  pollIntervalMs = 15000,
  selfParticipant,
  activePlan,
  kycApproved = true,
  modalPortal,
  kankamlaActive = false,
  activeTabOverride,
  onItems,
}: Props) {
  const [dashData, setDashData]   = useState<DashboardResponse | null>(null);
  const [loading, setLoading]     = useState(!!apiBase);
  const [ownTab, setActiveTab]    = useState<'GROUP' | 'ONE_ON_ONE' | 'KANKA'>('GROUP');
  const activeTab = activeTabOverride ?? ownTab;
  const [tabDir, setTabDir]       = useState(1);
  const [shineKey, setShineKey]   = useState(0);
  const isDesktop = useIsDesktop();

  const fetchDashboard = async () => {
    if (!apiBase) return;
    try {
      const res = await fetch(`${apiBase}/meetings/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) { setDashData({ items: [] }); return; }
      const data = await res.json();
      setDashData(data as DashboardResponse);
    } catch {
      setDashData({ items: [] });
    }
  };

  useEffect(() => {
    if (dashData) onItems?.(dashData.items);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashData]);

  useEffect(() => {
    if (!apiBase) return;
    setLoading(true);
    fetchDashboard().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);

  useEffect(() => {
    if (!apiBase) return;
    const id = setInterval(fetchDashboard, pollIntervalMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token, pollIntervalMs]);

  function handleTabSwitch(tab: 'GROUP' | 'ONE_ON_ONE' | 'KANKA') {
    if (tab === activeTab) return;
    const order = { GROUP: 0, ONE_ON_ONE: 1, KANKA: 2 };
    setTabDir(order[tab] > order[activeTab] ? 1 : -1);
    setShineKey(k => k + 1);
    setActiveTab(tab);
  }

  const cardStyle: React.CSSProperties = {
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: isDesktop ? '24px 48px 32px' : '14px 20px 20px',
    maxWidth: isDesktop ? undefined : 380,
    margin: '0 auto',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${SCAN_CLR}`, borderTopColor: 'transparent', animation: '_spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const items        = dashData?.items ?? [];
  const groupItem    = items.find(i => i.meeting.type === 'GROUP');
  const oneOnOneItem = items.find(i => i.meeting.type === 'ONE_ON_ONE');
  const kankaItem    = items.find(i => i.meeting.type === 'KANKA');
  // Bekleme ekranındaki rezervasyon iptali: iptal mesajı görünsün diye 2 sn sonra masalar yenilenir
  const cancelProps = { apiBase, token, modalPortal, onCancelled: () => { setTimeout(() => { fetchDashboard(); }, 2000); } };

  // Aktif tab'ın içeriğini belirle
  function getTabContent(tab: 'GROUP' | 'ONE_ON_ONE' | 'KANKA') {
    // Abonelik yok → her iki tab da kilitli
    // Kankamla ayrı paket: alıcı ya da kankası olarak açık paket varsa (veya masası varsa) tarama / masa
    if (tab === 'KANKA') {
      if (kankamlaActive || kankaItem) return <MasaKarti type="KANKA" item={kankaItem} selfParticipant={selfParticipant} isDesktop={isDesktop} {...cancelProps} />;
      return <LockedView type="KANKA" neededPlan="KANKAMLA" isDesktop={isDesktop} />;
    }

    if (!activePlan) return <LockedView type={tab} neededPlan={null} isDesktop={isDesktop} />;

    // Paket olsa bile (admin vermiş olsa dahi) KYC onaylı değilse eşleşme taraması yapılmaz
    const tabItem = tab === 'GROUP' ? groupItem : oneOnOneItem;
    if (!kycApproved && !tabItem) {
      return (
        <ClosedView
          type={tab}
          isDesktop={isDesktop}
          icon="/lock-icon.png"
          message="Eşleşme taramasına katılabilmek için kimlik doğrulamanızı (KYC) tamamlamalısınız."
          action={{ label: 'Kimliğimi Doğrula', href: '/profil?tab=kyc' }}
        />
      );
    }

    if (activePlan === 'ICERDE') {
      const item = tab === 'GROUP' ? groupItem : oneOnOneItem;
      return <MasaKarti type={tab} item={item} selfParticipant={selfParticipant} isDesktop={isDesktop} {...cancelProps} />;
    }

    if (activePlan === 'MASADA') {
      if (tab === 'GROUP') return <MasaKarti type="GROUP" item={groupItem} selfParticipant={selfParticipant} isDesktop={isDesktop} {...cancelProps} />;
      return <LockedView type="ONE_ON_ONE" neededPlan="KARSIMDA" isDesktop={isDesktop} />;
    }

    if (activePlan === 'KARSIMDA') {
      if (tab === 'ONE_ON_ONE') return <MasaKarti type="ONE_ON_ONE" item={oneOnOneItem} selfParticipant={selfParticipant} isDesktop={isDesktop} {...cancelProps} />;
      return <LockedView type="GROUP" neededPlan="MASADA" isDesktop={isDesktop} />;
    }

    return <LockedView type={tab} neededPlan={null} isDesktop={isDesktop} />;
  }

  // Masası olmayan ve kapanmamış sekmede gösterilecek kart yok (tarama durumu Katılım alanında)
  const activeItem = activeTab === 'GROUP' ? groupItem : activeTab === 'ONE_ON_ONE' ? oneOnOneItem : kankaItem;
  const tabContent = getTabContent(activeTab);
  const scanningOnly = !activeItem && !isMatchingClosed(activeTab) && (tabContent as React.ReactElement | null)?.type === MasaKarti;
  if (tabContent === null || scanningOnly) return null;

  return (
    <div style={{ maxWidth: isDesktop ? undefined : 400, margin: '0 auto' }}>
      <div style={cardStyle}>
        {!activeTabOverride && <div style={{ marginBottom: 24 }}><PremiumToggle activeTab={activeTab} onSwitch={handleTabSwitch} shineKey={shineKey} /></div>}
        <AnimatePresence mode="wait" custom={tabDir}>
          <motion.div
            key={activeTab}
            custom={tabDir}
            variants={{
              enter: (d: number) => ({ x: d * 55, opacity: 0, scale: 0.96, filter: 'blur(4px)' }),
              center: { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
              exit:  (d: number) => ({ x: d * -55, opacity: 0, scale: 0.96, filter: 'blur(4px)' }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          >
            {tabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
