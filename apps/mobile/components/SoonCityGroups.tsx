// Şehir listelerinde (kayıt + Profilim) Yakında şehirler: web components/SoonCityGroups.tsx karşılığı.
// İki grup, her grubun üstünde ayırıcı çizgi: countryCode TR ("Sezon Masaları 🇹🇷"), TR dışı ("Yeni Duraklar 📍"); ayırıcının altında ortalı,
// italik takvim satırı (Grup 1 groupSeason, yoksa "Takvim: Yakında"; Grup 2 "Takvim: Yakında"). Görseli olan şehir kare görselli kart
// (satırda yan yana 2; görsel soluk, altında ad, Grup 2'de + bayrak, ve kartın içinde "Yakında" etiketi); görseli olmayan şehir düz satır
// (ad + "Yakında" en sağda). Gruplama ve sıralama packages/shared citySeason.ts. Satırlar en az 44 pt, seçilemez.
import { Image, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { cityExtras, cityFlag, cityImage, groupSeason, soonCityGroups, type CitySeasonFields } from '@ahenk/shared';
import { SITE } from '@/lib/config';
import { btn } from '@/theme/theme';
import { currentLang } from '@/lib/i18n';
import { T } from './ui';

type SoonCity = CitySeasonFields & { id: string; name: string };

// Seçilebilir satırların etiketi için düz metin: ad, bayrak, sezon
export function cityLabelWithExtras(name: string, c: CitySeasonFields): string {
  const { flag, season } = cityExtras(c, currentLang());
  return [name, flag, season].filter(Boolean).join(' ');
}

// Şehir seçim listesi kare kartları (kayıt + Profilim; web components/SoonCityGroups.tsx CITY_GRID ile aynı): satırda yan yana 2 kart,
// satır aralığı 8, iki kart arası kalan boşluk (her kart %49); görseli olmayan şehir tam satır (cityGridItem)
export const CITY_GRID: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 };
export const cityGridItem = (name: string): ViewStyle => ({ width: cityImage(name) ? '49%' : '100%' });
const SQUARE_IMG = { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8 } as const;

// Seçilebilir şehir kartının içeriği (Btn listOption children): üstte kare şehir görseli (web kayıt / Profilim ile aynı, 1:1, köşe 8,
// cover), altında etiket; listOption yazı stilleri (seçili: kırmızı + 600). Görseli olmayan şehirde undefined (Btn düz satırı çizer)
export function cityImageOption(name: string, label: string, selected: boolean) {
  const src = cityImage(name);
  if (!src) return undefined;
  const spec = btn.listOption;
  return (
    <View>
      <Image source={{ uri: `${SITE}${src}` }} resizeMode="cover" accessibilityIgnoresInvertColors style={SQUARE_IMG} />
      <T w={selected ? 600 : 400} style={[{ fontSize: spec.text.fontSize, color: spec.text.color }, selected && { color: spec.on.text.color }]}>{label}</T>
    </View>
  );
}

function Separator({ label, schedule }: { label: string; schedule: string }) {
  return (
    <View style={{ marginTop: 10, marginBottom: 6, marginHorizontal: 4 }}>
      <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
        <T style={{ fontSize: 11, color: '#8f887f' }}>{label}</T>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
      </View>
      <T style={{ marginTop: 2, textAlign: 'center', fontStyle: 'italic', fontSize: 11, color: '#8f887f' }}>{schedule}</T>
    </View>
  );
}

export function SoonCityGroups({ cities, fontSize, color, paddingHorizontal }: { cities: SoonCity[]; fontSize: number; color: string; paddingHorizontal: number }) {
  const { t } = useTranslation();
  const lang = currentLang();
  const { tr, intl } = soonCityGroups(cities);
  const trRange = groupSeason(tr, lang);
  const schedule = (range: string) => (range ? t('common.scheduleRange', { range }) : t('common.scheduleSoon'));
  const soonTag = (
    <View style={{ flexShrink: 0, paddingVertical: 1, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(143,136,127,0.4)' }}>
      <T style={{ fontSize: 10, color: '#8f887f' }}>{t('common.comingSoon')}</T>
    </View>
  );
  const row = (c: SoonCity) => {
    const flag = cityFlag(c);
    const img = cityImage(c.name);
    const name = (
      <T style={{ flex: img ? undefined : 1, flexShrink: 1, fontSize, color }}>
        {c.name}
        {!!flag && ` ${flag}`}
      </T>
    );
    if (!img) return (
      <View key={c.id} accessibilityState={{ disabled: true }} style={{ width: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal }}>
        {name}{soonTag}
      </View>
    );
    // Kare kart: soluk görsel, altında ad + "Yakında" etiketi (dar kartta etiket alt satıra iner); tek erişilebilirlik öğesi, seçilemez
    return (
      <View key={c.id} accessible accessibilityLabel={`${c.name}${flag ? ` ${flag}` : ''}, ${t('common.comingSoon')}`} accessibilityState={{ disabled: true }}
        style={[cityGridItem(c.name), { paddingVertical: 13, paddingHorizontal, borderRadius: 8 }]}>
        <Image source={{ uri: `${SITE}${img}` }} resizeMode="cover" accessibilityIgnoresInvertColors style={[SQUARE_IMG, { opacity: 0.4 }]} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>{name}{soonTag}</View>
      </View>
    );
  };
  return (
    <>
      {tr.length > 0 && <><Separator label={t('common.seasonTablesTr')} schedule={schedule(trRange)} /><View style={CITY_GRID}>{tr.map(row)}</View></>}
      {intl.length > 0 && <><Separator label={t('common.seasonTablesIntl')} schedule={schedule('')} /><View style={CITY_GRID}>{intl.map(row)}</View></>}
    </>
  );
}
