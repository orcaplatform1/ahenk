'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OceanRadar, OceanScores } from '../ocean/OceanRadar';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────
const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const RED     = '#ef4444';
const BLUE    = '#3b82f6';
const CYAN    = '#22d3ee';
const AMBER   = '#f59e0b';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

// ─── Tipler ───────────────────────────────────────────────────────────────────
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

interface PhotoSlotState {
  url: string; caption: string; uploading: boolean; error: string;
}
interface TablePhotoState {
  expanded: boolean; saving: boolean;
  slots: [PhotoSlotState, PhotoSlotState, PhotoSlotState];
}

function emptySlot(): PhotoSlotState { return { url: '', caption: '', uploading: false, error: '' }; }
function emptyPhotoState(): TablePhotoState { return { expanded: false, saving: false, slots: [emptySlot(), emptySlot(), emptySlot()] }; }

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
function SeatBadge({ seat, onClick, isTarget }: { seat: Seat; onClick?: () => void; isTarget?: boolean }) {
  if (seat.type === 'EMPTY') {
    return (
      <button
        onClick={onClick}
        style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          borderRadius: 8, padding: 10, minHeight: 68, width: '100%',
          background: isTarget ? 'rgba(245,158,11,0.12)' : 'transparent',
          border: `1.5px dashed ${isTarget ? AMBER : 'rgba(245,158,11,0.4)'}`,
          cursor: onClick ? 'pointer' : 'default',
          fontFamily: SANS,
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(245,158,11,0.7)', letterSpacing: '0.1em' }}>BOŞ</span>
      </button>
    );
  }

  const isBotSeat = seat.type === 'BOT';
  const ringColor = isBotSeat ? BLUE : '#c0392b';
  const bgColor   = isBotSeat ? 'rgba(59,130,246,0.08)' : 'rgba(192,57,43,0.08)';

  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      borderRadius: 8, padding: 10, minHeight: 68,
      background: bgColor,
      border: `1px solid ${ringColor}55`,
    }}>
      <svg width={36} height={36} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
        <circle cx="18" cy="18" r="15" fill="none" stroke="#1f1f1f" strokeWidth="2" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={ringColor} strokeWidth="2" strokeLinecap="round"
          strokeDasharray="94.2" strokeDashoffset="24" />
        <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
          fontSize="8" fontFamily="Inter, sans-serif" fill="#f5f5f5" fontWeight="600">
          {seat.initials ?? '??'}
        </text>
      </svg>
      <span style={{ fontSize: 10, color: isBotSeat ? '#93c5fd' : TEXT }}>
        {seat.gender === 'MALE' ? 'E' : seat.gender === 'FEMALE' ? 'K' : '—'}
      </span>
      {isBotSeat && (
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
          padding: '1px 5px', borderRadius: 99,
          background: 'rgba(59,130,246,0.15)', color: '#93c5fd',
          border: '1px solid rgba(59,130,246,0.3)',
        }}>BOT</span>
      )}
    </div>
  );
}

