'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface MeetingRow {
  id: string;
  title: string;
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

interface Review {
  id: string; rating: number; comment: string | null;
  reviewer: { id: string; profile: { firstName: string; lastName: string } | null };
}

interface Block { blockerId: string; blockedId: string; createdAt: string; }

interface MeetingDetail extends MeetingRow {
  participants: Participant[];
  reviews: Review[];
  blocks: Block[];
}

interface ListResponse { items: MeetingRow[]; total: number; page: number; totalPages: number; }

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; border: string }> = {
  PENDING:   { label: 'Bekliyor',    color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  ACTIVE:    { label: 'Aktif',       color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  COMPLETED: { label: 'Tamamlandı',  color: '#888',    border: 'rgba(255,255,255,0.12)' },
  CANCELLED: { label: 'İptal',       color: '#ff6b6b', border: 'rgba(255,107,107,0.25)' },
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
  return <div className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />;
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-sm">
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= n ? '#c0392b' : 'rgba(255,255,255,0.12)' }}>★</span>
      ))}
    </span>
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

  const [selected, setSelected] = useState<MeetingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [cancelTarget, setCancelTarget] = useState<MeetingRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

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
    setSelected(null); setDetailError(''); setDetailLoading(true);
    try {
      const d = await api.get<MeetingDetail>(`/admin/meetings/${row.id}`);
      setSelected(d);
    } catch (e) { setDetailError((e as Error).message); }
    finally { setDetailLoading(false); }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.delete(`/admin/meetings/${cancelTarget.id}`);
      setItems(prev => prev.map(m => m.id === cancelTarget.id ? { ...m, status: 'CANCELLED' } : m));
      if (selected?.id === cancelTarget.id) setSelected(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
      setCancelTarget(null);
    } catch (e) { setError((e as Error).message); }
    finally { setCancelling(false); }
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="flex h-screen overflow-hidden">

      {/* Sol: liste */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-8">
        <div className="mb-6">
          <p className="text-xs text-[#555] uppercase tracking-[0.14em]">Admin</p>
          <h1 className="font-serif text-2xl text-[#f5f5f5]">Masalar</h1>
        </div>

        {/* Filtreler */}
        <div className="flex gap-3 mb-5">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-glass px-3 py-2 text-sm w-40"
          >
            <option value="">Tüm durumlar</option>
            <option value="PENDING">Bekliyor</option>
            <option value="ACTIVE">Aktif</option>
            <option value="COMPLETED">Tamamlandı</option>
            <option value="CANCELLED">İptal</option>
          </select>
          <input
            type="text"
            value={cityFilter}
            onChange={e => { setCityFilter(e.target.value); setPage(1); }}
            placeholder="Şehir..."
            className="input-glass px-3 py-2 text-sm w-40"
          />
        </div>

        {error && <p className="text-[#ff6b6b] text-sm mb-4">{error}</p>}

        {/* Tablo */}
        <div className="glass-card overflow-hidden mb-5">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Tarih', 'Tip', 'Katılımcı', 'Durum', 'Ort. Puan', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-[#555] uppercase tracking-[0.1em] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0,1,2,3,4].map(i => <tr key={i}><td colSpan={6} className="px-4 py-2"><Skel /></td></tr>)
                : items.map((m, i) => {
                    const s = STATUS_CFG[m.status] ?? STATUS_CFG.PENDING;
                    const isActive = selected?.id === m.id;
                    return (
                      <motion.tr
                        key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.25, ease: 'easeOut' }}
                        onClick={() => openDetail(m)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: isActive ? 'rgba(192,57,43,0.07)' : undefined,
                        }}
                      >
                        <td className="px-4 py-3 text-sm text-[#f5f5f5] whitespace-nowrap">{fmtDate(m.scheduledAt)}</td>
                        <td className="px-4 py-3 text-sm text-[#888]">{TYPE_LABEL[m.type] ?? m.type}</td>
                        <td className="px-4 py-3 text-sm text-[#888] text-center">{m._count.participants}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: s.color, border: `1px solid ${s.border}` }}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#888]">—</td>
                        <td className="px-4 py-3">
                          {m.status !== 'CANCELLED' && m.status !== 'COMPLETED' && (
                            <button
                              onClick={e => { e.stopPropagation(); setCancelTarget(m); }}
                              className="text-xs px-2 py-1 rounded-lg transition-colors"
                              style={{ border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b' }}
                            >
                              İptal
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })
              }
            </tbody>
          </table>
          {!loading && items.length === 0 && (
            <p className="p-10 text-sm text-[#555] text-center">Henüz masa kurulmadı.</p>
          )}
        </div>

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
      </div>

      {/* Sağ: detay paneli */}
      <AnimatePresence>
        {(detailLoading || selected || detailError) && (
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="w-96 flex-shrink-0 overflow-y-auto p-6"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}
          >
            {detailLoading && (
              <div className="flex flex-col gap-3 mt-4">
                {[0,1,2,3].map(i => <Skel key={i} />)}
              </div>
            )}
            {detailError && <p className="text-[#ff6b6b] text-sm">{detailError}</p>}
            {selected && !detailLoading && (
              <DetailPanel
                detail={selected}
                onCancel={() => setCancelTarget(selected)}
              />
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* İptal onay modalı */}
      <AnimatePresence>
        {cancelTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', zIndex: 50 }}
            onClick={() => setCancelTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="glass-card p-6 w-80 flex flex-col gap-5"
            >
              <div>
                <p className="font-medium text-[#f5f5f5] mb-1">Masayı iptal et</p>
                <p className="text-sm text-[#777]">
                  {fmtDate(cancelTarget.scheduledAt)} tarihli masa iptal edilecek. Bu işlem geri alınamaz.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCancelTarget(null)}
                  className="flex-1 py-2.5 text-sm text-[#888] transition-colors rounded-xl"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Vazgeç
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
                  style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.4)', color: '#ff6b6b' }}
                >
                  {cancelling ? '…' : 'İptal Et'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Detay paneli ─────────────────────────────────────────────────────────────

function DetailPanel({ detail: d, onCancel }: { detail: MeetingDetail; onCancel: () => void }) {
  const s = STATUS_CFG[d.status] ?? STATUS_CFG.PENDING;
  const avgRating = d.reviews.length > 0
    ? (d.reviews.reduce((sum, r) => sum + r.rating, 0) / d.reviews.length).toFixed(1)
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#f5f5f5]">{fmtDate(d.scheduledAt)}</p>
          <p className="text-xs text-[#555] mt-0.5">{d.locationText ?? 'Mekan belirsiz'}</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: s.color, border: `1px solid ${s.border}` }}>
          {s.label}
        </span>
      </div>

      <div className="flex gap-4 text-xs text-[#666]">
        <span>{TYPE_LABEL[d.type] ?? d.type}</span>
        <span>{d._count.participants} katılımcı</span>
        {avgRating && <span>★ {avgRating}</span>}
      </div>

      {/* Katılımcılar */}
      <Section title="Katılımcılar">
        {d.participants.map((p) => (
          <div key={p.userId} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <p className="text-sm text-[#f5f5f5]">
                {p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.user.email}
              </p>
              <p className="text-xs text-[#555]">{p.user.email}</p>
              {p.user.subscriptions[0] && (
                <p className="text-xs text-[#444]">{PLAN_LABEL[p.user.subscriptions[0].plan] ?? p.user.subscriptions[0].plan}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-[#555]">OCEAN ort.</p>
              <p className="text-sm font-semibold text-[#888]">{oceanAvg(p.user.oceanScore)}</p>
            </div>
          </div>
        ))}
      </Section>

      {/* Değerlendirmeler */}
      {d.reviews.length > 0 && (
        <Section title={`Değerlendirmeler (${d.reviews.length})`}>
          {d.reviews.map((r) => (
            <div key={r.id} className="py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-[#888]">
                  {r.reviewer.profile ? `${r.reviewer.profile.firstName} ${r.reviewer.profile.lastName[0]}.` : '—'}
                </p>
                <Stars n={r.rating} />
              </div>
              {r.comment && <p className="text-xs text-[#666] leading-relaxed">{r.comment}</p>}
            </div>
          ))}
        </Section>
      )}

      {/* Engel kayıtları */}
      {d.blocks.length > 0 && (
        <Section title={`Engel Kayıtları (${d.blocks.length})`}>
          <p className="text-xs text-[#555]">Bu masanın katılımcıları arasında {d.blocks.length} engel kaydı oluştu.</p>
        </Section>
      )}

      {/* İptal butonu */}
      {d.status !== 'CANCELLED' && d.status !== 'COMPLETED' && (
        <button
          onClick={onCancel}
          className="w-full py-2.5 text-sm font-medium rounded-xl transition-all mt-2"
          style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.35)', color: '#ff6b6b' }}
        >
          Masayı İptal Et
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[#555] uppercase tracking-[0.1em] font-medium mb-3">{title}</p>
      {children}
    </div>
  );
}
