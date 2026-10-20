'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────
const SURFACE  = '#0a1628';
const CARD     = '#0d1f3c';
const BORDER   = '#1a3a5c';
const TEXT     = '#e2e8f0';
const MUTED    = '#64748b';
const GREEN    = '#22c55e';
const RED      = '#ef4444';
const BLUE     = '#3b82f6';
const CYAN     = '#22d3ee';
const AMBER    = '#f59e0b';
const MONO     = '"JetBrains Mono", "Fira Code", "Courier New", monospace';
const SANS     = 'Inter, system-ui, sans-serif';

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface Meeting {
  id: string;
  status: string;
  scheduledAt: string;
  locationText?: string;
  participants?: { initials: string; gender: string }[];
  city?: { id: string; name: string };
}

interface Venue { id: string; name: string; }

interface PhotoSlot {
  file: File | null;
  url: string;
  caption: string;
  uploading: boolean;
}

function emptySlot(): PhotoSlot {
  return { file: null, url: '', caption: '', uploading: false };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:   AMBER,
  ACTIVE:    GREEN,
  COMPLETED: MUTED,
  CANCELLED: RED,
};
const STATUS_BG: Record<string, string> = {
  PENDING:   'rgba(245,158,11,0.12)',
  ACTIVE:    'rgba(34,197,94,0.12)',
  COMPLETED: 'rgba(100,116,139,0.12)',
  CANCELLED: 'rgba(239,68,68,0.12)',
};
const STATUS_BORDER: Record<string, string> = {
  PENDING:   'rgba(245,158,11,0.35)',
  ACTIVE:    'rgba(34,197,94,0.3)',
  COMPLETED: 'rgba(100,116,139,0.3)',
  CANCELLED: 'rgba(239,68,68,0.3)',
};
const GENDER_TR: Record<string, string> = { MALE: 'E', FEMALE: 'K' };

// ─── Input stil yardımcısı ────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#020c1b',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  color: TEXT,
  outline: 'none',
  fontFamily: SANS,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.14em',
  color: MUTED,
  marginBottom: 6,
  fontFamily: SANS,
};

