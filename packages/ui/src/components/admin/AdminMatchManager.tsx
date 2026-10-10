'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OceanRadar, OceanScores } from '../ocean/OceanRadar';

// ─── Tipler ──────────────────────────────────────────────────────────────────

type SeatType = 'REAL' | 'BOT' | 'EMPTY';

interface Seat {
  type: SeatType;
  userId?: string;
  initials?: string;
  gender?: string | null;
  matchScore?: number | null;
  oceanScore?: OceanScores | null;
}

export interface MatchTable {
  id: string;
  scheduledAt: string;
  locationName: string | null;
  avgCompatibilityScore: number | null;
  seats: Seat[];
}

export interface AvailableBot {
  id: string;
  initials: string;
  oceanScore: OceanScores;
}

interface Props {
  apiBase?: string;
  token?: string;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, token: string | undefined, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Hata oluştu' }));
    throw new Error((err as { message?: string }).message ?? 'Hata oluştu');
  }
  return res.json() as Promise<T>;
}

// ─── Koltuk bileşeni ─────────────────────────────────────────────────────────

function SeatBadge({
  seat,
  onClick,
  isTarget,
}: {
  seat: Seat;
  onClick?: () => void;
  isTarget?: boolean;
}) {
  const baseRing = 'absolute inset-0 rounded-xl border-2';

  if (seat.type === 'EMPTY') {
    return (
      <motion.button
        onClick={onClick}
        whileHover={onClick ? { scale: 1.04 } : undefined}
        className={`relative flex flex-col items-center justify-center gap-1 rounded-xl p-3 cursor-${onClick ? 'pointer' : 'default'} ${
          isTarget ? 'bg-amber-900/30' : 'bg-transparent'
        }`}
        style={{ minHeight: 72 }}
      >
        <div className={`${baseRing} border-dashed border-amber-500/60 animate-pulse`} />
        <span className="text-amber-500/70 text-xs">BOŞ</span>
      </motion.button>
    );
  }

  const isBotSeat = seat.type === 'BOT';
  const ringColor = isBotSeat ? '#3b82f6' : '#c0392b';
  const bgColor = isBotSeat ? 'rgba(59,130,246,0.08)' : 'rgba(192,57,43,0.08)';

  return (
    <motion.div
      className="relative flex flex-col items-center justify-center gap-1 rounded-xl p-3"
      style={{ minHeight: 72, background: bgColor }}
    >
      <div className={`${baseRing}`} style={{ borderColor: ringColor + '60' }} />
      {/* Avatar halka */}
      <svg width={36} height={36} viewBox="0 0 36 36" className="flex-shrink-0">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#1f1f1f" strokeWidth="2" />
        <motion.circle
          cx="18" cy="18" r="15" fill="none"
          stroke={ringColor} strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="94.2"
          strokeDashoffset="24"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
          style={{ transformOrigin: '18px 18px' }}
        />
        <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
          fontSize="8" fontFamily="Inter, sans-serif" fill="#f5f5f5" fontWeight="600">
          {seat.initials ?? '??'}
        </text>
      </svg>
      <span className="text-xs" style={{ color: isBotSeat ? '#93c5fd' : '#f5f5f5' }}>
        {seat.gender === 'MALE' ? 'E' : seat.gender === 'FEMALE' ? 'K' : '—'}
      </span>
      {isBotSeat && (
        <span className="text-[9px] px-1 rounded bg-blue-900/40 text-blue-400 border border-blue-800">BOT</span>
      )}
    </motion.div>
  );
}

// ─── Uyum badge ──────────────────────────────────────────────────────────────

function CompatBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted">—</span>;
  const isGood = score >= 80;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
        isGood
          ? 'bg-green-900/30 text-green-400 border-green-800'
          : 'bg-amber-900/30 text-amber-400 border-amber-800'
      }`}
    >
      {score}% uyum
    </span>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export function AdminMatchManager({ apiBase = '', token }: Props) {
  const [tables, setTables] = useState<MatchTable[]>([]);
  const [bots, setBots] = useState<AvailableBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpty, setSelectedEmpty] = useState<{ tableId: string; seatIdx: number } | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [placingBot, setPlacingBot] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(() => {
    if (!apiBase) return;
    Promise.all([
      apiFetch<MatchTable[]>(`${apiBase}/api/v1/admin/matches/pending`, token),
      apiFetch<AvailableBot[]>(`${apiBase}/api/v1/matching/admin/bots`, token),
    ])
      .then(([t, b]) => {
        setTables(t);
        // Sadece aktif botları havuza koy
        setBots(
          b
            .filter((bot) => bot.oceanScore)
            .map((bot) => ({
              id: bot.id,
              initials: bot.initials,
              oceanScore: bot.oceanScore,
            })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase, token]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(tableId: string) {
    setApproving(tableId);
    try {
      await apiFetch(`${apiBase}/api/v1/admin/matches/${tableId}/approve`, token, { method: 'PATCH' });
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      showToast('Masa onaylandı');
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setApproving(null);
    }
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    try {
      await Promise.all(
        tables.map((t) =>
          apiFetch(`${apiBase}/api/v1/admin/matches/${t.id}/approve`, token, { method: 'PATCH' }),
        ),
      );
      setTables([]);
      showToast(`${tables.length} masa onaylandı`);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setApprovingAll(false);
    }
  }

  async function handlePlaceBot(bot: AvailableBot) {
    if (!selectedEmpty) return;
    setPlacingBot(bot.id);
    try {
      await apiFetch(`${apiBase}/api/v1/admin/matches/${selectedEmpty.tableId}/bot`, token, {
        method: 'POST',
        body: JSON.stringify({ botUserId: bot.id }),
      });
      // Listeyi yenile
      load();
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      setSelectedEmpty(null);
      showToast('Bot yerleştirildi');
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setPlacingBot(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl bg-surface border border-border text-sm text-text shadow-xl"
            style={{ backdropFilter: 'blur(12px)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-muted text-sm">Onay bekleyen masa yok.</p>
          <p className="text-muted/60 text-xs">Algoritma her Perşembe 23:59'da çalışır.</p>
        </div>
      ) : (
        <div className="flex gap-6 items-start">
          {/* ── Sol kolon: masa listesi ── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Tümünü onayla */}
            <motion.button
              onClick={handleApproveAll}
              disabled={approvingAll}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #c0392b, #b5651d)' }}
            >
              {approvingAll ? 'Onaylanıyor…' : `TÜM MASALARI ONAYLA (${tables.length})`}
            </motion.button>

            {tables.map((table, ti) => (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ti * 0.07, type: 'spring', stiffness: 180, damping: 22 }}
                className="rounded-2xl border border-border p-5 flex flex-col gap-4"
                style={{ background: 'rgba(20,20,20,0.6)', backdropFilter: 'blur(12px)' }}
              >
                {/* Başlık satırı */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-text truncate">
                      {table.locationName ??
                        new Date(table.scheduledAt).toLocaleDateString('tr-TR', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                    </span>
                    <span className="text-xs text-muted flex-shrink-0">
                      {new Date(table.scheduledAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <CompatBadge score={table.avgCompatibilityScore} />
                </div>

                {/* Koltuklar */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {table.seats.map((seat, si) => (
                    <SeatBadge
                      key={si}
                      seat={seat}
                      isTarget={selectedEmpty?.tableId === table.id && selectedEmpty.seatIdx === si}
                      onClick={
                        seat.type === 'EMPTY'
                          ? () =>
                              setSelectedEmpty(
                                selectedEmpty?.tableId === table.id && selectedEmpty.seatIdx === si
                                  ? null
                                  : { tableId: table.id, seatIdx: si },
                              )
                          : undefined
                      }
                    />
                  ))}
                </div>

                {/* Onay butonu */}
                <motion.button
                  onClick={() => handleApprove(table.id)}
                  disabled={approving === table.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-2 rounded-xl border border-primary/40 bg-primary/10 text-primary text-sm font-medium disabled:opacity-40 hover:bg-primary/20 transition-colors"
                >
                  {approving === table.id ? 'Onaylanıyor…' : 'Bu Masayı Onayla'}
                </motion.button>
              </motion.div>
            ))}
          </div>

          {/* ── Sağ kolon: bot havuzu ── */}
          <div
            className="w-64 flex-shrink-0 rounded-2xl border border-border p-4 flex flex-col gap-3 sticky top-4"
            style={{ background: 'rgba(20,20,20,0.7)', backdropFilter: 'blur(16px)' }}
          >
            <h3 className="text-xs text-muted uppercase tracking-wide">Bot Havuzu</h3>
            {selectedEmpty && (
              <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-lg px-2 py-1.5">
                Boş koltuk seçildi — bot tıkla
              </p>
            )}

            {bots.length === 0 ? (
              <p className="text-xs text-muted">Müsait bot yok.</p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[70vh]">
                {bots.map((bot) => (
                  <motion.div
                    key={bot.id}
                    className="rounded-xl border border-border bg-surface p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
                        {bot.initials}
                      </div>
                      <span className="text-xs text-text font-medium flex-1 truncate">{bot.initials}</span>
                      <span className="text-[9px] px-1 rounded bg-blue-900/40 text-blue-400 border border-blue-800">BOT</span>
                    </div>

                    <OceanRadar scores={bot.oceanScore} size={100} />

                    <motion.button
                      onClick={() => handlePlaceBot(bot)}
                      disabled={!selectedEmpty || placingBot === bot.id}
                      whileHover={selectedEmpty ? { scale: 1.02 } : undefined}
                      whileTap={selectedEmpty ? { scale: 0.96 } : undefined}
                      className="w-full py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40"
                      style={
                        selectedEmpty
                          ? { borderColor: '#3b82f680', background: 'rgba(59,130,246,0.12)', color: '#93c5fd' }
                          : { borderColor: '#1f1f1f', background: 'transparent', color: '#888' }
                      }
                    >
                      {placingBot === bot.id ? '…' : 'BOT YERLEŞTİR'}
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
