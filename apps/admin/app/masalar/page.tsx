'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

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

  const STATUS_CLS: Record<string, string> = {
    PENDING: 'text-muted border-border', ACTIVE: 'text-green-400 border-green-800',
    COMPLETED: 'text-primary border-red-800', CANCELLED: 'text-accent border-accent/30',
  };

  const isUploading = photos.some((p) => p.uploading);

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-serif text-3xl">Masalar</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted">Hafta offset:</label>
          <input type="number" value={week} onChange={(e) => setWeek(Number(e.target.value))}
            className="w-20 bg-surface border border-border rounded-xl px-3 py-1.5 text-sm text-text focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-surface rounded-2xl animate-pulse" />)}
        </div>
      ) : meetings.length === 0 ? <p className="text-muted text-sm">Masa yok.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((m) => {
            const sc = STATUS_CLS[m.status] ?? 'text-muted border-border';
            return (
              <div key={m.id} className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(m.scheduledAt).toLocaleDateString('tr-TR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    {m.city && <p className="text-xs text-muted">{m.city.name}</p>}
                    {m.locationText && <p className="text-xs text-muted mt-0.5">{m.locationText}</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${sc}`}>{m.status}</span>
                </div>
                {m.participants && m.participants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {m.participants.map((p, i) => (
                      <span key={i} className="text-xs bg-bg border border-border rounded-full px-2 py-0.5 text-muted">
                        {p.initials} ({p.gender === 'MALE' ? 'E' : p.gender === 'FEMALE' ? 'K' : '?'})
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/masalar/${m.id}`}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs hover:bg-bg text-muted hover:text-text">
                    Detay / Sohbet
                  </Link>
                  {(m.status === 'PENDING' || m.status === 'ACTIVE') && (
                    <>
                      <button onClick={() => openVenueModal(m)}
                        className="px-3 py-1.5 rounded-lg bg-green-900/30 text-green-400 border border-green-800 text-xs hover:bg-green-900/50">
                        Mekan Ata / Onayla
                      </button>
                      <button onClick={() => handleCancel(m.id)} disabled={acting === m.id}
                        className="px-3 py-1.5 rounded-lg bg-red-900/30 text-accent border border-red-800 text-xs hover:bg-red-900/50 disabled:opacity-50">
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

      <Modal open={!!venueModal} onClose={() => setVenueModal(null)} title="Mekan Ata ve Onayla">
        {venueModal && (
          <div className="flex flex-col gap-4">
            {/* Mekan seç */}
            <div>
              <label className="block text-xs text-muted mb-1">Mekan</label>
              <select value={selectedVenue} onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none">
                <option value="">Seç</option>
                {venueModal.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            {/* Tarih/Saat */}
            <div>
              <label className="block text-xs text-muted mb-1">Tarih / Saat</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none" />
            </div>

            {/* Adres */}
            <div>
              <label className="block text-xs text-muted mb-1">Mekan Adresi</label>
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="Örn: Cevdetpaşa Cad. No:51, Bebek · Beşiktaş / İstanbul"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">Haritada Gör butonu bu adresi Google Maps'te açar.</p>
            </div>

            {/* Mekan Fotoğrafları */}
            <div>
              <label className="block text-xs text-muted mb-2">Mekan Fotoğrafları (en fazla 3)</label>
              <div className="flex flex-col gap-3">
                {([0, 1, 2] as const).map((idx) => {
                  const slot = photos[idx];
                  return (
                    <div key={idx} className="flex flex-col gap-2 p-3 bg-bg border border-border rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted w-6 flex-shrink-0">#{idx + 1}</span>
                        {slot.url && (
                          <img
                            src={slot.url}
                            alt={`Fotoğraf ${idx + 1}`}
                            className="w-14 h-10 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => fileRefs[idx].current?.click()}
                          className="flex-1 py-1.5 text-xs border border-dashed border-border rounded-lg text-muted hover:text-text hover:border-text/30 transition-colors"
                        >
                          {slot.file ? slot.file.name : 'Fotoğraf seç…'}
                        </button>
                        <input
                          ref={fileRefs[idx]}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange(idx, e.target.files?.[0] ?? null)}
                        />
                        {slot.uploading && <span className="text-xs text-muted">Yükleniyor…</span>}
                      </div>
                      {slot.file && (
                        <input
                          type="text"
                          value={slot.caption}
                          onChange={(e) => updatePhoto(idx, { caption: e.target.value })}
                          placeholder={`Fotoğraf ${idx + 1} başlığı (örn. Ana Salon)`}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleApprove}
              disabled={!!acting || isUploading}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium disabled:opacity-50"
            >
              {acting || isUploading ? 'Kaydediliyor…' : 'Onayla'}
            </button>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}
