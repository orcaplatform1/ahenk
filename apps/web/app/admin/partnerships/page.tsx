'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface Partnership {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  venueType?: string;
  capacity?: number;
  description?: string;
  websiteOrSocial?: string;
  status: string;
  adminNote?: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b', REVIEWED: '#4ade80', REJECTED: '#ff6b6b',
};

export default function AdminPartnerships() {
  const [items, setItems] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function load() {
    api.get<Partnership[]>('/admin/partnerships').then(setItems).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function update(id: string, status: string) {
    setSaving(id);
    await api.patch(`/admin/partnerships/${id}`, { status, adminNote: notes[id] || undefined }).catch(() => {});
    setSaving(null);
    setExpanded(null);
    load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-serif text-2xl text-[#f5f5f5] mb-6">İş Ortaklığı Başvuruları</h1>

      {loading ? (
        <div className="flex flex-col gap-3">{[0,1,2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />)}</div>
      ) : items.length === 0 ? (
        <p className="text-[#555] text-sm">Başvuru yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((p, i) => (
            <motion.div key={p.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#f5f5f5]">{p.businessName}</p>
                    <span className="text-xs font-semibold" style={{ color: STATUS_COLOR[p.status] ?? '#888' }}>{p.status}</span>
                  </div>
                  <p className="text-xs text-[#888]">{p.contactName} · {p.email}</p>
                  <p className="text-xs text-[#555]">{p.city}{p.venueType ? ` · ${p.venueType}` : ''} · {new Date(p.createdAt).toLocaleString('tr-TR')}</p>
                </div>
                <button onClick={() => setExpanded(e => e === p.id ? null : p.id)}
                  className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.10)', color: '#666', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {expanded === p.id ? '▲ Kapat' : '▼ Detay'}
                </button>
              </div>

              {expanded === p.id && (
                <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                  {p.phone && <p className="text-xs text-[#666]">Tel: {p.phone}</p>}
                  {p.capacity && <p className="text-xs text-[#666]">Kapasite: {p.capacity}</p>}
                  {p.websiteOrSocial && <p className="text-xs text-[#666]">Web/Sosyal: {p.websiteOrSocial}</p>}
                  {p.description && <p className="text-xs text-[#888] italic">"{p.description}"</p>}
                  {p.adminNote && <p className="text-xs text-[#666]">Not: {p.adminNote}</p>}
                  {p.status === 'PENDING' && (
                    <>
                      <textarea value={notes[p.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))}
                        placeholder="Admin notu (opsiyonel)" rows={2}
                        className="w-full bg-transparent border rounded-xl px-3 py-2 text-xs text-[#f5f5f5] outline-none resize-none"
                        style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                      <div className="flex gap-2">
                        <button onClick={() => update(p.id, 'REVIEWED')} disabled={saving === p.id}
                          className="flex-1 py-1.5 rounded-xl text-xs font-medium"
                          style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                          {saving === p.id ? '…' : 'İncelendi'}
                        </button>
                        <button onClick={() => update(p.id, 'REJECTED')} disabled={saving === p.id}
                          className="flex-1 py-1.5 rounded-xl text-xs font-medium"
                          style={{ background: 'rgba(192,57,43,0.12)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.2)' }}>
                          {saving === p.id ? '…' : 'Reddet'}
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
