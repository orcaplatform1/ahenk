// apps/web/app/admin/matches/page.tsx karşılığı (Masalar: Tüm masalar + Açık masalar, masa detayı, kullanıcı penceresi)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { api } from '@/lib/api';
import { myId, myRole } from '@/lib/adminRole';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATableRow, ATitle } from '@/components/admin/AdminUi';
import { AdminSelect, AInput, APager } from '@/components/admin/AdminControls';
import { StatusPill } from '@/components/admin/StatusPill';
import { AdminOpenTables } from '@/components/admin/AdminOpenTables';
import { AdminNoShowWarnings, AdminSanctionHistory, AdminUserEdit, type NoShowReportItem, type NoShowWarningInfo } from '@/components/admin/UserParts';
import { adm, llCard } from '@/theme/theme';

function canSanction(t: { id: string; role: string }) {
  const me = myId(); if (!me) return false;
  if (me === t.id || t.role === 'SUPERADMIN') return false;
  return t.role !== 'ADMIN' || myRole() === 'SUPERADMIN';
}

interface MeetingRow { id: string; title: string; type: 'GROUP' | 'ONE_ON_ONE'; status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; scheduledAt: string; locationText: string | null; venueMissing?: boolean; city?: { name: string } | null; _count: { participants: number } }
interface OceanScore { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }
interface Participant { userId: string; status: string; user: { id: string; email: string; isBot?: boolean; profile: { firstName: string; lastName: string; city: string | null } | null; oceanScore: OceanScore | null; subscriptions: { plan: string }[] } }
interface MeetingDetail extends MeetingRow {
  maxParticipants: number; participants: Participant[];
  reviews: { id: string; rating: number; comment: string | null; reviewer: { id: string; profile: { firstName: string; lastName: string } | null } }[];
  blocks: { blockerId: string; blockedId: string }[];
  noShowReports: { reporterId: string; reportedId: string; createdAt: string }[];
}
interface VenueOption { id: string; name: string; category: string; weekCount: number; lastDaysAgo: number | null; capacityShort: boolean }
interface BotRow { id: string; name: string; gender: string | null; age: number | null }
interface ChatMessage { id: string; content: string; createdAt: string; deletedAt: string | null; senderInitials: string; senderName: string | null; senderIsBot?: boolean; reportCount: number; reports: { reporterId: string; reporterInitials: string; createdAt: string }[] }
interface ListResponse { items: MeetingRow[]; total: number; page: number; totalPages: number }
interface AdminUserDetail {
  id: string; email: string; phone: string | null; role: string; status: string;
  profile: { firstName: string | null; lastName: string | null; city: string | null; gender?: string | null; birthDate?: string | null; primaryCity?: string | null } | null;
  occupationSector?: string | null; kyc: { status: string } | null; subscriptions: { id: string; plan: string; status: string }[];
  oceanScore?: { completedAt: string; adminCanReset: boolean } | null; noShowReportsReceived?: NoShowReportItem[]; noShowWarnings?: NoShowWarningInfo;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING: { label: 'Bekliyor', color: adm.amber, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
  ACTIVE: { label: 'Aktif', color: adm.green, bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  COMPLETED: { label: 'Tamamlandı', color: adm.muted, bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' },
  CANCELLED: { label: 'İptal', color: adm.red, bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
};
const VENUE_PACKAGES = ['SADE', 'ORTA', 'PREMIUM'];
const TYPE_LABEL: Record<string, string> = { GROUP: 'Grup', ONE_ON_ONE: 'Başbaşa' };
const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla' };
const INACTIVE = ['CANCELLED', 'DECLINED', 'NO_SHOW'];
const ROW_BORDER = 'rgba(26,58,92,0.5)';

const masaName = (m: { scheduledAt: string; title: string }) => `${new Date(m.scheduledAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' })} · ${m.title}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtShort = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const oceanAvg = (o: OceanScore | null) => (o ? ((o.openness + o.conscientiousness + o.extraversion + o.agreeableness + o.neuroticism) / 5).toFixed(0) : '—');
const Sect = ({ children }: { children: React.ReactNode }) => <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: adm.border }}>{children}</View>;
const Badge = ({ text, color }: { text: string; color: string }) => <AT w={800} style={{ fontSize: 8, color }}>{`  ${text}`}</AT>;

export default function AdminMatches() {
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<'all' | 'open'>('all');
  const [items, setItems] = useState<MeetingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<MeetingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([]);
  const [venueChoice, setVenueChoice] = useState('');
  const [venuePackage, setVenuePackage] = useState('');
  const [venueError, setVenueError] = useState('');
  const [venueSaving, setVenueSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const chatRef = useRef<ScrollViewInstance>(null);
  const [bots, setBots] = useState<BotRow[]>([]);
  const [botToPlace, setBotToPlace] = useState('');
  const [placingBot, setPlacingBot] = useState(false);

  const [userModal, setUserModal] = useState<AdminUserDetail | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userAction, setUserAction] = useState<string | null>(null);
  const [sanctionReasons, setSanctionReasons] = useState<string[]>([]);
  const [sanctionReason, setSanctionReason] = useState('');
  const [grantPlan, setGrantPlan] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (statusFilter) params.set('status', statusFilter);
    if (cityFilter) params.set('city', cityFilter);
    api.get<ListResponse>(`/admin/meetings?${params}`)
      .then(r => { setItems(r.items ?? []); setTotal(r.total ?? 0); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter, cityFilter, page]);
  useEffect(() => { load(); }, [load]);
  const [withoutVenue, setWithoutVenue] = useState(0);
  useEffect(() => { api.get<{ count: number }>('/admin/meetings/without-venue').then(r => setWithoutVenue(r.count)).catch(() => {}); }, [items]);
  useEffect(() => { api.get<string[]>('/admin/sanction-reasons').then(setSanctionReasons).catch(() => {}); }, []);
  const isSuperadmin = myRole() === 'SUPERADMIN';
  const loadBots = (meetingId: string) => { if (isSuperadmin) api.get<BotRow[]>(`/admin/matches/${meetingId}/bots`).then(setBots).catch(() => setBots([])); };

  function loadVenueOptions(meetingId: string) {
    api.get<{ venueId: string | null; options: VenueOption[] }>(`/admin/meetings/${meetingId}/venue-options`)
      .then(r => { setVenueOptions(r.options); setVenueChoice(r.venueId ?? ''); })
      .catch((e: Error) => setError(`Mekanlar yüklenemedi: ${e.message}`));
  }
  async function openDetail(row: MeetingRow) {
    if (selected?.id === row.id) { setSelected(null); return; }
    setDetailLoading(true); setSelected(null);
    try {
      const [d, messages] = await Promise.all([
        api.get<MeetingDetail>(`/admin/meetings/${row.id}`),
        api.get<ChatMessage[]>(`/chat/admin/${row.id}`).catch(() => [] as ChatMessage[]),
      ]);
      setSelected(d); setChat(messages); setBotToPlace(''); loadBots(row.id);
      setVenuePackage(''); setVenueError(''); setVenueOptions([]); setVenueChoice(''); loadVenueOptions(row.id);
    } catch (e) { setError(`Masa detayı yüklenemedi: ${(e as Error).message}`); } finally { setDetailLoading(false); }
  }
  async function approve() {
    if (!selected) return; setApproving(true);
    try { await api.patch(`/admin/matches/${selected.id}/approve`, {}); setSelected(s => (s ? { ...s, status: 'ACTIVE' } : null)); setItems(p => p.map(m => (m.id === selected.id ? { ...m, status: 'ACTIVE' } : m))); }
    catch (e) { setError(`Onaylama başarısız: ${(e as Error).message}`); } finally { setApproving(false); }
  }
  async function assignVenue() {
    if (!selected || !venueChoice) return; setVenueSaving(true); setVenueError('');
    try {
      const r = await api.patch<{ locationText: string }>(`/admin/meetings/${selected.id}/assign-venue`, { venueId: venueChoice });
      setSelected(s => (s ? { ...s, locationText: r.locationText } : null));
      setItems(p => p.map(m => (m.id === selected.id ? { ...m, locationText: r.locationText, venueMissing: false } : m)));
      loadVenueOptions(selected.id);
    } catch (e) { setVenueError((e as Error).message); } finally { setVenueSaving(false); }
  }
  async function placeBot() {
    if (!selected || !botToPlace) return; setPlacingBot(true); setError('');
    try { await api.post(`/admin/matches/${selected.id}/bot`, { botUserId: botToPlace }); setSelected(await api.get<MeetingDetail>(`/admin/meetings/${selected.id}`)); setBotToPlace(''); loadBots(selected.id); }
    catch (e) { setError((e as Error).message); } finally { setPlacingBot(false); }
  }
  async function removeParticipant(userId: string) {
    if (!selected) return; setRemoving(userId);
    try { await api.delete(`/admin/meetings/${selected.id}/participants/${userId}`); setSelected(s => (s ? { ...s, participants: s.participants.filter(p => p.userId !== userId) } : null)); }
    catch (e) { setError(`Katılımcı çıkarılamadı: ${(e as Error).message}`); } finally { setRemoving(null); }
  }
  async function cancelMeeting() {
    if (!selected) return; setCancelling(true);
    try { await api.delete(`/admin/meetings/${selected.id}`); setSelected(s => (s ? { ...s, status: 'CANCELLED' } : null)); setItems(p => p.map(m => (m.id === selected.id ? { ...m, status: 'CANCELLED' } : m))); setCancelConfirm(false); }
    catch (e) { setError(`İptal başarısız: ${(e as Error).message}`); } finally { setCancelling(false); }
  }
  function refreshUser(userId: string) { api.get<AdminUserDetail>(`/admin/users/${userId}`).then(setUserModal).catch((e: Error) => setError(`Kullanıcı yüklenemedi: ${e.message}`)); }
  async function openUser(userId: string) {
    setUserLoading(true); setUserModal(null);
    try { setUserModal(await api.get<AdminUserDetail>(`/admin/users/${userId}`)); setGrantPlan(''); }
    catch (e) { setError(`Kullanıcı yüklenemedi: ${(e as Error).message}`); } finally { setUserLoading(false); }
  }
  async function userUpdateStatus(status: string, reasonOverride?: string) {
    if (!userModal) return; setUserAction(status); const reason = reasonOverride ?? sanctionReason;
    try { await api.patch(`/admin/users/${userModal.id}/status`, status === 'SUSPENDED' && reason ? { status, reason } : { status }); setUserModal(u => (u ? { ...u, status } : null)); }
    catch (e) { setError(`İşlem başarısız: ${(e as Error).message}`); } finally { setUserAction(null); }
  }
  async function userResetTestLock() {
    if (!userModal) return; setUserAction('test');
    try { await api.patch(`/admin/users/${userModal.id}/test-lock-reset`, {}); setUserModal(u => (u && u.oceanScore ? { ...u, oceanScore: { ...u.oceanScore, adminCanReset: true } } : u)); }
    catch (e) { setError(`Test kilidi sıfırlanamadı: ${(e as Error).message}`); } finally { setUserAction(null); }
  }
  async function userApproveKyc() {
    if (!userModal) return; setUserAction('kyc');
    try { await api.post(`/admin/users/${userModal.id}/kyc-approve`, {}); setUserModal(u => (u ? { ...u, kyc: { status: 'APPROVED' } } : null)); }
    catch (e) { setError(`KYC onaylanamadı: ${(e as Error).message}`); } finally { setUserAction(null); }
  }
  async function userGrantSubscription() {
    if (!userModal || !grantPlan) return; setUserAction('sub');
    try { await api.post(`/admin/users/${userModal.id}/free-subscription`, { plan: grantPlan }); setGrantPlan(''); refreshUser(userModal.id); }
    catch (e) { setError(`Abonelik verilemedi: ${(e as Error).message}`); } finally { setUserAction(null); }
  }

  const totalPages = Math.ceil(total / 25);
  const sel = selected;
  const u = userModal;

  return (
    <APage maxWidth={900}>
      <View style={{ marginBottom: 24 }}>
        <ATitle>Masalar</ATitle>
        {withoutVenue > 0 && (
          <AT w={600} style={{ marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, fontSize: 13, color: adm.amber, backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', overflow: 'hidden' }}>⚠ Mekânsız masa: {withoutVenue}</AT>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {([['all', 'Tüm masalar'], ['open', 'Açık masalar']] as const).map(([key, label]) => <Btn key={key} variant="admMatchTab" selected={tab === key} label={label} onPress={() => setTab(key)} />)}
      </View>

      {tab === 'open' && <AdminOpenTables isSuperadmin={isSuperadmin} onUserClick={openUser} />}

      {tab === 'all' && (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <View style={{ width: 160 }}>
              <AdminSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} placeholder="Tüm durumlar"
                options={[{ value: '', label: 'Tüm durumlar' }, { value: 'PENDING', label: 'Bekliyor' }, { value: 'ACTIVE', label: 'Aktif' }, { value: 'COMPLETED', label: 'Tamamlandı' }, { value: 'CANCELLED', label: 'İptal' }]} />
            </View>
            <AInput value={cityFilter} onChangeText={t => { setCityFilter(t); setPage(1); }} placeholder="Şehir..." style={{ width: 140, paddingHorizontal: 12 }} />
          </View>
          <AError>{error}</AError>

          <ACard style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <ATitle>Masalar</ATitle>
              <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{total} kayıt</AMono>
            </View>
            {loading ? (
              <View>{[0, 1, 2, 3, 4].map(i => <View key={i} style={{ paddingVertical: 8, paddingHorizontal: 14 }}><View style={{ height: 36, backgroundColor: adm.surface, borderRadius: 6, opacity: 0.5 }} /></View>)}</View>
            ) : items.map((m, i) => {
              const s = STATUS_CFG[m.status] ?? STATUS_CFG.PENDING;
              const active = sel?.id === m.id;
              return (
                <View key={m.id} style={{ backgroundColor: active ? 'rgba(59,130,246,0.07)' : 'transparent', borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: ROW_BORDER }}>
                  <ATableRow last onPress={() => openDetail(m)} cells={[
                    ['Masa', <AT key="n" w={600} style={{ fontSize: 11, textAlign: 'right' }}>{masaName(m)}</AT>],
                    ['Tarih', <AT key="t" style={{ fontSize: 11 }}>{fmtDate(m.scheduledAt)}</AT>],
                    ['Tip', <AT key="y" style={{ fontSize: 11, color: adm.muted }}>{TYPE_LABEL[m.type] ?? m.type}</AT>],
                    ['Şehir', <AT key="c" style={{ fontSize: 11, color: adm.muted }}>{m.city?.name ?? '—'}</AT>],
                    ['Kişi', <AT key="k" style={{ fontSize: 11, color: adm.muted }}>{m._count.participants}</AT>],
                    ['Mekan', m.venueMissing ? <AT key="v" w={700} style={{ fontSize: 11, color: adm.amber }}>⚠ Mekânsız</AT> : <AT key="v" numberOfLines={1} style={{ fontSize: 11, color: adm.muted }}>{m.locationText ?? '—'}</AT>],
                    ['Durum', <StatusPill key="s" text={s.label} color={s.color} bg={s.bg} border={s.border} />],
                    ['', <AT key="a" style={{ fontSize: 11, color: adm.muted }}>{active ? '▲' : '▼'}</AT>],
                  ]} />
                </View>
              );
            })}
            {!loading && items.length === 0 && <View style={{ paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Henüz masa yok</AT></View>}
          </ACard>

          {totalPages > 1 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              <Btn variant="admPager" label="← Önceki" disabled={page === 1} onPress={() => setPage(p => Math.max(1, p - 1))} />
              <AMono style={{ fontSize: 11 }}>{page} / {totalPages}</AMono>
              <Btn variant="admPager" label="Sonraki →" disabled={page === totalPages} onPress={() => setPage(p => Math.min(totalPages, p + 1))} />
            </View>
          )}

          {detailLoading && <ACard style={{ marginBottom: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 36, backgroundColor: adm.surface, borderRadius: 6, opacity: 0.5, marginBottom: 10 }} />)}</ACard>}

          {sel && !detailLoading && (
            <ACard style={{ marginBottom: 16, gap: 20 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flexGrow: 1, flexBasis: 160, minWidth: 0 }}>
                  <AT w={600} style={{ fontSize: 13 }}>{masaName(sel)}</AT>
                  <AT style={{ marginTop: 3, fontSize: 11, color: adm.muted }}>{fmtDate(sel.scheduledAt)} · {TYPE_LABEL[sel.type]} · {sel.participants.length} katılımcı</AT>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                  <StatusPill text={STATUS_CFG[sel.status]?.label ?? ''} color={STATUS_CFG[sel.status]?.color} bg={STATUS_CFG[sel.status]?.bg} border={STATUS_CFG[sel.status]?.border} pad={[2, 8]} />
                  <Btn variant="admX" label="✕" accessibilityLabel="Kapat" textStyle={{ fontSize: 16 }} style={{ padding: 4 }} onPress={() => setSelected(null)} />
                </View>
              </View>

              <View>
                <ALabel style={{ marginBottom: 8 }}>Mekan</ALabel>
                <View style={{ marginBottom: 8, maxWidth: 220, width: '100%' }}>
                  <AdminSelect value={venuePackage} onChange={setVenuePackage} placeholder="Tüm paketler" title="Paket seç" options={[{ value: '', label: 'Tüm paketler' }, ...VENUE_PACKAGES.map(c => ({ value: c, label: c }))]} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <AdminSelect value={venueChoice} onChange={v => { setVenueChoice(v); setVenueError(''); }} placeholder={venueOptions.length ? 'Mekan seçin' : 'Uygun mekan yok'} title="Mekan seç" style={{ flex: 1, minWidth: 0 }}
                    options={venueOptions.filter(o => !venuePackage || o.category === venuePackage || o.id === venueChoice).map(o => ({
                      value: o.id,
                      label: [o.name, o.category, `Bu hafta ${o.weekCount} masa`, o.lastDaysAgo === null ? 'Hiç atanmadı' : `Son atama: ${o.lastDaysAgo} gün önce`, ...(o.capacityShort ? ['Kapasite yetersiz'] : [])].join(' · '),
                    }))} />
                  <Btn variant="admBlueAta" disabled={venueSaving || !venueChoice} label={venueSaving ? '…' : 'Ata'} onPress={assignVenue} />
                </View>
                {!!sel.locationText && !venueOptions.some(o => o.id === venueChoice) && <AT style={{ marginTop: 6, fontSize: 11, color: adm.muted }}>Mevcut mekan: {sel.locationText}</AT>}
                {!!venueError && <AT w={600} style={{ marginTop: 6, fontSize: 12, color: adm.red }}>{venueError}</AT>}
              </View>

              <View>
                <ALabel style={{ marginBottom: 8 }}>KATILIMCILAR ({sel.participants.length})</ALabel>
                {sel.participants.map((p, i) => (
                  <View key={p.userId} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, borderBottomWidth: i < sel.participants.length - 1 ? 1 : 0, borderBottomColor: ROW_BORDER }}>
                    <Pressable onPress={() => openUser(p.user.id)} accessibilityRole="button" style={{ flexGrow: 1, flexBasis: 160, minWidth: 0 }}>
                      <AT w={600} style={{ fontSize: 13 }}>
                        {p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.user.email}
                        {p.user.isBot && <Badge text="BOT" color={adm.cyan} />}
                        {INACTIVE.includes(p.status) && <Badge text="İPTAL" color={adm.red} />}
                      </AT>
                      {!!p.user.email && <AT style={{ marginTop: 2, fontSize: 10, color: adm.muted }}>{p.user.email}</AT>}
                    </Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                      <AMono style={{ fontSize: 10 }}>OCEAN {oceanAvg(p.user.oceanScore)}</AMono>
                      {sel.status !== 'CANCELLED' && sel.status !== 'COMPLETED' && <Btn variant="admRemoveXs" disabled={removing === p.userId} label={removing === p.userId ? '…' : 'Çıkart'} onPress={() => removeParticipant(p.userId)} />}
                    </View>
                  </View>
                ))}
              </View>

              {sel.status === 'PENDING' && <Btn variant="admGreen9" disabled={approving} label={approving ? 'Onaylanıyor…' : '✓ Masayı Onayla'} onPress={approve} />}

              {isSuperadmin && sel.status !== 'CANCELLED' && sel.status !== 'COMPLETED' && (() => {
                const emptySeats = sel.maxParticipants - sel.participants.filter(p => !INACTIVE.includes(p.status)).length;
                return (
                  <View>
                    <ALabel style={{ marginBottom: 8 }}>BOT YERLEŞTİR ({emptySeats > 0 ? `${emptySeats} boş koltuk` : 'boş koltuk yok'})</ALabel>
                    {emptySeats > 0 && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <AdminSelect value={botToPlace} onChange={setBotToPlace} placeholder={bots.length ? 'Bot seçin (eksik cinsiyet)' : 'Uygun bot yok'} title="Bot seç" style={{ flex: 1, minWidth: 0 }}
                          options={bots.map(b => ({ value: b.id, label: `${b.name || b.id} (${b.gender === 'MALE' ? 'E' : 'K'}${b.age !== null ? `, ${b.age}` : ''})` }))} />
                        <Btn variant="admBlueAta" disabled={placingBot || !botToPlace} label={placingBot ? '…' : 'Yerleştir'} onPress={placeBot} />
                      </View>
                    )}
                  </View>
                );
              })()}

              <View>
                <ALabel style={{ marginBottom: 8 }}>SOHBET GEÇMİŞİ ({chat.length}{chat.some(m => m.reportCount > 0) ? ` · ${chat.filter(m => m.reportCount > 0).length} şikayetli` : ''})</ALabel>
                {chat.length === 0 ? <AT style={{ fontSize: 11, color: adm.muted }}>Mesaj yok</AT> : (
                  <ScrollView ref={chatRef} nestedScrollEnabled onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: false })}
                    style={{ height: Math.min(height * 0.6, 500), borderRadius: 10, backgroundColor: adm.bg, borderWidth: 1, borderColor: adm.border }} contentContainerStyle={{ padding: 8, gap: 6 }}>
                    {[...chat].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(m => (
                      <View key={m.id} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: m.reportCount > 0 ? 'rgba(239,68,68,0.08)' : adm.surface, borderWidth: 1, borderColor: m.reportCount > 0 ? 'rgba(239,68,68,0.3)' : adm.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                          <AT w={700} style={{ fontSize: 10, flexShrink: 1 }}>{m.senderName ?? m.senderInitials}{m.senderIsBot && <Badge text="BOT" color={adm.cyan} />}</AT>
                          <AMono style={{ fontSize: 9 }}>{fmtShort(m.createdAt)}</AMono>
                        </View>
                        <AT style={{ fontSize: 11, color: m.deletedAt ? adm.muted : adm.text }}>{m.content}</AT>
                        {(!!m.deletedAt || m.reportCount > 0) && (
                          <AT style={{ marginTop: 4, fontSize: 9, color: m.reportCount > 0 ? adm.red : adm.muted }}>
                            {m.deletedAt ? 'Kullanıcı tarafında silindi' : ''}{m.deletedAt && m.reportCount > 0 ? ' · ' : ''}
                            {m.reportCount > 0 ? `${m.reportCount} şikayet: ${m.reports.map(r => `${r.reporterInitials} (${fmtShort(r.createdAt)})`).join(', ')}` : ''}
                          </AT>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              {sel.reviews.length > 0 && (
                <View>
                  <ALabel style={{ marginBottom: 8 }}>DEĞERLENDİRMELER ({sel.reviews.length})</ALabel>
                  {sel.reviews.map((r, i) => {
                    const nameOf = (id: string) => { const pr = sel.participants.find(p => p.userId === id)?.user.profile; return pr ? `${pr.firstName} ${pr.lastName}` : '—'; };
                    const blocked = sel.blocks.filter(b => b.blockerId === r.reviewer.id).map(b => nameOf(b.blockedId));
                    const noShow = (sel.noShowReports ?? []).filter(n => n.reporterId === r.reviewer.id).map(n => nameOf(n.reportedId));
                    return (
                      <View key={r.id} style={{ paddingVertical: 8, borderBottomWidth: i < sel.reviews.length - 1 ? 1 : 0, borderBottomColor: ROW_BORDER }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <AT style={{ fontSize: 11, color: adm.muted }}>{r.reviewer.profile ? `${r.reviewer.profile.firstName} ${r.reviewer.profile.lastName[0]}.` : '—'}</AT>
                          <AT style={{ fontSize: 13 }}>{[1, 2, 3, 4, 5].map(k => <AT key={k} style={{ fontSize: 13, color: k <= r.rating ? adm.amber : 'rgba(255,255,255,0.12)' }}>★</AT>)}</AT>
                        </View>
                        {!!r.comment && <AT style={{ fontSize: 11 }}><AT style={{ fontSize: 11, color: adm.muted }}>Beklenti: </AT>{r.comment}</AT>}
                        {noShow.length > 0 && <AT style={{ marginTop: 4, fontSize: 11, color: adm.red }}><AT style={{ fontSize: 11, color: adm.muted }}>Gelmedi bildirdi: </AT>{noShow.join(', ')}</AT>}
                        {blocked.length > 0 && <AT style={{ marginTop: 4, fontSize: 11, color: adm.amber }}><AT style={{ fontSize: 11, color: adm.muted }}>Engelledi: </AT>{blocked.join(', ')}</AT>}
                      </View>
                    );
                  })}
                </View>
              )}

              {sel.status !== 'CANCELLED' && sel.status !== 'COMPLETED' && <Btn variant="admRed9" label="Masayı İptal Et" onPress={() => setCancelConfirm(true)} />}
            </ACard>
          )}
        </>
      )}

      {/* İptal onay penceresi */}
      <Modal visible={cancelConfirm} transparent animationType="fade" onRequestClose={() => setCancelConfirm(false)}>
        <Pressable onPress={() => setCancelConfirm(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 320, gap: 20, borderRadius: llCard.radius, borderWidth: 1, borderColor: adm.border, backgroundColor: adm.card, padding: llCard.padding, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 32, shadowOffset: { width: 0, height: 24 } }}>
            <View>
              <AT w={700} style={{ fontSize: 14, marginBottom: 6 }}>Masayı iptal et</AT>
              <AT style={{ fontSize: 13, color: adm.muted }}>{sel ? fmtDate(sel.scheduledAt) : ''} tarihli masa iptal edilecek. Bu işlem geri alınamaz.</AT>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn variant="admCancelNo" label="Vazgeç" onPress={() => setCancelConfirm(false)} />
              <Btn variant="admCancelYes" disabled={cancelling} label={cancelling ? '…' : 'İptal Et'} onPress={cancelMeeting} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Kullanıcı detay penceresi */}
      <Modal visible={userLoading || !!u} transparent animationType="fade" onRequestClose={() => setUserModal(null)}>
        <Pressable onPress={() => setUserModal(null)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 360, maxHeight: '85%', borderRadius: llCard.radius, borderWidth: 1, borderColor: adm.border, backgroundColor: adm.card, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 32, shadowOffset: { width: 0, height: 24 } }}>
            <ScrollView contentContainerStyle={{ padding: llCard.padding, gap: 16 }} keyboardShouldPersistTaps="handled">
              {userLoading && [0, 1, 2, 3].map(i => <View key={i} style={{ height: 36, backgroundColor: adm.surface, borderRadius: 6, opacity: 0.5 }} />)}
              {u && !userLoading && (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flexShrink: 1 }}>
                      <AT w={700} style={{ fontSize: 14 }}>{u.profile ? `${u.profile.firstName} ${u.profile.lastName}` : u.email}</AT>
                      {!!u.email && <AT style={{ marginTop: 3, fontSize: 11, color: adm.muted }}>{u.email}</AT>}
                      {!!u.phone && <AT style={{ marginTop: 2, fontSize: 11, color: adm.muted }}>{u.phone}</AT>}
                      <AMono style={{ marginTop: 2, fontSize: 10 }}>{u.role}</AMono>
                    </View>
                    <Btn variant="admX" label="✕" accessibilityLabel="Kapat" textStyle={{ fontSize: 16 }} style={{ padding: 4 }} onPress={() => setUserModal(null)} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <StatusPill pad={[2, 8]} text={u.status === 'ACTIVE' ? 'Aktif' : u.status === 'SUSPENDED' ? 'Askıda' : 'Silinmiş'} color={u.status === 'ACTIVE' ? adm.green : adm.red} bg={u.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'} border={u.status === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'} />
                    <StatusPill pad={[2, 8]} text={`KYC: ${u.kyc?.status === 'APPROVED' ? 'Onaylı ✓' : u.kyc?.status ?? 'Yok'}`} color={u.kyc?.status === 'APPROVED' ? adm.green : adm.muted} bg={u.kyc?.status === 'APPROVED' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)'} border={u.kyc?.status === 'APPROVED' ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.25)'} />
                    {u.subscriptions.map(s => <StatusPill key={s.id} pad={[2, 8]} text={PLAN_LABEL[s.plan] ?? s.plan} color={adm.blue} bg="rgba(59,130,246,0.12)" border="rgba(59,130,246,0.3)" />)}
                  </View>
                  <AdminUserEdit user={u} canEdit={canSanction(u)} onSaved={() => refreshUser(u.id)} />
                  <AdminNoShowWarnings userId={u.id} reports={u.noShowReportsReceived ?? []} warnings={u.noShowWarnings ?? { count: 0, limit: 3, warnedMeetingIds: [] }} canSanction={canSanction(u)} userStatus={u.status}
                    suspending={userAction === 'SUSPENDED'} onChanged={w => setUserModal(x => (x ? { ...x, noShowWarnings: w } : null))} onSuspend={() => userUpdateStatus('SUSPENDED', 'Masaya katılım sağlamama')} />
                  <AdminSanctionHistory userId={u.id} canAct={canSanction(u)} onChanged={() => refreshUser(u.id)} />
                  <Sect>
                    <ALabel>HESAP İŞLEMLERİ</ALabel>
                    {canSanction(u) ? (
                      <>
                        {u.status !== 'SUSPENDED' && <AdminSelect value={sanctionReason} onChange={setSanctionReason} placeholder="Askı sebebi (boşsa: Yönetici kararı)" title="Askı sebebi" options={[{ value: '', label: 'Yönetici kararı' }, ...sanctionReasons.map(x => ({ value: x, label: x }))]} />}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {u.status !== 'SUSPENDED' && <Btn variant="admAct6Amber" disabled={!!userAction} label={userAction === 'SUSPENDED' ? '…' : 'Askıya Al (1 ay)'} onPress={() => userUpdateStatus('SUSPENDED')} />}
                          {u.status === 'SUSPENDED' && myRole() === 'SUPERADMIN' && <Btn variant="admAct6Green" disabled={!!userAction} label={userAction === 'ACTIVE' ? '…' : 'Aktifleştir'} onPress={() => userUpdateStatus('ACTIVE')} />}
                          {u.status !== 'DELETED' && <Btn variant="admAct6Red" disabled={!!userAction} label={userAction === 'DELETED' ? '…' : 'Hesabı Sil'} onPress={() => userUpdateStatus('DELETED')} />}
                        </View>
                      </>
                    ) : <AT style={{ fontSize: 11, color: adm.muted }}>Bu hesaba işlem yetkiniz yok</AT>}
                  </Sect>
                  {u.oceanScore && (
                    <View style={{ borderTopWidth: 1, borderTopColor: adm.border, paddingTop: 14, gap: 8 }}>
                      <ALabel>KİŞİLİK TESTİ</ALabel>
                      <AT style={{ fontSize: 11, color: adm.muted }}>Son test: {new Date(u.oceanScore.completedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}{u.oceanScore.adminCanReset ? ' · Kilit açık, kullanıcı testi yeniden yapabilir' : ' · 180 gün kilitli'}</AT>
                      {!u.oceanScore.adminCanReset && <Btn variant="admActBlue" disabled={!!userAction} label={userAction === 'test' ? '…' : 'Test Kilidini Sıfırla'} onPress={userResetTestLock} />}
                    </View>
                  )}
                  {u.kyc && u.kyc.status !== 'APPROVED' && (
                    <Sect>
                      <ALabel>KYC</ALabel>
                      <Btn variant="admGreen9" disabled={!!userAction} label={userAction === 'kyc' ? 'Onaylanıyor…' : "KYC'yi Onayla"} onPress={userApproveKyc} />
                    </Sect>
                  )}
                  {myRole() === 'SUPERADMIN' && (
                    <Sect>
                      <ALabel>ÜCRETSİZ ABONELİK VER</ALabel>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <AdminSelect value={grantPlan} onChange={setGrantPlan} placeholder="Paket seç…" title="Paket seç" style={{ flex: 1, minWidth: 0 }}
                          options={[{ value: 'MASADA', label: 'Masada' }, { value: 'KARSIMDA', label: 'Karşımda' }, { value: 'ICERDE', label: 'İçerde' }, { value: 'KANKAMLA', label: 'Kankamla' }]} />
                        <Btn variant="admBlueVer" disabled={!!userAction || !grantPlan} label={userAction === 'sub' ? '…' : 'Ver'} onPress={userGrantSubscription} />
                      </View>
                    </Sect>
                  )}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </APage>
  );
}
