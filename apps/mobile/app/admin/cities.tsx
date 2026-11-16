// apps/web/app/admin/cities/page.tsx karşılığı (ADMIN + SUPERADMIN)
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AInput } from '@/components/admin/AdminControls';
import { ADialog } from '@/components/admin/ADialog';
import { adm } from '@/theme/theme';

interface City { id: string; name: string; isActive: boolean; isComingSoon?: boolean; _count?: { venues: number; districts?: number } }

// İlçe seviyeleri (statik moddaki şehir yoğunluğu / tarama listesi) — web admin/cities ile aynı
interface District { id: string; name: string; level: number }
const LEVEL_LABELS: Record<number, string> = { 1: '1. Çok yoğun', 2: '2. Yoğun', 3: '3. Orta', 4: '4. Düşük' };
const TONE = {
  cyan: { color: adm.cyan, bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.3)' },
  red: { color: adm.red, bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  muted: { color: adm.muted, bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
  off: { color: adm.muted, bg: 'transparent', border: 'rgba(100,116,139,0.25)' },
  green: { color: adm.green, bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
  amber: { color: adm.amber, bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
} as const;

// Şehir durumu: Aktif / Pasif / Yakında — web admin/cities ile aynı
type CityStatus = 'ACTIVE' | 'PASSIVE' | 'COMING_SOON';
const statusOf = (c: City): CityStatus => (c.isActive ? 'ACTIVE' : c.isComingSoon ? 'COMING_SOON' : 'PASSIVE');
const STATUS_LABELS: Record<CityStatus, string> = { ACTIVE: 'Aktif', PASSIVE: 'Pasif', COMING_SOON: 'Yakında' };
const STATUS_ACTIONS: Record<CityStatus, string> = { ACTIVE: 'Aktifleştir', PASSIVE: 'Pasifleştir', COMING_SOON: 'Yakında yap' };
const STATUS_ORDER: CityStatus[] = ['ACTIVE', 'PASSIVE', 'COMING_SOON'];
const STATUS_TONE: Record<CityStatus, keyof typeof TONE> = { ACTIVE: 'green', PASSIVE: 'muted', COMING_SOON: 'amber' };

function SmallBtn({ label, tone, onPress, disabled }: { label: string; tone: keyof typeof TONE; onPress: () => void; disabled?: boolean }) {
  const t = TONE[tone];
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6}
      style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg, opacity: disabled ? 0.5 : 1 }}>
      <AT style={{ fontSize: 11, color: t.color }}>{label}</AT>
    </Pressable>
  );
}

function LevelPicker({ value, onChange, disabled }: { value: number; onChange: (l: number) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {[1, 2, 3, 4].map(l => <SmallBtn key={l} label={LEVEL_LABELS[l]} tone={value === l ? 'cyan' : 'off'} disabled={disabled} onPress={() => onChange(l)} />)}
    </View>
  );
}

