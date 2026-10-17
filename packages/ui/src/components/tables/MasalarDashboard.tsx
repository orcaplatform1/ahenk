'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MasaDetayKarti, type MasaDetayData } from './MasaDetayKarti';

// ── Sabitler ───────────────────────────────────────────────────────────────
const RADAR_SZ   = 340;
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
function gColor(g?: string | null) {
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
function nextDeadline(type: 'GROUP' | 'ONE_ON_ONE'): Date {
  const targetDay = type === 'GROUP' ? 4 : 5;
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

function DeadlineCountdown({ type }: { type: 'GROUP' | 'ONE_ON_ONE' }) {
  const [msLeft, setMsLeft] = useState(() => nextDeadline(type).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => setMsLeft(nextDeadline(type).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [type]);

  const { text, urgency } = formatCountdown(Math.max(0, msLeft));
  const isUrgent   = urgency === 'red' || urgency === 'critical';
  const isCritical = urgency === 'critical';

  const fontSize = isCritical ? 20 : urgency === 'red' ? 17 : 13;
  const color =
    isCritical ? '#e74c3c' :
    urgency === 'red' ? '#c0392b' :
    urgency === 'orange' ? '#e67e22' :
    urgency === 'day' ? '#bbb' : '#aaa';
  const filter =
    isCritical ? 'drop-shadow(0 0 10px rgba(231,76,60,0.7))' :
    urgency === 'red' ? 'drop-shadow(0 0 6px rgba(192,57,43,0.5))' : 'none';

  return (
    <div style={{ textAlign: 'center', marginBottom: 14 }}>
      {isUrgent && (
        <style>{`@keyframes cdPulse{0%,100%{opacity:.7}50%{opacity:1}}.cd-pulse{animation:cdPulse ${isCritical ? 0.8 : 1.1}s ease-in-out infinite}`}</style>
      )}
      <p style={{ margin: 0, fontSize: 9, color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>
        KAPANIŞA KALAN
      </p>
      <span
        className={isUrgent ? 'cd-pulse' : undefined}
        style={{ display: 'inline-block', fontFamily: '"SF Mono","Fira Code",monospace,Inter', fontSize, fontWeight: 700, letterSpacing: '0.06em', color, filter, transition: 'color 0.5s, font-size 0.3s' }}
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

interface DashboardItem {
  phase: 'WAITING' | 'REVEALED';
  meeting: {
    id: string;
    type?: 'GROUP' | 'ONE_ON_ONE';
    maxParticipants?: number;
    scheduledAt: string;
    participants: Participant[];
    sat10UTC?: string;
    venueName?: string;
    venueAddress?: string;
    venueMapsUrl?: string;
    venuePhotos?: Array<{ url: string; caption?: string }>;
    aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
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
function useRadarScale() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.offsetWidth / RADAR_SZ));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { wrapRef, scale };
}

// ── Radar sweep ──────────────────────────────────────────────────────────────
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
function ScanningView({ type = 'GROUP', participants, selfParticipant }: {
  type?: 'GROUP' | 'ONE_ON_ONE';
  participants?: Participant[];
  selfParticipant?: Participant;
}) {
  const seenIds = useRef<Set<string>>(new Set());
  const { wrapRef: radarWrapRef, scale: radarScale } = useRadarScale();

  const maxP = type === 'ONE_ON_ONE' ? 2 : 6;
  const title = type === 'ONE_ON_ONE' ? 'BAŞ BAŞA MASA' : 'GRUP MASASI';

  const rawParts = participants ?? [];
  const allParts: Participant[] = (() => {
    if (!selfParticipant) return rawParts;
    const alreadyIn = rawParts.some(p => p.initials === selfParticipant.initials);
    return alreadyIn ? rawParts : [selfParticipant, ...rawParts];
  })();

  const slots = buildScanningSlots(allParts, maxP);
  const filledCount = slots.filter(Boolean).length;
  const isFull    = filledCount >= maxP;
  const positions = orbitPts(maxP);

  const slotDelays: number[] = slots.map((p, i) => {
    if (!p) return 0;
    const key = p.id ?? `${p.initials}-${i}`;
    if (seenIds.current.has(key)) return 0;
    seenIds.current.add(key);
    return FIRST_DELAY + i * STAGGER;
  });

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

      <DeadlineCountdown type={type} />

      <div ref={radarWrapRef} style={{ width: '100%' }}>
        <div style={{
          position: 'relative', width: RADAR_SZ, height: RADAR_SZ, margin: '0 auto',
          transform: `scale(${radarScale})`, transformOrigin: 'top center',
          marginBottom: radarScale < 1 ? -(RADAR_SZ * (1 - radarScale)) : 0,
        }}>
          <svg width={RADAR_SZ} height={RADAR_SZ} viewBox={`0 0 ${RADAR_SZ} ${RADAR_SZ}`} style={{ position: 'absolute', inset: 0 }}>
            {[30, 62, 93, ORBIT_R].map((r, i) => (
              <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={SCAN_CLR}
                strokeWidth={i === 3 ? 1 : 0.8} opacity={i === 3 ? 0.35 : 0.18} />
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
            {slots.map((p, i) => {
              if (!p) return null;
              const pos = positions[i];
              if (!pos) return null;
              return (
                <AvatarBubble
                  key={p.id ?? `${p.initials}-${i}`}
                  participant={p} cx={pos.x} cy={pos.y} delayMs={slotDelays[i] ?? 0}
                />
              );
            })}
          </AnimatePresence>
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
  type?: 'GROUP' | 'ONE_ON_ONE';
  scheduledAt: string;
  infoText: string;
}

export function ConfirmedRadarView({ participants, maxParticipants, type, scheduledAt, infoText }: ConfirmedRadarProps) {
  const isOneOnOne = type === 'ONE_ON_ONE';
  const title      = isOneOnOne ? 'BAŞ BAŞA MASA' : 'GRUP MASASI';
  const maxP       = maxParticipants ?? (isOneOnOne ? 2 : 6);
  const { wrapRef: radarWrapRef, scale: radarScale } = useRadarScale();

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

      <div ref={radarWrapRef} style={{ width: '100%' }}>
        <div style={{
          position: 'relative', width: RADAR_SZ, height: RADAR_SZ, margin: '0 auto',
          transform: `scale(${radarScale})`, transformOrigin: 'top center',
          marginBottom: radarScale < 1 ? -(RADAR_SZ * (1 - radarScale)) : 0,
        }}>
          <svg width={RADAR_SZ} height={RADAR_SZ} viewBox={`0 0 ${RADAR_SZ} ${RADAR_SZ}`} style={{ position: 'absolute', inset: 0 }}>
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

// ── Kilitli ekran (yanlış/eksik paket) ────────────────────────────────────────
const LOCK_CLR      = '#e8850c';
const LOCK_ICON_CLR = '#7bc67e';

function LockedView({ type = 'GROUP' }: { type?: 'GROUP' | 'ONE_ON_ONE'; neededPlan?: 'MASADA' | 'KARSIMDA' | null }) {
  const isGroup = type === 'GROUP';
  const { wrapRef: radarWrapRef, scale: radarScale } = useRadarScale();

  const line1 = isGroup
    ? 'Eşleşme taraması aktif.'
    : 'Eşleşme taraması daha derin ve hassas çalışıyor.';
  const line2 = isGroup
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
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px',
        }}>
          {isGroup ? 'GRUP MASASI' : 'BAŞ BAŞA MASA'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: LOCK_CLR, animation: 'lockDot 1.2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: LOCK_CLR, fontFamily: 'Inter, sans-serif' }}>
            TARAMA DEVAM EDİYOR
          </span>
        </div>
      </div>

      {/* Kırmızı radar + kilit ikonu */}
      <div ref={radarWrapRef} style={{ width: '100%' }}>
        <div style={{
          position: 'relative', width: RADAR_SZ, height: RADAR_SZ, margin: '0 auto',
          transform: `scale(${radarScale})`, transformOrigin: 'top center',
          marginBottom: radarScale < 1 ? -(RADAR_SZ * (1 - radarScale)) : 0,
        }}>
          <svg width={RADAR_SZ} height={RADAR_SZ} viewBox={`0 0 ${RADAR_SZ} ${RADAR_SZ}`} style={{ position: 'absolute', inset: 0 }}>
            {[30, 62, 93, ORBIT_R].map((r, i) => (
              <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={SCAN_CLR}
                strokeWidth={i === 3 ? 1 : 0.8} opacity={i === 3 ? 0.3 : 0.14} />
            ))}
            <line x1={CX} y1={CY - ORBIT_R - 8} x2={CX} y2={CY + ORBIT_R + 8} stroke={SCAN_CLR} strokeWidth={0.6} opacity={0.12} />
            <line x1={CX - ORBIT_R - 8} y1={CY} x2={CX + ORBIT_R + 8} y2={CY} stroke={SCAN_CLR} strokeWidth={0.6} opacity={0.12} />
            <defs>
              <radialGradient id="lockSwpRG" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor={SCAN_CLR} stopOpacity={0} />
                <stop offset="45%"  stopColor={SCAN_CLR} stopOpacity={0.05} />
                <stop offset="100%" stopColor={SCAN_CLR} stopOpacity={0.22} />
              </radialGradient>
            </defs>
            <g style={{ animation: `lockSweep ${SCAN_DUR}s linear infinite`, transformOrigin: `${CX}px ${CY}px` }}>
              <path d={SWEEP_PATH} fill="url(#lockSwpRG)" />
              <line x1={CX} y1={CY} x2={CX} y2={CY - ORBIT_R} stroke={SCAN_CLR} strokeWidth={1.5} opacity={0.85} />
              <circle cx={CX} cy={CY - ORBIT_R} r={3.5} fill={SCAN_CLR} />
            </g>
            {/* Kilit ikonu — merkez, titreyen, PNG */}
            <image
              href="/lock-icon.png"
              x={CX - 28} y={CY - 28} width={56} height={56}
              style={{ animation: 'lockShake 0.8s ease-in-out infinite' }}
            />
          </svg>
        </div>
      </div>

      {/* Alt yazı + buton */}
      <div style={{ textAlign: 'center', marginTop: 20, padding: '0 8px' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888', lineHeight: 1.65, margin: '0 0 4px' }}>
          {line1}
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#555', lineHeight: 1.65, margin: '0 0 22px' }}>
          {line2}
        </p>
        <a
          href="/profil?tab=paket"
          style={{
            display: 'inline-block',
            padding: '13px 36px',
            background: 'linear-gradient(135deg, #c0392b, #e74c3c)',
            borderRadius: 9999,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.04em',
            textDecoration: 'none',
            boxShadow: '0 0 28px rgba(192,57,43,0.45), 0 4px 16px rgba(0,0,0,0.4)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Paket Seç
        </a>
      </div>
    </div>
  );
}

// ── Tek kart içeriği ──────────────────────────────────────────────────────────
function MasaKarti({
  type, item, selfParticipant,
}: {
  type: 'GROUP' | 'ONE_ON_ONE';
  item?: DashboardItem;
  selfParticipant?: Participant;
}) {
  if (!item) {
    return <ScanningView type={type} participants={[]} selfParticipant={selfParticipant} />;
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
      <ConfirmedRadarView
        participants={item.meeting.participants}
        maxParticipants={item.meeting.maxParticipants}
        type={item.meeting.type}
        scheduledAt={item.meeting.scheduledAt}
        infoText="Masalar bölümünden detaylı bilgiye ulaşabilirsiniz."
      />
    );
  }

  return <ScanningView type={type} participants={item.meeting.participants} selfParticipant={selfParticipant} />;
}

// ── Premium Toggle ─────────────────────────────────────────────────────────────
function PremiumToggle({
  activeTab,
  onSwitch,
  shineKey,
}: {
  activeTab: 'GROUP' | 'ONE_ON_ONE';
  onSwitch: (tab: 'GROUP' | 'ONE_ON_ONE') => void;
  shineKey: number;
}) {
  const tabs = [
    { key: 'GROUP' as const,      label: 'Grup Masası' },
    { key: 'ONE_ON_ONE' as const, label: 'Baş Başa' },
  ];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
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
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 100,
        padding: 4,
        gap: 2,
        boxShadow: '0 0 40px rgba(192,57,43,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        {tabs.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => onSwitch(key)}
              style={{
                position: 'relative',
                padding: '11px 26px',
                borderRadius: 100,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : '#444',
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
                    background: 'linear-gradient(135deg, #c0392b 0%, #e8472e 50%, #ff6b6b 100%)',
                    boxShadow: '0 0 28px rgba(192,57,43,0.65), 0 0 60px rgba(192,57,43,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
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
export function MasalarDashboard({
  apiBase,
  token,
  pollIntervalMs = 15000,
  selfParticipant,
  activePlan,
}: Props) {
  const [dashData, setDashData]   = useState<DashboardResponse | null>(null);
  const [loading, setLoading]     = useState(!!apiBase);
  const [activeTab, setActiveTab] = useState<'GROUP' | 'ONE_ON_ONE'>('GROUP');
  const [tabDir, setTabDir]       = useState(1);
  const [shineKey, setShineKey]   = useState(0);

  const fetchDashboard = async () => {
    if (!apiBase) return;
    try {
      const res = await fetch(`${apiBase}/meetings/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setDashData({ items: [] }); return; }
      const data = await res.json();
      setDashData(data as DashboardResponse);
    } catch {
      setDashData({ items: [] });
    }
  };

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

  function handleTabSwitch(tab: 'GROUP' | 'ONE_ON_ONE') {
    if (tab === activeTab) return;
    setTabDir(tab === 'ONE_ON_ONE' ? 1 : -1);
    setShineKey(k => k + 1);
    setActiveTab(tab);
  }

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

  const items        = dashData?.items ?? [];
  const groupItem    = items.find(i => i.meeting.type === 'GROUP');
  const oneOnOneItem = items.find(i => i.meeting.type === 'ONE_ON_ONE');

  // Aktif tab'ın içeriğini belirle
  function getTabContent(tab: 'GROUP' | 'ONE_ON_ONE') {
    // Abonelik yok → her iki tab da kilitli
    if (!activePlan) return <LockedView type={tab} neededPlan={null} />;

    if (activePlan === 'ICERDE') {
      const item = tab === 'GROUP' ? groupItem : oneOnOneItem;
      return <MasaKarti type={tab} item={item} selfParticipant={selfParticipant} />;
    }

    if (activePlan === 'MASADA') {
      if (tab === 'GROUP') return <MasaKarti type="GROUP" item={groupItem} selfParticipant={selfParticipant} />;
      return <LockedView type="ONE_ON_ONE" neededPlan="KARSIMDA" />;
    }

    if (activePlan === 'KARSIMDA') {
      if (tab === 'ONE_ON_ONE') return <MasaKarti type="ONE_ON_ONE" item={oneOnOneItem} selfParticipant={selfParticipant} />;
      return <LockedView type="GROUP" neededPlan="MASADA" />;
    }

    return <LockedView type={tab} neededPlan={null} />;
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <div style={cardStyle}>
        <PremiumToggle activeTab={activeTab} onSwitch={handleTabSwitch} shineKey={shineKey} />
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
            {getTabContent(activeTab)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
