'use client';

import type { MasaTuru } from '@ahenk/ui';

export type TabStatus = 'TABLE' | 'SCANNING' | 'KYC' | 'PENDING' | 'FAILED' | 'NONE';

const TABS: { type: MasaTuru; label: string }[] = [
  { type: 'GROUP', label: 'GRUP' },
  { type: 'ONE_ON_ONE', label: 'BAŞ BAŞA' },
  { type: 'KANKA', label: 'KANKAMLA' },
];

const STATUS_TEXT: Record<TabStatus, string> = {
  TABLE: 'Masa Kuruldu',
  SCANNING: 'Taramada',
  KYC: 'Kimlik Bekleniyor',
  PENDING: 'Beklemede',
  FAILED: 'Başarısız',
  NONE: 'Abonelik Yok',
};

// İç içe geçmiş iki halka; son yay kesişimde bakır halkayı kırmızının üstüne alır
// Küçük halkalar: dış çap dahil kapladığı alan Baş Başa ikonuyla aynı (x 4.5–53.5, y 10.5–47.5); kalınlık/çap oranı korunur
const SMALL_R = 11.4865;
const SMALL_STROKE = 2.027;
const SMALL_RINGS: Partial<Record<MasaTuru, [number, number][]>> = {
  GROUP: [[17, 23], [29, 35], [41, 23], [17, 35], [29, 23], [41, 35]],
  KANKA: [[17, 23], [33, 23], [25, 35], [41, 35]],
};

function Rings({ type }: { type: MasaTuru }) {
  const small = SMALL_RINGS[type];
  if (small) {
    return (
      <svg className="ll-tab-rings" width="58" height="58" viewBox="0 0 58 58" fill="none" aria-hidden="true">
        <g className="ll-tab-spin" strokeWidth={SMALL_STROKE}>
          {small.map(([cx, cy], i) => (
            <circle key={`${cx}-${cy}`} className={i % 2 === 0 ? 'll-ring-copper' : 'll-ring-red'} cx={cx} cy={cy} r={SMALL_R} />
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
