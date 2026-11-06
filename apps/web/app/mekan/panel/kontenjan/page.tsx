'use client';

import { useEffect, useState } from 'react';
import { VenueAuthError, venueApi } from '@/lib/venueApi';
import { panelCard, useVenuePanel } from '../context';

interface Week { weekStart: string; capacity: number; assignedSeats: number }

function weekLabel(iso: string) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export default function KontenjanPage() {
  const { onAuthLost } = useVenuePanel();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  function apply(list: Week[]) {
    setWeeks(list);
    setDrafts(Object.fromEntries(list.map((w) => [w.weekStart, String(w.capacity)])));
  }

  function fail(e: unknown) {
    if (e instanceof VenueAuthError) onAuthLost();
    else setError((e as Error).message);
  }

  useEffect(() => {
    venueApi.get<{ weeks: Week[] }>('/capacity').then((r) => apply(r.weeks)).catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(weekStart: string) {
    const capacity = Number(drafts[weekStart]);
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 500) { setError('Kontenjan 0-500 arasında olmalı.'); return; }
    setSaving(weekStart); setSaved(''); setError('');
    try {
      const r = await venueApi.put<{ weeks: Week[] }>('/capacity', { weekStart, capacity });
      apply(r.weeks);
      setSaved(weekStart);
    } catch (e) { fail(e); } finally { setSaving(''); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h1 className="font-serif" style={{ fontSize: '1.6rem', margin: 0 }}>Kontenjan</h1>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Her hafta ayırabildiğiniz kişi sayısını girin. Masalar bu sayıya göre atanır; 0 girerseniz o hafta masa atanmaz.</p>
      </div>
      {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
      {weeks.map((w, i) => (
        <div key={w.weekStart} style={{ ...panelCard, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '1 1 200px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{weekLabel(w.weekStart)}{i === 0 ? ' (bu hafta)' : ''}</p>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#666' }}>Atanan: {w.assignedSeats} kişi</p>
          </div>
          <input
            className="input-glass px-3 py-2 text-sm"
            type="number" inputMode="numeric" min={0} max={500}
            aria-label={`${weekLabel(w.weekStart)} kontenjanı`}
            value={drafts[w.weekStart] ?? ''}
            onChange={(e) => setDrafts((d) => ({ ...d, [w.weekStart]: e.target.value }))}
            style={{ width: 90, minHeight: 44 }}
          />
          <button type="button" onClick={() => save(w.weekStart)} disabled={saving === w.weekStart} className="btn-primary disabled:opacity-70">
            {saving === w.weekStart ? '…' : saved === w.weekStart ? 'Kaydedildi ✓' : 'Kaydet'}
          </button>
        </div>
      ))}
    </div>
  );
}
