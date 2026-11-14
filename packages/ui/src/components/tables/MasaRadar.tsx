'use client';

// Masa radarı ve masa yardımcıları (Masalarım "Masa Kuruldu" radarı, baş harf, cinsiyet rengi, masa kilidi).
// MasalarDashboard bileşeni kullanılmadığı için silindi; ortak parçalar bu dosyada kaldı.
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AhenkSonar } from '../sonar/AhenkSonar';

const RADAR_SZ   = 340;

const CX         = RADAR_SZ / 2;

const CY         = RADAR_SZ / 2;

const ORBIT_R    = 142;

const AV_D       = 52;

const AV_R       = AV_D / 2;

const AV_BR      = AV_R - 3;

const CIRCUMF    = 2 * Math.PI * AV_BR;

const MALE_CLR   = '#4fc3f7';

const FEMALE_CLR = '#f48fb1';

function orbitPts(n: number, r = ORBIT_R): Array<{ x: number; y: number }> {
  const step = (2 * Math.PI) / n;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + i * step;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  });
}

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

// Masa türü başlığı

function tableTitleOf(type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'): string {
  return type === 'ONE_ON_ONE' ? 'BAŞ BAŞA MASA' : type === 'KANKA' ? 'KANKAMLA MASASI' : 'GRUP MASASI';
}

export function isTableLocked(scheduledAt: string): boolean {
  const tr = new Date(new Date(scheduledAt).getTime() + 3 * 60 * 60 * 1000);
  return Date.now() >= Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - 1, 23 - 3, 59, 0, 0);
}

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
  cancelled?: boolean; // İptal etti ama iptal son anına kadar listede dönüyor (Katılım alanında görünür)
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
    sosEndsAt: string; // Acil yardımın bittiği an (backend tek kaynak)
    venueName?: string;
    venueAddress?: string;
    venueMapsUrl?: string;
    venuePhotos?: Array<{ url: string; caption?: string }>;
    aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
    cancelRightUsed?: boolean;
  };
}

interface BubbleProps {
  participant: Participant;
  cx: number;
  cy: number;
  delayMs: number;
}

function AvatarBubble({ participant, cx, cy, delayMs }: BubbleProps) {
  // Konum değişince (masa tamamlanınca merkeze yaklaşma) yumuşak geçiş
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
      style={{ position: 'absolute', width: AV_D, height: AV_D }}
      initial={{ scale: 0.4, opacity: 0, left: cx - AV_R, top: cy - AV_R }}
      animate={{ scale: 1, opacity: 1, left: cx - AV_R, top: cy - AV_R }}
      transition={{
        scale: { delay: ds, duration: 0.7, ease: [0.34, 1.56, 0.64, 1] },
        opacity: { delay: ds, duration: 0.7 },
        left: { duration: 1.6, ease: 'easeInOut' },
        top: { duration: 1.6, ease: 'easeInOut' },
      }}
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
        fontSize: label.length > 4 ? 10 : 11, fontWeight: 700, color: '#f0f0f0', letterSpacing: '0.03em',
        fontFamily: 'Inter, sans-serif', userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden',
      }}>
        {label}
      </div>
    </motion.div>
  );
}

// ── Responsive radar scale hook ──────────────────────────────────────────────

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

function revealAt(scheduledAt: string): number {
  const tr = new Date(new Date(scheduledAt).getTime() + 3 * 60 * 60 * 1000);
  return Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate(), 10 - 3, 0, 0, 0);
}

function RevealCountdown({ scheduledAt }: { scheduledAt: string }) {
  const target = revealAt(scheduledAt);
  const [msLeft, setMsLeft] = useState(() => Math.max(0, target - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setMsLeft(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const total = Math.floor(msLeft / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const units = [
    { val: pad(Math.floor(total / 86400)), lbl: 'GÜN' },
    { val: pad(Math.floor((total % 86400) / 3600)), lbl: 'SA' },
    { val: pad(Math.floor((total % 3600) / 60)), lbl: 'DK' },
    { val: pad(total % 60), lbl: 'SN' },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, margin: '6px 0 10px' }}>
      {units.map(u => (
        <div key={u.lbl} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 30 }}>
          <span style={{ fontFamily: '"SF Mono","Fira Code",monospace', fontSize: 18, fontWeight: 700, color: '#f5f5f5', lineHeight: 1 }}>{u.val}</span>
          <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', marginTop: 3 }}>{u.lbl}</span>
        </div>
      ))}
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

  // İptal eden sandalye tutmaz: boş sandalye geri gelir
  const seated  = participants.filter(p => !p.cancelled);
  const males   = seated.filter(p => p.gender === 'MALE');
  const females = seated.filter(p => p.gender === 'FEMALE');
  const others  = seated.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const ordered: Participant[] = [];
  const mfLen = Math.max(males.length, females.length);
  for (let i = 0; i < mfLen; i++) {
    if (i < males.length)   ordered.push(males[i]);
    if (i < females.length) ordered.push(females[i]);
  }
  ordered.push(...others);

  const locked = isTableLocked(scheduledAt);
  const full   = ordered.length >= maxP;
  // Dolu ya da kilitli masada tarama durur: profiller merkeze yaklaşıp sabitlenir, halkalar yavaş nabız atar
  const settled = full || locked;
  const positions = orbitPts(maxP, settled ? ORBIT_R * 0.62 : ORBIT_R);
  const emptySeats = settled ? [] : orbitPts(maxP).slice(ordered.length);
  const statusText = locked ? 'Masa Kuruldu' : 'Masa Oluşturuluyor';

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
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: '#27ae60', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
            {statusText}
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
            <AhenkSonar width="100%" ariaLabel={statusText} sweep={!settled} ringPulse={settled} />
          </div>
          {emptySeats.map((pos, i) => (
            <div
              key={`empty-${ordered.length + i}`}
              aria-hidden
              style={{
                position: 'absolute', left: pos.x - AV_R, top: pos.y - AV_R, width: AV_D, height: AV_D,
                borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.03)',
              }}
            />
          ))}
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
          {locked ? 'Masanız kuruldu. Mekan bilgileri masa detayında gözükecektir.' : full ? 'Masanız tamamlandı.' : 'Masanız Oluşturuluyor!'}
        </p>
        {locked && <RevealCountdown scheduledAt={scheduledAt} />}
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888', fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em' }}>
          Masa buluşma tarihi: {formatMasaDate(scheduledAt)}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#555', fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}>
          {infoText}
        </p>
      </div>
    </div>
  );
}
