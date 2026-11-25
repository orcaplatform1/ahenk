'use client';

// Şehir listelerinde (kayıt + Profilim) Yakında şehirler: iki grup, her grubun üstünde ayırıcı çizgi.
// Grup 1 countryCode TR ("Sezon Masaları 🇹🇷"), Grup 2 TR dışı ("Yeni Duraklar 📍"); ayırıcının altında ortalı, italik takvim satırı
// (Grup 1 şehirlerin sezonundan groupSeason, yoksa "Takvim: Yakında"; Grup 2 "Takvim: Yakında"). Satır: ad (Grup 2'de + bayrak),
// "Yakında" etiketi satırın en sağında. Gruplama ve sıralama packages/shared citySeason.ts (mobil components/SoonCityGroups.tsx ile aynı).
import { useLocale, useTranslations } from 'next-intl';
import { cityExtras, cityFlag, groupSeason, soonCityGroups, type CitySeasonFields } from '@ahenk/shared';

type SoonCity = CitySeasonFields & { id: string; name: string };

// Şehir adının sağındaki ekler: bayrak ve italik, küçük sezon metni
export function CityExtras({ city }: { city: CitySeasonFields }) {
  const lang = useLocale() === 'en' ? 'en' : 'tr';
  const { flag, season } = cityExtras(city, lang);
  return (
    <>
      {flag && <span style={{ marginLeft: 6 }}>{flag}</span>}
      {season && <span style={{ marginLeft: 6, fontStyle: 'italic', fontSize: '0.87em' }}>{season}</span>}
    </>
  );
}

function Separator({ label, schedule }: { label: string; schedule: string }) {
  return (
    <>
      <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 4px 2px', color: '#8f887f', fontSize: 11 }}>
        <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />{label}<span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
      </div>
      <p style={{ margin: '0 4px 6px', textAlign: 'center', fontStyle: 'italic', fontSize: 11, color: '#8f887f' }}>{schedule}</p>
    </>
  );
}

export function SoonCityGroups({ cities, color }: { cities: SoonCity[]; color: string }) {
  const t = useTranslations();
  const lang = useLocale() === 'en' ? 'en' : 'tr';
  const { tr, intl } = soonCityGroups(cities);
  const trRange = groupSeason(tr, lang);
  const schedule = (range: string) => (range ? t('common.scheduleRange', { range }) : t('common.scheduleSoon'));
  const row = (c: SoonCity) => (
    <div key={c.id} aria-disabled="true" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 15, color }}>
      <span style={{ flex: 1, minWidth: 0 }}>{c.name}{cityFlag(c) && <span style={{ marginLeft: 6 }}>{cityFlag(c)}</span>}</span>
      <span style={{ flexShrink: 0, padding: '1px 7px', borderRadius: 999, border: '1px solid rgba(143,136,127,0.4)', fontSize: 10, color: '#8f887f' }}>{t('common.comingSoon')}</span>
    </div>
  );
  return (
    <>
      {tr.length > 0 && <><Separator label={t('common.seasonTablesTr')} schedule={schedule(trRange)} />{tr.map(row)}</>}
      {intl.length > 0 && <><Separator label={t('common.seasonTablesIntl')} schedule={schedule('')} />{intl.map(row)}</>}
    </>
  );
}
