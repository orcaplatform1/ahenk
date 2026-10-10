'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

interface Venue { id: string; name: string; category: string; address?: string; isActive: boolean; city: { id: string; name: string }; }
interface City { id: string; name: string; }

const CATS = ['SADE', 'ORTA', 'PREMIUM'];

interface VenueForm { name: string; cityId: string; category: string; address: string; }
const EMPTY_FORM: VenueForm = { name: '', cityId: '', category: 'SADE', address: '' };

export default function MekanlarPage() {
  const toast = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ edit?: Venue } | null>(null);
  const [form, setForm] = useState<VenueForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get<Venue[]>('/admin/venues'), api.get<City[]>('/admin/cities')])
      .then(([v, c]) => { setVenues(v); setCities(c); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setModal({}); setForm(EMPTY_FORM); }
  function openEdit(v: Venue) {
    setModal({ edit: v });
    setForm({ name: v.name, cityId: v.city.id, category: v.category, address: v.address ?? '' });
  }

  function set<K extends keyof VenueForm>(k: K, v: VenueForm[K]) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.name || !form.cityId) { toast.error('Ad ve şehir zorunlu.'); return; }
    setSaving(true);
    try {
      if (modal?.edit) {
        await api.patch(`/admin/venues/${modal.edit.id}`, { name: form.name, category: form.category, address: form.address || undefined });
      } else {
        await api.post('/admin/venues', { name: form.name, cityId: form.cityId, category: form.category, address: form.address || undefined });
      }
      toast.success(modal?.edit ? 'Mekan güncellendi.' : 'Mekan oluşturuldu.');
      setModal(null); load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu mekanı silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/admin/venues/${id}`);
      toast.success('Mekan silindi.'); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl">Mekanlar</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-xl text-sm font-medium transition-colors">+ Yeni Mekan</button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-surface rounded-xl animate-pulse" />)}</div>
      ) : venues.length === 0 ? <p className="text-muted text-sm">Mekan yok.</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase">
              <th className="text-left py-3 px-2">Ad</th>
              <th className="text-left py-3 px-2">Şehir</th>
              <th className="text-left py-3 px-2">Tür</th>
              <th className="text-left py-3 px-2">Adres</th>
              <th className="text-left py-3 px-2">Durum</th>
              <th className="py-3 px-2" />
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                <td className="py-3 px-2 font-medium">{v.name}</td>
                <td className="py-3 px-2 text-muted">{v.city.name}</td>
                <td className="py-3 px-2 text-muted">{v.category}</td>
                <td className="py-3 px-2 text-muted max-w-xs truncate">{v.address ?? '—'}</td>
                <td className="py-3 px-2">
                  <span className={`text-xs ${v.isActive ? 'text-green-400' : 'text-muted'}`}>{v.isActive ? 'Aktif' : 'Pasif'}</span>
                </td>
                <td className="py-3 px-2 text-right">
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => openEdit(v)} className="text-xs text-primary hover:underline">Düzenle</button>
                    <button onClick={() => handleDelete(v.id)} className="text-xs text-muted hover:text-accent">Sil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Mekanı Düzenle' : 'Yeni Mekan'}>
        <div className="flex flex-col gap-3">
          <F label="Ad" value={form.name} onChange={(v) => set('name', v)} />
          {!modal?.edit && (
            <div>
              <label className="block text-xs text-muted mb-1">Şehir</label>
              <select value={form.cityId} onChange={(e) => set('cityId', e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none">
                <option value="">Seç</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-muted mb-1">Tür</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none">
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <F label="Adres (opsiyonel)" value={form.address} onChange={(v) => set('address', v)} />
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium disabled:opacity-50">
            {saving ? 'Kaydediliyor…' : modal?.edit ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </Modal>
    </AdminShell>
  );
}

function F({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" />
    </div>
  );
}
