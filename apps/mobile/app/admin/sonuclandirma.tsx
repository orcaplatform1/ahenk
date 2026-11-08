// apps/web/app/admin/sonuclandirma/page.tsx karşılığı (yalnız SUPERADMIN). Buradan iyzico'ya istek gitmez.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AInput } from '@/components/admin/AdminControls';
import { adm } from '@/theme/theme';

interface RefundRow { id: string; userName: string; phone: string | null; refundType: string; plan: string; status: string; createdAt: string; iyzicoPaymentId: string | null; amountKurus: number }
interface PaymentRow { id: string; userName: string; phone: string | null; plan: string; status: string; amountKurus: number; iyzicoPaymentId: string | null; failureReason: string | null; createdAt: string }
interface Settlements { refunds: RefundRow[]; payments: PaymentRow[] }
const tl = (k: number) => `₺${(k / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });

function Row({ title, lines, actions }: { title: string; lines: string[]; actions: { label: string; variant: 'admOk' | 'admNo'; run: (note?: string) => Promise<void> }[] }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(fn: (note?: string) => Promise<void>) { setBusy(true); setError(''); try { await fn(note || undefined); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: adm.border }}>
      <AT w={600} style={{ fontSize: 13 }}>{title}</AT>
      {lines.filter(Boolean).map(l => <AMono key={l} style={{ marginTop: 3, fontSize: 11 }}>{l}</AMono>)}
      <AInput value={note} onChangeText={setNote} placeholder="Not (opsiyonel)" style={{ marginTop: 10, fontSize: 12, paddingHorizontal: 12 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {actions.map(a => <Btn key={a.label} variant={a.variant} disabled={busy} label={a.label} onPress={() => run(a.run)} />)}
      </View>
      {!!error && <AT style={{ marginTop: 8, fontSize: 12, color: adm.red }}>{error}</AT>}
    </View>
  );
}

export default function AdminSonuclandirma() {
  const [data, setData] = useState<Settlements | null>(null);
  const [error, setError] = useState('');
  const load = () => { api.get<Settlements>('/admin/settlements').then(d => { setData(d); setError(''); }).catch((e: Error) => setError(e.message)); };
  useEffect(load, []);
  const settleRefund = (id: string, status: string) => async (note?: string) => { await api.patch(`/admin/settlements/refunds/${id}`, { status, note }); load(); };
  const settlePayment = (id: string, status: string) => async (note?: string) => { await api.patch(`/admin/settlements/payments/${id}`, { status, note }); load(); };
  return (
    <APage maxWidth={760}>
      <ATitle style={{ marginBottom: 8 }}>İade ve Ödeme Sonuçlandırma</ATitle>
      <AT style={{ marginBottom: 20, fontSize: 13, color: adm.amber, lineHeight: 19.5 }}>Bu ekrandan iyzico&apos;ya istek gitmez, para gönderilmez. Önce iyzico panelinden sonucu kontrol edin, sonra işleyin.</AT>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18 }}><ATitle>İşleniyor Durumundaki İadeler</ATitle></View>
        {data?.refunds.length === 0 && <AT style={{ paddingHorizontal: 18, paddingBottom: 16, fontSize: 13, color: adm.muted }}>Kayıt yok.</AT>}
        {data?.refunds.map(r => (
          <Row key={r.id} title={r.userName} lines={[`${r.plan} · ${r.refundType} · ${tl(r.amountKurus)}`, `${when(r.createdAt)}${r.phone ? ` · ${r.phone}` : ''}`, `iyzico: ${r.iyzicoPaymentId ?? '—'}`]}
            actions={[{ label: 'Para İade Edildi (Onayla)', variant: 'admOk', run: settleRefund(r.id, 'APPROVED') }, { label: 'Para Çıkmadı (Reddet)', variant: 'admNo', run: settleRefund(r.id, 'REJECTED') }]} />
        ))}
      </ACard>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18 }}><ATitle>İade Bekleyen Fazla Ödemeler</ATitle></View>
        {data?.payments.length === 0 && <AT style={{ paddingHorizontal: 18, paddingBottom: 16, fontSize: 13, color: adm.muted }}>Kayıt yok.</AT>}
        {data?.payments.map(p => (
          <Row key={p.id} title={p.userName} lines={[`${p.plan} · ${tl(p.amountKurus)}`, `${when(p.createdAt)}${p.phone ? ` · ${p.phone}` : ''}`, `iyzico: ${p.iyzicoPaymentId ?? '—'}`, p.failureReason ?? '']}
            actions={[{ label: 'İade Edildi', variant: 'admOk', run: settlePayment(p.id, 'REFUNDED') }, { label: 'Başarısız (Para Çekilmedi)', variant: 'admNo', run: settlePayment(p.id, 'FAILED') }]} />
        ))}
      </ACard>
    </APage>
  );
}
