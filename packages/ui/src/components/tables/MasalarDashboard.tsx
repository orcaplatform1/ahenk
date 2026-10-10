'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
  scheduledAt: string;
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
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2 } },
};

const itemVariants = {
  hidden: { y: 30, opacity: 0, filter: 'blur(8px)' },
  visible: {
    y: 0, opacity: 1, filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 120, damping: 18 },
  },
};

const FALLBACK_SCORES: OceanScores = { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 };

export function MasalarDashboard({ masa: propMasa, apiBase, token }: Props) {
  const [masa, setMasa] = useState<MasaData | null>(propMasa ?? null);
  const [loading, setLoading] = useState(!propMasa && !!apiBase);

  useEffect(() => {
    if (propMasa || !apiBase) return;

    setLoading(true);
    fetch(`${apiBase}/api/v1/meetings/my-current`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: MasaData | null) => setMasa(data))
      .catch(() => setMasa(null))
      .finally(() => setLoading(false));
  }, [apiBase, token, propMasa]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="h-64 rounded-2xl bg-surface border border-border animate-pulse" />
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!masa) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="text-muted text-sm">Bu hafta aktif masanız yok.</p>
        <p className="text-muted/60 text-xs">Eşleştirme algoritması her Perşembe 23:59'da çalışır.</p>
      </div>
    );
  }

  const dateStr = new Date(masa.scheduledAt).toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  const displayName = masa.locationName ?? masa.locationText ?? 'Mekan belirleniyor';

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 gap-5">

      {/* Sol — Mekan kartı */}
      <motion.div variants={itemVariants}
        className="rounded-2xl overflow-hidden border border-border bg-surface flex flex-col">
        {masa.venuePhotoUrl ? (
          <div className="h-44 overflow-hidden">
            <img src={masa.venuePhotoUrl} alt={displayName} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-44 flex items-end p-5"
            style={{ background: 'linear-gradient(135deg, #c0392b 0%, #b5651d 60%, #0a0a0a 100%)' }}>
            <span className="font-serif text-2xl text-white/80">{displayName}</span>
          </div>
        )}
        <div className="p-5 flex flex-col gap-3 flex-1">
          <div>
            <h3 className="font-serif text-xl text-text">{displayName}</h3>
            {masa.locationAddress && <p className="text-sm text-muted mt-0.5">{masa.locationAddress}</p>}
          </div>
          <p className="text-sm text-muted">{dateStr}</p>
          {masa.locationMapsUrl && (
            <motion.a
              href={masa.locationMapsUrl}
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(192,57,43,0.45)' }}
              whileTap={{ scale: 0.97 }}
              className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #c0392b, #b5651d)' }}
            >
              Rotayı Al →
            </motion.a>
          )}
        </div>
      </motion.div>

      {/* Sağ — Katılımcı kartları */}
      <div className="flex flex-col gap-4">
        {masa.participants.slice(0, 3).map((p, idx) => (
          <motion.div key={p.id ?? idx} variants={itemVariants}
            className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
            {/* Dönen halka avatar */}
            <div className="relative flex-shrink-0">
              <svg width={52} height={52} viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="23" fill="none" stroke="#1f1f1f" strokeWidth="3" />
                <motion.circle cx="26" cy="26" r="23" fill="none"
                  stroke="url(#ringGrad)" strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="144.5"
                  strokeDashoffset="36"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                  style={{ transformOrigin: '26px 26px' }}
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#c0392b" />
                    <stop offset="100%" stopColor="#b5651d" />
                  </linearGradient>
                </defs>
                <text x="26" y="26" textAnchor="middle" dominantBaseline="central"
                  fontSize="11" fontFamily="Inter, sans-serif" fill="#f5f5f5" fontWeight="600">
                  {p.initials}
                </text>
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text">{p.initials}</p>
              <p className="text-xs text-muted">{p.gender === 'MALE' ? 'Erkek' : p.gender === 'FEMALE' ? 'Kadın' : '—'}</p>
            </div>

            {p.oceanScore && (
              <OceanRadar scores={p.oceanScore ?? FALLBACK_SCORES} size={120} />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
