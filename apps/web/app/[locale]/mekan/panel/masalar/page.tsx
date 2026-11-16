'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatNamed, type Lang } from '@ahenk/shared';
import { VenueAuthError, venueApi } from '@/lib/venueApi';
import { panelCard, useVenuePanel } from '../context';

interface Row { id: string; scheduledAt: string; type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'; seats: number }


function RowList({ rows, empty }: { rows: Row[]; empty: string }) {
  const t = useTranslations();
  const locale = useLocale() as Lang;
  if (rows.length === 0) return <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>{empty}</p>;
  return (
    <>
      {rows.map((m) => {
        const d = new Date(m.scheduledAt);
        return (
          <div key={m.id} style={{ ...panelCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '0.9rem 1.1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>{formatNamed(d, locale, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#888' }}>
                {d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })} · {t(`vp.type${m.type}`)}
              </p>
            </div>
            <span style={{ flexShrink: 0, color: '#ff6b6b', fontSize: '0.85rem', fontWeight: 600 }}>{t('vp.seats', { n: m.seats })}</span>
          </div>
        );
      })}
    </>
  );
}

export default function MasalarPage() {
  const { onAuthLost } = useVenuePanel();
  const t = useTranslations();
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
      <h1 className="font-serif" style={{ fontSize: '1.6rem', margin: 0 }}>{t('vp.navTables')}</h1>
      {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
      {!rows && !error && <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>{t('vp.loading')}</p>}
      {rows && (
        <>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.5rem 0 0' }}>{t('vp.upcoming')}</h2>
          <RowList rows={upcoming} empty={t('vp.noUpcoming')} />
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.75rem 0 0' }}>{t('vp.past')}</h2>
          <RowList rows={past} empty={t('vp.noPast')} />
        </>
      )}
    </div>
  );
}
