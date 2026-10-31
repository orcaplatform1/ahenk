'use client';

import type { LivePulse } from './types';

type Event = LivePulse['feed']['events'][number];

const SCROLL_MIN_ROWS = 7; // Daha az satır pencereye sığar, kaydırılmaz
const SECONDS_PER_ROW = 4;

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
  const events = feed?.events ?? [];
  const scrolls = events.length >= SCROLL_MIN_ROWS;

  return (
    <section className="ll-card">
      <div className="ll-head">
        <h2 className="ll-title">Canlı Akış</h2>
        <span className="ll-note">dk&apos;da {(feed?.perMinute ?? 0).toLocaleString('tr-TR')} olay</span>
      </div>
      {events.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#a39c93' }}>Bu hafta henüz masa hareketi yok.</p>
      ) : (
        <div className="ll-feed-window">
          <div
            className={`ll-feed-track${scrolls ? '' : ' is-static'}`}
            style={{ '--ll-scroll-time': `${events.length * SECONDS_PER_ROW}s` } as React.CSSProperties}
          >
            <div>{events.map((e) => <Row key={e.key} event={e} />)}</div>
            {scrolls && <div aria-hidden="true">{events.map((e) => <Row key={e.key} event={e} />)}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
