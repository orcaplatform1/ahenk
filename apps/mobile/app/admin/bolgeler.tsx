// apps/web/app/admin/bolgeler/page.tsx karşılığı (ADMIN + SUPERADMIN). Türkçe kalır (yönetim paneli).
// Bölge = şehir ayarları (ülke, saat dilimi, para birimi, varsayılan dil, telefon kodu, kimlik türleri, sıra), tek tuşla Aktif / Pasif / Yakında
// Aktif yapılan bölge kullanıcı şehir listelerinde üst gruba geçer.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { ACheck, AdminSelect, AInput } from '@/components/admin/AdminControls';
import { adm } from '@/theme/theme';

type IdType = 'ID_CARD' | 'DRIVER_LICENSE' | 'PASSPORT' | 'RESIDENCE_PERMIT';
interface Region {
  id: string; name: string; isActive: boolean; isComingSoon?: boolean; countryCode: string; timezone: string; currency: string;
  defaultLanguage: string; phoneCountryCode: string; idTypes: IdType[]; sortOrder: number;
}

// Durum: Aktif / Pasif / Yakında — web admin/bolgeler ile aynı
type RegionStatus = 'ACTIVE' | 'PASSIVE' | 'COMING_SOON';
const statusOf = (r: Region): RegionStatus => (r.isActive ? 'ACTIVE' : r.isComingSoon ? 'COMING_SOON' : 'PASSIVE');
const STATUS_LABELS: Record<RegionStatus, string> = { ACTIVE: 'Aktif', PASSIVE: 'Pasif', COMING_SOON: 'Yakında' };
const ID_LABEL: Record<IdType, string> = { ID_CARD: 'Kimlik Kartı', DRIVER_LICENSE: 'Ehliyet', PASSPORT: 'Pasaport', RESIDENCE_PERMIT: 'Oturma İzni' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ gap: 4 }}><ALabel style={{ color: adm.muted }}>{label}</ALabel>{children}</View>;
}

function RegionEditor({ r, onSaved }: { r: Region; onSaved: () => void }) {
  const [f, setF] = useState({ name: r.name, countryCode: r.countryCode, timezone: r.timezone, currency: r.currency, defaultLanguage: r.defaultLanguage, phoneCountryCode: r.phoneCountryCode, idTypes: r.idTypes, sortOrder: String(r.sortOrder) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    setBusy(true); setErr('');
    try { await api.patch(`/admin/regions/${r.id}`, { ...f, sortOrder: Number(f.sortOrder) || 0 }); onSaved(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      <Field label="Ad"><AInput value={f.name} onChangeText={(v) => set('name', v)} style={{ paddingHorizontal: 12 }} /></Field>
      <Field label="Ülke kodu"><AInput value={f.countryCode} maxLength={2} autoCapitalize="characters" onChangeText={(v) => set('countryCode', v.toUpperCase())} style={{ paddingHorizontal: 12 }} /></Field>
      <Field label="Saat dilimi"><AInput value={f.timezone} autoCapitalize="none" onChangeText={(v) => set('timezone', v)} style={{ paddingHorizontal: 12 }} /></Field>
      <Field label="Para birimi"><AdminSelect value={f.currency} onChange={(v) => set('currency', v)} options={[{ value: 'TRY', label: 'TRY' }, { value: 'USD', label: 'USD' }]} placeholder="Para birimi" /></Field>
      <Field label="Varsayılan dil"><AdminSelect value={f.defaultLanguage} onChange={(v) => set('defaultLanguage', v)} options={[{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }]} placeholder="Varsayılan dil" /></Field>
      <Field label="Telefon kodu"><AInput value={f.phoneCountryCode} onChangeText={(v) => set('phoneCountryCode', v)} style={{ paddingHorizontal: 12 }} /></Field>
      <Field label="Sıra"><AInput value={f.sortOrder} keyboardType="number-pad" onChangeText={(v) => set('sortOrder', v.replace(/[^\d-]/g, ''))} style={{ paddingHorizontal: 12 }} /></Field>
      <Field label="Belge türleri">
        <View style={{ gap: 4 }}>
          {(['ID_CARD', 'DRIVER_LICENSE', 'PASSPORT', 'RESIDENCE_PERMIT'] as IdType[]).map((it) => (
            <ACheck key={it} label={ID_LABEL[it]} checked={f.idTypes.includes(it)} onChange={() => set('idTypes', f.idTypes.includes(it) ? f.idTypes.filter((x) => x !== it) : [...f.idTypes, it])} />
          ))}
        </View>
      </Field>
      {!!err && <AT style={{ fontSize: 12, color: adm.red }}>{err}</AT>}
      <Btn variant="admCyanFull" disabled={busy} label={busy ? '…' : 'Kaydet'} onPress={save} />
    </View>
  );
}

export default function AdminBolgeler() {
  const [rows, setRows] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const load = () => { api.get<Region[]>('/admin/regions').then(setRows).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);

  async function setStatus(r: Region, status: RegionStatus) {
    if (statusOf(r) === status) return;
    setToggling(r.id); setError('');
    try { await api.patch(`/admin/regions/${r.id}`, { status }); load(); } catch (e) { setError((e as Error).message); } finally { setToggling(null); }
  }

  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 8 }}><ATitle>Bölgeler</ATitle></View>
      <AT style={{ fontSize: 12, color: adm.muted, marginBottom: 16 }}>Aktif bölgeler kullanıcı şehir listelerinde seçilebilir; Yakında bölgeler &quot;Yakında&quot; grubunda seçilemez görünür; pasif bölgeler listelerde görünmez.</AT>
      <AError>{error}</AError>
      {loading ? <View style={{ gap: 6 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 64, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
        : rows.map((r) => (
          <ACard key={r.id} style={{ marginBottom: 10 }}>
            <AT w={600} style={{ fontSize: 14 }}>{r.name}</AT>
            <AMono style={{ fontSize: 11, color: adm.muted, marginTop: 3 }}>{r.countryCode} · {r.timezone} · {r.currency} · {r.defaultLanguage} · {r.phoneCountryCode} · sıra {r.sortOrder}</AMono>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {(['ACTIVE', 'PASSIVE', 'COMING_SOON'] as RegionStatus[]).map((st) => (
                <Btn key={st} variant="admActivate" selected={statusOf(r) === st} disabled={toggling === r.id} label={toggling === r.id ? '…' : STATUS_LABELS[st]} onPress={() => setStatus(r, st)} />
              ))}
              <Btn variant="admActivate" selected={open === r.id} label={open === r.id ? 'Kapat' : 'Düzenle'} onPress={() => setOpen(open === r.id ? null : r.id)} />
            </View>
            {open === r.id && <RegionEditor r={r} onSaved={() => { setOpen(null); load(); }} />}
          </ACard>
        ))}
    </APage>
  );
}
