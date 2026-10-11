'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Sabitler ───────────────────────────────────────────────────────────────
const RADAR_SZ   = 320;
const CX         = RADAR_SZ / 2;   // 160
const CY         = RADAR_SZ / 2;   // 160
const ORBIT_R    = 118;             // avatarların oturduğu yarıçap
const AV_D       = 52;             // avatar çapı (px)
const AV_R       = AV_D / 2;       // 26
const AV_BR      = AV_R - 3;       // border circle yarıçapı
const CIRCUMF    = 2 * Math.PI * AV_BR; // ≈ 144.5

const SCAN_CLR   = '#c0392b';
const MALE_CLR   = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';
const OTHER_CLR  = '#888888';

const SCAN_DUR     = 1.8;    // saniye/tur
const FIRST_DELAY  = 1800;   // ms — 1 tam tur sonra ilk avatar
const STAGGER      = 1100;   // ms — avatarlar arası

// ── Orbit konumları (üstten başlayan, eşit açılı) ─────────────────────────
function orbitPts(n: number): Array<{ x: number; y: number }> {
  const step = (2 * Math.PI) / n;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + i * step; // -90° = 12 saat
    return { x: CX + ORBIT_R * Math.cos(a), y: CY + ORBIT_R * Math.sin(a) };
  });
}

