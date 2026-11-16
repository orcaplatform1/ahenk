'use client';

import { gColor } from '@ahenk/ui';
import { useTranslations } from 'next-intl';
import { formatTime } from '@ahenk/shared';
import type { LivePulse } from './types';

type Event = LivePulse['feed']['events'][number];

// Kart en son 20 olayı tutar; 21. olay listeden düşer. Aynı anda en fazla 15 olay görünür, kalanı kart içinde kaydırılır
const MAX_ROWS = 20;
// 15 tek satırlık olay: satır 6+6 px dolgu + 17,25 px satır (11,5 × 1,5) + 1 px çizgi
const VISIBLE_ROWS_HEIGHT = 15 * (12 + 17.25 + 1);

function Row({ event, tz }: { event: Event; tz?: string }) {
  return (
    <div className="ll-feed-row">
      <span className="ll-mono" style={{ fontSize: 10, color: '#8f887f' }}>
        {formatTime(event.at, tz)}
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

export default function LiveFeed({ feed, tz }: { feed: LivePulse['feed'] | null; tz?: string }) {
  const t = useTranslations();
  const events = (feed?.events ?? []).slice(0, MAX_ROWS);

  return (
    <section className="ll-card">
      <div className="ll-head">
        <h2 className="ll-title">{t('live.feedTitle')}</h2>
        <span className="ll-note">{t('live.feedNote')}</span>
      </div>
      <div style={{ maxHeight: VISIBLE_ROWS_HEIGHT, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#a39c93' }}>{t('live.feedEmpty')}</p>
        ) : (
          events.map((e) => <Row key={e.key} event={e} tz={tz} />)
        )}
      </div>
    </section>
  );
}
