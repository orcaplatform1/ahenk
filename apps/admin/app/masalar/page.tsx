'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function MasalarPage() {
  const toast = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(0);
  const [venueModal, setVenueModal] = useState<{ meeting: Meeting; venues: Venue[] } | null>(null);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [acting, setActing] = useState('');

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
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleApprove() {
    if (!venueModal) return;
    setActing(venueModal.meeting.id);
    try {
      await api.patch(`/admin/meetings/${venueModal.meeting.id}/venue`, {
        ...(selectedVenue && { locationText: venueModal.venues.find((v) => v.id === selectedVenue)?.name }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      toast.success('Masa onaylandı ve mekan atandı.');
      setVenueModal(null); load();
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-surface rounded-2xl animate-pulse" />)}</div>
      ) : meetings.length === 0 ? <p className="text-muted text-sm">Masa yok.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((m) => {
            const sc = STATUS_CLS[m.status] ?? 'text-muted border-border';
            return (
              <div key={m.id} className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">{new Date(m.scheduledAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
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
                {(m.status === 'PENDING' || m.status === 'ACTIVE') && (
                  <div className="flex gap-2">
                    <button onClick={() => openVenueModal(m)} className="px-3 py-1.5 rounded-lg bg-green-900/30 text-green-400 border border-green-800 text-xs hover:bg-green-900/50">
                      Mekan Ata / Onayla
                    </button>
                    <button onClick={() => handleCancel(m.id)} disabled={acting === m.id}
                      className="px-3 py-1.5 rounded-lg bg-red-900/30 text-accent border border-red-800 text-xs hover:bg-red-900/50 disabled:opacity-50">
                      {acting === m.id ? '…' : 'İptal'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!venueModal} onClose={() => setVenueModal(null)} title="Mekan Ata ve Onayla">
        {venueModal && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Mekan</label>
              <select value={selectedVenue} onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none">
                <option value="">Seç</option>
                {venueModal.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Tarih/Saat</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none" />
            </div>
            <button onClick={handleApprove} disabled={acting === venueModal.meeting.id}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium disabled:opacity-50">
              {acting ? 'Kaydediliyor…' : 'Onayla'}
            </button>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}
