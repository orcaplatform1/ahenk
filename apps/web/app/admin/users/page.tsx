'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  role: string;
  profile?: {
    primaryCity?: { name: string } | null;
    oceanScore?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number } | null;
  };
  subscriptions?: { plan: string }[];
}

interface UsersResponse {
  data: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
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
  const avg = (o.openness + o.conscientiousness + o.extraversion + o.agreeableness + o.neuroticism) / 5;
  return avg.toFixed(0);
}

function activePlan(u: AdminUser): string {
  if (!u.subscriptions?.length) return '—';
  return u.subscriptions.map(s => PLAN_LABEL[s.plan] ?? s.plan).join(', ');
}

function Skel() {
  return <div className="h-16 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);

  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (search) params.set('search', search);
    if (cityFilter) params.set('city', cityFilter);
    api.get<UsersResponse>(`/admin/users?${params}`)
      .then(r => { setUsers(r.data ?? []); setTotal(r.total ?? 0); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, cityFilter, page]);

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

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-[#555] uppercase tracking-[0.14em]">Admin</p>
        <h1 className="font-serif text-2xl text-[#f5f5f5]">Kullanıcılar</h1>
      </div>

      {/* Filtreler */}
      <div className="flex gap-3 mb-6">
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
          className="input-glass w-40 px-4 py-2.5 text-sm"
        />
      </div>

      {error && <p className="text-[#ff6b6b] text-sm mb-4">{error}</p>}

      {/* Tablo */}
      <div className="glass-card overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Kullanıcı', 'Şehir', 'Paket', 'OCEAN Ort.', 'Durum', 'İşlem'].map(h => (
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
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#f5f5f5] font-medium">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-[#555]">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#888]">{u.profile?.primaryCity?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-[#888]">{activePlan(u)}</td>
                      <td className="px-4 py-3 text-sm text-[#888]">{oceanAvg(u.profile?.oceanScore ?? null)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: s.color, border: `1px solid ${s.border}` }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {u.status !== 'SUSPENDED' && (
                            <button
                              onClick={() => updateStatus(u.id, 'SUSPENDED')}
                              disabled={processing[u.id]}
                              className="text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{ border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                            >
                              {processing[u.id] ? '…' : 'Karantina'}
                            </button>
                          )}
                          {u.status === 'SUSPENDED' && (
                            <button
                              onClick={() => updateStatus(u.id, 'ACTIVE')}
                              disabled={processing[u.id]}
                              className="text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{ border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                            >
                              {processing[u.id] ? '…' : 'Aktifleştir'}
                            </button>
                          )}
                          {u.status !== 'DELETED' && (
                            <button
                              onClick={() => updateStatus(u.id, 'DELETED')}
                              disabled={processing[u.id]}
                              className="text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              style={{ border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b' }}
                            >
                              {processing[u.id] ? '…' : 'Ban'}
                            </button>
                          )}
                        </div>
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
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm text-[#888] hover:text-[#f5f5f5] transition-colors disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}
          >
            ← Önceki
          </button>
          <span className="text-sm text-[#555]">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm text-[#888] hover:text-[#f5f5f5] transition-colors disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}
          >
            Sonraki →
          </button>
        </div>
      )}
    </div>
  );
}
