'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface City { id: string; name: string; }
interface Venue {
  id: string; name: string; category: string; venueType?: string;
  address?: string; description?: string; isActive: boolean;
  city: City;
}

const CATS = ['SADE', 'ORTA', 'PREMIUM'];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-md p-5" style={{ background: '#111' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-[#f5f5f5]">{title}</h2>
          <button onClick={onClose} className="text-[#555] hover:text-[#f5f5f5] text-lg">✕</button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function AdminVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState({ name: '', category: 'SADE', cityId: '', address: '', description: '' });
  const [saving, setSaving] = useState(false);

  function loadVenues(cityId?: string) {
    const q = cityId ? `?cityId=${cityId}` : '';
    api.get<Venue[]>(`/admin/venues${q}`).then(setVenues).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    api.get<City[]>('/admin/cities').then(setCities).catch(() => {});
    loadVenues();
  }, []);

  function openAdd() {
    setForm({ name: '', category: 'SADE', cityId: cities[0]?.id ?? '', address: '', description: '' });
    setModal('add');
  }

  function openEdit(v: Venue) {
    setEditing(v);
    setForm({ name: v.name, category: v.category, cityId: v.city.id, address: v.address ?? '', description: v.description ?? '' });
    setModal('edit');
  }

  async function save() {
    setSaving(true);
    const body = { name: form.name, category: form.category, cityId: form.cityId, address: form.address || undefined, description: form.description || undefined };
    if (modal === 'add') await api.post('/admin/venues', body).catch(() => {});
    else if (editing) await api.patch(`/admin/venues/${editing.id}`, body).catch(() => {});
    setSaving(false);
    setModal(null);
    loadVenues(selectedCity || undefined);
  }

  async function deleteVenue(id: string) {
    if (!confirm('Mekanı sil?')) return;
    await api.delete(`/admin/venues/${id}`).catch(() => {});
    loadVenues(selectedCity || undefined);
  }

  async function toggleActive(v: Venue) {
    await api.patch(`/admin/venues/${v.id}`, { isActive: !v.isActive }).catch(() => {});
    loadVenues(selectedCity || undefined);
  }

  const filtered = selectedCity ? venues.filter(v => v.city.id === selectedCity) : venues;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-[#f5f5f5]">Mekanlar</h1>
        <button onClick={openAdd}
          className="px-4 py-1.5 rounded-xl text-sm font-medium"
          style={{ background: 'linear-gradient(135deg,#c0392b,#922b21)', color: '#fff' }}>
          + Mekan Ekle
        </button>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => { setSelectedCity(''); loadVenues(); }}
          className="px-3 py-1 rounded-full text-xs"
          style={selectedCity === '' ? { background: '#c0392b', color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
          Tümü
        </button>
        {cities.map(c => (
          <button key={c.id} onClick={() => { setSelectedCity(c.id); loadVenues(c.id); }}
            className="px-3 py-1 rounded-full text-xs"
            style={selectedCity === c.id ? { background: '#c0392b', color: '#fff' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">{[0,1,2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-[#555] text-sm">Mekan yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((v, i) => (
            <motion.div key={v.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="glass-card px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#f5f5f5] truncate">{v.name}</p>
                  {!v.isActive && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#555' }}>Pasif</span>}
                </div>
                <p className="text-xs text-[#555]">{v.city.name} · {v.category}{v.address ? ` · ${v.address}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => toggleActive(v)}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: v.isActive ? 'rgba(255,255,255,0.05)' : 'rgba(74,222,128,0.1)', color: v.isActive ? '#555' : '#4ade80', border: `1px solid ${v.isActive ? 'rgba(255,255,255,0.07)' : 'rgba(74,222,128,0.2)'}` }}>
                  {v.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                </button>
                <button onClick={() => openEdit(v)}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.07)' }}>
                  Düzenle
                </button>
                <button onClick={() => deleteVenue(v.id)}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(192,57,43,0.1)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.15)' }}>
                  Sil
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <Modal title={modal === 'add' ? 'Yeni Mekan' : 'Mekanı Düzenle'} onClose={() => setModal(null)}>
            <div className="flex flex-col gap-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mekan adı"
                className="w-full bg-transparent border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <select value={form.cityId} onChange={e => setForm(f => ({ ...f, cityId: e.target.value }))}
                className="w-full bg-[#1a1a1a] border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-[#1a1a1a] border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adres (opsiyonel)"
                className="w-full bg-transparent border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
              <button onClick={save} disabled={saving || !form.name || !form.cityId}
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
