'use client';

import { useTranslations } from 'next-intl';
import { DetayAvatar } from './DetayAvatar';

export interface KankaPerson { initials: string; gender?: string | null; isSelf?: boolean; photoUrl?: string | null; displayName?: string | null }

const OPPOSITE = (g?: string | null) => (g === 'FEMALE' ? 'MALE' : g === 'MALE' ? 'FEMALE' : null);

// Baş Başa avatarının aynısı; boş yuvada "?"
// onPhoto verilirse (masa detay kartı) onaylı profil fotoğrafı gösterilir ve basınca tam ekran açılır; showProfile (Masalarım tarama:
// kullanıcı ve kankası) fotoğraf ve adı gösterir, basınca bir şey olmaz; diğer yerlerde fotoğraf gösterilmez
function Slot({ person, emptyGender, delay, onPhoto, showProfile }: { person?: KankaPerson; emptyGender?: string | null; delay: number; onPhoto?: (p: KankaPerson) => void; showProfile?: boolean }) {
  const t = useTranslations();
  const p = person ? { ...person, photoUrl: onPhoto || showProfile ? person.photoUrl : null } : { initials: '?', gender: emptyGender };
  const av = <DetayAvatar participant={p} delay={delay} />;
  const slot = person?.photoUrl && onPhoto
    ? <button type="button" onClick={() => onPhoto(person)} aria-label={t('masa.enlargePhoto')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{av}</button>
    : av;
  // Masa detay kartında görünen ad ("Ahmet Y."): çift yerleşimi yan yana olduğu için dairenin altında
  if ((!onPhoto && !showProfile) || !person?.displayName) return slot;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
      {slot}
      <span style={{ fontSize: 11, fontWeight: 600, color: '#f4f1ec', fontFamily: 'Inter, sans-serif', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.displayName}</span>
    </div>
  );
}

// Kankamla katılımcıları: solda kullanıcı ve kankası, ortada görsel ayırıcı, sağda karşı çift.
// Boş yuvalar: kanka yuvası kullanıcının, karşı çift yuvaları karşı cinsin renginde "?"
export function KankaPairs({ mine, other, onPhoto, showMine }: { mine: KankaPerson[]; other: KankaPerson[]; onPhoto?: (p: KankaPerson) => void; showMine?: boolean }) {
  const left = [...mine].sort((a, b) => Number(!!b.isSelf) - Number(!!a.isSelf)).slice(0, 2);
  const right = other.slice(0, 2);
  const ownGender = left[0]?.gender ?? null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Slot person={left[0]} emptyGender={ownGender} delay={0.52} onPhoto={onPhoto} showProfile={showMine} />
      <Slot person={left[1]} emptyGender={ownGender} delay={0.62} onPhoto={onPhoto} showProfile={showMine} />
      <svg
        aria-hidden="true" width={26} height={14} viewBox="0 0 26 14" fill="none"
        stroke="rgba(232,162,122,0.7)" strokeWidth={1.1}
        style={{ flexShrink: 0, margin: '0 2px', pointerEvents: 'none' }}
      >
        <rect x={1} y={3} width={14} height={8} rx={4} />
        <rect x={11} y={3} width={14} height={8} rx={4} />
      </svg>
      <Slot person={right[0]} emptyGender={OPPOSITE(ownGender)} delay={0.72} onPhoto={onPhoto} />
      <Slot person={right[1]} emptyGender={OPPOSITE(ownGender)} delay={0.82} onPhoto={onPhoto} />
    </div>
  );
}
