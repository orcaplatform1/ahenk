'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { OceanRadar, OceanScores } from '../ocean/OceanRadar';

export interface HistoryEntry {
  id: string;
  date: string;
  locationName: string;
  locationPhotoUrl?: string;
  compatScore: number;
  oceanScore?: OceanScores;
}

interface ApiHistoryItem {
  id: string;
  weekNumber: number | null;
  date: string;
  venueName: string | null;
  venuePhotoUrl: string | null;
  city: string | null;
  overallCompatibility: number | null;
}

interface Props {
  entries?: HistoryEntry[];
  apiBase?: string;
  token?: string;
}

const FALLBACK: OceanScores = { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 };

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    setTilt({ rotateX: -y * 8, rotateY: x * 8 });
  }

  function handleLeave() { setTilt({ rotateX: 0, rotateY: 0 }); }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      animate={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{ transformStyle: 'preserve-3d', perspective: 800 }}
    >
      {children}
    </motion.div>
  );
}

function RingBadge({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={52} height={52} viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#1f1f1f" strokeWidth="4" />
        <motion.circle cx="26" cy="26" r={r} fill="none"
          stroke="url(#scoreGrad)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          style={{ transformOrigin: '26px 26px', transform: 'rotate(-90deg)' }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c0392b" />
            <stop offset="100%" stopColor="#b5651d" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-xs font-bold text-text">{score}</span>
    </div>
  );
}

export function AhenkHistory({ entries, apiBase, token }: Props) {
  const [data, setData] = useState<HistoryEntry[]>(entries ?? []);
  const [loading, setLoading] = useState(!entries && !!apiBase);

  useEffect(() => {
    if (!apiBase || entries) return;

    setLoading(true);
    fetch(`${apiBase}/api/v1/meetings/my-history`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((items: ApiHistoryItem[]) => {
        setData(
          items.map((item) => ({
            id: item.id,
            date: item.date,
            locationName: item.venueName ?? (item.city ? `${item.city} Buluşması` : 'Bilinmeyen Mekan'),
            locationPhotoUrl: item.venuePhotoUrl ?? undefined,
            compatScore: item.overallCompatibility ?? 0,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase, token, entries]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="text-muted text-sm">Henüz geçmiş masa yok.</p>;
  }

  return (
    <div className="relative flex flex-col gap-0">
      {/* Dikey timeline çizgisi */}
      <div className="absolute left-5 top-5 bottom-5 w-px bg-border" />

      {data.map((entry, i) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.12, type: 'spring', stiffness: 200, damping: 22 }}
          className="relative pl-14 pb-8 last:pb-0"
        >
          {/* Timeline dot */}
          <div className="absolute left-3.5 top-6 w-3 h-3 rounded-full border-2 border-primary bg-bg" />

          <TiltCard>
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[120px_1fr_auto] gap-0">
                {/* Sol — mekan görseli */}
                {entry.locationPhotoUrl ? (
                  <img src={entry.locationPhotoUrl} alt={entry.locationName}
                    className="w-full h-full object-cover" style={{ minHeight: 120 }} />
                ) : (
                  <div className="flex items-end p-3" style={{ minHeight: 120, background: 'linear-gradient(135deg, #c0392b 0%, #b5651d 80%, #0a0a0a 100%)' }}>
                    <span className="font-serif text-xs text-white/70 leading-tight">{entry.locationName}</span>
                  </div>
                )}

                {/* Orta — detay + radar */}
                <div className="p-4 flex flex-col gap-2">
                  <p className="font-medium text-sm text-text">{entry.locationName}</p>
                  <p className="text-xs text-muted">{new Date(entry.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <div className="mt-1">
                    <OceanRadar scores={entry.oceanScore ?? FALLBACK} size={140} />
                  </div>
                </div>

                {/* Sağ — uyum skoru + rozet */}
                <div className="p-4 flex flex-col items-center justify-center gap-2 border-l border-border">
                  <RingBadge score={entry.compatScore} />
                  <p className="text-xs text-muted text-center">Uyum</p>
                </div>
              </div>
            </div>
          </TiltCard>
        </motion.div>
      ))}
    </div>
  );
}
