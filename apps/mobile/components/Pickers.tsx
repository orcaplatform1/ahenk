// Kayıt formu seçicileri: CityPickerField, SiteSelect (ilçe, aramalı), OccupationField, DateField (apps/web/app/kayit, components/BirthDateField)
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { BtnPrimary, HIT, Input, Mono, Sheet, T } from './ui';
import { c, ll, tw } from '@/theme/theme';

export function FieldLabel({ children }: { children: string }) {
  return <Mono style={{ fontSize: 11, color: ll.label, marginBottom: 6 }}>{children}</Mono>;
}

function FieldButton({ text, filled, onPress }: { text: string; filled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 44 }}>
      <T style={{ fontSize: 13, color: filled ? tw.text : ll.label }}>{text}</T>
    </Pressable>
  );
}

export function ListPicker({ label, value, onChange, options, placeholder, title, searchable, searchPlaceholder }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; title: string; searchable?: boolean; searchPlaceholder?: string;
}) {
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
          <Pressable hitSlop={HIT} onPress={() => setOpen(false)}><T style={{ color: c.t555, fontSize: 20 }}>×</T></Pressable>
        </View>
        {searchable && <Input form placeholder={searchPlaceholder} value={q} onChangeText={setQ} style={{ marginBottom: 8 }} />}
        <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
          {shown.map(o => (
            <Pressable key={o.value} onPress={() => setTmp(o.value)} style={{ paddingVertical: 13, paddingHorizontal: 14, borderRadius: 8, backgroundColor: tmp === o.value ? 'rgba(192,57,43,0.12)' : 'transparent' }}>
              <T w={tmp === o.value ? 600 : 400} style={{ fontSize: 15, color: tmp === o.value ? tw.accent : c.tCcc }}>{o.label}</T>
            </Pressable>
          ))}
        </ScrollView>
        <BtnPrimary label="Seç" full style={{ marginTop: 16 }} onPress={() => { onChange(tmp); setOpen(false); }} />
      </Sheet>
    </View>
  );
}

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const currentYearTR = () => new Date(Date.now() + 3 * 3600 * 1000).getUTCFullYear();

function Column({ title, options, selected, onSelect }: { title: string; options: { value: number; label: string }[]; selected: number; onSelect: (v: number) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <T style={{ fontSize: 11, color: ll.label, textAlign: 'center', marginBottom: 6 }}>{title}</T>
      <ScrollView style={{ flex: 1 }}>
        {options.map(o => (
          <Pressable key={o.value} onPress={() => onSelect(o.value)} style={{ paddingVertical: 10, borderRadius: 8, backgroundColor: o.value === selected ? 'rgba(192,57,43,0.12)' : 'transparent' }}>
            <T w={o.value === selected ? 600 : 400} style={{ fontSize: 15, textAlign: 'center', color: o.value === selected ? tw.accent : c.tCcc }}>{o.label}</T>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const maxYear = currentYearTR() - 18, minYear = 1965;
  const parts = value ? value.split('-').map(Number) : [0, 0, 0];
  const [y, setY] = useState(parts[0] || maxYear);
  const [m, setM] = useState(parts[1] || 1);
  const [d, setD] = useState(parts[2] || 1);
  const dim = new Date(y, m, 0).getDate();
  useEffect(() => { if (d > dim) setD(dim); }, [dim, d]);
  let display = 'Doğum tarihi seç';
  if (value) { const [yy, mm, dd] = value.split('-').map(Number); display = `${dd} ${MONTHS_TR[mm - 1]} ${yy}`; }
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <FieldButton text={display} filled={!!value} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <T style={{ fontSize: 13, color: ll.label }}>Doğum tarihi seç</T>
          <Pressable hitSlop={HIT} onPress={() => setOpen(false)}><T style={{ color: ll.label, fontSize: 20 }}>×</T></Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, height: 220 }}>
          <Column title="Gün" options={Array.from({ length: dim }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} selected={d} onSelect={setD} />
          <Column title="Ay" options={MONTHS_TR.map((x, i) => ({ value: i + 1, label: x }))} selected={m} onSelect={setM} />
          <Column title="Yıl" options={Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({ value: maxYear - i, label: String(maxYear - i) }))} selected={y} onSelect={setY} />
        </View>
        <BtnPrimary label="Seç" full style={{ marginTop: 20 }} onPress={() => { onChange(`${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`); setOpen(false); }} />
      </Sheet>
    </View>
  );
}
