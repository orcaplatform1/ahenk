'use client';

import { AMBER, SANS } from '@/lib/adminTheme';

// Askı tek model: 3 gün / 15 gün / 1 ay (30). Askı girişi engellemez; kullanıcı yalnız masaya katılamaz, paket / abonelik alamaz.
const SUSPEND_OPTIONS: { days: 3 | 15 | 30; label: string }[] = [
  { days: 3, label: '3 gün' }, { days: 15, label: '15 gün' }, { days: 30, label: '1 ay' },
];

export function AdminSuspendButtons({ onPick, busy, color = AMBER }: { onPick: (days: 3 | 15 | 30) => void; busy?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: SANS }}>Askıya Al:</span>
      {SUSPEND_OPTIONS.map((o) => (
        <button key={o.days} type="button" onClick={() => onPick(o.days)} disabled={busy}
          style={{ padding: '5px 12px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer', background: 'transparent', color, border: `1px solid ${color}`, fontSize: 11, fontWeight: 600, fontFamily: SANS, opacity: busy ? 0.5 : 1 }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