// ─── Sayfa ────────────────────────────────────────────────────────────────────
export default function MasalarPage() {
  const toast = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(0);
  const [venueModal, setVenueModal] = useState<{ meeting: Meeting; venues: Venue[] } | null>(null);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [photos, setPhotos] = useState<[PhotoSlot, PhotoSlot, PhotoSlot]>([emptySlot(), emptySlot(), emptySlot()]);
  const [acting, setActing] = useState('');
  const fileRef0 = useRef<HTMLInputElement>(null);
  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);
  const fileRefs = [fileRef0, fileRef1, fileRef2];

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ items: Meeting[] }>(`/admin/meetings?limit=50${week ? `&week=${week}` : ''}`)
      .then((r) => setMeetings(r.items))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [week]);

  useEffect(() => { load(); }, [load]);

  async function openVenueModal(meeting: Meeting) {
    try {
      const venues = await api.get<Venue[]>(`/admin/venues${meeting.city?.id ? `?cityId=${meeting.city.id}` : ''}`);
      setVenueModal({ meeting, venues });
      setSelectedVenue('');
      setScheduledAt(meeting.scheduledAt ? meeting.scheduledAt.slice(0, 16) : '');
      setVenueAddress('');
      setPhotos([emptySlot(), emptySlot(), emptySlot()]);
    } catch (e) { toast.error((e as Error).message); }
  }

  function updatePhoto(idx: 0 | 1 | 2, patch: Partial<PhotoSlot>) {
    setPhotos((prev) => {
      const next = [...prev] as [PhotoSlot, PhotoSlot, PhotoSlot];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function handleFileChange(idx: 0 | 1 | 2, file: File | null) {
    updatePhoto(idx, { file, url: file ? URL.createObjectURL(file) : '' });
  }

  async function uploadPhoto(meetingId: string, idx: 0 | 1 | 2): Promise<string | null> {
    const slot = photos[idx];
    if (!slot.file) return null;
    updatePhoto(idx, { uploading: true });
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string | null }>(
        '/admin/meetings/venue-photo-upload-url',
        { meetingId, slot: idx + 1, contentType: slot.file.type, contentLength: slot.file.size },
      );
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': slot.file.type },
        body: slot.file,
      });
      return publicUrl;
    } catch (e) {
      toast.error(`Fotoğraf ${idx + 1} yüklenemedi: ${(e as Error).message}`);
      return null;
    } finally {
      updatePhoto(idx, { uploading: false });
    }
  }

  async function handleApprove() {
    if (!venueModal) return;
    const { meeting, venues } = venueModal;
    setActing(meeting.id);
    try {
      const locationText = selectedVenue ? (venues.find((v) => v.id === selectedVenue)?.name ?? '') : '';

      await api.patch(`/admin/meetings/${meeting.id}/venue`, {
        ...(locationText && { locationText }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt).toISOString() }),
      });

      const hasPhoto = photos.some((p) => p.file);
      if (hasPhoto || venueAddress) {
        const urls = await Promise.all([
          uploadPhoto(meeting.id, 0),
          uploadPhoto(meeting.id, 1),
          uploadPhoto(meeting.id, 2),
        ]);

        await api.patch(`/admin/meetings/${meeting.id}/venue-photos`, {
          ...(venueAddress && { venueAddress }),
          ...(urls[0] && { venuePhotoUrl: urls[0], venuePhotoCaption1: photos[0].caption || 'Alan 1' }),
          ...(urls[1] && { venuePhoto2Url: urls[1], venuePhotoCaption2: photos[1].caption || 'Alan 2' }),
          ...(urls[2] && { venuePhoto3Url: urls[2], venuePhotoCaption3: photos[2].caption || 'Alan 3' }),
        });
      }

      toast.success('Masa onaylandı ve mekan atandı.');
      setVenueModal(null);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setActing(''); }
  }

  async function handleCancel(id: string) {
    if (!confirm('Bu masayı iptal etmek istiyor musunuz?')) return;
    setActing(id);
    try {
      await api.delete(`/admin/meetings/${id}`);
      toast.success('Masa iptal edildi.'); load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setActing(''); }
  }

  const isUploading = photos.some((p) => p.uploading);

  return (
    <AdminShell>
      <div style={{ fontFamily: SANS }}>
        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>Masalar</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: MUTED }}>Hafta offset:</span>
            <input
              type="number"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              style={{ ...inputStyle, width: 72, padding: '5px 10px' }}
            />
          </div>
        </div>

        {/* İçerik */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 140, background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, opacity: 0.5 }} />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <p style={{ fontSize: 12, color: MUTED }}>Masa yok.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {meetings.map((m) => {
              const sc = STATUS_COLOR[m.status] ?? MUTED;
              const sbg = STATUS_BG[m.status] ?? 'transparent';
              const sbo = STATUS_BORDER[m.status] ?? BORDER;
              return (
                <div key={m.id} style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  padding: '16px 18px',
                }}>
                  {/* Üst satır */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT }}>
                        {new Date(m.scheduledAt).toLocaleDateString('tr-TR', {
                          day: 'numeric', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {m.city && (
                        <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED }}>{m.city.name}</p>
                      )}
                      {m.locationText && (
                        <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED }}>{m.locationText}</p>
                      )}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                      padding: '2px 8px', borderRadius: 99,
                      background: sbg, color: sc, border: `1px solid ${sbo}`,
                      flexShrink: 0,
                    }}>
                      {m.status}
                    </span>
                  </div>

                  {/* Katılımcılar */}
                  {m.participants && m.participants.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                      {m.participants.map((p, i) => (
                        <span key={i} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 99,
                          background: '#020c1b', border: `1px solid ${BORDER}`,
                          color: MUTED, fontFamily: MONO,
                        }}>
                          {p.initials} ({GENDER_TR[p.gender] ?? '?'})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Butonlar */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href={`/masalar/${m.id}`} style={{
                      padding: '5px 12px', borderRadius: 6,
                      background: SURFACE, border: `1px solid ${BORDER}`,
                      fontSize: 11, color: MUTED, textDecoration: 'none',
                    }}>
                      Detay / Sohbet
                    </Link>
                    {(m.status === 'PENDING' || m.status === 'ACTIVE') && (
                      <>
                        <button
                          onClick={() => openVenueModal(m)}
                          style={{
                            padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(34,197,94,0.1)',
                            border: '1px solid rgba(34,197,94,0.35)',
                            fontSize: 11, color: GREEN, fontFamily: SANS,
                          }}
                        >
                          Mekan Ata / Onayla
                        </button>
                        <button
                          onClick={() => handleCancel(m.id)}
                          disabled={acting === m.id}
                          style={{
                            padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.35)',
                            fontSize: 11, color: RED, fontFamily: SANS,
                            opacity: acting === m.id ? 0.5 : 1,
                          }}
                        >
                          {acting === m.id ? '…' : 'İptal'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={!!venueModal} onClose={() => setVenueModal(null)} title="Mekan Ata ve Onayla">
        {venueModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Mekan seç */}
            <div>
              <label style={labelStyle}>MEKAN</label>
              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seç</option>
                {venueModal.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            {/* Tarih/Saat */}
            <div>
              <label style={labelStyle}>TARİH / SAAT</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Adres */}
            <div>
              <label style={labelStyle}>MEKAN ADRESİ</label>
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="Örn: Cevdetpaşa Cad. No:51, Bebek · Beşiktaş / İstanbul"
                style={inputStyle}
              />
              <p style={{ margin: '5px 0 0', fontSize: 10, color: MUTED }}>
                Haritada Gör butonu bu adresi Google Maps'te açar.
              </p>
            </div>

            {/* Mekan Fotoğrafları */}
            <div>
              <label style={labelStyle}>MEKAN FOTOĞRAFLARI (en fazla 3)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([0, 1, 2] as const).map((idx) => {
                  const slot = photos[idx];
                  return (
                    <div key={idx} style={{
                      display: 'flex', flexDirection: 'column', gap: 8,
                      padding: '10px 12px',
                      background: '#020c1b',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, width: 20, flexShrink: 0 }}>
                          #{idx + 1}
                        </span>
                        {slot.url && (
                          <img
                            src={slot.url}
                            alt={`Fotoğraf ${idx + 1}`}
                            style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => fileRefs[idx].current?.click()}
                          style={{
                            flex: 1, padding: '5px 10px',
                            fontSize: 11, color: MUTED,
                            background: 'none',
                            border: `1px dashed ${BORDER}`,
                            borderRadius: 6, cursor: 'pointer',
                            fontFamily: SANS,
                          }}
                        >
                          {slot.file ? slot.file.name : 'Fotoğraf seç…'}
                        </button>
                        <input
                          ref={fileRefs[idx]}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileChange(idx, e.target.files?.[0] ?? null)}
                        />
                        {slot.uploading && (
                          <span style={{ fontSize: 10, color: MUTED }}>Yükleniyor…</span>
                        )}
                      </div>
                      {slot.file && (
                        <input
                          type="text"
                          value={slot.caption}
                          onChange={(e) => updatePhoto(idx, { caption: e.target.value })}
                          placeholder={`Fotoğraf ${idx + 1} başlığı (örn. Ana Salon)`}
                          style={{ ...inputStyle, fontSize: 11 }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Onayla */}
            <button
              onClick={handleApprove}
              disabled={!!acting || isUploading}
              style={{
                width: '100%', padding: '10px',
                borderRadius: 8, cursor: 'pointer',
                background: acting || isUploading ? SURFACE : 'rgba(59,130,246,0.18)',
                border: `1px solid ${acting || isUploading ? BORDER : 'rgba(59,130,246,0.4)'}`,
                color: acting || isUploading ? MUTED : BLUE,
                fontSize: 13, fontWeight: 600,
                fontFamily: SANS,
                opacity: acting || isUploading ? 0.6 : 1,
              }}
            >
              {acting || isUploading ? 'Kaydediliyor…' : 'Onayla'}
            </button>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}
