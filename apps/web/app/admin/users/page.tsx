'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface AdminUser {
  id: string;
  email: string;
  phone?: string;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  profile?: {
    firstName?: string;
    lastName?: string;
    city?: string | null;
    isPioneer?: boolean;
  } | null;
  kyc?: { status: string } | null;
  oceanScore?: {
    openness: number; conscientiousness: number; extraversion: number;
    agreeableness: number; neuroticism: number;
  } | null;
  subscriptions?: { plan: string }[];
}

interface UsersResponse {
  data: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_STYLE: Record<string, { label: string; color: string; border: string }> = {
  ACTIVE:    { label: 'Aktif',    color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  SUSPENDED: { label: 'Karantina', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  DELETED:   { label: 'Silindi',  color: '#888',    border: 'rgba(255,255,255,0.1)' },
};

const PLAN_LABEL: Record<string, string> = {
  MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde',
};

function oceanAvg(o: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number } | null | undefined): string {
  if (!o) return '—';
  return ((o.openness + o.conscientiousness + o.extraversion + o.agreeableness + o.neuroticism) / 5).toFixed(0);
}

function activePlan(u: AdminUser): string {
  if (!u.subscriptions?.length) return '—';
  return u.subscriptions.map(s => PLAN_LABEL[s.plan] ?? s.plan).join(', ');
}

function Skel() {
  return <div className="h-16 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }} />;
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

  // Kullanıcı detay modalı
  interface AdminUserDetail {
    id: string; email: string; phone: string | null; role: string; status: string;
    profile: { firstName: string | null; lastName: string | null; city: string | null } | null;
    kyc: { status: string } | null;
    subscriptions: { id: string; plan: string; status: string }[];
  }
  const [userModal, setUserModal] = useState<AdminUserDetail | null>(null);
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [userAction, setUserAction] = useState<string | null>(null);
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

  async function updateStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DELETED') {
    setProcessing(p => ({ ...p, [userId]: true }));
    try {
      await api.patch(`/admin/users/${userId}/status`, { status });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(p => { const n = { ...p }; delete n[userId]; return n; });
    }
  }

  async function openUserModal(userId: string) {
    setUserModalLoading(true);
    setUserModal(null);
    try {
      const u = await api.get<AdminUserDetail>(`/admin/users/${userId}`);
      setUserModal(u);
      setGrantPlan('');
    } catch { setError('Kullanıcı yüklenemedi'); }
    finally { setUserModalLoading(false); }
  }

  async function modalUpdateStatus(status: string) {
    if (!userModal) return;
    setUserAction(status);
    try {
      await api.patch(`/admin/users/${userModal.id}/status`, { status });
      setUserModal(u => u ? { ...u, status } : null);
      setUsers(prev => prev.map(u => u.id === userModal.id ? { ...u, status: status as 'ACTIVE' | 'SUSPENDED' | 'DELETED' } : u));
    } catch { setError('İşlem başarısız'); }
    finally { setUserAction(null); }
  }

  async function modalApproveKyc() {
    if (!userModal) return;
    setUserAction('kyc');
    try {
      await api.post(`/admin/users/${userModal.id}/kyc-approve`, {});
      setUserModal(u => u ? { ...u, kyc: { status: 'APPROVED' } } : null);
    } catch { setError('KYC onaylanamadı'); }
    finally { setUserAction(null); }
  }

  async function modalGrantSubscription() {
    if (!userModal || !grantPlan) return;
    setUserAction('sub');
    try {
      await api.post(`/admin/users/${userModal.id}/free-subscription`, { plan: grantPlan });
      setGrantPlan('');
    } catch { setError('Abonelik verilemedi'); }
    finally { setUserAction(null); }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-[#555] uppercase tracking-[0.14em]">Admin</p>
        <h1 className="font-serif text-2xl text-[#f5f5f5]">Kullanıcılar</h1>
      </div>

      {/* Filtreler */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Ad, soyad veya e-posta..."
          className="input-glass flex-1 px-4 py-2.5 text-sm"
        />
        <input
          type="text"
          value={cityFilter}
          onChange={e => { setCityFilter(e.target.value); setPage(1); }}
          placeholder="Şehir..."
          className="input-glass sm:w-32 px-4 py-2.5 text-sm"
        />
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="input-glass sm:w-44 px-3 py-2.5 text-sm"
        >
          <option value="">Tüm üyeler</option>
          <option value="NO_PLAN">Aboneliksiz</option>
          <option value="MASADA">Masada</option>
          <option value="KARSIMDA">Karşımda</option>
          <option value="ICERDE">İçerde</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPERADMIN">Superadmin</option>
        </select>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm mb-4">{error}</p>}

      {/* Tablo */}
      <div className="glass-card overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
              {['Kullanıcı', 'Şehir', 'Paket', 'OCEAN Ort.', 'Durum', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-[#555] uppercase tracking-[0.1em] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [0,1,2,3,4].map(i => (
                  <tr key={i}><td colSpan={6} className="px-4 py-2"><Skel /></td></tr>
                ))
              : users.map((u, i) => {
                  const s = STATUS_STYLE[u.status] ?? STATUS_STYLE.ACTIVE;
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25, ease: 'easeOut' }}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#f5f5f5] font-medium">{u.profile?.firstName ?? ''} {u.profile?.lastName ?? ''}</p>
                        <p className="text-xs text-[#555]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#888]">{u.profile?.city ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-[#888]">{activePlan(u)}</td>
                      <td className="px-4 py-3 text-sm text-[#888]">{oceanAvg(u.oceanScore)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: s.color, border: `1px solid ${s.border}` }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openUserModal(u.id)}
                          className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                          style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#888' }}
                        >
                          Detay
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
            }
          </tbody>
        </table>

        {!loading && users.length === 0 && (
          <p className="p-6 text-sm text-[#555] text-center">Kullanıcı bulunamadı.</p>
        )}
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 text-sm text-[#888] hover:text-[#f5f5f5] transition-colors disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>
            ← Önceki
          </button>
          <span className="text-sm text-[#555]">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 text-sm text-[#888] hover:text-[#f5f5f5] transition-colors disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>
            Sonraki →
          </button>
        </div>
      )}

      {/* Kullanıcı detay modalı */}
      <AnimatePresence>
        {(userModalLoading || userModal) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setUserModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="glass-card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto flex flex-col gap-4"
              style={{ background: '#1a1a1a' }}>

              {userModalLoading && [0,1,2,3].map(i => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
              ))}

              {userModal && !userModalLoading && (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#f5f5f5]">
                        {userModal.profile ? `${userModal.profile.firstName} ${userModal.profile.lastName}` : userModal.email}
                      </p>
                      <p className="text-xs text-[#555] mt-0.5">{userModal.email}</p>
                      {userModal.phone && <p className="text-xs text-[#555]">{userModal.phone}</p>}
                      <p className="text-xs text-[#444] mt-0.5">{userModal.role}</p>
                    </div>
                    <button onClick={() => setUserModal(null)} className="text-[#555] hover:text-[#f5f5f5] text-lg leading-none">✕</button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full"
                      style={{
                        background: userModal.status === 'ACTIVE' ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,107,0.1)',
                        color: userModal.status === 'ACTIVE' ? '#4ade80' : '#ff6b6b',
                        border: `1px solid ${userModal.status === 'ACTIVE' ? 'rgba(74,222,128,0.2)' : 'rgba(255,107,107,0.2)'}`,
                      }}>
                      {userModal.status === 'ACTIVE' ? 'Aktif' : userModal.status === 'SUSPENDED' ? 'Askıda' : 'Silinmiş'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full"
                      style={{
                        background: userModal.kyc?.status === 'APPROVED' ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.10)',
                        color: userModal.kyc?.status === 'APPROVED' ? '#4ade80' : '#666',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                      KYC: {userModal.kyc?.status === 'APPROVED' ? 'Onaylı ✓' : userModal.kyc?.status ?? 'Yok'}
                    </span>
                    {userModal.subscriptions[0] && (
                      <span className="px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(192,57,43,0.1)', color: '#ff9999', border: '1px solid rgba(192,57,43,0.2)' }}>
                        {{ MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde' }[userModal.subscriptions[0].plan] ?? userModal.subscriptions[0].plan}
                      </span>
                    )}
                  </div>

                  {/* Hesap işlemleri */}
                  <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <p className="text-xs text-[#555] uppercase tracking-[0.1em]">Hesap İşlemleri</p>
                    <div className="flex flex-wrap gap-2">
                      {userModal.status !== 'SUSPENDED' && (
                        <button onClick={() => modalUpdateStatus('SUSPENDED')} disabled={!!userAction}
                          className="text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
                          style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                          {userAction === 'SUSPENDED' ? '…' : 'Askıya Al'}
                        </button>
                      )}
                      {userModal.status === 'SUSPENDED' && (
                        <button onClick={() => modalUpdateStatus('ACTIVE')} disabled={!!userAction}
                          className="text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
                          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                          {userAction === 'ACTIVE' ? '…' : 'Aktifleştir'}
                        </button>
                      )}
                      {userModal.status !== 'DELETED' && (
                        <button onClick={() => modalUpdateStatus('DELETED')} disabled={!!userAction}
                          className="text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
                          style={{ background: 'rgba(192,57,43,0.1)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.2)' }}>
                          {userAction === 'DELETED' ? '…' : 'Hesabı Sil'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KYC onayla */}
                  {userModal.kyc && userModal.kyc.status !== 'APPROVED' && (
                    <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                      <p className="text-xs text-[#555] uppercase tracking-[0.1em]">KYC</p>
                      <button onClick={modalApproveKyc} disabled={!!userAction}
                        className="py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                        style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                        {userAction === 'kyc' ? 'Onaylanıyor…' : "KYC'yi Onayla"}
                      </button>
                    </div>
                  )}

                  {/* Abonelik ver */}
                  <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <p className="text-xs text-[#555] uppercase tracking-[0.1em]">Ücretsiz Abonelik Ver</p>
                    <div className="flex gap-2">
                      <select value={grantPlan} onChange={e => setGrantPlan(e.target.value)}
                        className="flex-1 input-glass px-3 py-2 text-sm">
                        <option value="">Paket seç…</option>
                        <option value="MASADA">Masada</option>
                        <option value="KARSIMDA">Karşımda</option>
                        <option value="ICERDE">İçerde</option>
                      </select>
                      <button onClick={modalGrantSubscription} disabled={!!userAction || !grantPlan}
                        className="px-4 py-2 text-sm rounded-xl font-medium disabled:opacity-50"
                        style={{ background: 'rgba(192,57,43,0.15)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.25)' }}>
                        {userAction === 'sub' ? '…' : 'Ver'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
