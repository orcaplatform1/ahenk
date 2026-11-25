// apps/web/app/admin/settings/page.tsx karşılığı (yalnız SUPERADMIN)
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { ACheck, AInput, AdminToggle } from '@/components/admin/AdminControls';
import { adm, mono } from '@/theme/theme';

// oceanGroup / oceanOneOnOne / oceanKanka: Eşleştirme Kriterleri (Planlı Buluşma'da masa türüne göre OCEAN sıralaması)
interface Settings { matchingEnabled: boolean; botSystemActive?: boolean; maintenanceMode: boolean; liveDistrictSource?: 'static' | 'real'; autoDataDeletion?: boolean; oceanGroup?: boolean; oceanOneOnOne?: boolean; oceanKanka?: boolean }
type Tab = 'general' | 'criteria';
const TABS: [Tab, string][] = [['general', 'Genel'], ['criteria', 'Eşleştirme Kriterleri']];
const OCEAN_DESC = "Yalnız Planlı Buluşma. Açık: sıralama OCEAN %100. Kapalı: yaş yakınlığı %50 + mekân kategori %50. Yarın Buluşma'da OCEAN her zaman kapalı."

// Geri kazanım indirimi: Açık / Kapalı + sabit TL + indirimin uygulanacağı paketler (AppConfig)
type PlanKey = 'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA' | 'PRIME_1M' | 'PRIME_3M' | 'PRIME_6M' | 'PRIME_12M';
const PLAN_NAME: Record<PlanKey, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla', PRIME_1M: 'Premium 1 Aylık', PRIME_3M: 'Premium 3 Aylık', PRIME_6M: 'Premium 6 Aylık', PRIME_12M: 'Premium 12 Aylık' };

function WinbackSettings() {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState('100');
  const [plans, setPlans] = useState<PlanKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api.get<{ enabled: boolean; amountTL: number; plans: PlanKey[] }>('/admin/winback').then(d => { setEnabled(d.enabled); setAmount(String(d.amountTL || 100)); setPlans(d.plans); setLoaded(true); }).catch(() => {}); }, []);
  const toggle = (p: PlanKey) => setPlans(c => (c.includes(p) ? c.filter(x => x !== p) : [...c, p]));
  async function save() { setBusy(true); setMsg(null); try { await api.patch('/admin/winback', { enabled, amountTL: Number(amount), plans }); setMsg({ ok: true, text: 'İndirim ayarları güncellendi' }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); } }
  if (!loaded) return null;
  return (
    <ACard style={{ marginTop: 20 }}>
      <ATitle style={{ marginBottom: 14 }}>Geri Kazanım İndirimi</ATitle>
      <View style={{ marginBottom: 14 }}><AdminToggle label="Açık / Kapalı" value={enabled} onChange={setEnabled} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <AT style={{ fontSize: 12, color: adm.muted }}>İndirim tutarı</AT>
        <AInput value={amount} onChangeText={t => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" style={{ width: 90, fontFamily: mono(400) }} />
        <AT style={{ fontSize: 12, color: adm.muted }}>TL</AT>
      </View>
      <AT style={{ marginBottom: 6, fontSize: 12, color: adm.muted }}>Uygulanacak paketler</AT>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        {(Object.keys(PLAN_NAME) as PlanKey[]).map(p => <ACheck key={p} label={PLAN_NAME[p]} checked={plans.includes(p)} onChange={() => toggle(p)} />)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Btn variant="admGreen" label="Kaydet" disabled={busy || !amount} onPress={save} />
        {msg && <AT style={{ fontSize: 13, color: msg.ok ? adm.green : adm.red, flexShrink: 1 }}>{msg.text}</AT>}
      </View>
    </ACard>
  );
}

export default function AdminSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('general');
  useEffect(() => { api.get<Settings>('/admin/settings').then(setS).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  async function save() {
    if (!s) return;
    setSaving(true); setError('');
    try { await api.patch('/admin/settings', { matchingEnabled: s.matchingEnabled, botSystemActive: s.botSystemActive, maintenanceMode: s.maintenanceMode, liveDistrictSource: s.liveDistrictSource, autoDataDeletion: s.autoDataDeletion, oceanGroup: s.oceanGroup, oceanOneOnOne: s.oceanOneOnOne, oceanKanka: s.oceanKanka }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
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
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {TABS.map(([v, l]) => <Btn key={v} variant="admSegment" selected={tab === v} label={l} onPress={() => setTab(v)} />)}
          </View>
          {tab === 'criteria' ? (
            <ACard style={{ gap: 16 }}>
              <AdminToggle label="OCEAN – Grup" desc={OCEAN_DESC} value={s.oceanGroup ?? true} onChange={v => upd({ oceanGroup: v })} />
              <AdminToggle label="OCEAN – Baş Başa" desc={OCEAN_DESC} value={s.oceanOneOnOne ?? false} onChange={v => upd({ oceanOneOnOne: v })} />
              <AdminToggle label="OCEAN – Kankamla" desc={OCEAN_DESC} value={s.oceanKanka ?? false} onChange={v => upd({ oceanKanka: v })} />
            </ACard>
          ) : (
          <ACard style={{ gap: 16 }}>
            <AdminToggle label="Eşleştirme Aktif" desc="Grup, baş başa ve Kankamla masa ataması yapılsın mı. Kapalıyken hak düşümü, kilit ve eşleştirme bildirimleri de durur." value={s.matchingEnabled} onChange={v => upd({ matchingEnabled: v })} />
            {s.botSystemActive !== undefined && <AdminToggle label="Bot Sistemi Aktif" desc="Eksik masalara bot ekleme" value={s.botSystemActive} onChange={v => upd({ botSystemActive: v })} />}
            <AdminToggle label="Bakım Modu" desc="Platform açık kalır; masa ataması ve paket satın alma durur, üyelere bakım uyarısı gösterilir" value={s.maintenanceMode} onChange={v => upd({ maintenanceMode: v })} />
            <AdminToggle label="Otomatik Veri Silme" desc="Her gece 03:30'da saklama süresi dolan kayıtlar silinir (ödeme kayıtları anonimleştirilir). Kapalıyken yalnız sayılır, silinmez." value={s.autoDataDeletion ?? false} onChange={v => upd({ autoDataDeletion: v })} />
            <View>
              <AT w={600} style={{ fontSize: 13 }}>Canlı katman ilçe verisi</AT>
              <AT style={{ marginTop: 2, marginBottom: 8, fontSize: 11, color: adm.muted }}>Statik: Şehirler sayfasındaki ilçe listeleri. Gerçek: üyelerin ilçe verisinden hesaplanır.</AT>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([['static', 'Statik'], ['real', 'Gerçek']] as const).map(([v, l]) => <Btn key={v} variant="admSegment" selected={(s.liveDistrictSource ?? 'static') === v} label={l} onPress={() => upd({ liveDistrictSource: v })} />)}
              </View>
            </View>
          </ACard>
          )}
          <Btn variant="admSave" selected={saved} disabled={saving} label={saving ? 'Kaydediliyor…' : saved ? 'Kaydedildi ✓' : 'Kaydet'} onPress={save} />
          {!!error && <AT style={{ marginTop: 8, fontSize: 13, color: adm.red }}>{error}</AT>}
          {tab === 'general' && <WinbackSettings />}
        </>
      )}
    </APage>
  );
}