// Şehre basınca açılan İlçe Ekle penceresi: mevcut ilçeler, seviye değiştirme, ilçe silme, ilçe ekleme, şehir silme
function DistrictDialog({ city, onClose, onChanged }: { city: City; onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [cityName, setCityName] = useState(city.name);
  const [savedName, setSavedName] = useState(city.name);
  const load = () => { api.get<District[]>(`/admin/cities/${city.id}/districts`).then(setRows).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, [city.id]);
  async function run(key: string, fn: () => Promise<unknown>, after?: () => void) {
    setBusy(key); setError('');
    try { await fn(); load(); onChanged(); after?.(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); setConfirmDel(null); }
  }
  const add = () => run('add', () => api.post(`/admin/cities/${city.id}/districts`, { name: name.trim(), level }), () => setName(''));
  const setRowLevel = (d: District, l: number) => { if (l !== d.level) run(d.id, () => api.patch(`/admin/cities/districts/${d.id}`, { level: l })); };
  const delRow = (d: District) => run(d.id, () => api.delete(`/admin/cities/districts/${d.id}`));
  // Şehir adı: yalnız ad değişir, id aynı kalır (ilçe, mekân, kullanıcı bağları korunur)
  async function saveName() {
    const n = cityName.trim();
    setBusy('name'); setError('');
    try { await api.patch(`/admin/cities/${city.id}`, { name: n }); setSavedName(n); setCityName(n); onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  const nameDirty = cityName.trim() !== savedName && cityName.trim().length >= 2;
  async function delCity() {
    setBusy('city'); setError('');
    try { await api.delete(`/admin/cities/${city.id}`); onChanged(); onClose(); } catch (e) { setError((e as Error).message); setBusy(null); setConfirmDel(null); }
  }
  return (
    <ADialog visible onClose={onClose} title={`${savedName} · İlçe Ekle`} maxWidth={520} keyboardScroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <AInput value={cityName} onChangeText={setCityName} placeholder="Şehir adı" maxLength={60} style={{ flex: 1, paddingHorizontal: 12 }} />
        <SmallBtn label={busy === 'name' ? 'Kaydediliyor…' : 'Adı Kaydet'} tone="cyan" disabled={busy === 'name' || !nameDirty} onPress={saveName} />
      </View>
      <View style={{ gap: 8, marginBottom: 16 }}>
        <AInput value={name} onChangeText={setName} placeholder="İlçe adı" maxLength={60} style={{ paddingHorizontal: 12 }} />
        <LevelPicker value={level} onChange={setLevel} />
        <Btn variant="admCyanFull" disabled={busy === 'add' || !name.trim()} label={busy === 'add' ? 'Ekleniyor…' : '+ İlçe Ekle'} onPress={add} />
      </View>
      {!!error && <AT style={{ fontSize: 11, color: adm.red, marginBottom: 10 }}>{error}</AT>}
      <View style={{ borderTopWidth: 1, borderTopColor: adm.border, paddingTop: 10 }}>
        <ALabel style={{ color: adm.muted, marginBottom: 8 }}>MEVCUT İLÇELER ({rows.length})</ALabel>
        {loading ? <AT style={{ fontSize: 12, color: adm.muted }}>Yükleniyor…</AT>
          : rows.length === 0 ? <AT style={{ fontSize: 12, color: adm.muted }}>Henüz ilçe yok</AT>
          : rows.map(d => (
            <View key={d.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(26,58,92,0.5)', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AT w={600} style={{ flex: 1, fontSize: 13 }}>{d.name}</AT>
                {confirmDel === d.id ? (
                  <>
                    <SmallBtn label={busy === d.id ? '…' : 'Evet, sil'} tone="red" disabled={busy === d.id} onPress={() => delRow(d)} />
                    <SmallBtn label="Vazgeç" tone="muted" onPress={() => setConfirmDel(null)} />
                  </>
                ) : <SmallBtn label="Sil" tone="red" onPress={() => setConfirmDel(d.id)} />}
              </View>
              <LevelPicker value={d.level} onChange={l => setRowLevel(d, l)} disabled={busy === d.id} />
            </View>
          ))}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: adm.border, marginTop: 14, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        {confirmDel === 'city' ? (
          <>
            <AT style={{ flex: 1, fontSize: 12, color: adm.red }}>{savedName} şehri silinsin mi?</AT>
            <SmallBtn label={busy === 'city' ? '…' : 'Evet, sil'} tone="red" disabled={busy === 'city'} onPress={delCity} />
            <SmallBtn label="Vazgeç" tone="muted" onPress={() => setConfirmDel(null)} />
          </>
        ) : <SmallBtn label="Şehri Sil" tone="red" onPress={() => setConfirmDel('city')} />}
      </View>
    </ADialog>
  );
}

export default function AdminCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<CityStatus>('PASSIVE');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [districtCity, setDistrictCity] = useState<City | null>(null);
  const load = () => { api.get<City[]>('/admin/cities').then(setCities).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  async function save() {
    setSaving(true); setError('');
    try { await api.post('/admin/cities', { name: name.trim(), status }); setModal(false); load(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  async function changeStatus(c: City, st: CityStatus) {
    setToggling(c.id); setError('');
    try { await api.patch(`/admin/cities/${c.id}`, { status: st }); setCities(p => p.map(x => (x.id === c.id ? { ...x, isActive: st === 'ACTIVE', isComingSoon: st === 'COMING_SOON' } : x))); } catch (e) { setError((e as Error).message); } finally { setToggling(null); }
  }
  const PILL: Record<CityStatus, { bg: string; border: string; color: string; label: string }> = {
    ACTIVE: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', color: adm.green, label: 'AKTİF' },
    PASSIVE: { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)', color: adm.muted, label: 'PASİF' },
    COMING_SOON: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: adm.amber, label: 'YAKINDA' },
  };
  const pill = (st: CityStatus) => ({ paddingVertical: 1, paddingHorizontal: 6, borderRadius: 99, overflow: 'hidden' as const, borderWidth: 1, backgroundColor: PILL[st].bg, borderColor: PILL[st].border, color: PILL[st].color });
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <ATitle>Şehirler</ATitle>
        <Btn variant="admAdd" label="+ Şehir Ekle" onPress={() => { setName(''); setStatus('PASSIVE'); setError(''); setModal(true); }} />
      </View>
      {!modal && <AError>{error}</AError>}
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <ATitle>Şehirler</ATitle>
          {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{cities.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 48, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : cities.length === 0 ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Şehir yok</AT></View>
          : cities.map((c, i) => (
            <View key={c.id} style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: i < cities.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => setDistrictCity(c)} accessibilityRole="button" style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <AT w={600} style={{ fontSize: 13 }}>{c.name}</AT>
                  <ALabel style={pill(statusOf(c))}>{PILL[statusOf(c)].label}</ALabel>
                </View>
                <AT style={{ fontSize: 10, color: adm.muted }}>{c._count ? `${c._count.venues} mekan · ${c._count.districts ?? 0} ilçe` : ''}</AT>
              </Pressable>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {STATUS_ORDER.filter(st => st !== statusOf(c)).map(st => (
                  <SmallBtn key={st} label={toggling === c.id ? '…' : STATUS_ACTIONS[st]} tone={STATUS_TONE[st]} disabled={toggling === c.id} onPress={() => changeStatus(c, st)} />
                ))}
              </View>
            </View>
          ))}
      </ACard>
      {districtCity && <DistrictDialog city={districtCity} onClose={() => setDistrictCity(null)} onChanged={load} />}
      <ADialog visible={modal} onClose={() => setModal(false)} title="Yeni Şehir">
        <View style={{ gap: 10 }}>
          <AInput value={name} onChangeText={setName} placeholder="Şehir adı" style={{ paddingHorizontal: 12 }} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {STATUS_ORDER.map(st => (
              <View key={st} style={{ flex: 1 }}>
                <SmallBtn label={STATUS_LABELS[st]} tone={status === st ? 'cyan' : 'off'} onPress={() => setStatus(st)} />
              </View>
            ))}
          </View>
          {!!error && <AT style={{ fontSize: 11, color: adm.red }}>{error}</AT>}
          <Btn variant="admCyanFull" disabled={saving || name.trim().length < 2} label={saving ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} />
        </View>
      </ADialog>
    </APage>
  );
}