// ── Sweep path (70° kuyruk, kol yukarı bakıyor) ────────────────────────────
// Kol: (CX, CY) → (CX, CY - ORBIT_R) yani 12 saat
// Kuyruk: -90° - 70° = -160° → -90° yönünde
function buildSweepPath(): string {
  const startRad = (-160 * Math.PI) / 180;
  const sx = CX + ORBIT_R * Math.cos(startRad); // ≈ 48.8
  const sy = CY + ORBIT_R * Math.sin(startRad); // ≈ 119.6
  // Saat yönünde ark: (sx,sy) → (CX, CY-ORBIT_R) — büyük ark değil, CW
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

interface Props {
  masa?: MasaData;
  apiBase?: string;
  token?: string;
  pollIntervalMs?: number;
}

// ── Avatar bileşeni ────────────────────────────────────────────────────────
interface BubbleProps {
  participant: Participant;
  cx: number;
  cy: number;
  delayMs: number;
}

function AvatarBubble({ participant, cx, cy, delayMs }: BubbleProps) {
  const color  = gColor(participant.gender);
  const bg     = gBg(participant.gender);
  const ds     = delayMs / 1000;
  const isFem  = participant.gender === 'FEMALE';

  // Pulse parametreleri
  const pulseMin = isFem ? 0.4  : 0.45;
  const pulseMax = isFem ? 0.95 : 1.0;
  const pulseDur = isFem ? 2.8  : 2.4;
  const shadow   = isFem
    ? 'drop-shadow(0 0 5px rgba(244,143,177,0.45))'
    : 'drop-shadow(0 0 5px rgba(79,195,247,0.5))';

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
      {/* SVG: arka plan dolgusu + border animasyonu */}
      <svg
        width={AV_D}
        height={AV_D}
        viewBox={`0 0 ${AV_D} ${AV_D}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* İç dolgu */}
        <circle cx={AV_R} cy={AV_R} r={AV_R - 1} fill={bg} />

        {/* Border çizme animasyonu (stroke-dashoffset 144.5→0) */}
        <motion.circle
          cx={AV_R}
          cy={AV_R}
          r={AV_BR}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={CIRCUMF}
          style={{
            rotate: '-90deg',
            transformOrigin: `${AV_R}px ${AV_R}px`,
          }}
          initial={{ strokeDashoffset: CIRCUMF, opacity: 1 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ delay: ds + 0.65, duration: 0.9, ease: 'easeOut' }}
        />

        {/* Pulse: border tamamlandıktan sonra başlar */}
        <motion.circle
          cx={AV_R}
          cy={AV_R}
          r={AV_BR}
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

      {/* Baş harfler */}
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
          letterSpacing: '0.04em',
          fontFamily: 'Inter, sans-serif',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {participant.initials}
      </div>
    </motion.div>
  );
}

// ── Ana bileşen ─────────────────────────────────────────────────────────────
export function MasalarDashboard({
  masa: propMasa,
  apiBase,
  token,
  pollIntervalMs = 30000,
}: Props) {
  const [masa, setMasa] = useState<MasaData | null>(propMasa ?? null);
  const [loading, setLoading] = useState(!propMasa && !!apiBase);
  const seenIds = useRef<Set<string>>(new Set());

  // API çekimi
  const fetchMasa = async () => {
    if (!apiBase) return;
    try {
      const res = await fetch(`${apiBase}/meetings/my-current`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setMasa(null); return; }
      setMasa(await res.json());
    } catch {
      setMasa(null);
    }
  };

  useEffect(() => {
    if (propMasa || !apiBase) return;
    setLoading(true);
    fetchMasa().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token]);

  useEffect(() => {
    if (!apiBase || propMasa) return;
    const id = setInterval(fetchMasa, pollIntervalMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, token, propMasa, pollIntervalMs]);

  // Yüklenme
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: '50%',
            border: `2px solid ${SCAN_CLR}`, borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Hesaplamalar ─────────────────────────────────────────────────────────
  const maxP        = masa?.maxParticipants ?? (masa?.type === 'ONE_ON_ONE' ? 2 : 6);
  const rawParts    = masa?.participants ?? [];
  const isOneOnOne  = masa?.type === 'ONE_ON_ONE';
  const title       = isOneOnOne ? 'BAŞ BAŞA MASA' : 'GRUP MASASI';

  // M-F-M-F sıralama
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

  // Tam dolu mu?
  const isFull = ordered.length >= maxP;

  // Her katılımcı için reveal gecikmesi
  // İlk render'da: 1.8s sonra başlar, 1.1s arayla
  // Polling ile gelen yeni katılımcı: hemen
  const delays: number[] = ordered.map((p, i) => {
    const key = p.id ?? p.initials;
    if (seenIds.current.has(key)) return 0; // zaten görüldü
    seenIds.current.add(key);
    return FIRST_DELAY + i * STAGGER;
  });

  // Konum dizisi (maxP kadar, kullanılacak)
  const positions = orbitPts(maxP);

  // ── Render ──────────────────────────────────────────────────────────────
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

  return (
    <div style={cardStyle}>
      {/* Başlık */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2
          style={{
            fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
            fontSize: 22,
            fontWeight: 400,
            color: '#f5f5f5',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          {title}
        </h2>

        {/* Durum satırı */}
        <motion.div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}
        >
          {/* Yanıp sönen nokta */}
          <motion.span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isFull ? '#27ae60' : SCAN_CLR,
            }}
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
        </motion.div>
      </div>

      {/* Radar alanı */}
      <div
        style={{
          position: 'relative',
          width: RADAR_SZ,
          height: RADAR_SZ,
          margin: '0 auto',
        }}
      >
        {/* ── Radar SVG: ızgara + dönen tarama kolu ── */}
        <svg
          width={RADAR_SZ}
          height={RADAR_SZ}
          viewBox={`0 0 ${RADAR_SZ} ${RADAR_SZ}`}
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Çok sönük ızgara */}
          {[30, 62, 93, ORBIT_R].map(r => (
            <circle
              key={r} cx={CX} cy={CY} r={r}
              fill="none" stroke={SCAN_CLR} strokeWidth={0.6} opacity={0.05}
            />
          ))}
          {/* Çapraz çizgiler */}
          <line x1={CX} y1={CY - ORBIT_R - 8} x2={CX} y2={CY + ORBIT_R + 8}
            stroke={SCAN_CLR} strokeWidth={0.5} opacity={0.04} />
          <line x1={CX - ORBIT_R - 8} y1={CY} x2={CX + ORBIT_R + 8} y2={CY}
            stroke={SCAN_CLR} strokeWidth={0.5} opacity={0.04} />

          {/* Merkez nokta */}
          <circle cx={CX} cy={CY} r={5} fill={SCAN_CLR} opacity={0.85} />

          {/* Dönen tarama grubu */}
          <motion.g
            style={{ transformOrigin: `${CX}px ${CY}px` }}
            animate={isFull
              ? { opacity: 0 }
              : { rotate: 360 }}
            transition={isFull
              ? { duration: 0.6, ease: 'easeOut' }
              : { rotate: { duration: SCAN_DUR, repeat: Infinity, ease: 'linear', repeatDelay: 0 } }}
            initial={{ opacity: 1, rotate: 0 }}
          >
            {/* Sweep sweep (70° koni dolgusu) */}
            <defs>
              <radialGradient id="swpRG" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor={SCAN_CLR} stopOpacity={0} />
                <stop offset="45%"  stopColor={SCAN_CLR} stopOpacity={0.05} />
                <stop offset="100%" stopColor={SCAN_CLR} stopOpacity={0.28} />
              </radialGradient>
            </defs>
            <path d={SWEEP_PATH} fill="url(#swpRG)" />

            {/* Kol çizgisi */}
            <line
              x1={CX} y1={CY}
              x2={CX} y2={CY - ORBIT_R}
              stroke={SCAN_CLR} strokeWidth={1.5} opacity={0.9}
            />
            {/* Uç nokta */}
            <circle cx={CX} cy={CY - ORBIT_R} r={3.5} fill={SCAN_CLR} />
          </motion.g>
        </svg>

        {/* ── Avatar baloncukları (absolute) ── */}
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
        <span
          style={{
            fontSize: 14,
            color: '#666',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.02em',
          }}
        >
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
