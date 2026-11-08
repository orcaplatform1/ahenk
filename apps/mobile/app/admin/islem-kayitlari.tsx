// apps/web/app/admin/islem-kayitlari/page.tsx karşılığı (yalnız SUPERADMIN)
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { ACard, AError, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminDatePicker, AdminSelect, AInput, APager } from '@/components/admin/AdminControls';
import { adm } from '@/theme/theme';

interface AdminRef { id: string; profile: { firstName: string; lastName: string } | null }
interface LogItem { id: string; action: string; description: string; createdAt: string; admin: AdminRef }
interface LogResponse { items: LogItem[]; total: number; page: number; totalPages: number; admins: AdminRef[] }
const nameOf = (a: AdminRef) => (a.profile ? `${a.profile.firstName} ${a.profile.lastName}` : 'Admin');
const fmt = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function IslemKayitlari() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [error, setError] = useState('');
  const [adminId, setAdminId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (adminId) p.set('adminId', adminId); if (from) p.set('from', from); if (to) p.set('to', to); if (q.trim()) p.set('q', q.trim());
    api.get<LogResponse>(`/admin/action-logs?${p}`).then(d => { setData(d); setError(''); }).catch((e: Error) => setError(`Kayıtlar yüklenemedi: ${e.message}`));
  }, [adminId, from, to, q, page]);
  useEffect(() => { load(); }, [load]);
  const year = new Date().getFullYear();
  return (
    <APage maxWidth={960}>
      <ATitle style={{ marginBottom: 6 }}>İşlem Kayıtları</ATitle>
      <AT style={{ marginBottom: 20, fontSize: 13, color: adm.muted }}>Adminlerin yaptığı veri değiştiren işlemler. Kayıtlar silinemez ve değiştirilemez.</AT>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <View style={{ minWidth: 0, flexBasis: '100%', flexGrow: 1 }}>
          <AdminSelect value={adminId} onChange={v => { setAdminId(v); setPage(1); }} placeholder="Tüm adminler" title="Admin seç" options={[{ value: '', label: 'Tüm adminler' }, ...(data?.admins ?? []).map(a => ({ value: a.id, label: nameOf(a) }))]} />
        </View>
        <View style={{ width: 150 }}><AdminDatePicker value={from} onChange={v => { setFrom(v); setPage(1); }} placeholder="Başlangıç tarihi" title="Başlangıç tarihi" minYear={2026} maxYear={year} clearable /></View>
        <View style={{ width: 150 }}><AdminDatePicker value={to} onChange={v => { setTo(v); setPage(1); }} placeholder="Bitiş tarihi" title="Bitiş tarihi" minYear={2026} maxYear={year} clearable /></View>
        <AInput value={q} onChangeText={t => { setQ(t); setPage(1); }} placeholder="Açıklamada ara…" style={{ flexGrow: 1, minWidth: 0, flexBasis: '100%' }} />
      </View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        {!data ? <AT style={{ padding: 16, fontSize: 13, color: adm.muted }}>Yükleniyor…</AT>
          : data.items.length === 0 ? <AT style={{ padding: 16, fontSize: 13, color: adm.muted }}>Kayıt yok</AT>
          : data.items.map((l, i) => (
            <View key={l.id} style={{ paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, alignItems: 'baseline' }}>
              <AMono style={{ fontSize: 11, minWidth: 0, flexBasis: '100%' }}>{fmt(l.createdAt)}</AMono>
              <AT w={700} style={{ fontSize: 13, minWidth: 0, flexBasis: '100%' }}>{nameOf(l.admin)}</AT>
              <AT style={{ fontSize: 13, flexBasis: '100%' }}>{l.description}</AT>
            </View>
          ))}
      </ACard>
      {data && <APager page={page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
    </APage>
  );
}
