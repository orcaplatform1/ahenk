// Kayıt formu seçicileri: CityPickerField, SiteSelect (ilçe, aramalı), OccupationField, DateField (apps/web/app/kayit, components/BirthDateField)
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Btn, StdButton, Input, Mono, Sheet, T } from './ui';
import { c, ll } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { formatNamed, type CitySeasonFields } from '@ahenk/shared';
import { CITY_GRID, cityGridItem, cityImageOption, SoonCityGroups } from './SoonCityGroups';
import { currentLang } from '@/lib/i18n';

export function FieldLabel({ children }: { children: string }) {
  return <Mono style={{ fontSize: 11, color: ll.label, marginBottom: 6 }}>{children}</Mono>;
}

function FieldButton({ text, filled, onPress }: { text: string; filled: boolean; onPress: () => void }) {
  return (
    <Btn variant="fieldSelect" selected={filled} label={text} onPress={onPress} />
  );
}

// soon: Yakında şehirler (soluk, seçilemez; iki grup "Sezon Masaları 🇹🇷 / 🌐", components/SoonCityGroups.tsx). extra: listede adın sağındaki ek
export function ListPicker({ label, value, onChange, options, placeholder, title, searchable, searchPlaceholder, soon }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; extra?: string; cityName?: string }[]; placeholder: string; title: string; searchable?: boolean; searchPlaceholder?: string;
  soon?: (CitySeasonFields & { id: string; name: string })[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tmp, setTmp] = useState(value);
  const [q, setQ] = useState('');
  const shown = useMemo(() => options.filter(o => !q || o.label.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR'))), [options, q]);
  const found = options.find(o => o.value === value);
  return (
    <View>
      {!!label && <FieldLabel>{label}</FieldLabel>}
      <FieldButton text={found?.label ?? placeholder} filled={!!found} onPress={() => { setTmp(value); setQ(''); setOpen(true); }} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <T style={{ fontSize: 13, color: c.t888 }}>{title}</T>
          <Btn variant="closeX" accessibilityLabel={t('common.close')} label="×" onPress={() => setOpen(false)} />
        </View>
        {searchable && <Input form placeholder={searchPlaceholder} value={q} onChangeText={setQ} style={{ marginBottom: 8 }} />}
        <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
          {/* Şehir listesinde görselli şehir kare kart (satırda yan yana 2), görseli olmayan tam satır; şehir dışı listelerde düz satır */}
          <View style={CITY_GRID}>
          {shown.map(o => (
            <Btn key={o.value} variant="listOption" selected={tmp === o.value} label={o.extra ? `${o.label} ${o.extra}` : o.label} onPress={() => setTmp(o.value)}
              style={o.cityName ? cityGridItem(o.cityName) : { width: '100%' }}>
              {o.cityName ? cityImageOption(o.cityName, o.extra ? `${o.label} ${o.extra}` : o.label, tmp === o.value) : undefined}
            </Btn>
          ))}
          </View>
          {!!soon?.length && <SoonCityGroups cities={soon} fontSize={15} color="rgba(201,194,184,0.4)" paddingHorizontal={14} />}
        </ScrollView>
        <StdButton variant="primary" label={t('date.select')} full style={{ marginTop: 16 }} onPress={() => { onChange(tmp); setOpen(false); }} />
      </Sheet>
    </View>
  );
}

// Ay adları arayüz dilinde
const monthNames = () => Array.from({ length: 12 }, (_, i) => formatNamed(new Date(Date.UTC(2024, i, 15, 12)), currentLang(), { month: 'long' }, 'UTC'));
const currentYearTR = () => new Date(Date.now() + 3 * 3600 * 1000).getUTCFullYear();

function Column({ title, options, selected, onSelect }: { title: string; options: { value: number; label: string }[]; selected: number; onSelect: (v: number) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <T style={{ fontSize: 11, color: ll.label, textAlign: 'center', marginBottom: 6 }}>{title}</T>
      <ScrollView style={{ flex: 1 }}>
        {options.map(o => (
          <Btn key={o.value} variant="listOption" selected={o.value === selected} label={o.label} style={{ paddingVertical: 10 }} textStyle={{ textAlign: 'center' }} onPress={() => onSelect(o.value)} />
        ))}
      </ScrollView>
    </View>
  );
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const MONTHS = monthNames();
  const [open, setOpen] = useState(false);
  const maxYear = currentYearTR() - 18, minYear = 1965;
  const parts = value ? value.split('-').map(Number) : [0, 0, 0];
  const [y, setY] = useState(parts[0] || maxYear);
  const [m, setM] = useState(parts[1] || 1);
  const [d, setD] = useState(parts[2] || 1);
  const dim = new Date(y, m, 0).getDate();
  useEffect(() => { if (d > dim) setD(dim); }, [dim, d]);
  let display = t('date.pickBirth');
  if (value) { const [yy, mm, dd] = value.split('-').map(Number); display = `${dd} ${MONTHS[mm - 1]} ${yy}`; }
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <FieldButton text={display} filled={!!value} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <T style={{ fontSize: 13, color: ll.label }}>{t('date.pickBirth')}</T>
          <Btn variant="closeX" accessibilityLabel={t('common.close')} label="×" textStyle={{ color: ll.label }} onPress={() => setOpen(false)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, height: 220 }}>
          <Column title={t('date.day')} options={Array.from({ length: dim }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} selected={d} onSelect={setD} />
          <Column title={t('date.month')} options={MONTHS.map((x, i) => ({ value: i + 1, label: x }))} selected={m} onSelect={setM} />
          <Column title={t('date.year')} options={Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({ value: maxYear - i, label: String(maxYear - i) }))} selected={y} onSelect={setY} />
        </View>
        <StdButton variant="primary" label={t('date.select')} full style={{ marginTop: 20 }} onPress={() => { onChange(`${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`); setOpen(false); }} />
      </Sheet>
    </View>
  );
}
