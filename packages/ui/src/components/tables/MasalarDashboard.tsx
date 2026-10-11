'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OceanRadar, OceanScores } from '../ocean/OceanRadar';

export interface Participant {
  id?: string;
  initials: string;
  gender: string | null;
  oceanScore?: OceanScores;
  avatarUrl?: string;
}

export interface MasaData {
  id: string;
  type?: 'GROUP' | 'ONE_ON_ONE';
  scheduledAt: string;
  maxParticipants?: number;
  locationName: string | null;
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

/* ── Renk sabitleri ─────────────────────────────────────────────────────── */
const MALE_COLOR   = '#4fc3f7';
const FEMALE_COLOR = '#f48fb1';
const OTHER_COLOR  = '#888888';

function genderColor(g: string | null): string {
  if (g === 'MALE')   return MALE_COLOR;
  if (g === 'FEMALE') return FEMALE_COLOR;
  return OTHER_COLOR;
}

/* ── Animasyonlu katılımcı avatarı ──────────────────────────────────────── */
const AVATAR_R   = 36; // daire yarıçapı (px)
const AVATAR_SZ  = (AVATAR_R + 6) * 2; // svg boyutu
const CIRCUMF    = 2 * Math.PI * AVATAR_R; // ≈ 226.2

interface AvatarProps {
  participant: Participant;
  index: number;
}

function ParticipantAvatar({ participant, index }: AvatarProps) {
  const color = genderColor(participant.gender);

  return (
    <motion.div
      key={participant.id ?? participant.initials}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: index * 0.12 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
    >
      <div style={{ position: 'relative' }}>
        {/* Pulse glow */}
        <motion.div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
        />

        <svg
          width={AVATAR_SZ}
          height={AVATAR_SZ}
          viewBox={`0 0 ${AVATAR_SZ} ${AVATAR_SZ}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Arka halka */}
          <circle
            cx={AVATAR_SZ / 2} cy={AVATAR_SZ / 2} r={AVATAR_R}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={2.5}
          />
          {/* Animasyonlu renkli halka */}
          <motion.circle
            cx={AVATAR_SZ / 2} cy={AVATAR_SZ / 2} r={AVATAR_R}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${CIRCUMF}` }}
            animate={{ strokeDasharray: `${CIRCUMF} 0` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.12 }}
            style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
          />
        </svg>

        {/* Baş harf etiketi */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: '#f0f0f0',
            letterSpacing: '0.05em',
          }}
        >
          {participant.initials}
        </div>
      </div>

      <span style={{ fontSize: 10, color: '#666', letterSpacing: '0.03em' }}>
        {participant.gender === 'MALE' ? 'E' : participant.gender === 'FEMALE' ? 'K' : '—'}
      </span>
    </motion.div>
  );
}

/* ── Boş slot ─────────────────────────────────────────────────────────────── */
function EmptySlot({ index }: { index: number }) {
  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.08 }}
    >
      <motion.div
        style={{
          width: AVATAR_SZ,
          height: AVATAR_SZ,
          borderRadius: '50%',
          border: '2px dashed rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        animate={{ opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 }}
      >
        <span style={{ fontSize: 10, color: '#555' }}>+</span>
      </motion.div>
      <span style={{ fontSize: 10, color: '#444' }}>bekleniyor</span>
    </motion.div>
  );
}

/* ── Katılımcı ızgarası ───────────────────────────────────────────────────── */
function ParticipantGrid({ participants, maxParticipants }: { participants: Participant[]; maxParticipants: number }) {
  const slots = Array.from({ length: maxParticipants });

  // M-F-M-F sıralama: erkekler önce, kadınlar ikinci, diğerleri sonra
  const males   = participants.filter((p) => p.gender === 'MALE');
  const females = participants.filter((p) => p.gender === 'FEMALE');
  const others  = participants.filter((p) => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const ordered: Participant[] = [];
  const maxLen = Math.max(males.length, females.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < males.length)   ordered.push(males[i]);
    if (i < females.length) ordered.push(females[i]);
  }
  ordered.push(...others);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
        padding: '16px 0',
      }}
    >
      {slots.map((_, i) => {
        const p = ordered[i];
        return p
          ? <ParticipantAvatar key={p.id ?? p.initials} participant={p} index={i} />
          : <EmptySlot key={`empty-${i}`} index={i} />;
      })}
    </div>
  );
}

/* ── Bekleme animasyonu ───────────────────────────────────────────────────── */
function AnimatedDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block', color: '#888', fontSize: 14 }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

function MatchingWait() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 32 }}>
      <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.18) 0%, transparent 65%)' }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div style={{ position: 'absolute', width: '100%', height: '100%' }}
          animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}>
          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <circle cx="100" cy="100" r="94" fill="none" stroke="#c0392b"
              strokeWidth="2" strokeDasharray="150 440" strokeLinecap="round"
              opacity="0.85" style={{ filter: 'drop-shadow(0 0 8px #c0392b)' }} />
          </svg>
        </motion.div>
        <motion.div style={{ position: 'absolute', width: '72%', height: '72%' }}
          animate={{ rotate: -360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <circle cx="100" cy="100" r="94" fill="none" stroke="#ff6b6b"
              strokeWidth="1.5" strokeDasharray="60 530" strokeLinecap="round"
              opacity="0.6" style={{ filter: 'drop-shadow(0 0 6px rgba(255,107,107,0.6))' }} />
          </svg>
        </motion.div>
        <motion.div style={{ position: 'absolute', width: '44%', height: '44%' }}
          animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}>
          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
            <circle cx="100" cy="100" r="94" fill="none" stroke="#ff6b6b"
              strokeWidth="1.5" strokeDasharray="28 562" strokeLinecap="round" opacity="0.45" />
          </svg>
        </motion.div>
        <motion.div
          style={{ position: 'absolute', width: 36, height: 36, borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.5) 0%, rgba(192,57,43,0.1) 70%)', border: '1px solid rgba(192,57,43,0.4)' }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', boxShadow: '0 0 12px rgba(192,57,43,0.7)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#888' }}>
          Senin için masa aranıyor<AnimatedDots />
        </p>
        <p style={{ fontSize: 12, marginTop: 8, color: '#555' }}>
          Algoritma her saat çalışır
        </p>
      </div>
    </div>
  );
}

