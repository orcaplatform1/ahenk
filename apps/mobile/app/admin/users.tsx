// apps/web/app/admin/users/page.tsx karşılığı (Kullanıcılar + Silme Talepleri)
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { api } from '@/lib/api';
import { myId, myRole } from '@/lib/adminRole';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATableRow, ATitle } from '@/components/admin/AdminUi';
import { AdminSelect, AInput, APager } from '@/components/admin/AdminControls';
import { StatusPill } from '@/components/admin/StatusPill';
import { AdminDeletionRequests, AdminNoShowWarnings, AdminSanctionHistory, AdminUserEdit, type NoShowReportItem, type NoShowWarningInfo } from '@/components/admin/UserParts';
import { adm, llCard } from '@/theme/theme';

function canSanction(t: { id: string; role: string }) {
  const me = myId(); if (!me) return false;
  if (me === t.id || t.role === 'SUPERADMIN') return false;
  return t.role !== 'ADMIN' || myRole() === 'SUPERADMIN';
}
interface AdminUser { id: string; email: string; phone?: string; role: string; status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'; profile?: { firstName?: string; lastName?: string; city?: string | null; isPioneer?: boolean } | null; kyc?: { status: string } | null; oceanScore?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number } | null; subscriptions?: { plan: string }[]; primaryCityName?: string | null; activeCityName?: string | null }
interface UsersResponse { data: AdminUser[]; total: number; page: number; totalPages: number }
interface Detail { id: string; email: string; phone: string | null; role: string; status: string; profile: { firstName: string | null; lastName: string | null; city: string | null; birthDate: string | null; occupation: string | null; gender?: string | null; primaryCity?: string | null } | null; occupationSector?: string | null; kyc: { status: string } | null; subscriptions: { id: string; plan: string; status: string }[]; rights?: { group: number; oneOnOne: number; kanka: number }; kanka?: { userId: string; name: string; since: string } | null; oceanScore?: { completedAt: string; adminCanReset: boolean } | null; noShowReportsReceived?: NoShowReportItem[]; noShowWarnings?: NoShowWarningInfo }
const SS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ACTIVE: { label: 'Aktif', color: adm.green, bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
  SUSPENDED: { label: 'Karantina', color: adm.amber, bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  DELETED: { label: 'Silindi', color: adm.muted, bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
};
const PL: Record<string, string> = { MASADA: 'Grup', KARSIMDA: 'Başbaşa', ICERDE: 'İçerde', KANKAMLA: 'Kankamla', PRIME_1M: 'Prime 1 Aylık', PRIME_3M: 'Prime 3 Aylık', PRIME_6M: 'Prime 6 Aylık', PRIME_12M: 'Prime 12 Aylık' };
const oceanAvg = (o: AdminUser['oceanScore']) => (o ? ((o.openness + o.conscientiousness + o.extraversion + o.agreeableness + o.neuroticism) / 5).toFixed(0) : '—');
const planOf = (u: AdminUser) => (u.subscriptions?.length ? u.subscriptions.map(s => PL[s.plan] ?? s.plan).join(', ') : '—');
const PLANS = [{ value: 'MASADA', label: 'Grup' }, { value: 'KARSIMDA', label: 'Başbaşa' }, { value: 'ICERDE', label: 'İçerde' }, { value: 'KANKAMLA', label: 'Kankamla' }];
const Sect = ({ children }: { children: React.ReactNode }) => <View style={{ borderTopWidth: 1, borderTopColor: adm.border, paddingTop: 14, gap: 8 }}>{children}</View>;

export default function AdminUsers() {
  const [tab, setTab] = useState<'users' | 'deletions'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Detail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [grant, setGrant] = useState('');
  const [subToCancel, setSubToCancel] = useState<Detail['subscriptions'][number] | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) p.set('search', search); if (city) p.set('city', city); if (type) p.set('type', type);
    api.get<UsersResponse>(`/admin/users?${p}`).then(r => { setUsers(r.data ?? []); setTotal(r.total ?? 0); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [search, city, type, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<string[]>('/admin/sanction-reasons').then(setReasons).catch(() => {}); }, []);
  const refresh = (id: string) => { api.get<Detail>(`/admin/users/${id}`).then(setModal).catch((e: Error) => setError(`Kullanıcı yüklenemedi: ${e.message}`)); };
  async function openModal(id: string) {
    setModalLoading(true); setModal(null); setSubToCancel(null);
    try { setModal(await api.get<Detail>(`/admin/users/${id}`)); setGrant(''); } catch (e) { setError(`Kullanıcı yüklenemedi: ${(e as Error).message}`); } finally { setModalLoading(false); }
  }
  async function updStatus(status: string, override?: string) {
    if (!modal) return; setAction(status); const r = override ?? reason;
    try { await api.patch(`/admin/users/${modal.id}/status`, status === 'SUSPENDED' && r ? { status, reason: r } : { status }); setModal(u => (u ? { ...u, status } : null)); setUsers(p => p.map(u => (u.id === modal.id ? { ...u, status: status as AdminUser['status'] } : u))); }
    catch (e) { setError(`İşlem başarısız: ${(e as Error).message}`); } finally { setAction(null); }
  }
  async function resetTest() { if (!modal) return; setAction('test'); try { await api.patch(`/admin/users/${modal.id}/test-lock-reset`, {}); setModal(u => (u && u.oceanScore ? { ...u, oceanScore: { ...u.oceanScore, adminCanReset: true } } : u)); } catch (e) { setError(`Test kilidi sıfırlanamadı: ${(e as Error).message}`); } finally { setAction(null); } }
  async function approveKyc() { if (!modal) return; setAction('kyc'); try { await api.post(`/admin/users/${modal.id}/kyc-approve`, {}); setModal(u => (u ? { ...u, kyc: { status: 'APPROVED' } } : null)); } catch (e) { setError(`KYC onaylanamadı: ${(e as Error).message}`); } finally { setAction(null); } }
  async function grantSub() { if (!modal || !grant) return; setAction('sub'); try { await api.post(`/admin/users/${modal.id}/free-subscription`, { plan: grant }); setGrant(''); refresh(modal.id); load(); } catch (e) { setError(`Abonelik verilemedi: ${(e as Error).message}`); } finally { setAction(null); } }
  async function cancelSub() { if (!modal || !subToCancel) return; setAction('cancelSub'); try { await api.patch(`/admin/subscriptions/${subToCancel.id}/cancel`, {}); setSubToCancel(null); refresh(modal.id); load(); } catch (e) { setError(`Abonelik iptal edilemedi: ${(e as Error).message}`); } finally { setAction(null); } }
  const totalPages = Math.ceil(total / 20);
  const m = modal; const st = m ? SS[m.status] ?? SS.ACTIVE : null; const kycOk = m?.kyc?.status === 'APPROVED';

  return (
    <APage maxWidth={900}>
      <View style={{ marginBottom: 24 }}>
        <ATitle>Kullanıcılar</ATitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {([['users', 'Kullanıcılar'], ['deletions', 'Silme Talepleri']] as const).map(([k, l]) => <Btn key={k} variant="admTabSm" selected={tab === k} label={l} onPress={() => setTab(k)} />)}
        </View>
      </View>
      {tab === 'deletions' && <AdminDeletionRequests />}
      {tab === 'users' && (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <AInput value={search} onChangeText={t => { setSearch(t); setPage(1); }} placeholder="Ad, soyad veya e-posta..." style={{ flexGrow: 1, minWidth: 0, flexBasis: '100%', backgroundColor: adm.surface, paddingHorizontal: 12 }} />
            <AInput value={city} onChangeText={t => { setCity(t); setPage(1); }} placeholder="Şehir..." style={{ width: 120, backgroundColor: adm.surface, paddingHorizontal: 12 }} />
            <View style={{ width: 160 }}>
              <AdminSelect value={type} onChange={v => { setType(v); setPage(1); }} placeholder="Tüm üyeler" title="Üye filtresi" options={[{ value: '', label: 'Tüm üyeler' }, { value: 'NO_PLAN', label: 'Aboneliksiz' }, ...PLANS, { value: 'ADMIN', label: 'Admin' }, { value: 'SUPERADMIN', label: 'Superadmin' }]} />
            </View>
          </View>
          <AError>{error}</AError>
          <ACard style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <ATitle>Kullanıcılar</ATitle>
              <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{total} kayıt</AMono>
            </View>
            {loading ? <View style={{ padding: 14, gap: 8 }}>{[0, 1, 2, 3, 4].map(i => <View key={i} style={{ height: 32, backgroundColor: adm.surface, borderRadius: 6, opacity: 0.5 }} />)}</View>
              : users.length === 0 ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Kullanıcı bulunamadı.</AT></View>
              : users.map((u, i) => { const s = SS[u.status] ?? SS.ACTIVE; return (
                <ATableRow borderColor="rgba(26,58,92,0.5)" key={u.id} last={i === users.length - 1} cells={[
                  ['Kullanıcı', <View key="u" style={{ alignItems: 'flex-end' }}><AT w={600} numberOfLines={1} style={{ fontSize: 13 }}>{u.profile?.firstName ?? ''} {u.profile?.lastName ?? ''}</AT><AT numberOfLines={1} style={{ marginTop: 2, fontSize: 10, color: adm.muted }}>{u.email ?? u.phone ?? ''}</AT></View>],
                  ['Şehir', <View key="c" style={{ alignItems: 'flex-end' }}><AT style={{ fontSize: 13, color: adm.muted }}>{u.primaryCityName ?? '—'}</AT><AT style={{ fontSize: 11, color: adm.muted }}>Bu hafta: {u.activeCityName ?? '—'}</AT></View>],
                  ['Paket', <AT key="p" style={{ fontSize: 13, color: adm.muted }}>{planOf(u)}</AT>],
                  ['OCEAN Ort.', <AMono key="o" style={{ fontSize: 13 }}>{oceanAvg(u.oceanScore)}</AMono>],
                  ['Durum', <StatusPill key="s" text={s.label} color={s.color} bg={s.bg} border={s.border} pad={[2, 8]} />],
                  ['', <Btn key="d" variant="admDetailBtn" label="Detay" onPress={() => openModal(u.id)} />],
                ]} />
              ); })}
          </ACard>
          <APager page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </>
      )}
      <Modal visible={modalLoading || !!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable onPress={() => setModal(null)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 360, maxHeight: '85%', borderRadius: llCard.radius, borderWidth: 1, borderColor: adm.border, backgroundColor: adm.card }}>
            <ScrollView contentContainerStyle={{ padding: llCard.padding, gap: 16 }} keyboardShouldPersistTaps="handled">
              {modalLoading && [0, 1, 2, 3].map(i => <View key={i} style={{ height: 40, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}
              {m && st && !modalLoading && (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flexShrink: 1 }}>
                      <AT w={600} style={{ fontSize: 14 }}>{m.profile ? `${m.profile.firstName} ${m.profile.lastName}` : m.email}</AT>
                      {!!m.email && <AMono style={{ marginTop: 3, fontSize: 10 }}>{m.email}</AMono>}
                      {!!m.phone && <AMono style={{ marginTop: 2, fontSize: 10 }}>{m.phone}</AMono>}
                      <AT style={{ marginTop: 2, fontSize: 10, color: adm.muted }}>{m.role}</AT>
                    </View>
                    <Btn variant="admX" label="✕" accessibilityLabel="Kapat" textStyle={{ fontSize: 16 }} onPress={() => setModal(null)} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {!!m.profile?.birthDate && <AT style={{ fontSize: 11, color: adm.muted }}>{Math.floor((Date.now() - new Date(m.profile.birthDate).getTime()) / 31557600000)} yaş</AT>}
                    {!!m.profile?.occupation && <AT style={{ fontSize: 11, color: adm.muted }}>{m.profile.occupation}</AT>}
                    {([['Grup hakkı', m.rights?.group ?? 0], ['Başbaşa hakkı', m.rights?.oneOnOne ?? 0], ['Kankamla hakkı', m.rights?.kanka ?? 0], ['Kanka', m.kanka ? m.kanka.name : 'yok']] as const).map(([k, v]) => (
                      <AT key={k} style={{ fontSize: 11, color: adm.muted }}>{k}: <AT style={{ fontSize: 11, color: '#93c5fd' }}>{String(v)}</AT></AT>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <StatusPill text={st.label} color={st.color} bg={st.bg} border={st.border} pad={[2, 8]} />
                    <StatusPill text={`KYC: ${kycOk ? 'Onaylı ✓' : m.kyc?.status ?? 'Yok'}`} color={kycOk ? adm.green : adm.muted} bg={kycOk ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)'} border={kycOk ? 'rgba(34,197,94,0.3)' : adm.border} pad={[2, 8]} />
                    {m.subscriptions.map(s => (
                      <View key={s.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 99, backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' }}>
                        <ALabel style={{ color: '#93c5fd' }}>{PL[s.plan] ?? s.plan}</ALabel>
                        <Btn variant="admChipX" label="✕" accessibilityLabel={`${PL[s.plan] ?? s.plan} aboneliğini iptal et`} onPress={() => setSubToCancel(s)} />
                      </View>
                    ))}
                  </View>
                  {subToCancel && (
                    <View style={{ padding: 10, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', gap: 8 }}>
                      <AT style={{ fontSize: 13 }}>{PL[subToCancel.plan] ?? subToCancel.plan} aboneliği iptal edilsin mi? Bu işlem geri alınamaz.</AT>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <Btn variant="admRed6" disabled={action === 'cancelSub'} label={action === 'cancelSub' ? 'İptal ediliyor…' : 'İptal Et'} onPress={cancelSub} />
                        <Btn variant="admMuted6" label="Vazgeç" onPress={() => setSubToCancel(null)} />
                      </View>
                    </View>
                  )}
                  <AdminUserEdit user={m} canEdit={canSanction(m)} onSaved={() => refresh(m.id)} />
                  <AdminNoShowWarnings userId={m.id} reports={m.noShowReportsReceived ?? []} warnings={m.noShowWarnings ?? { count: 0, limit: 3, warnedMeetingIds: [] }} canSanction={canSanction(m)} userStatus={m.status}
                    suspending={action === 'SUSPENDED'} onChanged={w => setModal(u => (u ? { ...u, noShowWarnings: w } : null))} onSuspend={() => updStatus('SUSPENDED', 'Masaya katılım sağlamama')} />
                  <AdminSanctionHistory userId={m.id} canAct={canSanction(m)} onChanged={() => refresh(m.id)} />
                  <Sect>
                    <ALabel>HESAP İŞLEMLERİ</ALabel>
                    {canSanction(m) ? (
                      <>
                        {m.status !== 'SUSPENDED' && <AdminSelect value={reason} onChange={setReason} placeholder="Askı sebebi (boşsa: Yönetici kararı)" title="Askı sebebi" options={[{ value: '', label: 'Yönetici kararı' }, ...reasons.map(x => ({ value: x, label: x }))]} />}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {m.status !== 'SUSPENDED' && <Btn variant="admActAmber" disabled={!!action} label={action === 'SUSPENDED' ? '…' : 'Askıya Al (1 ay)'} onPress={() => updStatus('SUSPENDED')} />}
                          {m.status === 'SUSPENDED' && myRole() === 'SUPERADMIN' && <Btn variant="admActGreen" disabled={!!action} label={action === 'ACTIVE' ? '…' : 'Aktifleştir'} onPress={() => updStatus('ACTIVE')} />}
                        </View>
                      </>
                    ) : <AT style={{ fontSize: 11, color: adm.muted }}>Bu hesaba işlem yetkiniz yok</AT>}
                  </Sect>
                  {m.oceanScore && (
                    <Sect>
                      <ALabel>KİŞİLİK TESTİ</ALabel>
                      <AT style={{ fontSize: 11, color: adm.muted }}>Son test: {new Date(m.oceanScore.completedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}{m.oceanScore.adminCanReset ? ' · Kilit açık, kullanıcı testi yeniden yapabilir' : ' · 180 gün kilitli'}</AT>
                      {!m.oceanScore.adminCanReset && <Btn variant="admActBlue" disabled={!!action} label={action === 'test' ? '…' : 'Test Kilidini Sıfırla'} onPress={resetTest} />}
                    </Sect>
                  )}
                  {m.kyc && m.kyc.status !== 'APPROVED' && (
                    <Sect>
                      <ALabel>KYC</ALabel>
                      <Btn variant="admGreenLg" disabled={!!action} label={action === 'kyc' ? 'Onaylanıyor…' : "KYC'yi Onayla"} onPress={approveKyc} />
                    </Sect>
                  )}
                  {myRole() === 'SUPERADMIN' && (
                    <Sect>
                      <ALabel>ÜCRETSİZ ABONELİK VER</ALabel>
                      {!kycOk && <AT style={{ fontSize: 10, color: adm.red }}>KYC onaylı değil: paket verilse bile kullanıcı KYC tamamlanana kadar eşleşmeye katılamaz.</AT>}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <View style={{ flex: 1 }}><AdminSelect value={grant} onChange={setGrant} placeholder="Paket seç…" title="Paket seç" options={PLANS} /></View>
                        <Btn variant="admCyanVer" disabled={!!action || !grant} label={action === 'sub' ? '…' : 'Ver'} onPress={grantSub} />
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
