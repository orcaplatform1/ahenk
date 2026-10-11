'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Tipler ──────────────────────────────────────────────────────────────────
export interface DetayParticipant {
  initials: string;
  gender: 'MALE' | 'FEMALE' | string | null;
}

export interface VenuePhoto {
  url: string;
  caption?: string;
}

export interface MasaDetayData {
  id: string;
  type?: 'GROUP' | 'ONE_ON_ONE';
  maxParticipants?: number;
  scheduledAt: string;            // ISO string
  venueName: string;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
  venuePhotos?: VenuePhoto[];
  participants: DetayParticipant[];
}

interface Props {
  masa: MasaDetayData;
}

// ── Renkler ─────────────────────────────────────────────────────────────────
const MALE_CLR   = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';
const OTHER_CLR  = '#888';
const GREEN      = '#27ae60';

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

// ── Saat formatı ─────────────────────────────────────────────────────────────
function formatMeetingTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    // TR saatine çevir
    const trMs  = d.getTime() + 3 * 3600 * 1000;
    const trDate = new Date(trMs);
    const h = trDate.getUTCHours().toString().padStart(2, '0');
    const m = trDate.getUTCMinutes().toString().padStart(2, '0');
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const day  = days[trDate.getUTCDay()];
    return `${day}, ${h}:${m}`;
  } catch { return ''; }
}

// ── Avatar (34×34px) ─────────────────────────────────────────────────────────
const AV_D = 34;
const AV_R = AV_D / 2;
const AV_BR = AV_R - 2;
const CIRCUMF = 2 * Math.PI * AV_BR;

interface AvatarProps {
  participant: DetayParticipant;
  delay: number;
}

function DetayAvatar({ participant, delay }: AvatarProps) {
  const color = gColor(participant.gender);
  const bg    = gBg(participant.gender);

  const label = (() => {
    const raw = (participant.initials ?? '').trim();
    if (!raw) return '?.';
    if (/^[A-ZÇĞİÖŞÜa-zçğışöşü]\.[A-ZÇĞİÖŞÜa-zçğışöşü]\.?$/.test(raw)) return raw.toUpperCase();
    if (raw.length === 2 && !raw.includes('.')) return `${raw[0].toUpperCase()}.${raw[1].toUpperCase()}.`;
    return raw.toUpperCase();
  })();

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ position: 'relative', width: AV_D, height: AV_D, flexShrink: 0 }}
    >
      <svg width={AV_D} height={AV_D} viewBox={`0 0 ${AV_D} ${AV_D}`} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={AV_R} cy={AV_R} r={AV_R - 1} fill={bg} />

        {/* Stroke çizme */}
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none" stroke={color} strokeWidth={2}
          strokeLinecap="round" strokeDasharray={CIRCUMF}
          style={{ rotate: '-90deg', transformOrigin: `${AV_R}px ${AV_R}px` }}
          initial={{ strokeDashoffset: CIRCUMF }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ delay: delay + 0.55, duration: 0.8, ease: 'easeOut' }}
        />

        {/* Pulse */}
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none" stroke={color} strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ delay: delay + 1.4, duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color: '#f0f0f0',
        letterSpacing: '0.02em', fontFamily: 'Inter, sans-serif',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {label}
      </div>
    </motion.div>
  );
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
interface LightboxProps {
  photos: VenuePhoto[];
  startIdx: number;
  onClose: () => void;
}

