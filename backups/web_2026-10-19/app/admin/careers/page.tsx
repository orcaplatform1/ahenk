'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface Career {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  linkedinOrCv?: string;
  motivation?: string;
  hearFrom?: string;
  status: string;
  adminNote?: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b', REVIEWED: '#4ade80', REJECTED: '#ff6b6b',
};

export default function AdminCareers() {
  const [items, setItems] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function load() {
    api.get<Career[]>('/admin/careers').then(setItems).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function update(id: string, status: string) {
    setSaving(id);
    await api.patch(`/admin/careers/${id}`, { status, adminNote: notes[id] || undefined }).catch(() => {});
    setSaving(null);
    setExpanded(null);
    load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-serif text-2xl text-[#f5f5f5] mb-6">Kariyer Başvuruları</h1>

      {loading ? (
        <div className="flex flex-col gap-3">{[0,1,2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}</div>
      ) : items.length === 0 ? (
        <p className="text-[#555] text-sm">Başvuru yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((c, i) => (
            <motion.div key={c.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#f5f5f5]">{c.fullName}</p>
                    <span className="text-xs font-semibold" style={{ color: STATUS_COLOR[c.status] ?? '#888' }}>{c.status}</span>
                  </div>
                  <p className="text-xs text-[#888]">{c.email}</p>
                  <p className="text-xs text-[#555]">{c.city ?? '—'} · {new Date(c.createdAt).toLocaleString('tr-TR')}</p>
                </div>
                <button onClick={() => setExpanded(e => e === c.id ? null : c.id)}
                  className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#666', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {expanded === c.id ? '▲ Kapat' : '▼ Detay'}
                </button>
              </div>

              {expanded === c.id && (
                <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {c.phone && <p className="text-xs text-[#666]">Tel: {c.phone}</p>}
                  {c.linkedinOrCv && <p className="text-xs text-[#666]">LinkedIn/CV: {c.linkedinOrCv}</p>}
                  {c.hearFrom && <p className="text-xs text-[#666]">Nasıl duydunuz: {c.hearFrom}</p>}
                  {c.motivation && <p className="text-xs text-[#888] italic">"{c.motivation}"</p>}
                  {c.adminNote && <p className="text-xs text-[#666]">Not: {c.adminNote}</p>}
                  {c.status === 'PENDING' && (
                    <>
                      <textarea value={notes[c.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))}
                        placeholder="Admin notu (opsiyonel)" rows={2}
                        className="w-full bg-transparent border rounded-xl px-3 py-2 text-xs text-[#f5f5f5] outline-none resize-none"
                        style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                      <div className="flex gap-2">
                        <button onClick={() => update(c.id, 'REVIEWED')} disabled={saving === c.id}
                          className="flex-1 py-1.5 rounded-xl text-xs font-medium"
                          style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                          {saving === c.id ? '…' : 'İncelendi'}
                        </button>
                        <button onClick={() => update(c.id, 'REJECTED')} disabled={saving === c.id}
                          className="flex-1 py-1.5 rounded-xl text-xs font-medium"
                          style={{ background: 'rgba(192,57,43,0.12)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.2)' }}>
                          {saving === c.id ? '…' : 'Reddet'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
