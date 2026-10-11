'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface Bot {
  id: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
  status?: string;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-sm p-5" style={{ background: '#111' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-[#f5f5f5]">{title}</h2>
          <button onClick={onClose} className="text-[#555] hover:text-[#f5f5f5] text-lg">✕</button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function AdminBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<Bot[]>('/matching/admin/bots').then(setBots).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setForm({ firstName: '', lastName: '' }); setModal('add'); }
  function openEdit(b: Bot) { setEditing(b); setForm({ firstName: b.firstName, lastName: b.lastName }); setModal('edit'); }

  async function save() {
    setSaving(true);
    if (modal === 'add') {
      await api.post('/matching/admin/bots', form).catch(() => {});
    } else if (editing) {
      await api.patch(`/matching/admin/bots/${editing.id}/name`, form).catch(() => {});
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function toggleStatus(b: Bot) {
    const active = b.isActive !== false && b.status !== 'INACTIVE';
    await api.patch(`/matching/admin/bots/${b.id}/status`, { isActive: !active }).catch(() => {});
    load();
  }

  async function deleteBot(id: string) {
    if (!confirm('Botu sil?')) return;
    await api.delete(`/matching/admin/bots/${id}`).catch(() => {});
    load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-[#f5f5f5]">Bot Yönetimi</h1>
        <button onClick={openAdd}
          className="px-4 py-1.5 rounded-xl text-sm font-medium"
          style={{ background: 'linear-gradient(135deg,#c0392b,#922b21)', color: '#fff' }}>
          + Bot Ekle
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">{[0,1,2].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}</div>
      ) : bots.length === 0 ? (
        <p className="text-[#555] text-sm">Bot yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bots.map((b, i) => {
            const active = b.isActive !== false && b.status !== 'INACTIVE';
            return (
              <motion.div key={b.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="glass-card px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#f5f5f5]">{b.firstName} {b.lastName}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={active ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80' } : { background: 'rgba(255,255,255,0.05)', color: '#555' }}>
                      {active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleStatus(b)}
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={active ? { background: 'rgba(255,255,255,0.05)', color: '#555', border: '1px solid rgba(255,255,255,0.07)' }
                      : { background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                    {active ? 'Pasifleştir' : 'Aktifleştir'}
                  </button>
                  <button onClick={() => openEdit(b)}
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.07)' }}>
                    İsim
                  </button>
                  <button onClick={() => deleteBot(b.id)}
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(192,57,43,0.1)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.15)' }}>
                    Sil
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <Modal title={modal === 'add' ? 'Yeni Bot' : 'İsim Düzenle'} onClose={() => setModal(null)}>
            <div className="flex flex-col gap-3">
              <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Ad"
                className="w-full bg-transparent border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Soyad"
                className="w-full bg-transparent border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <button onClick={save} disabled={saving || !form.firstName || !form.lastName}
                className="w-full py-2 rounded-xl text-sm font-medium"
                style={{ background: 'linear-gradient(135deg,#c0392b,#922b21)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
