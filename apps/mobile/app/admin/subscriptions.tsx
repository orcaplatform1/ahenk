// apps/web/app/admin/subscriptions/page.tsx karşılığı
import React, { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminSelect, AInput } from '@/components/admin/AdminControls';
import { ADialog } from '@/components/admin/ADialog';
import { StatusPill } from '@/components/admin/StatusPill';
import { adm, sans } from '@/theme/theme';

interface Sub {
  id: string; plan: 'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA'; kankaRights?: number; kankaCycles?: number; status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startsAt: string; expiresAt: string | null; usedAt: string | null; cancelNote: string | null; missedGroupCycles: number; missedOneonOneCycles: number;
  groupRights: number; groupCycles: number; oneOnOneCycles: number; updatedAt: string;
  user: { id: string; email: string; phone: string | null; profile: { firstName: string; lastName: string } | null };
  payment: { platform: string; amountKurus: number; paidAt: string | null } | null;
}
interface ListResponse { items: { user: Sub['user']; subscriptions: Sub[] }[]; total: number; page: number; totalPages: number }
const TABS = [{ key: 'ACTIVE', label: 'Aktif' }, { key: 'EXPIRED', label: 'Süresi Dolan / Kullanılan' }, { key: 'CANCELLED', label: 'İptal Edilen' }] as const;
const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla' };
const PLATFORM_LABEL: Record<string, string> = { WEB: 'Web', ANDROID: 'Android', IOS: 'iOS' };
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function SubRow({ s, onCancel }: { s: Sub; onCancel: () => void }) {
  const one = s.plan === 'KARSIMDA' || s.plan === 'ICERDE';
  return (
    <View style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: adm.surface, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <View style={{ flex: 1, minWidth: 200 }}>
        <AT w={600} style={{ fontSize: 13 }}>{PLAN_LABEL[s.plan] ?? s.plan}</AT>
        <AMono style={{ marginTop: 3, fontSize: 11 }}>
          Başlangıç {fmtDate(s.startsAt)}{s.expiresAt ? ` · Bitiş ${fmtDate(s.expiresAt)}` : ''}
          {s.plan === 'MASADA' || s.plan === 'ICERDE' ? ` · Grup hakkı: ${s.groupRights}/2 kaldı, döngü ${s.groupCycles}/4` : ''}
          {s.plan === 'KANKAMLA' ? ` · Kankamla hakkı: ${s.kankaRights ?? 0}/2 kaldı, döngü ${s.kankaCycles ?? 0}/4` : ''}
          {one ? ` · Başbaşa hakkı: ${s.usedAt ? `kullanıldı (${fmtDate(s.usedAt)})` : `kullanılmadı, döngü ${s.oneOnOneCycles}/4`}` : ''}
        </AMono>
        <AT style={{ marginTop: 3, fontSize: 11, color: adm.muted }}>
          {s.payment ? `${PLATFORM_LABEL[s.payment.platform] ?? s.payment.platform} · ₺${(s.payment.amountKurus / 100).toFixed(2)}` : 'Ücretsiz (admin)'}
          {s.status === 'ACTIVE' && (s.missedGroupCycles > 0 || s.missedOneonOneCycles > 0) ? ` · Masa kurulamayan döngü: grup ${s.missedGroupCycles}, başbaşa ${s.missedOneonOneCycles}` : ''}
        </AT>
        {s.status === 'CANCELLED' && <AT style={{ marginTop: 3, fontSize: 11, color: adm.amber }}>İptal: {fmtDate(s.updatedAt)}{s.cancelNote ? ` · ${s.cancelNote}` : ''}</AT>}
      </View>
      {s.status === 'ACTIVE' && <Btn variant="admCancelSm" label="İptal Et" onPress={onCancel} />}
      {s.status === 'EXPIRED' && <ALabel>SONA ERDİ</ALabel>}
      {s.status !== 'CANCELLED' && !!s.payment && (s.missedGroupCycles >= 4 || s.missedOneonOneCycles >= 4) && <ALabel style={{ color: adm.green }}>İADE HAKKI</ALabel>}
    </View>
  );
}

