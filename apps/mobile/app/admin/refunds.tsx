// apps/web/app/admin/refunds/page.tsx karşılığı (yalnız SUPERADMIN)
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AInput } from '@/components/admin/AdminControls';
import { adm } from '@/theme/theme';

interface RefundItem { id: string; userId: string; refundType: string; status: string; adminNote?: string; createdAt: string; refundAmountKurus?: number | null; user?: { profile?: { firstName?: string; lastName?: string } }; subscription?: { plan?: string } }
const COLOR: Record<string, string> = { PENDING: adm.amber, PROCESSING: adm.amber, APPROVED: adm.green, REJECTED: adm.red };
const BG: Record<string, string> = { PENDING: 'rgba(245,158,11,0.12)', PROCESSING: 'rgba(245,158,11,0.12)', APPROVED: 'rgba(34,197,94,0.12)', REJECTED: 'rgba(239,68,68,0.12)' };
const BORDER: Record<string, string> = { PENDING: 'rgba(245,158,11,0.35)', PROCESSING: 'rgba(245,158,11,0.35)', APPROVED: 'rgba(34,197,94,0.3)', REJECTED: 'rgba(239,68,68,0.3)' };

function RefundRow({ r, onUpdate, last }: { r: RefundItem; onUpdate: () => void; last: boolean }) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  async function update(status: 'APPROVED' | 'REJECTED') {
    setLoading(true); setError('');
    try { await api.patch(`/admin/refunds/${r.id}`, { status, adminNote: note || undefined }); setOpen(false); onUpdate(); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
      <View style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AT w={600} style={{ fontSize: 13 }}>{r.user?.profile?.firstName ?? ''} {r.user?.profile?.lastName ?? ''}</AT>
          <AMono style={{ marginTop: 3, fontSize: 10 }}>{r.refundType}{r.subscription?.plan ? ` · ${r.subscription.plan}` : ''} · {new Date(r.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</AMono>
          {r.refundAmountKurus != null && <AMono style={{ marginTop: 4, fontSize: 11, color: adm.text }}>{r.status === 'APPROVED' ? 'İade edildi' : 'İade tutarı'}: ₺{(r.refundAmountKurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</AMono>}
          {!!r.adminNote && <AT style={{ marginTop: 4, fontSize: 10, color: adm.muted, fontStyle: 'italic' }}>{r.adminNote}</AT>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ALabel style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 99, overflow: 'hidden', backgroundColor: BG[r.status] ?? 'transparent', borderWidth: 1, borderColor: BORDER[r.status] ?? adm.border, color: COLOR[r.status] ?? adm.muted }}>{r.status}</ALabel>
          {r.status === 'PENDING' && <Btn variant="admReview" selected={open} label={open ? '▲' : 'İncele'} onPress={() => setOpen(o => !o)} />}
        </View>
      </View>
      {open && (
        <View style={{ marginHorizontal: 18, marginBottom: 14, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, gap: 10 }}>
          <AInput value={note} onChangeText={setNote} placeholder="Admin notu (opsiyonel)" style={{ fontSize: 11, paddingHorizontal: 12 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn variant="admOkSm" label="Onayla" disabled={loading} onPress={() => update('APPROVED')} />
            <Btn variant="admNoSm" label="Reddet" disabled={loading} onPress={() => update('REJECTED')} />
          </View>
          {!!error && <AT style={{ fontSize: 11, color: adm.red }}>{error}</AT>}
        </View>
      )}
    </View>
  );
}

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => { api.get<{ alerts: unknown[]; refunds: RefundItem[] }>('/admin/alerts').then(d => { setRefunds(d.refunds ?? []); setError(''); }).catch((e: Error) => setError(`İade talepleri yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); };
  useEffect(load, []);
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24 }}><ATitle>İade Talepleri</ATitle></View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ATitle>İade Talepleri</ATitle>
          {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{refunds.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ padding: 16, gap: 6 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 48, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : refunds.length === 0 ? <View style={{ paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>İade talebi yok.</AT></View>
          : refunds.map((r, i) => <RefundRow key={r.id} r={r} onUpdate={load} last={i === refunds.length - 1} />)}
      </ACard>
    </APage>
  );
}
