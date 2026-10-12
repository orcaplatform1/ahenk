'use client';

import { useEffect, useState } from 'react';
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

export interface AiReport {
  content: string;
  uyumSkoru: number;
  generatedAt: string;
}

export interface MasaDetayData {
  id: string;
  type?: 'GROUP' | 'ONE_ON_ONE';
  maxParticipants?: number;
  scheduledAt: string;
  venueName: string;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
  venuePhotos?: VenuePhoto[];
  participants: DetayParticipant[];
  aiReport?: AiReport | null;
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

// ── E-K-E-K sıralama (boşluksuz — masa kuruldu, tüm katılımcılar mevcut) ────
function buildOrdered(participants: DetayParticipant[]): DetayParticipant[] {
  const males   = participants.filter(p => p.gender === 'MALE');
  const females = participants.filter(p => p.gender === 'FEMALE');
  const others  = participants.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const ordered: DetayParticipant[] = [];
  const len = Math.max(males.length, females.length);
  for (let i = 0; i < len; i++) {
    if (i < males.length)   ordered.push(males[i]);
    if (i < females.length) ordered.push(females[i]);
  }
  return [...ordered, ...others];
}

// ── Saat formatı ─────────────────────────────────────────────────────────────
function formatMeetingTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const trMs   = d.getTime() + 3 * 3600 * 1000;
    const trDate = new Date(trMs);
    const h = trDate.getUTCHours().toString().padStart(2, '0');
    const m = trDate.getUTCMinutes().toString().padStart(2, '0');
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return `${days[trDate.getUTCDay()]} · ${h}:${m}`;
  } catch { return ''; }
}

// ── Google Maps URL ───────────────────────────────────────────────────────────
function mapsUrl(url?: string | null, address?: string | null): string | null {
  if (url) return url;
  if (address) return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  return null;
}

// ── Avatar (48×48px) ─────────────────────────────────────────────────────────
const AV_D = 48;
const AV_R = AV_D / 2;
const AV_BR = AV_R - 2.5;
const CIRCUMF = 2 * Math.PI * AV_BR;

