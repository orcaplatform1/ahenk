// Şehir listelerinde (kayıt + Profilim) Yakında şehirler: web components/SoonCityGroups.tsx karşılığı.
// İki grup, her grubun üstünde ayırıcı çizgi: countryCode TR ("Sezon Masaları 🇹🇷"): ad + italik küçük sezon; TR dışı ("Sezon Masaları 🌐"):
// ad + bayrak. "Yakında" etiketi satırın en sağında. Gruplama ve sıralama packages/shared citySeason.ts. Satırlar en az 44 pt, seçilemez.
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cityExtras, soonCityGroups, type CitySeasonFields } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';
import { T } from './ui';

type SoonCity = CitySeasonFields & { id: string; name: string };

// Seçilebilir satırların etiketi için düz metin: ad, bayrak, sezon
export function cityLabelWithExtras(name: string, c: CitySeasonFields): string {
  const { flag, season } = cityExtras(c, currentLang());
  return [name, flag, season].filter(Boolean).join(' ');
}

function Separator({ label }: { label: string }) {
  return (
    <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10, marginHorizontal: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
      <T style={{ fontSize: 11, color: '#8f887f' }}>{label}</T>
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
    </View>
  );
}

export function SoonCityGroups({ cities, fontSize, color, paddingHorizontal }: { cities: SoonCity[]; fontSize: number; color: string; paddingHorizontal: number }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const { tr, intl } = soonCityGroups(cities);
  const row = (c: SoonCity) => {
    const { flag, season } = cityExtras(c, lang);
    return (
      <View key={c.id} accessibilityState={{ disabled: true }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal }}>
        <T style={{ flex: 1, fontSize, color }}>
          {c.name}
          {!!flag && ` ${flag}`}
          {!!season && <T style={{ fontSize: fontSize - 2, color, fontStyle: 'italic' }}>{`  ${season}`}</T>}
        </T>
        <View style={{ flexShrink: 0, paddingVertical: 1, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(143,136,127,0.4)' }}>
          <T style={{ fontSize: 10, color: '#8f887f' }}>{t('common.comingSoon')}</T>
        </View>
      </View>
    );
  };
  return (
    <>
      {tr.length > 0 && <><Separator label={t('common.seasonTablesTr')} />{tr.map(row)}</>}
      {intl.length > 0 && <><Separator label={t('common.seasonTablesIntl')} />{intl.map(row)}</>}
    </>
  );
}
