'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { gColor } from './MasaRadar';

function gBg(g?: string | null) {
  if (g === 'FEMALE') return 'rgba(244,143,177,0.12)';
  return 'rgba(79,195,247,0.12)';
}

// ── Avatar ─────────────────────────────────────────────────────────────────
// size: çap (varsayılan 48). ring: isteğe bağlı çerçeve / zemin rengi (yalnız canlı destek mekân sahibi avatarı: altın); verilmezse cinsiyet rengi
export function DetayAvatar({ participant, delay, size = 48, ring }: { participant: { initials?: string | null; gender?: string | null; photoUrl?: string | null }; delay: number; size?: number; ring?: { color: string; bg: string } }) {
  const AV_D = size;
  const AV_R = AV_D / 2;
  const AV_BR = AV_R - 2.5;
  const CIRCUMF = 2 * Math.PI * AV_BR;
  const t = useTranslations();
  const color = ring?.color ?? gColor(participant.gender);
  const bg    = ring?.bg ?? gBg(participant.gender);

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
      style={{ position: 'relative', width: AV_D, height: AV_D, flexShrink: 0, borderRadius: '50%' }}
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
      {participant.photoUrl && (
        // Onaylı profil fotoğrafı: kısaltma yerine, cinsiyet renkli çerçevenin içinde
        <img src={participant.photoUrl} alt={t('photo.alt')} style={{ position: 'absolute', inset: 4, width: AV_D - 8, height: AV_D - 8, borderRadius: '50%', objectFit: 'cover', pointerEvents: 'none' }} />
      )}
      {!participant.photoUrl && <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: label.length > 4 ? 10 : 11, fontWeight: 700, color: '#f0f0f0',
        letterSpacing: '0.02em', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {label}
      </div>}
    </motion.div>
  );
}
