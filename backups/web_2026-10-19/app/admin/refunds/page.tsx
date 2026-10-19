'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface RefundItem {
  id: string;
  userId: string;
  refundType: string;
  status: string;
  adminNote?: string;
  createdAt: string;
  user?: { profile?: { firstName?: string; lastName?: string } };
  subscription?: { plan?: string };
}

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api.get<{ alerts: unknown[]; refunds: RefundItem[] }>('/admin/alerts')
      .then(d => setRefunds(d.refunds ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const statusColor: Record<string, string> = {
    PENDING: '#f59e0b', APPROVED: '#4ade80', REJECTED: '#ff6b6b',
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-serif text-2xl text-[#f5f5f5] mb-6">İade Talepleri</h1>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0,1,2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : refunds.length === 0 ? (
        <p className="text-[#555] text-sm">İade talebi yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {refunds.map((r, i) => (
            <RefundRow key={r.id} refund={r} delay={i * 0.04} statusColor={statusColor} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function RefundRow({ refund, delay, statusColor, onUpdate }: {
  refund: RefundItem; delay: number; statusColor: Record<string, string>; onUpdate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  async function update(status: 'APPROVED' | 'REJECTED') {
    setLoading(true);
    await api.patch(`/admin/refunds/${refund.id}`, { status, adminNote: note || undefined }).catch(() => {});
    setLoading(false);
    setOpen(false);
    onUpdate();
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="glass-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#f5f5f5] font-medium">{refund.user?.profile?.firstName ?? ''} {refund.user?.profile?.lastName ?? ''}</p>
          <p className="text-xs text-[#555]">{refund.refundType}{refund.subscription?.plan ? ` · ${refund.subscription.plan}` : ''} · {new Date(refund.createdAt).toLocaleString('tr-TR')}</p>
          {refund.adminNote && <p className="text-xs text-[#666] mt-1 italic">{refund.adminNote}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: statusColor[refund.status] ?? '#888' }}>{refund.status}</span>
          {refund.status === 'PENDING' && (
            <button onClick={() => setOpen(o => !o)}
              className="text-xs px-3 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }}>
              İncele
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Admin notu (opsiyonel)"
            className="w-full bg-transparent border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
          <div className="flex gap-2">
            <button onClick={() => update('APPROVED')} disabled={loading}
              className="flex-1 py-1.5 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
              Onayla
            </button>
            <button onClick={() => update('REJECTED')} disabled={loading}
              className="flex-1 py-1.5 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(192,57,43,0.12)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.2)' }}>
              Reddet
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
