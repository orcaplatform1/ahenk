'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MasaDetayKarti, type MasaDetayData } from './MasaDetayKarti';
import { MasaBeklemeKarti } from './MasaBeklemeKarti';

// ── Sabitler ───────────────────────────────────────────────────────────────
const RADAR_SZ   = 320;
const CX         = RADAR_SZ / 2;
const CY         = RADAR_SZ / 2;
const ORBIT_R    = 118;
const AV_D       = 52;
const AV_R       = AV_D / 2;
const AV_BR      = AV_R - 3;
const CIRCUMF    = 2 * Math.PI * AV_BR;

const SCAN_CLR   = '#c0392b';
const MALE_CLR   = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';
const OTHER_CLR  = '#888888';

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
  const startRad = (-160 * Math.PI) / 180;
  const sx = CX + ORBIT_R * Math.cos(startRad);
  const sy = CY + ORBIT_R * Math.sin(startRad);
  return `M ${CX},${CY} L ${sx.toFixed(1)},${sy.toFixed(1)} A ${ORBIT_R},${ORBIT_R} 0 0,1 ${CX},${CY - ORBIT_R} Z`;
}
const SWEEP_PATH = buildSweepPath();

// ── Cinsiyet yardımcıları ──────────────────────────────────────────────────
function gColor(g?: string | null) {
  if (g === 'MALE')   return MALE_CLR;
  if (g === 'FEMALE') return FEMALE_CLR;
  return OTHER_CLR;
}
function gBg(g?: string | null) {
  if (g === 'MALE')   return 'rgba(79,195,247,0.12)';
  if (g === 'FEMALE') return 'rgba(244,143,177,0.12)';
  return 'rgba(136,136,136,0.08)';
}

// ── Baş harf üretimi ── "Ayşe Yılmaz" → "A.Y." ─────────────────────────────
export function buildInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? '').trim()[0] ?? '?';
  const l = (lastName  ?? '').trim()[0] ?? '?';
  return `${f.toUpperCase()}.${l.toUpperCase()}.`;
}

// ── Perşembe 23:59 sayacı ──────────────────────────────────────────────────

function nextThursdayClosing(): Date {
  const now = Date.now();
  const nowTRms = now + 3 * 60 * 60 * 1000;
  const nowTR   = new Date(nowTRms);

  const dayTR          = nowTR.getUTCDay();
  const daysToThursday = (4 - dayTR + 7) % 7;

  const tgtTR = new Date(nowTRms);
  tgtTR.setUTCDate(tgtTR.getUTCDate() + daysToThursday);
  tgtTR.setUTCHours(23, 59, 0, 0);

  const tgtUTC = new Date(tgtTR.getTime() - 3 * 60 * 60 * 1000);

  if (tgtUTC.getTime() <= now) {
    tgtUTC.setUTCDate(tgtUTC.getUTCDate() + 7);
  }
  return tgtUTC;
}

type Urgency = 'far' | 'day' | 'orange' | 'red' | 'critical';

function formatCountdown(ms: number): { text: string; urgency: Urgency } {
  if (ms <= 0) return { text: '00sn', urgency: 'critical' };

  const totalSec = Math.floor(ms / 1000);
  const days  = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (days >= 1) return { text: `${days}g ${hours}sa ${pad(mins)}dk`, urgency: 'far' };
  if (totalSec > 3600) return { text: `${hours}sa ${pad(mins)}dk`, urgency: 'day' };
  if (totalSec > 600)  return { text: `${pad(mins)}dk ${pad(secs)}sn`, urgency: 'orange' };
  if (totalSec > 60)   return { text: `${pad(mins)}dk ${pad(secs)}sn`, urgency: 'red' };
  return { text: `${pad(secs)}sn`, urgency: 'critical' };
}

