'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { myRole, myId } from '@/lib/adminRole';
import { AdminUserEdit } from '@/components/AdminUserEdit';
import { AdminSanctionHistory } from '@/components/AdminSanctionHistory';
import { AdminNoShowWarnings, type NoShowReportItem, type NoShowWarningInfo } from '@/components/AdminNoShowWarnings';

// Yaptırım yetkisi (backend assertCanSanction ile aynı kural)
function canSanction(target: { id: string; role: string }): boolean {
  const meId = myId();
  if (!meId) return false;
  if (meId === target.id || target.role === 'SUPERADMIN') return false;
  return target.role !== 'ADMIN' || myRole() === 'SUPERADMIN';
}

const BG     = '#020c1b';
const SURFACE = '#0a1628';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const BLUE   = '#3b82f6';
const AMBER  = '#f59e0b';
const CYAN   = '#22d3ee';
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const inputStyle: React.CSSProperties = {
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 12, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface AdminUser {
  id: string; email: string; phone?: string; role: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  profile?: { firstName?: string; lastName?: string; city?: string | null; isPioneer?: boolean } | null;
  kyc?: { status: string } | null;
  oceanScore?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number } | null;
  subscriptions?: { plan: string }[];
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
  groupCount: number; oneOnOneCount: number; kankaCount?: number;
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
  MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla',
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

  const totalPages = Math.ceil(total / 20);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>Kullanıcılar</h1>
      </div>

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
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 160 }}
        >
          <option value="">Tüm üyeler</option>
          <option value="NO_PLAN">Aboneliksiz</option>
          <option value="MASADA">Masada</option>
          <option value="KARSIMDA">Karşımda</option>
          <option value="ICERDE">İçerde</option>
          <option value="KANKAMLA">Kankamla</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPERADMIN">Superadmin</option>
        </select>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 12, color: RED }}>{error}</p>}

      {/* Tablo */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE }}>KULLANICILAR</span>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{total} kayıt</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Kullanıcı', 'Şehir', 'Paket', 'OCEAN Ort.', 'Durum', ''].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: MUTED }}>{h}</th>
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
                        <td style={{ padding: '10px 14px' }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.profile?.firstName ?? ''} {u.profile?.lastName ?? ''}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email ?? u.phone ?? ''}</p>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: MUTED }}>{u.profile?.city ?? '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: MUTED }}>{activePlan(u)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: MUTED, fontFamily: MONO }}>{oceanAvg(u.oceanScore)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                            padding: '2px 8px', borderRadius: 99,
                            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                          }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
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

      {/* Kullanıcı detay modalı */}
      {(userModalLoading || userModal) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setUserModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 360, maxHeight: '85vh', overflowY: 'auto', padding: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 16 }}
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
                  <span style={{ fontSize: 11, color: MUTED }}>Grup: <span style={{ color: '#93c5fd' }}>{userModal.groupCount}</span></span>
                  <span style={{ fontSize: 11, color: MUTED }}>Başbaşa: <span style={{ color: '#93c5fd' }}>{userModal.oneOnOneCount}</span></span>
                  <span style={{ fontSize: 11, color: MUTED }}>Kankamla: <span style={{ color: '#93c5fd' }}>{userModal.kankaCount ?? 0}</span></span>
                  <span style={{ fontSize: 11, color: MUTED }}>Kanka: <span style={{ color: '#93c5fd' }}>{userModal.kanka ? userModal.kanka.name : 'yok'}</span></span>
                </div>

                {/* Durum badge'leri */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(() => {
                    const s = STATUS_STYLE[userModal.status] ?? STATUS_STYLE.ACTIVE;
                    return (
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 99, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                        {s.label}
                      </span>
                    );
                  })()}
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 99,
                    background: userModal.kyc?.status === 'APPROVED' ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                    color: userModal.kyc?.status === 'APPROVED' ? GREEN : MUTED,
                    border: `1px solid ${userModal.kyc?.status === 'APPROVED' ? 'rgba(34,197,94,0.3)' : BORDER}`,
                  }}>
                    KYC: {userModal.kyc?.status === 'APPROVED' ? 'Onaylı ✓' : userModal.kyc?.status ?? 'Yok'}
                  </span>
                  {/* Tüm aktif paketler (backend sadece ACTIVE gönderir) */}
                  {userModal.subscriptions.map(s => (
                    <span key={s.id} style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)',
                    }}>
                      {{ MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla' }[s.plan] ?? s.plan}
                    </span>
                  ))}
                </div>

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
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>HESAP İŞLEMLERİ</span>
                  {canSanction(userModal) ? (<>
                  {userModal.status !== 'SUSPENDED' && (
                    <select
                      value={sanctionReason}
                      onChange={e => setSanctionReason(e.target.value)}
                      style={{
                        padding: '6px 10px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`,
                        fontSize: 11, color: TEXT, fontFamily: SANS, outline: 'none',
                      }}
                    >
                      <option value="">Askı sebebi (boşsa: Yönetici kararı)</option>
                      {sanctionReasons.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
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
                    {userModal.status !== 'DELETED' && (
                      <button
                        onClick={() => modalUpdateStatus('DELETED')} disabled={!!userAction}
                        style={{
                          padding: '5px 12px', borderRadius: 8, cursor: userAction ? 'not-allowed' : 'pointer',
                          background: 'rgba(239,68,68,0.1)', color: RED, border: '1px solid rgba(239,68,68,0.3)',
                          fontSize: 11, fontWeight: 600, fontFamily: SANS, opacity: userAction ? 0.5 : 1,
                        }}
                      >
                        {userAction === 'DELETED' ? '…' : 'Hesabı Sil'}
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
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>KİŞİLİK TESTİ</span>
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
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>KYC</span>
                    <button
                      onClick={modalApproveKyc} disabled={!!userAction}
                      style={{
                        padding: '8px', borderRadius: 8, cursor: userAction ? 'not-allowed' : 'pointer',
                        background: 'rgba(34,197,94,0.1)', color: GREEN, border: '1px solid rgba(34,197,94,0.3)',
                        fontSize: 12, fontWeight: 600, fontFamily: SANS, opacity: userAction ? 0.5 : 1,
                      }}
                    >
                      {userAction === 'kyc' ? 'Onaylanıyor…' : "KYC'yi Onayla"}
                    </button>
                  </div>
                )}

                {/* Abonelik ver — ücretsiz paket sadece SUPERADMIN */}
                {myRole() === 'SUPERADMIN' && (
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>ÜCRETSİZ ABONELİK VER</span>
                  {userModal.kyc?.status !== 'APPROVED' && (
                    <p style={{ margin: 0, fontSize: 10, color: RED }}>
                      KYC onaylı değil: paket verilse bile kullanıcı KYC tamamlanana kadar eşleşmeye katılamaz.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={grantPlan} onChange={e => setGrantPlan(e.target.value)}
                      style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none', fontFamily: SANS }}
                    >
                      <option value="">Paket seç…</option>
                      <option value="MASADA">Masada</option>
                      <option value="KARSIMDA">Karşımda</option>
                      <option value="ICERDE">İçerde</option>
                      <option value="KANKAMLA">Kankamla</option>
                    </select>
                    <button
                      onClick={modalGrantSubscription} disabled={!!userAction || !grantPlan}
                      style={{
                        padding: '7px 16px', borderRadius: 8, cursor: (userAction || !grantPlan) ? 'not-allowed' : 'pointer',
                        background: 'rgba(34,211,238,0.1)', color: CYAN, border: '1px solid rgba(34,211,238,0.3)',
                        fontSize: 12, fontWeight: 600, fontFamily: SANS,
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
