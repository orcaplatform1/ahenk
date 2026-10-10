'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  createdAt: string;
  profile?: { firstName: string; lastName: string; primaryCity?: { name: string }; };
  kyc?: { status: string };
}

interface UserDetail extends User {
  oceanScore?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number };
  subscriptions?: { plan: string; expiresAt?: string }[];
}

const KYC_CLS: Record<string, string> = {
  APPROVED: 'text-green-400', REJECTED: 'text-accent', PENDING: 'text-muted', SUSPICIOUS: 'text-orange-400',
};

export default function KullanicilarPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [myRole, setMyRole] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) q.set('search', search);
    api.get<{ items: User[]; total: number }>(`/admin/users?${q}`)
      .then((r) => { setUsers(r.items); setTotal(r.total); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<{ role: string }>('/auth/me').then((m) => setMyRole(m.role)).catch(() => {});
  }, []);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api.get<UserDetail>(`/admin/users/${id}`);
      setDetail(d);
    } catch (e) { toast.error((e as Error).message); }
    finally { setDetailLoading(false); }
  }

  async function resetOcean(id: string) {
    try {
      await api.patch(`/admin/users/${id}/test-lock-reset`, {});
      toast.success('Test kilidi sıfırlandı.');
    } catch (e) { toast.error((e as Error).message); }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-6">Kullanıcılar</h1>

      <div className="flex gap-3 mb-6">
        <input
          value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
          placeholder="İsim veya telefon ara…"
          className="flex-1 max-w-sm bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text focus:outline-none focus:border-primary"
        />
        <button onClick={() => { setSearch(searchInput); setPage(1); }}
          className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-xl text-sm transition-colors">
          Ara
        </button>
        {search && <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:text-text">Temizle</button>}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">{[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-surface rounded-xl animate-pulse" />)}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted text-xs uppercase">
                  <th className="text-left py-3 px-2">Ad Soyad</th>
                  <th className="text-left py-3 px-2">Telefon</th>
                  <th className="text-left py-3 px-2">Şehir</th>
                  <th className="text-left py-3 px-2">KYC</th>
                  <th className="text-left py-3 px-2">Kayıt</th>
                  <th className="py-3 px-2" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border hover:bg-surface/50 transition-colors cursor-pointer" onClick={() => openDetail(u.id)}>
                    <td className="py-3 px-2">{u.profile?.firstName} {u.profile?.lastName}</td>
                    <td className="py-3 px-2 text-muted">{u.phone ?? '—'}</td>
                    <td className="py-3 px-2 text-muted">{u.profile?.primaryCity?.name ?? '—'}</td>
                    <td className={`py-3 px-2 text-xs font-medium ${KYC_CLS[u.kyc?.status ?? ''] ?? 'text-muted'}`}>{u.kyc?.status ?? '—'}</td>
                    <td className="py-3 px-2 text-muted">{new Date(u.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td className="py-3 px-2 text-primary text-xs">Detay →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 items-center">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted disabled:opacity-40">← Önceki</button>
              <span className="text-sm text-muted">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted disabled:opacity-40">Sonraki →</button>
            </div>
          )}
        </>
      )}

      <Modal open={detailLoading || !!detail} onClose={() => setDetail(null)} title="Kullanıcı Detayı">
        {detailLoading && <p className="text-muted text-sm">Yükleniyor…</p>}
        {detail && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Row label="Ad Soyad" value={`${detail.profile?.firstName} ${detail.profile?.lastName}`} />
              <Row label="E-posta" value={detail.email} />
              <Row label="Telefon" value={detail.phone ?? '—'} />
              <Row label="Rol" value={detail.role} />
              <Row label="KYC" value={detail.kyc?.status ?? '—'} />
            </div>

            {detail.oceanScore && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted uppercase mb-3">OCEAN Skoru</p>
                {[
                  ['Açıklık', detail.oceanScore.openness],
                  ['Öz-Disiplin', detail.oceanScore.conscientiousness],
                  ['Dışadönüklük', detail.oceanScore.extraversion],
                  ['Uyumluluk', detail.oceanScore.agreeableness],
                  ['Nevrotiklik', detail.oceanScore.neuroticism],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-muted w-28">{label as string}</span>
                    <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${val}%` }} />
                    </div>
                    <span className="text-xs text-muted w-8 text-right">{Math.round(val as number)}</span>
                  </div>
                ))}
              </div>
            )}

            {detail.subscriptions && detail.subscriptions.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted uppercase mb-2">Aktif Paket</p>
                <p className="text-sm text-text">{detail.subscriptions[0].plan}</p>
              </div>
            )}

            {myRole === 'SUPERADMIN' && (
              <button onClick={() => resetOcean(detail.id)}
                className="mt-2 w-full py-2 rounded-xl border border-border text-sm text-muted hover:text-text hover:border-muted transition-colors">
                OCEAN Kilidini Sıfırla
              </button>
            )}
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  );
}
