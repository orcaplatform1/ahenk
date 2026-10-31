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
  const seated = [...(item?.meeting.participants ?? [])].sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''));
  const waiting = tab === 'KANKA' ? [self, kanka].filter((p): p is Person => !!p) : [];
  const people: Person[] = item ? seated : waiting;
  if (!item && !scanning) return null;

  return (
    <section className="ll-card" aria-live="polite">
      <h2 className="ll-title">Katılım {people.length}/{CAPACITY[tab]}</h2>
      {people.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {people.map((p, i) => (
            <li key={`${p.initials}-${i}`} className="ll-mono" style={{ fontSize: 13, fontWeight: 600, color: gColor(p.gender), padding: '4px 10px', borderRadius: 9999, border: '1px solid currentColor' }}>
              {label(p.initials)}
            </li>
          ))}
        </ul>
      )}
      {!item && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#c9c2b8' }}>Tarama sürüyor, masana yerleşince burada görünecek.</p>}
    </section>
  );
}
