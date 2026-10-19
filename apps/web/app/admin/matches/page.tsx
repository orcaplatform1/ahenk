'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface MeetingRow {
  id: string;
  type: 'GROUP' | 'ONE_ON_ONE';
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: string;
  locationText: string | null;
  _count: { participants: number };
}

interface OceanScore {
  openness: number; conscientiousness: number; extraversion: number;
  agreeableness: number; neuroticism: number;
}

interface Participant {
  userId: string;
  user: {
    id: string; email: string;
    profile: { firstName: string; lastName: string; city: string | null } | null;
    oceanScore: OceanScore | null;
    subscriptions: { plan: string }[];
  };
}

interface MeetingDetail extends MeetingRow {
  participants: Participant[];
  reviews: {
    id: string; rating: number; comment: string | null;
    reviewer: { id: string; profile: { firstName: string; lastName: string } | null };
  }[];
  blocks: { blockerId: string; blockedId: string }[];
}

interface ListResponse { items: MeetingRow[]; total: number; page: number; totalPages: number; }

interface AdminUserDetail {
  id: string; email: string; phone: string | null; role: string; status: string;
  profile: { firstName: string | null; lastName: string | null; city: string | null } | null;
  kyc: { status: string } | null;
  subscriptions: { id: string; plan: string; status: string }[];
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; border: string }> = {
  PENDING:   { label: 'Bekliyor',   color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  ACTIVE:    { label: 'Aktif',      color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  COMPLETED: { label: 'Tamamlandı', color: '#888',    border: 'rgba(255,255,255,0.12)' },
  CANCELLED: { label: 'İptal',      color: '#ff6b6b', border: 'rgba(255,107,107,0.25)' },
};

const TYPE_LABEL: Record<string, string> = { GROUP: 'Grup', ONE_ON_ONE: 'Başbaşa' };
const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde' };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function oceanAvg(o: OceanScore | null) {
  if (!o) return '—';
  return ((o.openness + o.conscientiousness + o.extraversion + o.agreeableness + o.neuroticism) / 5).toFixed(0);
}

function Skel() {
  return <div className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />;
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[#555] uppercase tracking-[0.1em] font-medium mb-2">{title}</p>
      {children}
    </div>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

export default function AdminMatches() {
  const [items, setItems] = useState<MeetingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);

  // Detay paneli
  const [selected, setSelected] = useState<MeetingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [venueInput, setVenueInput] = useState('');
  const [venueSaving, setVenueSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Kullanıcı detay modalı
  const [userModal, setUserModal] = useState<AdminUserDetail | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userAction, setUserAction] = useState<string | null>(null);
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

  async function openDetail(row: MeetingRow) {
    if (selected?.id === row.id) { setSelected(null); return; }
    setDetailLoading(true);
    setSelected(null);
    try {
      const d = await api.get<MeetingDetail>(`/admin/meetings/${row.id}`);
      setSelected(d);
      setVenueInput(d.locationText ?? '');
    } catch { setError('Masa detayı yüklenemedi'); }
    finally { setDetailLoading(false); }
  }

  async function approve() {
    if (!selected) return;
    setApproving(true);
    try {
      await api.patch(`/admin/matches/${selected.id}/approve`, {});
      setSelected(s => s ? { ...s, status: 'ACTIVE' } : null);
      setItems(prev => prev.map(m => m.id === selected.id ? { ...m, status: 'ACTIVE' } : m));
    } catch { setError('Onaylama başarısız'); }
    finally { setApproving(false); }
  }

  async function saveVenue() {
    if (!selected) return;
    setVenueSaving(true);
    try {
      await api.patch(`/admin/meetings/${selected.id}/venue`, { locationText: venueInput });
      setSelected(s => s ? { ...s, locationText: venueInput } : null);
      setItems(prev => prev.map(m => m.id === selected.id ? { ...m, locationText: venueInput } : m));
    } catch { setError('Mekan kaydedilemedi'); }
    finally { setVenueSaving(false); }
  }

  async function removeParticipant(userId: string) {
    if (!selected) return;
    setRemoving(userId);
    try {
      await api.delete(`/admin/meetings/${selected.id}/participants/${userId}`);
      setSelected(s => s ? { ...s, participants: s.participants.filter(p => p.userId !== userId) } : null);
    } catch { setError('Katılımcı çıkarılamadı'); }
    finally { setRemoving(null); }
  }

  async function cancelMeeting() {
    if (!selected) return;
    setCancelling(true);
    try {
      await api.delete(`/admin/meetings/${selected.id}`);
      setSelected(s => s ? { ...s, status: 'CANCELLED' } : null);
      setItems(prev => prev.map(m => m.id === selected.id ? { ...m, status: 'CANCELLED' } : m));
      setCancelConfirm(false);
    } catch { setError('İptal başarısız'); }
    finally { setCancelling(false); }
  }

  async function openUser(userId: string) {
    setUserLoading(true);
    setUserModal(null);
    try {
      const u = await api.get<AdminUserDetail>(`/admin/users/${userId}`);
      setUserModal(u);
      setGrantPlan('');
    } catch { setError('Kullanıcı yüklenemedi'); }
    finally { setUserLoading(false); }
  }

  async function userUpdateStatus(status: string) {
    if (!userModal) return;
    setUserAction(status);
    try {
      await api.patch(`/admin/users/${userModal.id}/status`, { status });
      setUserModal(u => u ? { ...u, status } : null);
    } catch { setError('İşlem başarısız'); }
    finally { setUserAction(null); }
  }

  async function userApproveKyc() {
    if (!userModal) return;
    setUserAction('kyc');
    try {
      await api.post(`/admin/users/${userModal.id}/kyc-approve`, {});
      setUserModal(u => u ? { ...u, kyc: { status: 'APPROVED' } } : null);
    } catch { setError('KYC onaylanamadı'); }
    finally { setUserAction(null); }
  }

  async function userGrantSubscription() {
    if (!userModal || !grantPlan) return;
    setUserAction('sub');
    try {
      await api.post(`/admin/users/${userModal.id}/free-subscription`, { plan: grantPlan });
      setGrantPlan('');
    } catch { setError('Abonelik verilemedi'); }
    finally { setUserAction(null); }
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Başlık */}
      <div className="mb-6">
        <p className="text-xs text-[#555] uppercase tracking-[0.14em]">Admin</p>
        <h1 className="font-serif text-2xl text-[#f5f5f5]">Masalar</h1>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-glass px-3 py-2 text-sm w-44">
          <option value="">Tüm durumlar</option>
          <option value="PENDING">Bekliyor</option>
          <option value="ACTIVE">Aktif</option>
          <option value="COMPLETED">Tamamlandı</option>
          <option value="CANCELLED">İptal</option>
        </select>
        <input type="text" value={cityFilter} onChange={e => { setCityFilter(e.target.value); setPage(1); }}
          placeholder="Şehir..." className="input-glass px-3 py-2 text-sm w-40" />
      </div>

      {error && <p className="text-[#ff6b6b] text-sm mb-4">{error}</p>}

      {/* Tablo */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                {['Tarih', 'Tip', 'Kişi', 'Mekan', 'Durum', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs text-[#555] uppercase tracking-[0.08em] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0,1,2,3,4].map(i => <tr key={i}><td colSpan={6} className="px-3 py-2"><Skel /></td></tr>)
                : items.map((m, i) => {
                    const s = STATUS_CFG[m.status] ?? STATUS_CFG.PENDING;
                    const isActive = selected?.id === m.id;
                    return (
                      <motion.tr key={m.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.2, ease: 'easeOut' }}
                        onClick={() => openDetail(m)}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: isActive ? 'rgba(192,57,43,0.07)' : undefined }}>
                        <td className="px-3 py-2.5 text-xs text-[#f5f5f5] whitespace-nowrap">{fmtDate(m.scheduledAt)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#888]">{TYPE_LABEL[m.type] ?? m.type}</td>
                        <td className="px-3 py-2.5 text-xs text-[#888] text-center">{m._count.participants}</td>
                        <td className="px-3 py-2.5 text-xs text-[#555] truncate max-w-[100px]">{m.locationText ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#444]">{isActive ? '▲' : '▼'}</td>
                      </motion.tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 && <p className="p-10 text-sm text-[#555] text-center">Henüz masa yok.</p>}
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mb-5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 text-sm text-[#888] disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>← Önceki</button>
          <span className="text-sm text-[#555]">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 text-sm text-[#888] disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>Sonraki →</button>
        </div>
      )}

      {/* Detay (tablo altında inline) */}
      <AnimatePresence>
        {detailLoading && (
          <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass-card p-5 flex flex-col gap-3 mb-4">
            {[0,1,2].map(i => <Skel key={i} />)}
          </motion.div>
        )}
        {selected && !detailLoading && (
          <motion.div key={selected.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="glass-card p-5 flex flex-col gap-5 mb-4">

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#f5f5f5]">{fmtDate(selected.scheduledAt)}</p>
                <p className="text-xs text-[#666] mt-0.5">{TYPE_LABEL[selected.type]} · {selected.participants.length} katılımcı</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs px-2.5 py-1 rounded-full"
                  style={{ color: STATUS_CFG[selected.status]?.color, border: `1px solid ${STATUS_CFG[selected.status]?.border}` }}>
                  {STATUS_CFG[selected.status]?.label}
                </span>
                <button onClick={() => setSelected(null)} className="text-[#555] hover:text-[#f5f5f5] text-lg leading-none">✕</button>
              </div>
            </div>

            {/* Onayla (sadece PENDING) */}
            {selected.status === 'PENDING' && (
              <button onClick={approve} disabled={approving}
                className="w-full py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                {approving ? 'Onaylanıyor…' : '✓ Masayı Onayla'}
              </button>
            )}

            {/* Mekan */}
            <Sec title="Mekan">
              <div className="flex gap-2">
                <input value={venueInput} onChange={e => setVenueInput(e.target.value)}
                  placeholder="Mekan adı / adresi…"
                  className="flex-1 bg-transparent border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <button onClick={saveVenue} disabled={venueSaving}
                  className="px-4 py-2 text-sm rounded-xl font-medium disabled:opacity-50"
                  style={{ background: 'rgba(192,57,43,0.15)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.25)' }}>
                  {venueSaving ? '…' : 'Kaydet'}
                </button>
              </div>
            </Sec>

            {/* Katılımcılar */}
            <Sec title={`Katılımcılar (${selected.participants.length})`}>
              <div className="flex flex-col">
                {selected.participants.map(p => (
                  <div key={p.userId} className="flex items-center justify-between py-2 gap-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                    <button onClick={() => openUser(p.user.id)} className="text-left flex-1 min-w-0 hover:opacity-80 transition-opacity">
                      <p className="text-sm text-[#f5f5f5] font-medium">
                        {p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.user.email}
                      </p>
                      <p className="text-xs text-[#555]">{p.user.email}</p>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[#555]">OCEAN {oceanAvg(p.user.oceanScore)}</span>
                      {selected.status !== 'CANCELLED' && selected.status !== 'COMPLETED' && (
                        <button onClick={() => removeParticipant(p.userId)} disabled={removing === p.userId}
                          className="text-xs px-2 py-1 rounded-lg disabled:opacity-50"
                          style={{ background: 'rgba(255,107,107,0.08)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.18)' }}>
                          {removing === p.userId ? '…' : 'Çıkart'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Sec>

            {/* Değerlendirmeler */}
            {selected.reviews.length > 0 && (
              <Sec title={`Değerlendirmeler (${selected.reviews.length})`}>
                {selected.reviews.map(r => (
                  <div key={r.id} className="py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-[#888]">{r.reviewer.profile ? `${r.reviewer.profile.firstName} ${r.reviewer.profile.lastName[0]}.` : '—'}</p>
                      <span className="text-sm">{[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= r.rating ? '#c0392b' : 'rgba(255,255,255,0.12)' }}>★</span>)}</span>
                    </div>
                    {r.comment && <p className="text-xs text-[#666] leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </Sec>
            )}

            {/* İptal */}
            {selected.status !== 'CANCELLED' && selected.status !== 'COMPLETED' && (
              <button onClick={() => setCancelConfirm(true)}
                className="w-full py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.3)', color: '#ff6b6b' }}>
                Masayı İptal Et
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* İptal onay modalı */}
      <AnimatePresence>
        {cancelConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setCancelConfirm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="glass-card p-6 w-80 flex flex-col gap-5" style={{ background: '#1a1a1a' }}>
              <div>
                <p className="font-medium text-[#f5f5f5] mb-1">Masayı iptal et</p>
                <p className="text-sm text-[#777]">{selected && fmtDate(selected.scheduledAt)} tarihli masa iptal edilecek. Bu işlem geri alınamaz.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCancelConfirm(false)}
                  className="flex-1 py-2.5 text-sm text-[#888] rounded-xl"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Vazgeç</button>
                <button onClick={cancelMeeting} disabled={cancelling}
                  className="flex-1 py-2.5 text-sm font-medium rounded-xl disabled:opacity-50"
                  style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.4)', color: '#ff6b6b' }}>
                  {cancelling ? '…' : 'İptal Et'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kullanıcı detay modalı */}
      <AnimatePresence>
        {(userLoading || userModal) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setUserModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="glass-card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto flex flex-col gap-4"
              style={{ background: '#1a1a1a' }}>

              {userLoading && [0,1,2,3].map(i => <Skel key={i} />)}

              {userModal && !userLoading && (
                <>
                  {/* Kullanıcı bilgileri */}
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

                  {/* Durum / KYC / Paket rozetleri */}
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
                        {PLAN_LABEL[userModal.subscriptions[0].plan] ?? userModal.subscriptions[0].plan}
                      </span>
                    )}
                  </div>

                  {/* Hesap işlemleri */}
                  <div className="flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <p className="text-xs text-[#555] uppercase tracking-[0.1em]">Hesap İşlemleri</p>
                    <div className="flex flex-wrap gap-2">
                      {userModal.status !== 'SUSPENDED' && (
                        <button onClick={() => userUpdateStatus('SUSPENDED')} disabled={!!userAction}
                          className="text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
                          style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                          {userAction === 'SUSPENDED' ? '…' : 'Askıya Al'}
                        </button>
                      )}
                      {userModal.status === 'SUSPENDED' && (
                        <button onClick={() => userUpdateStatus('ACTIVE')} disabled={!!userAction}
                          className="text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
                          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                          {userAction === 'ACTIVE' ? '…' : 'Aktifleştir'}
                        </button>
                      )}
                      {userModal.status !== 'DELETED' && (
                        <button onClick={() => userUpdateStatus('DELETED')} disabled={!!userAction}
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
                      <button onClick={userApproveKyc} disabled={!!userAction}
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
                      <button onClick={userGrantSubscription} disabled={!!userAction || !grantPlan}
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