function Lightbox({ photos, startIdx, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(startIdx);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowRight')  setIdx(i => Math.min(i + 1, photos.length - 1));
      if (e.key === 'ArrowLeft')   setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [photos.length, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.img
        key={idx}
        src={photos[idx].url}
        alt={photos[idx].caption ?? ''}
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '75vh',
          objectFit: 'contain', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      />
      {photos[idx].caption && (
        <p style={{ color: '#aaa', fontSize: 13, marginTop: 12, fontFamily: 'Inter, sans-serif' }}>
          {photos[idx].caption}
        </p>
      )}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }} onClick={e => e.stopPropagation()}>
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: i === idx ? '#f5f5f5' : 'rgba(255,255,255,0.25)',
                padding: 0, transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      )}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#f5f5f5', borderRadius: '50%', width: 36, height: 36,
          cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ×
      </button>
    </motion.div>
  );
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────
export function MasaDetayKarti({ masa }: Props) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const shimmerRef = useRef(false);

  const isOneOnOne = masa.type === 'ONE_ON_ONE';
  const photos     = masa.venuePhotos ?? [];
  const meetTime   = formatMeetingTime(masa.scheduledAt);

  // M-F-M-F sıralama
  const males   = masa.participants.filter(p => p.gender === 'MALE');
  const females = masa.participants.filter(p => p.gender === 'FEMALE');
  const others  = masa.participants.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const ordered: DetayParticipant[] = [];
  const mfLen = Math.max(males.length, females.length);
  for (let i = 0; i < mfLen; i++) {
    if (i < males.length)   ordered.push(males[i]);
    if (i < females.length) ordered.push(females[i]);
  }
  ordered.push(...others);

  return (
    <>
      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox
            photos={photos}
            startIdx={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
          />
        )}
      </AnimatePresence>

      {/* Kart */}
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          position: 'relative',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
          borderRadius: 16,
          padding: '24px 20px 20px',
          maxWidth: 380,
          margin: '0 auto',
          overflow: 'hidden',
        }}
      >
        {/* Açılış shimmer */}
        <motion.div
          initial={{ opacity: 0.7, x: '-100%' }}
          animate={{ opacity: 0, x: '200%' }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(105deg, transparent 30%, rgba(39,174,96,0.18) 50%, transparent 70%)',
            pointerEvents: 'none', zIndex: 10,
          }}
        />

        {/* Üst etiket */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: 16 }}
        >
          <p style={{
            margin: 0, fontSize: 9,
            color: GREEN, letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600, marginBottom: 6,
          }}>
            MASA DETAYI
          </p>
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-serif, "DM Serif Display", Georgia, serif)',
            fontSize: 20, fontWeight: 400,
            color: '#f5f5f5', letterSpacing: '0.04em',
          }}>
            {masa.venueName}
          </h2>
          {masa.venueAddress && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              style={{
                margin: '6px 0 0',
                fontSize: 12, color: '#666',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.01em',
              }}
            >
              {masa.venueAddress}
            </motion.p>
          )}
        </motion.div>

        {/* Fotoğraflar */}
        {photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{ marginBottom: 18 }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: photos.length === 1 ? '1fr' : photos.length === 2 ? '1fr 1fr' : '2fr 1fr',
              gap: 6, borderRadius: 10, overflow: 'hidden',
            }}>
              {photos.map((photo, i) => (
                <div
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: i === 0 ? '8px 0 0 8px' : i === photos.length - 1 ? '0 8px 8px 0' : 0,
                    overflow: 'hidden',
                    aspectRatio: i === 0 ? '4/3' : '1/1',
                    background: 'rgba(255,255,255,0.04)',
                    position: 'relative',
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? `Fotoğraf ${i + 1}`}
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'cover', display: 'block',
                      transition: 'transform 0.3s, filter 0.3s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)';
                      (e.currentTarget as HTMLImageElement).style.filter = 'brightness(1.1)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)';
                      (e.currentTarget as HTMLImageElement).style.filter = 'brightness(1)';
                    }}
                  />
                  {/* Caption overlay */}
                  {photo.caption && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '12px 8px 6px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                      fontSize: 10, color: 'rgba(255,255,255,0.8)',
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {photo.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.45, duration: 0.5, ease: 'easeOut' }}
          style={{
            height: 1, background: 'rgba(255,255,255,0.07)',
            margin: '0 0 16px', transformOrigin: 'left',
          }}
        />

        {/* Buluşma zamanı */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}
        >
          <span style={{ fontSize: 15 }}>🕗</span>
          <div>
            <p style={{ margin: 0, fontSize: 9, color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
              BULUŞMA
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: '#f0f0f0', fontFamily: 'Inter, sans-serif' }}>
              {meetTime}
            </p>
          </div>
        </motion.div>

        {/* Katılımcılar */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          style={{ marginBottom: 16 }}
        >
          <p style={{
            margin: '0 0 10px', fontSize: 9,
            color: '#444', letterSpacing: '0.12em',
            textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
          }}>
            {isOneOnOne ? 'BAŞ BAŞA' : 'KATILIMCILAR'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ordered.map((p, i) => (
              <DetayAvatar
                key={`${p.initials}-${i}`}
                participant={p}
                delay={0.65 + i * 0.12}
              />
            ))}
          </div>
        </motion.div>

        {/* Rezervasyon notu */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          style={{
            background: 'rgba(39,174,96,0.06)',
            border: '1px solid rgba(39,174,96,0.2)',
            borderRadius: 10, padding: '10px 14px',
            marginBottom: 16,
          }}
        >
          <p style={{
            margin: 0, fontSize: 11.5,
            color: 'rgba(255,255,255,0.55)',
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.5,
          }}>
            <span style={{ color: GREEN, fontWeight: 600 }}>Rezervasyon yapıldı.</span>{' '}
            Masanız sizin için ayrılmıştır. Lütfen belirlenen saatte mekanda olun.
          </p>
        </motion.div>

        {/* Haritada Gör butonu */}
        {masa.venueMapsUrl && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.4 }}
          >
            <a
              href={masa.venueMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '12px 0',
                background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)',
                borderRadius: 9999,
                color: '#fff', textDecoration: 'none',
                fontSize: 12, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif',
                transition: 'filter 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1.1)'}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              HARİTADA GÖR
            </a>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
