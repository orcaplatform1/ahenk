'use client';

import { panelCard, useVenuePanel } from '../context';

export default function AbonelikPage() {
  const { me } = useVenuePanel();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="font-serif" style={{ fontSize: '1.6rem', margin: 0 }}>Abonelik</h1>
      <div style={panelCard}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>Plan</p>
        <p style={{ margin: '0.15rem 0 0.9rem', fontSize: '1.1rem', color: '#ff6b6b', fontWeight: 600 }}>Ücretsiz dönem</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>Kayıt tarihi</p>
        <p style={{ margin: '0.15rem 0 0', fontSize: '1rem' }}>
          {new Date(me.registeredAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })}
        </p>
      </div>
    </div>
  );
}