function ThursdayCountdown() {
  const [msLeft, setMsLeft] = useState(() => nextThursdayClosing().getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setMsLeft(nextThursdayClosing().getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const { text, urgency } = formatCountdown(Math.max(0, msLeft));

  const isUrgent   = urgency === 'red' || urgency === 'critical';
  const isCritical = urgency === 'critical';

  const fontSize =
    isCritical ? 20 :
    urgency === 'red' ? 17 :
    13;

  const color =
    isCritical ? '#e74c3c' :
    urgency === 'red' ? '#c0392b' :
    urgency === 'orange' ? '#e67e22' :
    urgency === 'day' ? '#bbb' :
    '#aaa';

  const filter =
    isCritical ? 'drop-shadow(0 0 10px rgba(231,76,60,0.7))' :
    urgency === 'red' ? 'drop-shadow(0 0 6px rgba(192,57,43,0.5))' :
    'none';

  return (
    <div style={{ textAlign: 'center', marginBottom: 14 }}>
      {isUrgent && (
        <style>{`
          @keyframes cdPulse { 0%,100%{opacity:.7} 50%{opacity:1} }
          .cd-pulse { animation: cdPulse ${isCritical ? 0.8 : 1.1}s ease-in-out infinite; }
        `}</style>
      )}

      <p style={{
        margin: 0,
        fontSize: 9,
        color: '#666',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        fontFamily: 'Inter, sans-serif',
        marginBottom: 4,
      }}>
        KAPANIŞA KALAN
      </p>

      <span
        className={isUrgent ? 'cd-pulse' : undefined}
        style={{
          display: 'inline-block',
          fontFamily: '"SF Mono", "Fira Code", monospace, Inter',
          fontSize,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color,
          filter,
          transition: 'color 0.5s, font-size 0.3s',
        }}
      >
        {text}
      </span>
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
}

export interface MasaData {
  id: string;
  type?: 'GROUP' | 'ONE_ON_ONE';
  scheduledAt: string;
  maxParticipants?: number;
  locationName?: string | null;
  locationText?: string | null;
  locationMapsUrl?: string | null;
  locationAddress?: string;
  venuePhotoUrl?: string | null;
  participants: Participant[];
}

// Dashboard API response tipi
interface DashboardResponse {
  phase: 'SCANNING' | 'WAITING' | 'REVEALED';
  meeting?: {
    id: string;
    type?: 'GROUP' | 'ONE_ON_ONE';
    maxParticipants?: number;
    scheduledAt: string;
    participants: Participant[];
    sat10UTC?: string;
    // REVEALED alanları
    venueName?: string;
    venueAddress?: string;
    venueMapsUrl?: string;
    venuePhotos?: Array<{ url: string; caption?: string }>;
    aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
  };
}

interface Props {
  masa?: MasaData;                // eski prop — SCANNING ekranını direkt beslemek için
  apiBase?: string;
  token?: string;
  pollIntervalMs?: number;
  /** true geçilirse /meetings/dashboard kullanır, false ise /meetings/my-current */
  useDashboardApi?: boolean;
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
    : 'drop-shadow(0 0 5px rgba(79,195,247,0.5))';

  const label = (() => {
    const raw = (participant.initials ?? '').trim();
    if (!raw) return '?.';
    if (/^[A-ZÇĞİÖŞÜa-zçğışöşü]\.[A-ZÇĞİÖŞÜa-zçğışöşü]\.?$/.test(raw)) return raw.toUpperCase();
    if (raw.length === 2 && !raw.includes('.')) return `${raw[0].toUpperCase()}.${raw[1].toUpperCase()}.`;
    return raw.toUpperCase();
  })();

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: cx - AV_R,
        top:  cy - AV_R,
        width: AV_D,
        height: AV_D,
      }}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: ds, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <svg
        width={AV_D}
        height={AV_D}
        viewBox={`0 0 ${AV_D} ${AV_D}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        <circle cx={AV_R} cy={AV_R} r={AV_R - 1} fill={bg} />

        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={CIRCUMF}
          style={{ rotate: '-90deg', transformOrigin: `${AV_R}px ${AV_R}px` }}
          initial={{ strokeDashoffset: CIRCUMF }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ delay: ds + 0.65, duration: 0.9, ease: 'easeOut' }}
        />

        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          style={{ filter: shadow }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [pulseMin, pulseMax, pulseMin] }}
          transition={{
            delay: ds + 0.65 + 0.9,
            duration: pulseDur,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#f0f0f0',
          letterSpacing: '0.03em',
          fontFamily: 'Inter, sans-serif',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {label}
      </div>
    </motion.div>
  );
}

// ── Onaylı Radar Görünümü ─────────────────────────────────────────────────────
interface ConfirmedRadarProps {
  participants: Participant[];
  maxParticipants?: number;
  type?: 'GROUP' | 'ONE_ON_ONE';
  scheduledAt: string;
  infoText: string;
}

export function ConfirmedRadarView({ participants, maxParticipants, type, scheduledAt, infoText }: ConfirmedRadarProps) {
  const isOneOnOne = type === 'ONE_ON_ONE';
  const title      = isOneOnOne ? 'BAŞ BAŞA MASA' : 'GRUP MASASI';
  const maxP       = maxParticipants ?? (isOneOnOne ? 2 : 6);

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
      {/* Başlık */}
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
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            color: '#27ae60', fontFamily: 'Inter, sans-serif',
          }}>
            MASA OLUŞTURULDU
          </span>
        </div>
      </div>

      {/* Radar alanı */}
      <div style={{ position: 'relative', width: RADAR_SZ, height: RADAR_SZ, margin: '0 auto' }}>
        <svg
          width={RADAR_SZ} height={RADAR_SZ}
          viewBox={`0 0 ${RADAR_SZ} ${RADAR_SZ}`}
          style={{ position: 'absolute', inset: 0 }}
        >
          {[30, 62, 93, ORBIT_R].map((r, i) => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="#27ae60"
              strokeWidth={i === 3 ? 1 : 0.8} opacity={i === 3 ? 0.35 : 0.12} />
          ))}
          <line x1={CX} y1={CY - ORBIT_R - 8} x2={CX} y2={CY + ORBIT_R + 8} stroke="#27ae60" strokeWidth={0.6} opacity={0.1} />
          <line x1={CX - ORBIT_R - 8} y1={CY} x2={CX + ORBIT_R + 8} y2={CY} stroke="#27ae60" strokeWidth={0.6} opacity={0.1} />
          <circle cx={CX} cy={CY} r={5} fill="#27ae60" opacity={0.7} />
        </svg>

        <AnimatePresence>
          {ordered.map((p, i) => {
            const pos = positions[i];
            if (!pos) return null;
            return (
              <AvatarBubble
                key={p.id ?? `${p.initials}-${i}`}
                participant={p}
                cx={pos.x}
                cy={pos.y}
                delayMs={i * 120}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Katılımcı sayısı */}
      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <span style={{ fontSize: 14, color: '#666', fontFamily: 'Inter, sans-serif' }}>
          Katılımcı:{' '}
          <span style={{ fontWeight: 700, color: '#27ae60' }}>{ordered.length}</span>
          <span style={{ color: '#444', margin: '0 4px' }}>/</span>
          <span style={{ fontWeight: 700, color: '#27ae60' }}>{maxP}</span>
        </span>
      </div>

      {/* Onay bilgisi */}
      <div style={{ textAlign: 'center', marginTop: 20, padding: '0 4px' }}>
        <p style={{
          margin: '0 0 6px',
          fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
          fontSize: 18, fontWeight: 400, color: '#27ae60',
        }}>
          Masanız Kuruldu!
        </p>
        <p style={{
          margin: '0 0 8px',
          fontSize: 12, color: '#888', fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.01em',
        }}>
          Masa bulunma tarihi: {formatMasaDate(scheduledAt)}
        </p>
        <p style={{
          margin: 0,
          fontSize: 12, color: '#555', fontFamily: 'Inter, sans-serif',
          lineHeight: 1.55,
        }}>
          {infoText}
        </p>
      </div>
    </div>
  );
}

// ── Radar sweep (RAF tabanlı) ─────────────────────────────────────────────────
function RadarSweep({ running, cx, cy, sweepPath }: {
  running: boolean; cx: number; cy: number; sweepPath: string;
}) {
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
      if (gRef.current) {
        gRef.current.setAttribute('transform', `rotate(${angleRef.current} ${cx} ${cy})`);
      }
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

// ── SCANNING ekranı (radar) ──────────────────────────────────────────────────
function ScanningView({ masa }: { masa: MasaData | null }) {
  const seenIds = useRef<Set<string>>(new Set());

  const maxP       = masa?.maxParticipants ?? (masa?.type === 'ONE_ON_ONE' ? 2 : 6);
  const rawParts   = masa?.participants ?? [];
  const isOneOnOne = masa?.type === 'ONE_ON_ONE';
  const title      = isOneOnOne ? 'BAŞ BAŞA MASA' : 'GRUP MASASI';

  const males   = rawParts.filter(p => p.gender === 'MALE');
  const females = rawParts.filter(p => p.gender === 'FEMALE');
  const others  = rawParts.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const ordered: Participant[] = [];
  const mfLen = Math.max(males.length, females.length);
  for (let i = 0; i < mfLen; i++) {
    if (i < males.length)   ordered.push(males[i]);
    if (i < females.length) ordered.push(females[i]);
  }
  ordered.push(...others);

  const isFull  = ordered.length >= maxP;
  const positions = orbitPts(maxP);

  const delays: number[] = ordered.map((p, i) => {
    const key = p.id ?? `${p.initials}-${i}`;
    if (seenIds.current.has(key)) return 0;
    seenIds.current.add(key);
    return FIRST_DELAY + i * STAGGER;
  });

  return (
    <div>
      {/* Başlık */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
          fontSize: 22,
          fontWeight: 400,
          color: '#f5f5f5',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: '0 0 8px',
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
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              color: isFull ? '#27ae60' : SCAN_CLR,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {isFull ? 'MASA OLUŞTURULDU' : 'EŞLEŞME TARANIYOR'}
          </motion.span>
        </div>
      </div>

      {/* Perşembe kapanış sayacı */}
      <ThursdayCountdown />

      {/* Radar alanı */}
      <div style={{ position: 'relative', width: RADAR_SZ, height: RADAR_SZ, margin: '0 auto' }}>
        <svg
          width={RADAR_SZ}
          height={RADAR_SZ}
          viewBox={`0 0 ${RADAR_SZ} ${RADAR_SZ}`}
          style={{ position: 'absolute', inset: 0 }}
        >
          {[30, 62, 93, ORBIT_R].map((r, i) => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={SCAN_CLR}
              strokeWidth={i === 3 ? 1 : 0.8}
              opacity={i === 3 ? 0.35 : 0.18} />
          ))}
          <line x1={CX} y1={CY - ORBIT_R - 8} x2={CX} y2={CY + ORBIT_R + 8} stroke={SCAN_CLR} strokeWidth={0.6} opacity={0.14} />
          <line x1={CX - ORBIT_R - 8} y1={CY} x2={CX + ORBIT_R + 8} y2={CY} stroke={SCAN_CLR} strokeWidth={0.6} opacity={0.14} />

          <circle cx={CX} cy={CY} r={5} fill={SCAN_CLR} opacity={0.85} />

          <defs>
            <radialGradient id="swpRG" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={SCAN_CLR} stopOpacity={0} />
              <stop offset="45%"  stopColor={SCAN_CLR} stopOpacity={0.05} />
              <stop offset="100%" stopColor={SCAN_CLR} stopOpacity={0.28} />
            </radialGradient>
          </defs>
          <RadarSweep running={!isFull} cx={CX} cy={CY} sweepPath={SWEEP_PATH} />
        </svg>

        <AnimatePresence>
          {ordered.map((p, i) => {
            const pos = positions[i];
            if (!pos) return null;
            return (
              <AvatarBubble
                key={p.id ?? `${p.initials}-${i}`}
                participant={p}
                cx={pos.x}
                cy={pos.y}
                delayMs={delays[i] ?? 0}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Katılımcı sayısı */}
      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <span style={{ fontSize: 14, color: '#666', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}>
          Katılımcı:{' '}
          <motion.span
            key={ordered.length}
            initial={{ scale: 1.4, color: '#ff6b6b' }}
            animate={{ scale: 1, color: SCAN_CLR }}
            transition={{ duration: 0.4 }}
            style={{ fontWeight: 700, display: 'inline-block' }}
          >
            {ordered.length}
          </motion.span>
          <span style={{ color: '#444', margin: '0 4px' }}>/</span>
          <span style={{ fontWeight: 700, color: SCAN_CLR }}>{maxP}</span>
        </span>
      </div>
    </div>
  );
}

// ── Ana bileşen (akıllı container) ──────────────────────────────────────────
export function MasalarDashboard({
  masa: propMasa,
  apiBase,
  token,
  pollIntervalMs = 30000,
  useDashboardApi = true,
}: Props) {
  const [dashData, setDashData]   = useState<DashboardResponse | null>(null);
  const [legacyMasa, setLegacyMasa] = useState<MasaData | null>(propMasa ?? null);
  const [loading, setLoading]     = useState(!propMasa && !!apiBase);

  const fetchDashboard = async () => {
    if (!apiBase) return;
    try {
      const endpoint = useDashboardApi ? '/meetings/dashboard' : '/meetings/my-current';
      const res = await fetch(`${apiBase}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (useDashboardApi) setDashData({ phase: 'SCANNING' });
        else setLegacyMasa(null);
        return;
      }
      const data = await res.json();
      if (useDashboardApi) setDashData(data as DashboardResponse);
      else setLegacyMasa(data as MasaData);
    } catch {
      if (useDashboardApi) setDashData({ phase: 'SCANNING' });
      else setLegacyMasa(null);
    }
  };

  useEffect(() => {
    if (propMasa || !apiBase) return;
    setLoading(true);
    fetchDashboard().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);

  useEffect(() => {
    if (!apiBase || propMasa) return;
    const id = setInterval(fetchDashboard, pollIntervalMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token, propMasa, pollIntervalMs]);

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: '28px 20px 20px',
    maxWidth: 380,
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

  // ── Dashboard API modu ────────────────────────────────────────────────────
  if (useDashboardApi && dashData) {
    const { phase, meeting } = dashData;

    if (phase === 'REVEALED' && meeting?.venueName) {
      const detayData: MasaDetayData = {
        id:             meeting.id,
        type:           meeting.type,
        maxParticipants: meeting.maxParticipants,
        scheduledAt:    meeting.scheduledAt,
        venueName:      meeting.venueName,
        venueAddress:   meeting.venueAddress,
        venueMapsUrl:   meeting.venueMapsUrl,
        venuePhotos:    meeting.venuePhotos,
        participants:   meeting.participants,
        aiReport:       meeting.aiReport,
      };
      return <MasaDetayKarti masa={detayData} />;
    }

    if (phase === 'WAITING' && meeting) {
      return (
        <div style={cardStyle}>
          <ConfirmedRadarView
            participants={meeting.participants ?? []}
            maxParticipants={meeting.maxParticipants}
            type={meeting.type}
            scheduledAt={meeting.scheduledAt}
            infoText="Masalar bölümünden detaylı bilgiye ulaşabilirsiniz."
          />
        </div>
      );
    }

    // SCANNING — radar göster
    const scanMasa: MasaData | null = meeting ? {
      id:             meeting.id,
      type:           meeting.type,
      scheduledAt:    meeting.scheduledAt,
      maxParticipants: meeting.maxParticipants,
      participants:   meeting.participants,
    } : null;

    return (
      <div style={cardStyle}>
        <ScanningView masa={scanMasa} />
      </div>
    );
  }

  // ── Eski /my-current modu (useDashboardApi=false) ─────────────────────────
  return (
    <div style={cardStyle}>
      <ScanningView masa={legacyMasa} />
    </div>
  );
}
