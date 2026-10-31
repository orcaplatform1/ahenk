'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { VenueAuthError, VenueMe, venueApi } from '@/lib/venueApi';
import { VenuePanelContext } from './context';

const NAV = [
  { href: '/mekan/panel/kontenjan', label: 'Kontenjan' },
  { href: '/mekan/panel/bilgiler', label: 'Mekân Bilgileri' },
  { href: '/mekan/panel/masalar', label: 'Masalar' },
  { href: '/mekan/panel/abonelik', label: 'Abonelik' },
  { href: '/mekan/panel/hesap', label: 'Hesap' },
];

export default function MekanPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<VenueMe | null>(null);
  const [error, setError] = useState('');

  const onAuthLost = useCallback(() => router.replace('/mekan/giris'), [router]);

  useEffect(() => {
    venueApi.get<VenueMe>('/me').then(setMe).catch((e) => {
      if (e instanceof VenueAuthError) onAuthLost();
      else setError((e as Error).message);
    });
  }, [onAuthLost]);

  async function logout() {
    await venueApi.post('/logout').catch(() => undefined);
    onAuthLost();
  }

  return (
    <main style={{ minHeight: '100vh', background: '#121212', color: '#f5f5f5' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(18,18,18,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0.9rem 1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p className="font-serif" style={{ fontSize: '1.25rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.venue.name ?? 'Mekân Paneli'}</p>
              {me && <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>{me.venue.city}</p>}
            </div>
            <button type="button" onClick={logout} style={{ flexShrink: 0, minHeight: 44, padding: '0 0.5rem', background: 'none', border: 'none', color: '#888', fontSize: '0.8rem', cursor: 'pointer' }}>Çıkış</button>
          </div>
          <nav aria-label="Mekân paneli" style={{ display: 'flex', gap: 4, overflowX: 'auto', marginTop: 6 }}>
            {NAV.map((n) => {
              const active = path === n.href;
              return (
                <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} style={{ flexShrink: 0, padding: '0.7rem 0.75rem', fontSize: '0.85rem', textDecoration: 'none', color: active ? '#ff6b6b' : '#888', borderBottom: `2px solid ${active ? '#c0392b' : 'transparent'}` }}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '1.25rem 1rem 3rem' }}>
        {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{error}</p>}
        {me ? <VenuePanelContext.Provider value={{ me, setMe, onAuthLost }}>{children}</VenuePanelContext.Provider> : !error && <p style={{ color: '#666', fontSize: '0.85rem' }}>Yükleniyor…</p>}
      </div>
    </main>
  );
}
