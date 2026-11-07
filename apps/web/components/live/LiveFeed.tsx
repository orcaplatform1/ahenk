'use client';

import { gColor } from '@ahenk/ui';
import type { LivePulse } from './types';

type Event = LivePulse['feed']['events'][number];

// Kart en son 20 olayı gösterir; 21. olay listeden düşer
const MAX_ROWS = 20;

function Row({ event }: { event: Event }) {
  return (
    <div className="ll-feed-row">
      <span className="ll-mono" style={{ fontSize: 10, color: '#8f887f' }}>
        {new Date(event.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
      </span>
      <span style={{ fontSize: 11.5, lineHeight: 1.5, color: '#f4f1ec', minWidth: 0, overflowWrap: 'anywhere' }}>
        {event.segments.map((s, i) => s.t === 'person' ? (
          <span key={i} style={{ display: 'inline-block', padding: '0 5px', borderRadius: 99, border: `1px solid ${gColor(s.g)}`, fontSize: 10.5, fontWeight: 600, lineHeight: 1.45 }}>
            {s.v}
          </span>
        ) : (
          <span key={i}>{s.v}</span>
        ))}
      </span>
    </div>
  );
}

export default function LiveFeed({ feed }: { feed: LivePulse['feed'] | null }) {
  const events = (feed?.events ?? []).slice(0, MAX_ROWS);

  return (
    <section className="ll-card">
      <div className="ll-head">
        <h2 className="ll-title">Canlı Akış</h2>
        <span className="ll-note">Son 20 olay</span>
      </div>
      <div>
        {events.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#a39c93' }}>Henüz olay yok.</p>
        ) : (
          events.map((e) => <Row key={e.key} event={e} />)
        )}
      </div>
    </section>
  );
}
