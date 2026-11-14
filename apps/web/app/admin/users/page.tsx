'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { myRole, myId } from '@/lib/adminRole';
import { AdminUserEdit } from '@/components/AdminUserEdit';
import { AdminSanctionHistory } from '@/components/AdminSanctionHistory';
import { AdminNoShowWarnings, type NoShowReportItem, type NoShowWarningInfo } from '@/components/AdminNoShowWarnings';
import { SURFACE, BORDER, TEXT, MUTED, RED, GREEN, AMBER, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';
import { AdminSelect } from '@/components/AdminSelect';
import { AdminDeletionRequests } from '@/components/AdminDeletionRequests';

// Yaptırım yetkisi (backend assertCanSanction ile aynı kural)
function canSanction(target: { id: string; role: string }): boolean {
  const meId = myId();
  if (!meId) return false;
  if (meId === target.id || target.role === 'SUPERADMIN') return false;
  return target.role !== 'ADMIN' || myRole() === 'SUPERADMIN';
}


const inputStyle: React.CSSProperties = {
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 13, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface AdminUser {
  id: string; email: string; phone?: string; role: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  profile?: { firstName?: string; lastName?: string; city?: string | null; isPioneer?: boolean } | null;
  kyc?: { status: string } | null;
  oceanScore?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number } | null;
  subscriptions?: { plan: string }[];
  primaryCityName?: string | null;
  activeCityName?: string | null;
}

interface UsersResponse {
  data: AdminUser[]; total: number; page: number; totalPages: number;
}

interface AdminUserDetail {
  id: string; email: string; phone: string | null; role: string; status: string;
  profile: { firstName: string | null; lastName: string | null; city: string | null; birthDate: string | null; occupation: string | null; gender?: string | null; primaryCity?: string | null } | null;
  occupationSector?: string | null;
  kyc: { status: string } | null;
  subscriptions: { id: string; plan: string; status: string }[];
  rights?: { group: number; oneOnOne: number; kanka: number };
  kanka?: { userId: string; name: string; since: string } | null;
  oceanScore?: { completedAt: string; adminCanReset: boolean } | null;
  noShowReportsReceived?: NoShowReportItem[];
  noShowWarnings?: NoShowWarningInfo;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ACTIVE:    { label: 'Aktif',     color: GREEN,  bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.3)'  },
  SUSPENDED: { label: 'Karantina', color: AMBER,  bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)' },
  DELETED:   { label: 'Silindi',   color: MUTED,  bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
};

const PLAN_LABEL: Record<string, string> = {
  MASADA: 'Grup', KARSIMDA: 'Başbaşa', ICERDE: 'İçerde', KANKAMLA: 'Kankamla',
  PRIME_1M: 'Prime 1 Aylık', PRIME_3M: 'Prime 3 Aylık', PRIME_6M: 'Prime 6 Aylık', PRIME_12M: 'Prime 12 Aylık',
};

function oceanAvg(o: AdminUser['oceanScore']): string {
  if (!o) return '—';
  return ((o.openness + o.conscientiousness + o.extraversion + o.agreeableness + o.neuroticism) / 5).toFixed(0);
}

function activePlan(u: AdminUser): string {
  if (!u.subscriptions?.length) return '—';
  return u.subscriptions.map(s => PLAN_LABEL[s.plan] ?? s.plan).join(', ');
}

export default function AdminUsers() {
  const [tab, setTab] = useState<'users' | 'deletions'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const [userModal, setUserModal] = useState<AdminUserDetail | null>(null);
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [userAction, setUserAction] = useState<string | null>(null);
  const [sanctionReasons, setSanctionReasons] = useState<string[]>([]);
  const [sanctionReason, setSanctionReason] = useState('');
  const [grantPlan, setGrantPlan] = useState('');
  const [subToCancel, setSubToCancel] = useState<AdminUserDetail['subscriptions'][number] | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (cityFilter) params.set('city', cityFilter);
    if (typeFilter) params.set('type', typeFilter);
    api.get<UsersResponse>(`/admin/users?${params}`)
      .then(r => { setUsers(r.data ?? []); setTotal(r.total ?? 0); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, cityFilter, typeFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<string[]>('/admin/sanction-reasons').then(setSanctionReasons).catch(() => {}); }, []);

  async function updateStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DELETED') {
    setProcessing(p => ({ ...p, [userId]: true }));
    try {
      await api.patch(`/admin/users/${userId}/status`, { status });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
    } catch (e) { setError((e as Error).message); }
    finally { setProcessing(p => { const n = { ...p }; delete n[userId]; return n; }); }
  }

  // Pencereyi kapatmadan detayı yeniler (düzenleme / yaptırım sonrası)
  function refreshUserModal(userId: string) {
    api.get<AdminUserDetail>(`/admin/users/${userId}`).then(setUserModal)
      .catch((e: Error) => setError(`Kullanıcı yüklenemedi: ${e.message}`));
  }

  async function openUserModal(userId: string) {
    setUserModalLoading(true);
    setUserModal(null);
    setSubToCancel(null);
    try {
      const u = await api.get<AdminUserDetail>(`/admin/users/${userId}`);
      setUserModal(u); setGrantPlan('');
    } catch (e) { setError(`Kullanıcı yüklenemedi: ${(e as Error).message}`); }
    finally { setUserModalLoading(false); }
  }

  async function modalUpdateStatus(status: string, reasonOverride?: string) {
    if (!userModal) return;
    setUserAction(status);
    const reason = reasonOverride ?? sanctionReason;
    try {
      await api.patch(`/admin/users/${userModal.id}/status`, status === 'SUSPENDED' && reason ? { status, reason } : { status });
      setUserModal(u => u ? { ...u, status } : null);
      setUsers(prev => prev.map(u => u.id === userModal.id ? { ...u, status: status as 'ACTIVE' | 'SUSPENDED' | 'DELETED' } : u));
    } catch (e) { setError(`İşlem başarısız: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  async function modalResetTestLock() {
    if (!userModal) return;
    setUserAction('test');
    try {
      await api.patch(`/admin/users/${userModal.id}/test-lock-reset`, {});
      setUserModal(u => u && u.oceanScore ? { ...u, oceanScore: { ...u.oceanScore, adminCanReset: true } } : u);
    } catch (e) { setError(`Test kilidi sıfırlanamadı: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  async function modalApproveKyc() {
    if (!userModal) return;
    setUserAction('kyc');
    try {
      await api.post(`/admin/users/${userModal.id}/kyc-approve`, {});
      setUserModal(u => u ? { ...u, kyc: { status: 'APPROVED' } } : null);
    } catch (e) { setError(`KYC onaylanamadı: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  async function modalGrantSubscription() {
    if (!userModal || !grantPlan) return;
    setUserAction('sub');
    try {
      await api.post(`/admin/users/${userModal.id}/free-subscription`, { plan: grantPlan });
      setGrantPlan('');
      // Çakışan paket iptal edilmiş olabilir: rozetler ve listedeki Paket sütunu güncellenir
      refreshUserModal(userModal.id);
      load();
    } catch (e) { setError(`Abonelik verilemedi: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  // Abonelikler sayfasındaki İptal Et ile aynı uç (İşlem Kayıtları'na yazılır)
  async function modalCancelSubscription() {
    if (!userModal || !subToCancel) return;
    setUserAction('cancelSub');
    try {
      await api.patch(`/admin/subscriptions/${subToCancel.id}/cancel`, {});
      setSubToCancel(null);
      refreshUserModal(userModal.id);
      load();
    } catch (e) { setError(`Abonelik iptal edilemedi: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="adm-page" style={{ maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 className="ll-title">Kullanıcılar</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {([['users', 'Kullanıcılar'], ['deletions', 'Silme Talepleri']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontFamily: SANS, cursor: 'pointer', background: tab === key ? 'rgba(34,211,238,0.08)' : 'transparent', border: `1px solid ${tab === key ? 'rgba(34,211,238,0.3)' : BORDER}`, color: tab === key ? TEXT : MUTED }}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'deletions' && <AdminDeletionRequests />}
      {tab === 'users' && <>
      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <input
          type="text" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Ad, soyad veya e-posta..."
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
        />
        <input
          type="text" value={cityFilter}
          onChange={e => { setCityFilter(e.target.value); setPage(1); }}
          placeholder="Şehir..."
          style={{ ...inputStyle, width: 120 }}
        />
        <div style={{ width: 160 }}>
          <AdminSelect
            value={typeFilter}
            onChange={v => { setTypeFilter(v); setPage(1); }}
            placeholder="Tüm üyeler"
            title="Üye filtresi"
            options={[
              { value: '', label: 'Tüm üyeler' }, { value: 'NO_PLAN', label: 'Aboneliksiz' },
              { value: 'MASADA', label: 'Grup' }, { value: 'KARSIMDA', label: 'Başbaşa' },
              { value: 'ICERDE', label: 'İçerde' }, { value: 'KANKAMLA', label: 'Kankamla' },
              { value: 'PRIME_1M', label: 'Prime 1 Aylık' }, { value: 'PRIME_3M', label: 'Prime 3 Aylık' },
              { value: 'PRIME_6M', label: 'Prime 6 Aylık' }, { value: 'PRIME_12M', label: 'Prime 12 Aylık' },
              { value: 'ADMIN', label: 'Admin' }, { value: 'SUPERADMIN', label: 'Superadmin' },
            ]}
          />
        </div>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      {/* Tablo */}
      <div className="ll-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ll-title">Kullanıcılar</h2>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{total} kayıt</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="adm-table" style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Kullanıcı', 'Şehir', 'Paket', 'OCEAN Ort.', 'Durum', ''].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', ...LABEL, color: MUTED }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0,1,2,3,4].map(i => (
                    <tr key={i}><td colSpan={6} style={{ padding: '8px 14px' }}>
                      <div style={{ height: 32, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />
                    </td></tr>
                  ))
                : users.map((u, i) => {
                    const s = STATUS_STYLE[u.status] ?? STATUS_STYLE.ACTIVE;
                    return (
                      <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none' }}>
                        <td data-label="Kullanıcı" style={{ padding: '6px 10px' }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.profile?.firstName ?? ''} {u.profile?.lastName ?? ''}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email ?? u.phone ?? ''}</p>
                        </td>
                        <td data-label="Şehir" style={{ padding: '6px 10px', fontSize: 13, color: MUTED }}>
                          <div>{u.primaryCityName ?? '—'}</div>
                          <div style={{ fontSize: 11 }}>Bu hafta: {u.activeCityName ?? '—'}</div>
                        </td>
                        <td data-label="Paket" style={{ padding: '6px 10px', fontSize: 13, color: MUTED }}>{activePlan(u)}</td>
                        <td data-label="OCEAN Ort." style={{ padding: '6px 10px', fontSize: 13, color: MUTED, fontFamily: MONO }}>{oceanAvg(u.oceanScore)}</td>
                        <td data-label="Durum" style={{ padding: '6px 10px' }}>
                          <span style={{
                            ...LABEL,
                            padding: '2px 8px', borderRadius: 99,
                            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                          }}>
                            {s.label}
                          </span>
                        </td>
                        <td data-label="" style={{ padding: '6px 10px' }}>
                          <button
                            onClick={() => openUserModal(u.id)}
                            style={{
                              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                              background: 'transparent', border: `1px solid ${BORDER}`,
                              fontSize: 10, color: MUTED, fontFamily: SANS,
                            }}
                          >
                            Detay
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
          {!loading && users.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Kullanıcı bulunamadı.</p>
            </div>
          )}
        </div>
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{
              padding: '6px 16px', borderRadius: 99, cursor: page === 1 ? 'not-allowed' : 'pointer',
              background: 'transparent', border: `1px solid ${BORDER}`,
              fontSize: 11, color: MUTED, fontFamily: SANS, opacity: page === 1 ? 0.4 : 1,
            }}
          >
            ← Önceki
          </button>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{
              padding: '6px 16px', borderRadius: 99, cursor: page === totalPages ? 'not-allowed' : 'pointer',
              background: 'transparent', border: `1px solid ${BORDER}`,
              fontSize: 11, color: MUTED, fontFamily: SANS, opacity: page === totalPages ? 0.4 : 1,
            }}
          >
            Sonraki →
          </button>
        </div>
      )}

      </>}

      {/* Kullanıcı detay modalı */}
      {(userModalLoading || userModal) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setUserModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="ll-card" style={{ width: '100%', maxWidth: 360, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {userModalLoading && [0,1,2,3].map(i => (
              <div key={i} style={{ height: 40, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />
            ))}

            {userModal && !userModalLoading && (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>
                      {userModal.profile ? `${userModal.profile.firstName} ${userModal.profile.lastName}` : userModal.email}
                    </p>
                    {userModal.email && <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>{userModal.email}</p>}
                    {userModal.phone && <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>{userModal.phone}</p>}
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED }}>{userModal.role}</p>
                  </div>
                  <button
                    onClick={() => setUserModal(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4, flexShrink: 0 }}
                  >✕</button>
                </div>

                {/* Yaş, meslek, masa sayıları */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {userModal.profile?.birthDate && (
                    <span style={{ fontSize: 11, color: MUTED }}>
                      {Math.floor((Date.now() - new Date(userModal.profile.birthDate).getTime()) / 31557600000)} yaş
                    </span>
                  )}
                  {userModal.profile?.occupation && (
                    <span style={{ fontSize: 11, color: MUTED }}>{userModal.profile.occupation}</span>
                  )}
                  <span style={{ fontSize: 11, color: MUTED }}>Grup hakkı: <span style={{ color: '#93c5fd' }}>{userModal.rights?.group ?? 0}</span></span>
                  <span style={{ fontSize: 11, color: MUTED }}>Başbaşa hakkı: <span style={{ color: '#93c5fd' }}>{userModal.rights?.oneOnOne ?? 0}</span></span>
                  <span style={{ fontSize: 11, color: MUTED }}>Kankamla hakkı: <span style={{ color: '#93c5fd' }}>{userModal.rights?.kanka ?? 0}</span></span>
                  <span style={{ fontSize: 11, color: MUTED }}>Kanka: <span style={{ color: '#93c5fd' }}>{userModal.kanka ? userModal.kanka.name : 'yok'}</span></span>
                </div>

                {/* Durum badge'leri */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(() => {
                    const s = STATUS_STYLE[userModal.status] ?? STATUS_STYLE.ACTIVE;
                    return (
                      <span style={{ ...LABEL, padding: '2px 8px', borderRadius: 99, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                        {s.label}
                      </span>
                    );
                  })()}
                  <span style={{
                    ...LABEL, padding: '2px 8px', borderRadius: 99,
                    background: userModal.kyc?.status === 'APPROVED' ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                    color: userModal.kyc?.status === 'APPROVED' ? GREEN : MUTED,
                    border: `1px solid ${userModal.kyc?.status === 'APPROVED' ? 'rgba(34,197,94,0.3)' : BORDER}`,
                  }}>
                    KYC: {userModal.kyc?.status === 'APPROVED' ? 'Onaylı ✓' : userModal.kyc?.status ?? 'Yok'}
                  </span>
                  {/* Tüm aktif paketler (backend sadece ACTIVE gönderir) */}
                  {userModal.subscriptions.map(s => (
                    <span key={s.id} style={{
                      ...LABEL, padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)',
                    }}>
                      {PLAN_LABEL[s.plan] ?? s.plan}
                      <button
                        type="button"
                        onClick={() => setSubToCancel(s)}
                        aria-label={`${PLAN_LABEL[s.plan] ?? s.plan} aboneliğini iptal et`}
                        style={{ marginLeft: 6, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 11, lineHeight: 1 }}
                      >✕</button>
                    </span>
                  ))}
                </div>
                {subToCancel && (
                  <div style={{ padding: 10, borderRadius: 8, background: SURFACE, border: '1px solid rgba(239,68,68,0.3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 13, color: TEXT }}>{PLAN_LABEL[subToCancel.plan] ?? subToCancel.plan} aboneliği iptal edilsin mi? Bu işlem geri alınamaz.</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={modalCancelSubscription}
                        disabled={userAction === 'cancelSub'}
                        style={{ flex: 1, padding: '6px', borderRadius: 6, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: RED, fontFamily: SANS }}
                      >
                        {userAction === 'cancelSub' ? 'İptal ediliyor…' : 'İptal Et'}
                      </button>
                      <button
                        onClick={() => setSubToCancel(null)}
                        style={{ flex: 1, padding: '6px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: `1px solid ${BORDER}`, fontSize: 13, color: MUTED, fontFamily: SANS }}
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}

                {/* Kişisel bilgi düzenleme */}
                <AdminUserEdit user={userModal} canEdit={canSanction(userModal)} onSaved={() => refreshUserModal(userModal.id)} />

                {/* Gelmedi bildirimleri + uyarı */}
                <AdminNoShowWarnings
                  userId={userModal.id}
                  reports={userModal.noShowReportsReceived ?? []}
                  warnings={userModal.noShowWarnings ?? { count: 0, limit: 3, warnedMeetingIds: [] }}
                  canSanction={canSanction(userModal)}
                  userStatus={userModal.status}
                  suspending={userAction === 'SUSPENDED'}
                  onChanged={w => setUserModal(u => u ? { ...u, noShowWarnings: w } : null)}
                  onSuspend={() => modalUpdateStatus('SUSPENDED', 'Masaya katılım sağlamama')}
                />

                {/* Yaptırım geçmişi */}
                <AdminSanctionHistory userId={userModal.id} canAct={canSanction(userModal)} onChanged={() => refreshUserModal(userModal.id)} />

                {/* Hesap işlemleri */}
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ ...LABEL, color: MUTED }}>HESAP İŞLEMLERİ</span>
                  {canSanction(userModal) ? (<>
                  {userModal.status !== 'SUSPENDED' && (
                    <AdminSelect
                      value={sanctionReason}
                      onChange={setSanctionReason}
                      placeholder="Askı sebebi (boşsa: Yönetici kararı)"
                      title="Askı sebebi"
                      options={[{ value: '', label: 'Yönetici kararı' }, ...sanctionReasons.map(x => ({ value: x, label: x }))]}
                    />
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {userModal.status !== 'SUSPENDED' && (
                      <button
                        onClick={() => modalUpdateStatus('SUSPENDED')} disabled={!!userAction}
                        style={{
                          padding: '5px 12px', borderRadius: 8, cursor: userAction ? 'not-allowed' : 'pointer',
                          background: 'rgba(245,158,11,0.1)', color: AMBER, border: '1px solid rgba(245,158,11,0.3)',
                          fontSize: 11, fontWeight: 600, fontFamily: SANS, opacity: userAction ? 0.5 : 1,
                        }}
                      >
                        {userAction === 'SUSPENDED' ? '…' : 'Askıya Al (1 ay)'}
                      </button>
                    )}
                    {userModal.status === 'SUSPENDED' && myRole() === 'SUPERADMIN' && (
                      <button
                        onClick={() => modalUpdateStatus('ACTIVE')} disabled={!!userAction}
                        style={{
                          padding: '5px 12px', borderRadius: 8, cursor: userAction ? 'not-allowed' : 'pointer',
                          background: 'rgba(34,197,94,0.1)', color: GREEN, border: '1px solid rgba(34,197,94,0.3)',
                          fontSize: 11, fontWeight: 600, fontFamily: SANS, opacity: userAction ? 0.5 : 1,
                        }}
                      >
                        {userAction === 'ACTIVE' ? '…' : 'Aktifleştir'}
                      </button>
                    )}
                  </div>
                  </>) : (
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, fontFamily: SANS }}>Bu hesaba işlem yetkiniz yok</p>
                  )}
                </div>

                {/* Kişilik testi kilidi */}
                {userModal.oceanScore && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ ...LABEL, color: MUTED }}>KİŞİLİK TESTİ</span>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                      Son test: {new Date(userModal.oceanScore.completedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                      {userModal.oceanScore.adminCanReset ? ' · Kilit açık, kullanıcı testi yeniden yapabilir' : ' · 180 gün kilitli'}
                    </p>
                    {!userModal.oceanScore.adminCanReset && (
                      <button
                        onClick={modalResetTestLock} disabled={!!userAction}
                        style={{
                          alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 8, cursor: userAction ? 'not-allowed' : 'pointer',
                          background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)',
                          fontSize: 11, fontWeight: 600, fontFamily: SANS, opacity: userAction ? 0.5 : 1,
                        }}
                      >
                        {userAction === 'test' ? '…' : 'Test Kilidini Sıfırla'}
                      </button>
                    )}
                  </div>
                )}

                {/* KYC onayla */}
                {userModal.kyc && userModal.kyc.status !== 'APPROVED' && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ ...LABEL, color: MUTED }}>KYC</span>
                    <button
                      onClick={modalApproveKyc} disabled={!!userAction}
                      style={{
                        padding: '8px', borderRadius: 8, cursor: userAction ? 'not-allowed' : 'pointer',
                        background: 'rgba(34,197,94,0.1)', color: GREEN, border: '1px solid rgba(34,197,94,0.3)',
                        fontSize: 13, fontWeight: 600, fontFamily: SANS, opacity: userAction ? 0.5 : 1,
                      }}
                    >
                      {userAction === 'kyc' ? 'Onaylanıyor…' : "KYC'yi Onayla"}
                    </button>
                  </div>
                )}

                {/* Abonelik ver — ücretsiz paket sadece SUPERADMIN */}
                {myRole() === 'SUPERADMIN' && (
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ ...LABEL, color: MUTED }}>ÜCRETSİZ ABONELİK VER</span>
                  {userModal.kyc?.status !== 'APPROVED' && (
                    <p style={{ margin: 0, fontSize: 10, color: RED }}>
                      KYC onaylı değil: paket verilse bile kullanıcı KYC tamamlanana kadar eşleşmeye katılamaz.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <AdminSelect
                      value={grantPlan}
                      onChange={setGrantPlan}
                      placeholder="Paket seç…"
                      title="Paket seç"
                      style={{ flex: 1, width: 'auto', minWidth: 0 }}
                      options={[
              { value: 'MASADA', label: 'Grup' }, { value: 'KARSIMDA', label: 'Başbaşa' },
              { value: 'ICERDE', label: 'İçerde' }, { value: 'KANKAMLA', label: 'Kankamla' },
              { value: 'PRIME_1M', label: 'Prime 1 Aylık' }, { value: 'PRIME_3M', label: 'Prime 3 Aylık' },
              { value: 'PRIME_6M', label: 'Prime 6 Aylık' }, { value: 'PRIME_12M', label: 'Prime 12 Aylık' },
            ]}
                    />
                    <button
                      onClick={modalGrantSubscription} disabled={!!userAction || !grantPlan}
                      style={{
                        padding: '7px 16px', borderRadius: 8, cursor: (userAction || !grantPlan) ? 'not-allowed' : 'pointer',
                        background: 'rgba(34,211,238,0.1)', color: CYAN, border: '1px solid rgba(34,211,238,0.3)',
                        fontSize: 13, fontWeight: 600, fontFamily: SANS,
                        opacity: (userAction || !grantPlan) ? 0.5 : 1,
                      }}
                    >
                      {userAction === 'sub' ? '…' : 'Ver'}
                    </button>
                  </div>
                </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
