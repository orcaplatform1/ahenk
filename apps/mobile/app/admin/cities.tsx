// apps/web/app/admin/cities/page.tsx karşılığı (yalnız SUPERADMIN)
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AInput } from '@/components/admin/AdminControls';
import { ADialog } from '@/components/admin/ADialog';
import { adm } from '@/theme/theme';

interface City { id: string; name: string; isActive: boolean; _count?: { venues: number } }

export default function AdminCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const load = () => { api.get<City[]>('/admin/cities').then(setCities).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  async function save() {
    setSaving(true); setError('');
    try { await api.post('/admin/cities', { name: name.trim() }); setModal(false); load(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  async function toggle(c: City) {
    setToggling(c.id); setError('');
    try { await api.patch(`/admin/cities/${c.id}`, { isActive: !c.isActive }); setCities(p => p.map(x => (x.id === c.id ? { ...x, isActive: !c.isActive } : x))); } catch (e) { setError((e as Error).message); } finally { setToggling(null); }
  }
  const pill = (on: boolean) => ({ paddingVertical: 1, paddingHorizontal: 6, borderRadius: 99, overflow: 'hidden' as const, borderWidth: 1, backgroundColor: on ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)', borderColor: on ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.25)', color: on ? adm.green : adm.muted });
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ATitle>Şehirler</ATitle>
        <Btn variant="admAdd" label="+ Şehir Ekle" onPress={() => { setName(''); setError(''); setModal(true); }} />
      </View>
      {!modal && <AError>{error}</AError>}
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ATitle>Şehirler</ATitle>
          {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{cities.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 48, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : cities.length === 0 ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Şehir yok</AT></View>
          : cities.map((c, i) => (
            <View key={c.id} style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: i < cities.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <AT w={600} style={{ fontSize: 13 }}>{c.name}</AT>
                  <ALabel style={pill(c.isActive)}>{c.isActive ? 'AKTİF' : 'PASİF'}</ALabel>
                </View>
                <AT style={{ fontSize: 10, color: adm.muted }}>{c._count ? `${c._count.venues} mekan` : ''}</AT>
              </View>
              <Btn variant="admActivate" selected={c.isActive} disabled={toggling === c.id} label={toggling === c.id ? '…' : c.isActive ? 'Pasifleştir' : 'Aktifleştir'} onPress={() => toggle(c)} />
            </View>
          ))}
      </ACard>
      <ADialog visible={modal} onClose={() => setModal(false)} title="Yeni Şehir">
        <View style={{ gap: 10 }}>
          <AInput value={name} onChangeText={setName} placeholder="Şehir adı" style={{ paddingHorizontal: 12 }} />
          {!!error && <AT style={{ fontSize: 11, color: adm.red }}>{error}</AT>}
          <Btn variant="admCyanFull" disabled={saving || name.trim().length < 2} label={saving ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} />
        </View>
      </ADialog>
    </APage>
  );
}
