// apps/web/app/admin/settings/page.tsx karşılığı (yalnız SUPERADMIN)
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminToggle } from '@/components/admin/AdminControls';
import { adm } from '@/theme/theme';

interface Settings { matchingEnabled: boolean; botSystemActive?: boolean; maintenanceMode: boolean; liveDistrictSource?: 'static' | 'real' }

export default function AdminSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.get<Settings>('/admin/settings').then(setS).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  async function save() {
    if (!s) return;
    setSaving(true); setError('');
    try { await api.patch('/admin/settings', { matchingEnabled: s.matchingEnabled, botSystemActive: s.botSystemActive, maintenanceMode: s.maintenanceMode, liveDistrictSource: s.liveDistrictSource }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { setError(`Kaydedilemedi: ${(e as Error).message}`); } finally { setSaving(false); }
  }
  const upd = (p: Partial<Settings>) => setS(x => (x ? { ...x, ...p } : x));
  return (
    <APage maxWidth={520}>
      <View style={{ marginBottom: 24 }}><ATitle>Sistem Ayarları</ATitle></View>
      {loading ? (
        <ACard style={{ gap: 10 }}>{[0, 1, 2, 3].map(i => <View key={i} style={{ height: 48, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</ACard>
      ) : !s ? (
        <ACard style={{ alignItems: 'center' }}><AT style={{ fontSize: 13, color: adm.muted }}>Ayarlar yüklenemedi.{error ? ` ${error}` : ''}</AT></ACard>
      ) : (
        <>
          <ACard style={{ gap: 16 }}>
            <AdminToggle label="Eşleştirme Aktif" desc="Grup ve başbaşa masa ataması yapılsın mı" value={s.matchingEnabled} onChange={v => upd({ matchingEnabled: v })} />
            {s.botSystemActive !== undefined && <AdminToggle label="Bot Sistemi Aktif" desc="Eksik masalara bot ekleme" value={s.botSystemActive} onChange={v => upd({ botSystemActive: v })} />}
            <AdminToggle label="Bakım Modu" desc="Platform açık kalır; masa ataması ve paket satın alma durur, üyelere bakım uyarısı gösterilir" value={s.maintenanceMode} onChange={v => upd({ maintenanceMode: v })} />
            <View>
              <AT w={600} style={{ fontSize: 13 }}>Canlı katman ilçe verisi</AT>
              <AT style={{ marginTop: 2, marginBottom: 8, fontSize: 11, color: adm.muted }}>Statik: İstanbul yoğunluk tablosu. Gerçek: üyelerin ilçe verisinden hesaplanır.</AT>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([['static', 'Statik'], ['real', 'Gerçek']] as const).map(([v, l]) => <Btn key={v} variant="admSegment" selected={(s.liveDistrictSource ?? 'static') === v} label={l} onPress={() => upd({ liveDistrictSource: v })} />)}
              </View>
            </View>
          </ACard>
          <Btn variant="admSave" selected={saved} disabled={saving} label={saving ? 'Kaydediliyor…' : saved ? 'Kaydedildi ✓' : 'Kaydet'} onPress={save} />
          {!!error && <AT style={{ marginTop: 8, fontSize: 13, color: adm.red }}>{error}</AT>}
        </>
      )}
    </APage>
  );
}