function DetayAvatar({ participant, delay }: { participant: DetayParticipant; delay: number }) {
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
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none" stroke={color} strokeWidth={2.5}
          strokeLinecap="round" strokeDasharray={CIRCUMF}
          style={{ rotate: '-90deg', transformOrigin: `${AV_R}px ${AV_R}px` }}
          initial={{ strokeDashoffset: CIRCUMF }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ delay: delay + 0.5, duration: 0.8, ease: 'easeOut' }}
        />
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none" stroke={color} strokeWidth={2.5}
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ delay: delay + 1.35, duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#f0f0f0',
        letterSpacing: '0.02em', fontFamily: 'Inter, sans-serif',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {label}
      </div>
    </motion.div>
  );
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ photos, startIdx, onClose }: { photos: VenuePhoto[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowRight')  setIdx(i => Math.min(i + 1, photos.length - 1));
      if (e.key === 'ArrowLeft')   setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [photos.length, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <motion.img
        key={idx} src={photos[idx].url} alt={photos[idx].caption ?? ''}
        initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }}
      />
      {photos[idx].caption && (
        <p style={{ color: '#aaa', fontSize: 13, marginTop: 12, fontFamily: 'Inter, sans-serif' }}>{photos[idx].caption}</p>
      )}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }} onClick={e => e.stopPropagation()}>
          {photos.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, transition: 'background 0.2s',
                background: i === idx ? '#f5f5f5' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
      )}
      <button onClick={onClose}
        style={{ position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#f5f5f5', borderRadius: '50%', width: 36, height: 36,
          cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ×
      </button>
    </motion.div>
  );
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────
export function MasaDetayKarti({ masa }: { masa: MasaDetayData }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const isOneOnOne = masa.type === 'ONE_ON_ONE';
  const photos     = masa.venuePhotos ?? [];
  const meetTime   = formatMeetingTime(masa.scheduledAt);
  const mapLink    = mapsUrl(masa.venueMapsUrl, masa.venueAddress);
  const ordered    = buildOrdered(masa.participants);

  return (
    <>
      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox photos={photos} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {/* Açılış shimmer */}
        <motion.div
          initial={{ opacity: 0.6, x: '-100%' }}
          animate={{ opacity: 0, x: '200%' }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
            background: 'linear-gradient(105deg, transparent 30%, rgba(39,174,96,0.15) 50%, transparent 70%)',
          }}
        />

        {/* ── MASA DETAYI etiketi ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}
        >
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            MASA DETAYI
          </span>
        </motion.div>

        {/* ── Mekan adı ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ marginBottom: masa.venueAddress ? 4 : 16 }}
        >
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-serif, "DM Serif Display", Georgia, serif)',
            fontSize: 26, fontWeight: 400, color: '#f5f5f5',
            letterSpacing: '0.01em', lineHeight: 1.2,
          }}>
            {masa.venueName}
          </h2>
        </motion.div>

        {/* ── Adres ── */}
        {masa.venueAddress && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{ margin: '0 0 16px', fontSize: 13, color: '#666', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}
          >
            {masa.venueAddress}
          </motion.p>
        )}

        {/* ── Fotoğraflar (3 eşit sütun) ── */}
        {photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            style={{ marginBottom: 18 }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: photos.length === 1 ? '1fr' : '1fr 1fr 1fr',
              gap: 6,
            }}>
              {photos.slice(0, 3).map((photo, i) => (
                <div
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  style={{
                    cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
                    aspectRatio: '4/3', background: 'rgba(255,255,255,0.04)', position: 'relative',
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? `Fotoğraf ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s, filter 0.3s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Divider ── */}
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.45, ease: 'easeOut' }}
          style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 16px', transformOrigin: 'left' }}
        />

        {/* ── Buluşma zamanı ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#888', fontFamily: 'Inter, sans-serif' }}>Buluşma</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em' }}>
            {meetTime}
          </span>
        </motion.div>

        {/* ── Katılımcılar ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.4 }}
          style={{ marginBottom: 20 }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            {isOneOnOne ? 'BAŞ BAŞA' : 'KATILIMCILAR'}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ordered.map((p, i) => (
              <DetayAvatar key={`${p.initials}-${i}`} participant={p} delay={0.52 + i * 0.1} />
            ))}
          </div>
        </motion.div>

        {/* ── Yapay Zeka Masa Raporu ── */}
        {masa.aiReport && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            style={{
              background: 'rgba(8, 18, 44, 0.75)',
              border: '1px solid rgba(100,130,200,0.18)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 14,
            }}
          >
            {/* Başlık */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'rgba(100,130,200,0.14)', border: '1px solid rgba(100,130,200,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>✦</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif', color: 'rgba(180,200,255,0.75)',
              }}>
                YAPAY ZEKA MASA RAPORU
              </span>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(100,130,200,0.12)', marginBottom: 12 }} />

            {/* Uyum skoru */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                  UYUM SKORU
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', fontFamily: 'Inter, sans-serif' }}>
                  %{masa.aiReport.uyumSkoru}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ delay: 0.85, duration: 0.9, ease: 'easeOut' }}
                  style={{
                    height: '100%', width: `${masa.aiReport.uyumSkoru}%`,
                    background: 'linear-gradient(90deg, #4fc3f7 0%, #f48fb1 100%)',
                    borderRadius: 99, transformOrigin: 'left',
                  }}
                />
              </div>
            </div>

            {/* İçerik */}
            <p style={{
              margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)',
              fontFamily: 'Inter, sans-serif', lineHeight: 1.65,
            }}>
              {masa.aiReport.content}
            </p>
          </motion.div>
        )}

        {/* ── Rezervasyon notu ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: masa.aiReport ? 0.72 : 0.62, duration: 0.4 }}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '12px 14px',
            marginBottom: mapLink ? 16 : 0,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
            Rezervasyonunuz tamamlandı. Girişte görevliye isminizi söylediğinizde masanıza yönlendirileceksiniz. İyi eğlenceler.
          </p>
        </motion.div>

        {/* ── Haritada Gör ── */}
        {mapLink && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: masa.aiReport ? 0.8 : 0.7, duration: 0.4 }}
            style={{ marginTop: 16 }}
          >
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '13px 0',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 9999,
                color: '#f5f5f5', textDecoration: 'none',
                fontSize: 12, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = 'rgba(255,255,255,0.28)';
                el.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = 'rgba(255,255,255,0.12)';
                el.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 14 }}>📍</span>
              HARİTADA GÖR
            </a>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
