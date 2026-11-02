'use client';

import { DetayAvatar } from './DetayAvatar';

export interface KankaPerson { initials: string; gender?: string | null; isSelf?: boolean }

const OPPOSITE = (g?: string | null) => (g === 'FEMALE' ? 'MALE' : g === 'MALE' ? 'FEMALE' : null);

// Baş Başa avatarının aynısı; boş yuvada "?"
function Slot({ person, emptyGender, delay }: { person?: KankaPerson; emptyGender?: string | null; delay: number }) {
  return <DetayAvatar participant={person ?? { initials: '?', gender: emptyGender }} delay={delay} />;
}

// Kankamla katılımcıları: solda kullanıcı ve kankası, ortada görsel ayırıcı, sağda karşı çift.
// Boş yuvalar: kanka yuvası kullanıcının, karşı çift yuvaları karşı cinsin renginde "?"
export function KankaPairs({ mine, other }: { mine: KankaPerson[]; other: KankaPerson[] }) {
  const left = [...mine].sort((a, b) => Number(!!b.isSelf) - Number(!!a.isSelf)).slice(0, 2);
  const right = other.slice(0, 2);
  const ownGender = left[0]?.gender ?? null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Slot person={left[0]} emptyGender={ownGender} delay={0.52} />
      <Slot person={left[1]} emptyGender={ownGender} delay={0.62} />
      <svg
        aria-hidden="true" width={26} height={14} viewBox="0 0 26 14" fill="none"
        stroke="rgba(232,162,122,0.7)" strokeWidth={1.1}
        style={{ flexShrink: 0, margin: '0 2px', pointerEvents: 'none' }}
      >
        <rect x={1} y={3} width={14} height={8} rx={4} />
        <rect x={11} y={3} width={14} height={8} rx={4} />
      </svg>
      <Slot person={right[0]} emptyGender={OPPOSITE(ownGender)} delay={0.72} />
      <Slot person={right[1]} emptyGender={OPPOSITE(ownGender)} delay={0.82} />
    </div>
  );
}
