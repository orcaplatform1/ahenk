'use client';

import { gColor, type DashboardItem, type MasaTuru } from '@ahenk/ui';

const CAPACITY: Record<MasaTuru, number> = { GROUP: 6, ONE_ON_ONE: 2, KANKA: 4 };

type Person = { initials: string; gender?: string | null };

// "AM" → "A.M."
function label(initials: string) {
  const raw = initials.trim();
  return raw.length === 2 && !raw.includes('.') ? `${raw[0]}.${raw[1]}.`.toLocaleUpperCase('tr-TR') : raw.toLocaleUpperCase('tr-TR');
}

// Sadece kullanıcının kendi masası. Kankamla'da masa kurulana kadar kullanıcı + kankası listelenir.
export default function LiveParticipation({ tab, item, self, kanka, scanning }: {
  tab: MasaTuru;
  item?: DashboardItem;
  self?: Person;
  kanka?: Person | null;
  scanning: boolean;
}) {
  const seated = (item?.meeting.participants ?? []).filter((p) => !p.cancelled).sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''));
  const waiting = tab === 'KANKA' && scanning && self && kanka ? [self, kanka] : [];
  const people: Person[] = item ? seated : waiting;
  const total = item?.meeting.maxParticipants ?? CAPACITY[tab];

  return (
    <section className="ll-card" aria-live="polite" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 6 }}>
      <h2 className="ll-title">{people.length > 0 ? `Katılım ${people.length}/${total}:` : 'Katılım:'}</h2>
      {people.map((p, i) => (
        <span key={`${p.initials}-${i}`} className="ll-mono" style={{ fontSize: 14, fontWeight: 600, color: gColor(p.gender) }}>
          {label(p.initials)}
        </span>
      ))}
    </section>
  );
}
