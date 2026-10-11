'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  /** Cumartesi 10:00 UTC zamanı (ISO string veya Date) */
  sat10UTC: string | Date;
  maxParticipants?: number;
  participantCount?: number;
}

// ── Saat formatı ─────────────────────────────────────────────────────────────
function formatSatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}sa ${pad(m)}dk ${pad(s)}sn`;
  if (m > 0) return `${pad(m)}dk ${pad(s)}sn`;
  return `${pad(s)}sn`;
}

// ── Onay tiki SVG ─────────────────────────────────────────────────────────────
function CheckCircle() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      {/* Dış halka */}
      <motion.circle
        cx="32" cy="32" r="28"
        stroke="#27ae60" strokeWidth="2"
        fill="rgba(39,174,96,0.08)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* Tik işareti */}
      <motion.path
        d="M 20 32 L 28 40 L 44 24"
        stroke="#27ae60" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.7 }}
      />
      {/* Pulse halka */}
      <motion.circle
        cx="32" cy="32" r="28"
        stroke="#27ae60" strokeWidth="1.5" fill="none"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: [0, 0.4, 0], scale: [0.9, 1.25, 1.4] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5, ease: 'easeOut' }}
        style={{ transformOrigin: '32px 32px' }}
      />
    </svg>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export function MasaBeklemeKarti({ sat10UTC, maxParticipants = 6, participantCount }: Props) {
  const target = typeof sat10UTC === 'string' ? new Date(sat10UTC) : sat10UTC;
  const [msLeft, setMsLeft] = useState(() => Math.max(0, target.getTime() - Date.now()));

  useEffect(() => {
    if (msLeft <= 0) return;
    const id = setInterval(() => {
      const rem = Math.max(0, target.getTime() - Date.now());
      setMsLeft(rem);
    }, 1000);
    return () => clearInterval(id);
  }, [target, msLeft]);

  const countText = formatSatCountdown(msLeft);
  const isNear    = msLeft <= 30 * 60 * 1000; // 30 dakika

  return (
    <motion.div
      initial={{ scale: 0.93, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
        borderRadius: 16,
        padding: '32px 24px 28px',
        maxWidth: 380,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {/* Üst etiket */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        style={{
          margin: '0 0 20px', fontSize: 9,
          color: '#27ae60', letterSpacing: '0.18em',
          textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
        }}
      >
        MASA OLUŞTURULDU
      </motion.p>

      {/* Tik animasyonu */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}
      >
        <CheckCircle />
      </motion.div>

      {/* Başlık */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-serif, "DM Serif Display", Georgia, serif)',
          fontSize: 20, fontWeight: 400,
          color: '#f5f5f5', letterSpacing: '0.04em',
        }}
      >
        Masanız hazır
      </motion.h2>

      {/* Açıklama */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        style={{
          margin: '0 0 24px',
          fontSize: 13, color: '#666',
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1.55, letterSpacing: '0.01em',
        }}
      >
        Mekan bilgileri Cumartesi sabah 10:00'da açıklanacak.
      </motion.p>

      {/* Divider */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
        style={{
          height: 1, background: 'rgba(255,255,255,0.07)',
          margin: '0 0 20px', transformOrigin: 'left',
        }}
      />

      {/* Geri sayım */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <p style={{
          margin: '0 0 6px', fontSize: 9,
          color: '#444', letterSpacing: '0.15em',
          textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
        }}>
          AÇIKLANMAYA KALAN
        </p>

        {isNear && <style>{`
          @keyframes beklPulse { 0%,100%{opacity:.75} 50%{opacity:1} }
          .bekl-count { animation: beklPulse 1s ease-in-out infinite; }
        `}</style>}

        <motion.span
          key={countText}
          className={isNear ? 'bekl-count' : undefined}
          style={{
            display: 'inline-block',
            fontFamily: '"SF Mono", "Fira Code", monospace, Inter',
            fontSize: isNear ? 20 : 17,
            fontWeight: 700,
            color: isNear ? '#e67e22' : '#c0392b',
            letterSpacing: '0.06em',
            filter: isNear ? 'drop-shadow(0 0 8px rgba(230,126,34,0.5))' : 'none',
            transition: 'font-size 0.3s, color 0.5s',
          }}
        >
          {countText}
        </motion.span>
      </motion.div>

      {/* Katılımcı bilgisi */}
      {participantCount != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          style={{ marginTop: 20 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 9999, padding: '5px 14px',
          }}>
            <motion.span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#27ae60', display: 'inline-block',
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span style={{
              fontSize: 11, color: '#888',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.04em',
            }}>
              {participantCount}/{maxParticipants} kişi hazır
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
