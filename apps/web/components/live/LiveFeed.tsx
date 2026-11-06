'use client';

import type { LivePulse } from './types';

type Event = LivePulse['feed']['events'][number];

// Kart son 10 olayı gösterir; yükseklik satır sayısına göre sabit (10 × 44px)
const MAX_ROWS = 10;
const LIST_HEIGHT = 440;

const KIND: Record<Event['kind'], { text: string; color: string }> = {
  FULL: { text: 'Masa doldu', color: '#ff8a7e' },
  MATCH: { text: 'Baş başa eşleşme', color: '#e8a27a' },
  OPEN: { text: 'Masada boş yer kaldı', color: '#c9c2b8' },
  VENUE: { text: 'Yeni mekân eklendi', color: '#c9c2b8' },
};

function badge(e: Event) {
  if (e.kind === 'FULL') return 'DOLDU';
  if (e.kind === 'MATCH') return `%${e.value} UYUM`;
  if (e.kind === 'OPEN') return `${e.value} YER`;
  return 'MEKAN';
}

function Row({ event }: { event: Event }) {
  const kind = KIND[event.kind];
  return (
    <div className="ll-feed-row">
      <span className="ll-mono" style={{ fontSize: 11, color: '#8f887f' }}>
        {new Date(event.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
      </span>
      <span style={{ fontSize: 13, color: '#f4f1ec', minWidth: 0 }}>{event.place} · {kind.text}</span>
      <span className="ll-badge" style={{ color: kind.color }}>{badge(event)}</span>
    </div>
  );
}

export default function LiveFeed({ feed }: { feed: LivePulse['feed'] | null }) {
  const events = (feed?.events ?? []).slice(0, MAX_ROWS);

  return (
    <section className="ll-card">
      <div className="ll-head">
        <h2 className="ll-title">Canlı Akış</h2>
        <span className="ll-note">24 saatte {(feed?.last24h ?? 0).toLocaleString('tr-TR')} olay</span>
      </div>
      <div style={{ height: LIST_HEIGHT, overflow: 'hidden' }}>
        {events.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#a39c93' }}>Son 24 saatte olay yok.</p>
        ) : (
          events.map((e) => <Row key={e.key} event={e} />)
        )}
      </div>
    </section>
  );
}
