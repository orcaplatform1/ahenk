'use client';

import type { CSSProperties } from 'react';
import type { MasaTuru } from '@ahenk/ui';

export type TabStatus = 'TABLE' | 'SCANNING' | 'KYC' | 'KANKA' | 'PENDING' | 'FAILED' | 'NONE';

const TABS: { type: MasaTuru; label: string }[] = [
  { type: 'GROUP', label: 'GRUP' },
  { type: 'ONE_ON_ONE', label: 'BAŞ BAŞA' },
  { type: 'KANKA', label: 'KANKAMLA' },
];

const STATUS_TEXT: Record<TabStatus, string> = {
  TABLE: 'Masa Kuruldu',
  SCANNING: 'Taramada',
  KYC: 'Kimlik Bekleniyor',
  KANKA: 'Kanka Bekleniyor',
  PENDING: 'Beklemede',
  FAILED: 'Başarısız',
  NONE: 'Abonelik Yok',
};

// İç içe geçmiş iki halka; son yay kesişimde bakır halkayı kırmızının üstüne alır
// Küçük halkalar merkeze göre konumlanır: durağan alan Baş Başa ile aynı (x 4.5–53.5, y 10.5–47.5), kalınlık/çap oranı aynı.
// Her halka Baş Başa ile aynı dönüşte kendi evresiyle merkeze girip çıkar; hareket bu alanın içinde kalır.
const SMALL_R = 11.4865;
const SMALL_STROKE = 2.027;
const SPIN_S = 3.2;
const SMALL_RINGS: Partial<Record<MasaTuru, [number, number][]>> = {
  GROUP: [[-12, 0], [-6, -6], [6, -6], [12, 0], [6, 6], [-6, 6]],
  KANKA: [[-12, 0], [0, -6], [12, 0], [0, 6]],
};

function Rings({ type }: { type: MasaTuru }) {
  const small = SMALL_RINGS[type];
  if (small) {
    return (
      <svg className="ll-tab-rings" width="58" height="58" viewBox="0 0 58 58" fill="none" aria-hidden="true">
        <g className="ll-tab-spin" strokeWidth={SMALL_STROKE}>
          {small.map(([x, y], i) => (
            <circle
              key={`${x}-${y}`}
              className={`ll-ring-drift ${i % 2 === 0 ? 'll-ring-copper' : 'll-ring-red'}`}
              cx={29 + x}
              cy={29 + y}
              r={SMALL_R}
              style={{ '--ring-x': `${-x}px`, '--ring-y': `${-y}px`, animationDelay: `${(-SPIN_S * i) / small.length}s` } as CSSProperties}
            />
          ))}
        </g>
      </svg>
    );
  }
  return (
    <svg className="ll-tab-rings" width="58" height="58" viewBox="0 0 58 58" fill="none" aria-hidden="true">
      <g className="ll-tab-spin" strokeWidth="3" strokeLinecap="round">
        <circle className="ll-ring-copper" cx="23" cy="29" r="17" />
        <circle className="ll-ring-red" cx="35" cy="29" r="17" />
        <path className="ll-ring-copper" d="M24.69 12.08A17 17 0 0 1 32.93 15.19" />
      </g>
    </svg>
  );
}

export default function LiveTabs({ tab, statuses, onTab }: {
  tab: MasaTuru;
  statuses: Record<MasaTuru, TabStatus>;
  onTab: (tab: MasaTuru) => void;
}) {
  return (
    <div className="ll-tabs">
      {TABS.map(({ type, label }) => {
        const status = statuses[type];
        const off = status === 'NONE';
        const on = !off && type === tab;
        return (
          <button
            key={type}
            type="button"
            className={`ll-tab${on ? ' is-on' : ''}${off ? ' is-off' : ''}`}
            disabled={off}
            aria-disabled={off}
            aria-pressed={on}
            aria-label={`${label}: ${STATUS_TEXT[status]}`}
            onClick={() => onTab(type)}
          >
            <Rings type={type} />
            <span className="ll-tab-label">{label}</span>
            <span className="ll-tab-status">
              <span className={`ll-tab-dot is-${status.toLowerCase()}`} />
              {STATUS_TEXT[status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