export default function AdminSubscriptions() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('ACTIVE');
  const [plan, setPlan] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<Sub | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    setLoading(true); setError('');
    const p = new URLSearchParams({ status: tab, page: String(page), limit: '25', group: 'user' });
    if (plan) p.set('plan', plan); if (query) p.set('search', query);
    api.get<ListResponse>(`/admin/subscriptions?${p}`).then(setData).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [tab, plan, query, page]);
  useEffect(() => { load(); }, [load]);
  async function confirmCancel() {
    if (!cancelling) return;
    setSaving(true); setError('');
    try { await api.patch(`/admin/subscriptions/${cancelling.id}/cancel`, note.trim() ? { cancelNote: note.trim() } : {}); setCancelling(null); setNote(''); load(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  const items = data?.items ?? [];
  return (
    <APage maxWidth={900}>
      <View style={{ marginBottom: 20 }}><ATitle>Abonelikler</ATitle></View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map(t => <Btn key={t.key} variant="admChipTab" selected={tab === t.key} label={t.label} onPress={() => { setTab(t.key); setPage(1); }} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <AInput value={search} onChangeText={setSearch} onSubmitEditing={() => { setQuery(search.trim()); setPage(1); }} returnKeyType="search" placeholder="Ad, e-posta veya telefon… (Enter)" style={{ flexGrow: 1, minWidth: 180, paddingHorizontal: 12 }} />
        <View style={{ width: 160 }}>
          <AdminSelect value={plan} onChange={v => { setPlan(v); setPage(1); }} placeholder="Tüm paketler" title="Paket filtresi" options={[{ value: '', label: 'Tüm paketler' }, { value: 'MASADA', label: 'Masada' }, { value: 'KARSIMDA', label: 'Karşımda' }, { value: 'ICERDE', label: 'İçerde' }, { value: 'KANKAMLA', label: 'Kankamla' }]} />
        </View>
      </View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ATitle>Abonelikler</ATitle>
          {data && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{data.total} kişi</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 52, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : items.length === 0 ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Kayıt yok</AT></View>
          : items.map(({ user, subscriptions }, i) => (
            <View key={user.id} style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
              <AT w={600} style={{ fontSize: 13 }}>{user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email}</AT>
              <AT style={{ marginTop: 2, marginBottom: 8, fontSize: 11, color: adm.muted }}>{[user.email, user.phone].filter(Boolean).join(' · ')}</AT>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {subscriptions.map(s => <StatusPill key={s.id} text={PLAN_LABEL[s.plan] ?? s.plan} color="#93c5fd" bg="rgba(59,130,246,0.1)" border="rgba(59,130,246,0.25)" pad={[1, 7]} />)}
              </View>
              <View style={{ gap: 6 }}>{subscriptions.map(s => <SubRow key={s.id} s={s} onCancel={() => { setCancelling(s); setNote(''); }} />)}</View>
            </View>
          ))}
      </ACard>
      {data && data.totalPages > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <Btn variant="admPageBox" label="‹" disabled={page <= 1} onPress={() => setPage(p => Math.max(1, p - 1))} />
          <AMono style={{ fontSize: 11 }}>{page} / {data.totalPages}</AMono>
          <Btn variant="admPageBox" label="›" disabled={page >= data.totalPages} onPress={() => setPage(p => Math.min(data.totalPages, p + 1))} />
        </View>
      )}
      <ADialog visible={!!cancelling} onClose={() => setCancelling(null)} title="Aboneliği İptal Et">
        {cancelling && (
          <>
            <AT style={{ marginBottom: 12, fontSize: 13, color: adm.muted }}>{cancelling.user.profile ? `${cancelling.user.profile.firstName} ${cancelling.user.profile.lastName}` : cancelling.user.email}: {PLAN_LABEL[cancelling.plan]}. Bu işlem geri alınamaz.</AT>
            <TextInput value={note} onChangeText={setNote} placeholder="İptal notu (opsiyonel)" placeholderTextColor={adm.muted} multiline numberOfLines={3} keyboardAppearance="dark"
              style={{ backgroundColor: adm.bg, borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, fontSize: 13, color: adm.text, fontFamily: sans(400), minHeight: 72, textAlignVertical: 'top', marginBottom: 12 }} />
            <Btn variant="admRedFull" disabled={saving} label={saving ? 'İptal ediliyor…' : 'İptal Et'} onPress={confirmCancel} />
          </>
        )}
      </ADialog>
    </APage>
  );
}
