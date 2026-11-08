// apps/web/components/AdminSelect.tsx, AdminDatePicker.tsx karşılıkları + admin metin girişi ve sayfalama
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Btn } from '../ui';
import { ALabel, AT } from './AdminUi';
import { adm, admToggle, llCard, sans } from '@/theme/theme';

export interface AdminSelectOption { value: string; label: string; group?: string }

function Dialog({ visible, onClose, title, children, pad = true }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; pad?: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 360, maxHeight: '75%', borderRadius: llCard.radius, borderWidth: 1, borderColor: adm.border, backgroundColor: adm.card, padding: pad ? llCard.padding : 0, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 32, shadowOffset: { width: 0, height: 24 } }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, ...(pad ? { marginBottom: 12 } : { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: adm.border }) }}>
            <AT w={700} style={{ fontSize: 13 }}>{title}</AT>
            <Btn variant="admX" label="✕" accessibilityLabel="Kapat" onPress={onClose} />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AdminSelect({ value, onChange, options, placeholder, title, style }: { value: string; onChange: (v: string) => void; options: AdminSelectOption[]; placeholder: string; title?: string; style?: StyleProp<ViewStyle> }) {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.value === value);
  return (
    <>
      <Btn variant="admSelect" selected={!!sel} accessibilityLabel={title ?? placeholder} style={style} onPress={() => setOpen(true)}>
        <AT numberOfLines={1} style={{ flex: 1, fontSize: 13, color: sel ? adm.text : adm.muted }}>{sel ? sel.label : placeholder}</AT>
        <AT style={{ color: adm.muted, fontSize: 10 }}>▾</AT>
      </Btn>
      <Dialog visible={open} onClose={() => setOpen(false)} title={title ?? placeholder} pad={false}>
        <ScrollView contentContainerStyle={{ padding: 6 }}>
          {options.map((o, i) => (
            <View key={o.value || '__empty'}>
              {!!o.group && o.group !== options[i - 1]?.group && <ALabel style={{ marginTop: 10, marginHorizontal: 10, marginBottom: 4 }}>{o.group.toLocaleUpperCase('tr-TR')}</ALabel>}
              <Btn variant="admOption" selected={o.value === value} label={o.label} onPress={() => { onChange(o.value); setOpen(false); }} />
            </View>
          ))}
        </ScrollView>
      </Dialog>
    </>
  );
}

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const currentYearTR = () => new Date(Date.now() + 3 * 3600 * 1000).getUTCFullYear();

function Col({ title, options, selected, onSelect }: { title: string; options: { value: number; label: string }[]; selected: number; onSelect: (v: number) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <ALabel style={{ textAlign: 'center', marginBottom: 8 }}>{title}</ALabel>
      <ScrollView>{options.map(o => <Btn key={o.value} variant="admDateOption" selected={o.value === selected} label={o.label} onPress={() => onSelect(o.value)} />)}</ScrollView>
    </View>
  );
}

export function AdminDatePicker({ value, onChange, placeholder = 'Doğum tarihi', title = 'Doğum tarihi seç', minYear = 1965, maxYear: maxYearProp, clearable = false, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; title?: string; minYear?: number; maxYear?: number; clearable?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const maxYear = maxYearProp ?? currentYearTR() - 18;
  const [y, setY] = useState(maxYear); const [m, setM] = useState(1); const [d, setD] = useState(1);
  const dim = new Date(y, m, 0).getDate();
  useEffect(() => { if (d > dim) setD(dim); }, [dim, d]);
  function openPicker() { const p = value ? value.split('-').map(Number) : [0, 0, 0]; setY(p[0] || maxYear); setM(p[1] || 1); setD(p[2] || 1); setOpen(true); }
  const display = value ? value.split('-').reverse().join('.') : '';
  return (
    <>
      <Btn variant="admSelect" selected={!!display} label={display || placeholder} style={style} onPress={openPicker} />
      <Dialog visible={open} onClose={() => setOpen(false)} title={title}>
        <View style={{ flexDirection: 'row', gap: 6, height: 220 }}>
          <Col title="GÜN" options={Array.from({ length: dim }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} selected={d} onSelect={setD} />
          <Col title="AY" options={MONTHS_TR.map((x, i) => ({ value: i + 1, label: x }))} selected={m} onSelect={setM} />
          <Col title="YIL" options={Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({ value: maxYear - i, label: String(maxYear - i) }))} selected={y} onSelect={setY} />
        </View>
        <Btn variant="admCyan" label="Seç" onPress={() => { onChange(`${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`); setOpen(false); }} />
        {clearable && !!value && <Btn variant="admOutline" label="Temizle" onPress={() => { onChange(''); setOpen(false); }} />}
      </Dialog>
    </>
  );
}

// Admin metin girişi (web: background BG, border, radius 8, padding 7/10-12, 13px)
export function AInput({ style, ...rest }: TextInputProps) {
  return <TextInput placeholderTextColor={adm.muted} keyboardAppearance="dark" {...rest}
    style={[{ backgroundColor: adm.bg, borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, fontSize: 13, color: adm.text, fontFamily: sans(400), minHeight: 36 }, style]} />;
}

export function APager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
      <Btn variant="admPager" label="← Önceki" disabled={page === 1} onPress={() => onPage(Math.max(1, page - 1))} />
      <ALabel style={{ fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 0 }}>{page} / {totalPages} · {total} kayıt</ALabel>
      <Btn variant="admPager" label="Sonraki →" disabled={page === totalPages} onPress={() => onPage(Math.min(totalPages, page + 1))} />
    </View>
  );
}

// apps/web/app/admin/settings Toggle
export function AdminToggle({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = admToggle;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <View style={{ flex: 1 }}>
        <AT w={600} style={{ fontSize: 13 }}>{label}</AT>
        {!!desc && <AT style={{ marginTop: 3, fontSize: 10, color: adm.muted }}>{desc}</AT>}
      </View>
      <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} hitSlop={10}
        style={{ width: t.width, height: t.height, borderRadius: 99, backgroundColor: value ? t.onBg : t.offBg, borderWidth: 1, borderColor: value ? t.onBg : t.offBorder }}>
        <View style={{ position: 'absolute', top: t.inset - 1, left: (value ? t.travel : 0) + t.inset - 1, width: t.knob, height: t.knob, borderRadius: t.knob / 2, backgroundColor: '#fff' }} />
      </Pressable>
    </View>
  );
}

// Onay kutusu (web input type=checkbox) + etiket
export function ACheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <Btn variant="admCheck" selected={checked} accessibilityLabel={label} onPress={onChange}>
      <View style={{ width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: checked ? adm.blue : adm.muted, backgroundColor: checked ? adm.blue : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <AT w={700} style={{ fontSize: 10, color: '#fff' }}>✓</AT>}
      </View>
      <AT style={{ fontSize: 13 }}>{label}</AT>
    </Btn>
  );
}
