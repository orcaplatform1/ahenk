// apps/web/app/admin/fiyatlar/page.tsx karşılığı (yalnız SUPERADMIN)
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATableRow, ATitle } from '@/components/admin/AdminUi';
import { ACheck, AInput } from '@/components/admin/AdminControls';
import { ADialog } from '@/components/admin/ADialog';
import { StatusPill } from '@/components/admin/StatusPill';
import { adm, mono } from '@/theme/theme';

type PlanKey = 'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA' | 'PRIME_1M' | 'PRIME_3M' | 'PRIME_6M' | 'PRIME_12M';
interface CurrentPrice { plan: PlanKey; name: string; netKurus: number; webKurus: number; mobileKurus: number; webDiscountKurus: number; mobileDiscountKurus: number; updatedAt: string }
interface HistoryRow { plan: PlanKey; netKurus: number; webKurus: number; mobileKurus: number; createdAt: string; createdBy: { profile: { firstName: string; lastName: string } | null } | null }
interface PricesResponse { current: CurrentPrice[]; history: HistoryRow[] }
const roundTL = (k: number) => Math.round(k / 100) * 100;
function compute(net: number) { const web = roundTL(net * 1.2); const mobile = roundTL((net * 1.2) / 0.85); return { web, mobile, webDiscount: roundTL(web * 0.9), mobileDiscount: roundTL(mobile * 0.9) }; }
const tl = (k: number) => `${(k / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;
function parseNet(v: string): number | null { const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) && n >= 1 ? Math.round(n * 100) : null; }
const PLAN_NAME: Record<PlanKey, string> = { MASADA: 'Grup', KARSIMDA: 'Başbaşa', ICERDE: 'İçerde', KANKAMLA: 'Kankamla', PRIME_1M: 'Prime 1 Aylık', PRIME_3M: 'Prime 3 Aylık', PRIME_6M: 'Prime 6 Aylık', PRIME_12M: 'Prime 12 Aylık' };
const PLAN_RIGHTS: Record<PlanKey, string> = { MASADA: '1 grup buluşması', KARSIMDA: '1 başbaşa buluşması', ICERDE: '1 grup + 1 başbaşa buluşması', KANKAMLA: '1 Kankamla buluşması (kanka ücretsiz)', PRIME_1M: 'her 30 günde 1 grup + 1 başbaşa + 1 kankamla', PRIME_3M: 'her 30 günde 1 grup + 1 başbaşa + 1 kankamla', PRIME_6M: 'her 30 günde 1 grup + 1 başbaşa + 1 kankamla', PRIME_12M: 'her 30 günde 1 grup + 1 başbaşa + 1 kankamla' };

function WinbackSettings() {
  const [amount, setAmount] = useState('');
  const [plans, setPlans] = useState<PlanKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api.get<{ amountTL: number; plans: PlanKey[] }>('/admin/winback').then(d => { setAmount(String(d.amountTL)); setPlans(d.plans); }).catch((e: Error) => setMsg({ ok: false, text: e.message })); }, []);
  const toggle = (p: PlanKey) => setPlans(c => (c.includes(p) ? c.filter(x => x !== p) : [...c, p]));
  async function save() { setBusy(true); setMsg(null); try { await api.patch('/admin/winback', { amountTL: Number(amount), plans }); setMsg({ ok: true, text: 'İndirim ayarları güncellendi' }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); } }
  return (
    <ACard style={{ marginTop: 20 }}>
      <ATitle style={{ marginBottom: 10 }}>Geri Kazanım İndirimi</ATitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <AT style={{ fontSize: 12, color: adm.muted }}>İndirim tutarı</AT>
        <AInput value={amount} onChangeText={t => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" style={{ width: 90, fontFamily: mono(400) }} />
        <AT style={{ fontSize: 12, color: adm.muted }}>₺</AT>
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

export default function AdminFiyatlar() {
  const [fitW, setFitW] = useState(0);
  const fitCols = fitW ? Math.max(1, Math.floor((fitW + 8) / 158)) : 2;
  const fitCell = fitW ? (fitW - 8 * (fitCols - 1)) / fitCols : '47%';
  const [data, setData] = useState<PricesResponse | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const apply = (d: PricesResponse) => { setData(d); setInputs(Object.fromEntries(d.current.map(c => [c.plan, (c.netKurus / 100).toFixed(2).replace('.', ',')]))); };
  useEffect(() => { api.get<PricesResponse>('/admin/prices').then(apply).catch((e: Error) => setError(`Fiyatlar yüklenemedi: ${e.message}`)); }, []);
  const changes = (data?.current ?? []).map(c => ({ c, net: parseNet(inputs[c.plan] ?? '') })).filter(({ c, net }) => net !== null && net !== c.netKurus) as { c: CurrentPrice; net: number }[];
  const invalid = (data?.current ?? []).some(c => parseNet(inputs[c.plan] ?? '') === null);
  async function save() {
    setSaving(true); setError('');
    try { const d = await api.patch<PricesResponse>('/admin/prices', { prices: changes.map(({ c, net }) => ({ plan: c.plan, netKurus: net })) }); apply(d); setConfirm(false); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    catch (e) { setError(`Kaydedilemedi: ${(e as Error).message}`); } finally { setSaving(false); }
  }
  return (
    <APage maxWidth={900}>
      <ATitle style={{ marginBottom: 14 }}>Paket Fiyatları</ATitle>
      <ACard style={{ marginBottom: 20 }}>
        <ATitle style={{ marginBottom: 6 }}>Not</ATitle>
        <AT style={{ fontSize: 13, color: adm.muted, lineHeight: 20.8 }}>
          Ham fiyat (KDV hariç) girin. Web fiyatı = ham + %20 KDV. Mobil fiyat = ham + %20 KDV, %15 mağaza komisyonu dahil (÷ 0,85). Davet indirimi %10. Tüm fiyatlar tam TL&apos;ye yuvarlanır. Paketler tek seferlik; yeni fiyat sadece bundan sonraki satın almalarda geçerli olur.
        </AT>
      </ACard>
      <AError>{error}</AError>
      <View style={{ gap: 12 }}>
        {(data?.current ?? []).map(c => {
          const net = parseNet(inputs[c.plan] ?? ''); const p = net !== null ? compute(net) : null; const changed = net !== null && net !== c.netKurus;
          return (
            <ACard key={c.plan} style={{ borderColor: changed ? 'rgba(245,158,11,0.5)' : adm.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <AT w={700} style={{ fontSize: 14, minWidth: 80 }}>{c.name}</AT>
                <StatusPill text="Tek Seferlik" color="#93c5fd" bg="rgba(59,130,246,0.1)" border="rgba(59,130,246,0.25)" pad={[2, 8]} />
                <AT style={{ fontSize: 10, color: adm.muted }}>{PLAN_RIGHTS[c.plan]}</AT>
                <View style={{ marginLeft: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <AT style={{ fontSize: 11, color: adm.muted }}>Ham fiyat</AT>
                  <AInput value={inputs[c.plan] ?? ''} onChangeText={t => setInputs(prev => ({ ...prev, [c.plan]: t.replace(/[^\d.,]/g, '') }))} keyboardType="decimal-pad" style={{ width: 110, fontFamily: mono(400), borderColor: net === null ? adm.red : adm.border }} />
                  <AT style={{ fontSize: 11, color: adm.muted }}>₺</AT>
                </View>
              </View>
              {p && (
                // web: grid repeat(auto-fit, minmax(150px, 1fr)), gap 8
                <View onLayout={(e) => setFitW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {([['Web (KDV dahil)', p.web, c.webKurus], ['Web indirimli', p.webDiscount, c.webDiscountKurus], ['Mobil (KDV + %15)', p.mobile, c.mobileKurus], ['Mobil indirimli', p.mobileDiscount, c.mobileDiscountKurus]] as const).map(([label, now, old]) => (
                    <View key={label} style={{ width: fitCell, backgroundColor: adm.surface, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 }}>
                      <AT style={{ fontSize: 9, color: adm.muted, letterSpacing: 0.72 }}>{label}</AT>
                      <AMono w={700} style={{ marginTop: 2, fontSize: 15, color: now !== old ? adm.amber : adm.text }}>{tl(now)}</AMono>
                      {now !== old && <AMono style={{ fontSize: 10, textDecorationLine: 'line-through' }}>{tl(old)}</AMono>}
                    </View>
                  ))}
                </View>
              )}
            </ACard>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <Btn variant="admGreen" label="Kaydet" disabled={changes.length === 0 || invalid} onPress={() => setConfirm(true)} />
        {saved && <AT style={{ fontSize: 13, color: adm.green }}>Fiyatlar güncellendi</AT>}
      </View>
      <WinbackSettings />
      <ADialog visible={confirm} onClose={() => !saving && setConfirm(false)} title="Fiyat değişikliğini onayla" maxWidth={640}>
        <View style={{ borderWidth: 1, borderColor: adm.border, borderRadius: 8, overflow: 'hidden' }}>
          {changes.map(({ c, net }, i) => { const p = compute(net); return (
            <ATableRow key={c.plan} last={i === changes.length - 1} cells={[['Paket', c.name], ['Ham', `${tl(c.netKurus)} → ${tl(net)}`], ['Web', <AMono key="w" style={{ fontSize: 13, color: adm.text }}>{tl(c.webKurus)} → <AMono w={600} style={{ fontSize: 13, color: adm.amber }}>{tl(p.web)}</AMono></AMono>], ['Web indirimli', `${tl(c.webDiscountKurus)} → ${tl(p.webDiscount)}`], ['Mobil', `${tl(c.mobileKurus)} → ${tl(p.mobile)}`]]} />
          ); })}
        </View>
        <AT style={{ marginTop: 12, fontSize: 11, color: adm.muted, lineHeight: 16.5 }}>Yeni fiyat sadece bundan sonraki satın almalarda geçerli olur; satın alınmış paketler etkilenmez.</AT>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          <Btn variant="admGreen" style={{ flex: 1, padding: 9 }} disabled={saving} label={saving ? 'Kaydediliyor…' : 'Onayla ve uygula'} onPress={save} />
          <Btn variant="admGhost" disabled={saving} label="Vazgeç" onPress={() => setConfirm(false)} />
        </View>
      </ADialog>
      {(data?.history.length ?? 0) > 0 && (
        <View style={{ marginTop: 28 }}>
          <ALabel style={{ marginBottom: 8 }}>FİYAT GEÇMİŞİ</ALabel>
          <ACard style={{ padding: 0, overflow: 'hidden' }}>
            {data!.history.map((h, i) => (
              <ATableRow key={i} last={i === data!.history.length - 1} cells={[
                ['Tarih', new Date(h.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })], ['Paket', PLAN_NAME[h.plan]],
                ['Ham', `ham ${tl(h.netKurus)}`], ['Web', `web ${tl(h.webKurus)}`], ['Mobil', `mobil ${tl(h.mobileKurus)}`],
                ['Yapan', h.createdBy?.profile ? `${h.createdBy.profile.firstName} ${h.createdBy.profile.lastName}` : 'Başlangıç'],
              ]} />
            ))}
          </ACard>
        </View>
      )}
    </APage>
  );
}
