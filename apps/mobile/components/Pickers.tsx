// Kayıt formu seçicileri: CityPickerField, SiteSelect (ilçe, aramalı), OccupationField, DateField (apps/web/app/kayit, components/BirthDateField)
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Btn, StdButton, Input, Mono, Sheet, T } from './ui';
import { c, ll } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { formatNamed } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';

export function FieldLabel({ children }: { children: string }) {
  return <Mono style={{ fontSize: 11, color: ll.label, marginBottom: 6 }}>{children}</Mono>;
}

function FieldButton({ text, filled, onPress }: { text: string; filled: boolean; onPress: () => void }) {
  return (
    <Btn variant="fieldSelect" selected={filled} label={text} onPress={onPress} />
  );
}

// soon: "Yakında" ayracının altındaki pasif bölgeler (soluk, seçilemez; sağda "Haber ver" — kullanıcı başına bir kez)
export function ListPicker({ label, value, onChange, options, placeholder, title, searchable, searchPlaceholder, soon, notified, onNotify }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; title: string; searchable?: boolean; searchPlaceholder?: string;
  soon?: { value: string; label: string }[]; notified?: string[]; onNotify?: (v: string) => void;
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
          {shown.map(o => (
            <Btn key={o.value} variant="listOption" selected={tmp === o.value} label={o.label} onPress={() => setTmp(o.value)} />
          ))}
          {!!soon?.length && (
            <>
              <View accessibilityRole="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10, marginHorizontal: 4 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                <T style={{ fontSize: 11, color: '#8f887f' }}>{t('common.comingSoon')}</T>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
              </View>
              {soon.map((o) => {
                const done = !!notified?.includes(o.value);
                return (
                  <View key={o.value} accessibilityState={{ disabled: true }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6, paddingHorizontal: 14, minHeight: 44 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}><T style={{ fontSize: 15, color: 'rgba(201,194,184,0.4)' }}>{o.label}</T><View style={{ paddingVertical: 1, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(143,136,127,0.4)' }}><T style={{ fontSize: 10, color: '#8f887f' }}>{t('common.comingSoon')}</T></View></View>
                    {onNotify && (
                      <Pressable disabled={done} onPress={() => onNotify(o.value)} accessibilityRole="button" hitSlop={6}
                        style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(192,57,43,0.5)', backgroundColor: done ? 'transparent' : 'rgba(192,57,43,0.10)' }}>
                        <T style={{ fontSize: 11, color: done ? '#8f887f' : '#ff6b6b' }}>{done ? t('common.notified') : t('common.notifyMe')}</T>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </>
          )}
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