/* ── Ana bileşen ─────────────────────────────────────────────────────────── */
export function MasalarDashboard({ masa: propMasa, apiBase, token, pollIntervalMs = 30000 }: Props) {
  const [masa, setMasa] = useState<MasaData | null>(propMasa ?? null);
  const [loading, setLoading] = useState(!propMasa && !!apiBase);
  const prevParticipantIds = useRef<Set<string>>(new Set());

  const fetchMasa = async () => {
    if (!apiBase) return;
    try {
      const res = await fetch(`${apiBase}/meetings/my-current`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setMasa(null); return; }
      const data: MasaData = await res.json();
      setMasa(data);
    } catch {
      setMasa(null);
    }
  };

  useEffect(() => {
    if (propMasa || !apiBase) return;
    setLoading(true);
    fetchMasa().finally(() => setLoading(false));
  }, [apiBase, token, propMasa]);

  // Polling
  useEffect(() => {
    if (!apiBase || propMasa) return;
    const id = setInterval(fetchMasa, pollIntervalMs);
    return () => clearInterval(id);
  }, [apiBase, token, propMasa, pollIntervalMs]);

  // Yeni katılımcı geldiğinde id setini güncelle
  useEffect(() => {
    if (!masa) return;
    masa.participants.forEach((p) => { if (p.id) prevParticipantIds.current.add(p.id); });
  }, [masa]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ height: 256, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!masa) return <MatchingWait />;

  const maxParticipants = masa.maxParticipants ?? (masa.type === 'ONE_ON_ONE' ? 2 : 6);
  const participantCount = masa.participants.length;
  const dateStr = new Date(masa.scheduledAt).toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
  const displayName = masa.locationName ?? masa.locationText ?? 'Mekan belirleniyor';

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20,
    overflow: 'hidden',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Katılımcı kartı */}
      <div style={{ ...card, padding: '24px 20px' }}>
        {/* Sayım başlığı */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#888' }}>
            {masa.type === 'ONE_ON_ONE' ? 'Başbaşa buluşma' : 'Grup masası'}
          </span>
          <motion.span
            key={participantCount}
            initial={{ scale: 1.3, color: '#c0392b' }}
            animate={{ scale: 1, color: '#aaa' }}
            transition={{ duration: 0.4 }}
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            {participantCount}/{maxParticipants} kişi
          </motion.span>
        </div>

        {/* Renk göstergesi */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: MALE_COLOR }} />
            Erkek
          </span>
          <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: FEMALE_COLOR }} />
            Kadın
          </span>
        </div>

        {/* Avatar ızgarası */}
        <AnimatePresence>
          <ParticipantGrid participants={masa.participants} maxParticipants={maxParticipants} />
        </AnimatePresence>
      </div>

      {/* Mekan kartı */}
      <div style={card}>
        {masa.venuePhotoUrl ? (
          <div style={{ height: 160, overflow: 'hidden' }}>
            <img src={masa.venuePhotoUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{ height: 120, background: 'linear-gradient(135deg, #c0392b 0%, #b5651d 60%, #0a0a0a 100%)', display: 'flex', alignItems: 'flex-end', padding: '0 20px 16px' }}>
            <span style={{ fontFamily: 'var(--font-serif, serif)', fontSize: 22, color: 'rgba(255,255,255,0.8)' }}>{displayName}</span>
          </div>
        )}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {masa.venuePhotoUrl && (
            <h3 style={{ fontFamily: 'var(--font-serif, serif)', fontSize: 18, color: '#f0f0f0', margin: 0 }}>{displayName}</h3>
          )}
          {masa.locationAddress && <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{masa.locationAddress}</p>}
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{dateStr}</p>
          {masa.locationMapsUrl && (
            <motion.a
              href={masa.locationMapsUrl}
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(192,57,43,0.4)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                marginTop: 4,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: 'linear-gradient(135deg, #c0392b, #b5651d)',
                textDecoration: 'none',
                alignSelf: 'flex-start',
              }}
            >
              Rotayı Al →
            </motion.a>
          )}
        </div>
      </div>

      {/* OCEAN karşılaştırma (grupsa göster) */}
      {masa.type !== 'ONE_ON_ONE' && masa.participants.some((p) => p.oceanScore) && (
        <div style={card}>
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 12, color: '#555', margin: '0 0 12px' }}>Kişilik uyumu</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {masa.participants.filter((p) => p.oceanScore).map((p, i) => (
                <div key={p.id ?? i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <OceanRadar scores={p.oceanScore!} size={100} />
                  <span style={{ fontSize: 10, color: '#555' }}>{p.initials}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
