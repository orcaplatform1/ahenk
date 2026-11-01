'use client';

import { gColor } from './MasalarDashboard';

export interface KankaPerson { initials: string; gender?: string | null; isSelf?: boolean }

const OPPOSITE = (g?: string | null) => (g === 'FEMALE' ? 'MALE' : g === 'MALE' ? 'FEMALE' : null);

function Slot({ person, emptyGender }: { person?: KankaPerson; emptyGender?: string | null }) {
  const color = gColor(person ? person.gender : emptyGender);
  return (
    <span
      style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${color}`, color, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono), monospace',
      }}
    >
      {person ? person.initials : '?'}
    </span>
  );
}

// Kankamla katılımcıları: solda kullanıcı ve kankası, ortada görsel ayırıcı, sağda karşı çift.
// Boş yuvalar: kanka yuvası kullanıcının, karşı çift yuvaları karşı cinsin renginde "?"
export function KankaPairs({ mine, other }: { mine: KankaPerson[]; other: KankaPerson[] }) {
  const left = [...mine].sort((a, b) => Number(!!b.isSelf) - Number(!!a.isSelf)).slice(0, 2);
  const right = other.slice(0, 2);
  const ownGender = left[0]?.gender ?? null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Slot person={left[0]} emptyGender={ownGender} />
      <Slot person={left[1]} emptyGender={ownGender} />
      <span
        aria-hidden="true"
        style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 2px', color: '#f4f1ec', fontSize: 18, lineHeight: 1, fontFamily: 'var(--font-serif), Georgia, serif', pointerEvents: 'none',
          background: 'radial-gradient(circle at 35% 30%, rgba(232,162,122,0.35), rgba(214,69,58,0.18))',
          border: '1px solid rgba(232,162,122,0.55)', boxShadow: '0 0 12px rgba(232,162,122,0.25)',
        }}
      >
        +
      </span>
      <Slot person={right[0]} emptyGender={OPPOSITE(ownGender)} />
      <Slot person={right[1]} emptyGender={OPPOSITE(ownGender)} />
    </div>
  );
}