// ─── Uyum badge ──────────────────────────────────────────────────────────────
function CompatBadge({ score }: { score: number | null }) {
  if (score === null) return <span style={{ fontSize: 10, color: MUTED }}>—</span>;
  const isGood = score >= 80;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      background: isGood ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
      border: `1px solid ${isGood ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.35)'}`,
      color: isGood ? GREEN : AMBER,
      fontFamily: MONO,
    }}>
      {score}% uyum
    </span>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export function AdminMatchManager({ apiBase = '', token }: Props) {
  const [tables, setTables]           = useState<MatchTable[]>([]);
  const [bots, setBots]               = useState<AvailableBot[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedEmpty, setSelectedEmpty] = useState<{ tableId: string; seatIdx: number } | null>(null);
  const [approving, setApproving]     = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [placingBot, setPlacingBot]   = useState<string | null>(null);
  const [toast, setToast]             = useState('');
  const [photoStates, setPhotoStates] = useState<Record<string, TablePhotoState>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
        setBots(b.filter((bot) => bot.oceanScore).map((bot) => ({ id: bot.id, initials: bot.initials, oceanScore: bot.oceanScore })));
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
    } catch (e) { showToast((e as Error).message); }
    finally { setApproving(null); }
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    try {
      await Promise.all(tables.map((t) => apiFetch(`${apiBase}/api/v1/admin/matches/${t.id}/approve`, token, { method: 'PATCH' })));
      setTables([]);
      showToast(`${tables.length} masa onaylandı`);
    } catch (e) { showToast((e as Error).message); }
    finally { setApprovingAll(false); }
  }

  async function handlePlaceBot(bot: AvailableBot) {
    if (!selectedEmpty) return;
    setPlacingBot(bot.id);
    try {
      await apiFetch(`${apiBase}/api/v1/admin/matches/${selectedEmpty.tableId}/bot`, token, {
        method: 'POST', body: JSON.stringify({ botUserId: bot.id }),
      });
      load();
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      setSelectedEmpty(null);
      showToast('Bot yerleştirildi');
    } catch (e) { showToast((e as Error).message); }
    finally { setPlacingBot(null); }
  }

  function getPhotoState(tableId: string): TablePhotoState {
    return photoStates[tableId] ?? emptyPhotoState();
  }
  function setPhotoState(tableId: string, updater: (prev: TablePhotoState) => TablePhotoState) {
    setPhotoStates(prev => ({ ...prev, [tableId]: updater(prev[tableId] ?? emptyPhotoState()) }));
  }
  function togglePhotoExpand(tableId: string) {
    setPhotoState(tableId, prev => ({ ...prev, expanded: !prev.expanded }));
  }

  async function handlePhotoFile(tableId: string, slotIdx: 0 | 1 | 2, file: File) {
    setPhotoState(tableId, prev => {
      const slots = [...prev.slots] as TablePhotoState['slots'];
      slots[slotIdx] = { ...slots[slotIdx], uploading: true, error: '' };
      return { ...prev, slots };
    });
    try {
      const { uploadUrl, publicUrl } = await apiFetch<{ uploadUrl: string; publicUrl: string | null; key: string }>(
        `${apiBase}/api/v1/admin/meetings/venue-photo-upload-url`, token,
        { method: 'POST', body: JSON.stringify({ meetingId: tableId, slot: slotIdx + 1, contentType: file.type || 'image/jpeg', contentLength: file.size }) },
      );
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } });
      const finalUrl = publicUrl ?? uploadUrl.split('?')[0];
      setPhotoState(tableId, prev => {
        const slots = [...prev.slots] as TablePhotoState['slots'];
        slots[slotIdx] = { ...slots[slotIdx], uploading: false, url: finalUrl };
        return { ...prev, slots };
      });
    } catch (e) {
      setPhotoState(tableId, prev => {
        const slots = [...prev.slots] as TablePhotoState['slots'];
        slots[slotIdx] = { ...slots[slotIdx], uploading: false, error: (e as Error).message };
        return { ...prev, slots };
      });
    }
  }

  async function handleSavePhotos(tableId: string) {
    const ps = getPhotoState(tableId);
    setPhotoState(tableId, prev => ({ ...prev, saving: true }));
    try {
      const [s1, s2, s3] = ps.slots;
      await apiFetch(`${apiBase}/api/v1/admin/meetings/${tableId}/venue-photos`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          venuePhotoUrl:      s1.url || undefined, venuePhotoCaption1: s1.caption || undefined,
          venuePhoto2Url:     s2.url || undefined, venuePhotoCaption2: s2.caption || undefined,
          venuePhoto3Url:     s3.url || undefined, venuePhotoCaption3: s3.caption || undefined,
        }),
      });
      showToast('Fotoğraflar kaydedildi');
      setPhotoState(tableId, prev => ({ ...prev, expanded: false, saving: false }));
    } catch (e) {
      showToast((e as Error).message);
      setPhotoState(tableId, prev => ({ ...prev, saving: false }));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: SANS }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 50,
          padding: '8px 16px', borderRadius: 8,
          background: CARD, border: `1px solid ${BORDER}`,
          fontSize: 12, color: TEXT, fontFamily: SANS,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}

      {loading ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE }}>EŞLEŞİM YÖNETİMİ</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 140, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />
            ))}
          </div>
        </div>
      ) : tables.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE }}>EŞLEŞİM YÖNETİMİ</span>
          </div>
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: GREEN }}>Onay bekleyen masa yok</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>Algoritma her Perşembe 23:59'da çalışır</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

          {/* ── Sol: masa listesi ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              style={{
                width: '100%', padding: '11px',
                borderRadius: 8, cursor: approvingAll ? 'not-allowed' : 'pointer',
                background: approvingAll ? SURFACE : 'rgba(59,130,246,0.15)',
                border: `1px solid ${approvingAll ? BORDER : 'rgba(59,130,246,0.4)'}`,
                fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
                color: approvingAll ? MUTED : BLUE, fontFamily: SANS,
                opacity: approvingAll ? 0.6 : 1,
              }}
            >
              {approvingAll ? 'Onaylanıyor…' : `TÜM MASALARI ONAYLA (${tables.length})`}
            </button>

            {tables.map((table) => {
              const ps = getPhotoState(table.id);
              return (
                <div key={table.id} style={{
                  background: CARD, border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: '16px 18px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {table.locationName ?? new Date(table.scheduledAt).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                      <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, flexShrink: 0 }}>
                        {new Date(table.scheduledAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <CompatBadge score={table.avgCompatibilityScore} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                    {table.seats.map((seat, si) => (
                      <SeatBadge
                        key={si} seat={seat}
                        isTarget={selectedEmpty?.tableId === table.id && selectedEmpty.seatIdx === si}
                        onClick={seat.type === 'EMPTY' ? () => setSelectedEmpty(
                          selectedEmpty?.tableId === table.id && selectedEmpty.seatIdx === si
                            ? null : { tableId: table.id, seatIdx: si }
                        ) : undefined}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => handleApprove(table.id)}
                    disabled={approving === table.id}
                    style={{
                      width: '100%', padding: '8px', borderRadius: 8,
                      cursor: approving === table.id ? 'not-allowed' : 'pointer',
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.3)',
                      fontSize: 12, fontWeight: 600, color: GREEN,
                      fontFamily: SANS,
                      opacity: approving === table.id ? 0.4 : 1,
                    }}
                  >
                    {approving === table.id ? 'Onaylanıyor…' : 'Bu Masayı Onayla'}
                  </button>

                  {/* Fotoğraf bölümü */}
                  <div>
                    <button
                      onClick={() => togglePhotoExpand(table.id)}
                      style={{
                        width: '100%', padding: '6px', borderRadius: 6, cursor: 'pointer',
                        background: ps.expanded ? 'rgba(34,211,238,0.08)' : 'transparent',
                        border: `1px solid ${ps.expanded ? 'rgba(34,211,238,0.3)' : BORDER}`,
                        fontSize: 10, fontWeight: 600,
                        color: ps.expanded ? CYAN : MUTED,
                        fontFamily: SANS,
                      }}
                    >
                      {ps.expanded ? '▲ Fotoğraf Yükle' : '▼ Fotoğraf Yükle'}
                    </button>

                    {ps.expanded && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {([0, 1, 2] as const).map((slotIdx) => {
                          const slot = ps.slots[slotIdx];
                          const refKey = `${table.id}-${slotIdx}`;
                          const labels = ['Ana Salon', 'Bar', 'Teras'];
                          return (
                            <div key={slotIdx} style={{
                              borderRadius: 8, border: `1px solid ${BORDER}`,
                              padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
                              background: 'rgba(255,255,255,0.02)',
                            }}>
                              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: MUTED }}>
                                FOTOĞRAF {slotIdx + 1}
                              </span>
                              {slot.url ? (
                                <div style={{ position: 'relative' }}>
                                  <img src={slot.url} alt={`Fotoğraf ${slotIdx + 1}`}
                                    style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 6 }} />
                                  <button
                                    onClick={() => {
                                      setPhotoState(table.id, prev => {
                                        const slots = [...prev.slots] as TablePhotoState['slots'];
                                        slots[slotIdx] = emptySlot();
                                        return { ...prev, slots };
                                      });
                                    }}
                                    style={{
                                      position: 'absolute', top: 4, right: 4,
                                      width: 22, height: 22, borderRadius: '50%',
                                      background: 'rgba(0,0,0,0.7)', border: 'none',
                                      color: TEXT, fontSize: 12, cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                  >×</button>
                                </div>
                              ) : (
                                <div>
                                  <input ref={el => { fileRefs.current[refKey] = el; }} type="file" accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(table.id, slotIdx, f); }} />
                                  <button
                                    onClick={() => fileRefs.current[refKey]?.click()}
                                    disabled={slot.uploading}
                                    style={{
                                      width: '100%', height: 60, borderRadius: 6, cursor: 'pointer',
                                      background: 'transparent',
                                      border: `1.5px dashed ${BORDER}`,
                                      fontSize: 10, color: MUTED, fontFamily: SANS,
                                      opacity: slot.uploading ? 0.5 : 1,
                                    }}
                                  >
                                    {slot.uploading ? 'Yükleniyor…' : '+ Fotoğraf Seç'}
                                  </button>
                                  {slot.error && <p style={{ margin: '4px 0 0', fontSize: 9, color: RED }}>{slot.error}</p>}
                                </div>
                              )}
                              <input type="text" placeholder={labels[slotIdx]} value={slot.caption}
                                onChange={e => {
                                  const val = e.target.value;
                                  setPhotoState(table.id, prev => {
                                    const slots = [...prev.slots] as TablePhotoState['slots'];
                                    slots[slotIdx] = { ...slots[slotIdx], caption: val };
                                    return { ...prev, slots };
                                  });
                                }}
                                style={{
                                  width: '100%', background: 'transparent',
                                  border: `1px solid ${BORDER}`, borderRadius: 6,
                                  padding: '5px 8px', fontSize: 11, color: TEXT,
                                  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
                                }}
                              />
                            </div>
                          );
                        })}
                        <button
                          onClick={() => handleSavePhotos(table.id)}
                          disabled={ps.saving}
                          style={{
                            width: '100%', padding: '8px', borderRadius: 8, cursor: ps.saving ? 'not-allowed' : 'pointer',
                            background: ps.saving ? SURFACE : 'rgba(34,197,94,0.12)',
                            border: `1px solid ${ps.saving ? BORDER : 'rgba(34,197,94,0.3)'}`,
                            fontSize: 11, fontWeight: 700, color: ps.saving ? MUTED : GREEN,
                            fontFamily: SANS, opacity: ps.saving ? 0.5 : 1,
                          }}
                        >
                          {ps.saving ? 'Kaydediliyor…' : 'Fotoğrafları Kaydet'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Sağ: bot havuzu ── */}
          <div style={{
            width: 220, flexShrink: 0,
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, overflow: 'hidden',
            position: 'sticky', top: 16,
          }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE }}>BOT HAVUZU</span>
            </div>

            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedEmpty && (
                <div style={{
                  padding: '7px 10px', borderRadius: 6,
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
                  fontSize: 10, color: AMBER, fontFamily: SANS,
                }}>
                  Boş koltuk seçildi — bot tıkla
                </div>
              )}

              {bots.length === 0 ? (
                <div style={{ padding: '20px 8px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Müsait bot yok.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: '70vh' }}>
                  {bots.map((bot) => (
                    <div key={bot.id} style={{
                      borderRadius: 8, border: `1px solid ${BORDER}`,
                      background: SURFACE, padding: '10px',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: TEXT,
                          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        }}>
                          {bot.initials}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bot.initials}
                        </span>
                        <span style={{
                          fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 99,
                          background: 'rgba(59,130,246,0.15)', color: '#93c5fd',
                          border: '1px solid rgba(59,130,246,0.3)',
                        }}>BOT</span>
                      </div>

                      <OceanRadar scores={bot.oceanScore} size={100} />

                      <button
                        onClick={() => handlePlaceBot(bot)}
                        disabled={!selectedEmpty || placingBot === bot.id}
                        style={{
                          width: '100%', padding: '6px', borderRadius: 6,
                          cursor: selectedEmpty && placingBot !== bot.id ? 'pointer' : 'not-allowed',
                          background: selectedEmpty ? 'rgba(59,130,246,0.12)' : 'transparent',
                          border: `1px solid ${selectedEmpty ? 'rgba(59,130,246,0.35)' : BORDER}`,
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                          color: selectedEmpty ? '#93c5fd' : MUTED,
                          fontFamily: SANS,
                          opacity: !selectedEmpty || placingBot === bot.id ? 0.4 : 1,
                        }}
                      >
                        {placingBot === bot.id ? '…' : 'BOT YERLEŞTİR'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
