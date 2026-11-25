'use client';

// Şehir listelerinde (kayıt + Profilim) Yakında şehirler: iki grup, her grubun üstünde ayırıcı çizgi.
// Grup 1 countryCode TR ("Sezon Masaları 🇹🇷"), Grup 2 TR dışı ("Yeni Duraklar 📍"); ayırıcının altında ortalı, italik takvim satırı
// (Grup 1 şehirlerin sezonundan groupSeason, yoksa "Takvim: Yakında"; Grup 2 "Takvim: Yakında"). Görseli olan şehir kare görselli kart
// (satırda yan yana 2; görsel soluk, altında ad, Grup 2'de + bayrak, ve kartın içinde "Yakında" etiketi); görseli olmayan şehir düz satır
// (ad + "Yakında" en sağda). Gruplama ve sıralama packages/shared citySeason.ts (mobil components/SoonCityGroups.tsx ile aynı).
import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cityExtras, cityFlag, cityImage, groupSeason, soonCityGroups, type CitySeasonFields } from '@ahenk/shared';

// Şehir seçim listesi kare kartları (kayıt + Profilim): satırda yan yana 2 kart; görseli olmayan şehir tam satır (cityGridItem)
export const CITY_GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 };
export const cityGridItem = (name: string): CSSProperties | undefined => (cityImage(name) ? undefined : { gridColumn: '1 / -1' });
// Kare görsel: kart genişliğini doldurur, oran 1:1, kırpmalı (cover)
export const CITY_SQUARE_IMG: CSSProperties = { display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 8, marginBottom: 8 };

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
  const soonTag = <span style={{ flexShrink: 0, padding: '1px 7px', borderRadius: 999, border: '1px solid rgba(143,136,127,0.4)', fontSize: 10, color: '#8f887f' }}>{t('common.comingSoon')}</span>;
  const row = (c: SoonCity) => {
    const img = cityImage(c.name);
    const name = <span style={{ flex: 1, minWidth: 0 }}>{c.name}{cityFlag(c) && <span style={{ marginLeft: 6 }}>{cityFlag(c)}</span>}</span>;
    if (!img) return (
      <div key={c.id} aria-disabled="true" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 15, color }}>
        {name}{soonTag}
      </div>
    );
    // Kare kart: soluk görsel, altında ad + "Yakında" etiketi (dar kartta etiket alt satıra iner)
    return (
      <div key={c.id} aria-disabled="true" style={{ padding: '13px 14px', borderRadius: 8, fontSize: 15, color }}>
        <img src={img} alt="" style={{ ...CITY_SQUARE_IMG, opacity: 0.4 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>{name}{soonTag}</div>
      </div>
    );
  };
  return (
    <>
      {tr.length > 0 && <><Separator label={t('common.seasonTablesTr')} schedule={schedule(trRange)} /><div style={CITY_GRID}>{tr.map(row)}</div></>}
      {intl.length > 0 && <><Separator label={t('common.seasonTablesIntl')} schedule={schedule('')} /><div style={CITY_GRID}>{intl.map(row)}</div></>}
    </>
  );
}
