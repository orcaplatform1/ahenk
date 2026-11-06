'use client';

import { useEffect, useState } from 'react';
import { VenueAuthError, venueApi } from '@/lib/venueApi';
import { panelCard, useVenuePanel } from '../context';

interface Row { id: string; scheduledAt: string; type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'; seats: number }

const TYPE_LABEL: Record<Row['type'], string> = { GROUP: 'Grup masası', ONE_ON_ONE: 'Başbaşa masa', KANKA: 'Kankamla masası' };

function RowList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>{empty}</p>;
  return (
    <>
      {rows.map((m) => {
        const d = new Date(m.scheduledAt);
        return (
          <div key={m.id} style={{ ...panelCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '0.9rem 1.1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>{d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'Europe/Istanbul' })}</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#888' }}>
                {d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })} · {TYPE_LABEL[m.type]}
              </p>
            </div>
            <span style={{ flexShrink: 0, color: '#ff6b6b', fontSize: '0.85rem', fontWeight: 600 }}>{m.seats} kişi</span>
          </div>
        );
      })}
    </>
  );
}

export default function MasalarPage() {
  const { onAuthLost } = useVenuePanel();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    venueApi.get<Row[]>('/meetings').then(setRows).catch((e) => {
      if (e instanceof VenueAuthError) onAuthLost();
      else setError((e as Error).message);
    });
  }, [onAuthLost]);

  const now = Date.now();
  const upcoming = (rows ?? []).filter((m) => new Date(m.scheduledAt).getTime() >= now).reverse();
  const past = (rows ?? []).filter((m) => new Date(m.scheduledAt).getTime() < now);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h1 className="font-serif" style={{ fontSize: '1.6rem', margin: 0 }}>Masalar</h1>
      {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
      {!rows && !error && <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Yükleniyor…</p>}
      {rows && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.5rem 0 0' }}>Yaklaşan</h2>
          <RowList rows={upcoming} empty="Yaklaşan masa yok." />
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.75rem 0 0' }}>Geçmiş</h2>
          <RowList rows={past} empty="Geçmiş masa yok." />
        </>
      )}
    </div>
  );
}
