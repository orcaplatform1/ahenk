'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

interface City { id: string; name: string; isActive: boolean; weeklyTableLimit: number; }

export default function SehirlerPage() {
  const toast = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<City | null>(null);
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get<City[]>('/admin/cities')
      .then(setCities)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(city: City) {
    setToggling(city.id);
    try {
      await api.patch(`/admin/cities/${city.id}`, { isActive: !city.isActive });
      toast.success(city.isActive ? 'Şehir pasife alındı.' : 'Şehir aktif edildi.');
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setToggling(''); }
  }

  async function handleSaveLimit() {
    if (!editModal) return;
    setSaving(true);
    try {
      await api.patch(`/admin/cities/${editModal.id}`, { weeklyTableLimit: Number(limit) });
      toast.success('Limit güncellendi.');
      setEditModal(null); load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-6">Şehirler</h1>

      {loading ? (
        <div className="flex flex-col gap-2">{[...Array(7)].map((_, i) => <div key={i} className="h-12 bg-surface rounded-xl animate-pulse" />)}</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase">
              <th className="text-left py-3 px-2">Şehir</th>
              <th className="text-left py-3 px-2">Haftalık Limit</th>
              <th className="text-left py-3 px-2">Durum</th>
              <th className="py-3 px-2" />
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                <td className="py-3 px-2 font-medium">{c.name}</td>
                <td className="py-3 px-2 text-muted">{c.weeklyTableLimit === 0 ? 'Global' : c.weeklyTableLimit}</td>
                <td className="py-3 px-2">
                  <button onClick={() => toggleActive(c)} disabled={toggling === c.id}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors disabled:opacity-50 ${c.isActive ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-bg text-muted border-border'}`}>
                    {toggling === c.id ? '…' : c.isActive ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
                <td className="py-3 px-2 text-right">
                  <button onClick={() => { setEditModal(c); setLimit(String(c.weeklyTableLimit)); }}
                    className="text-xs text-primary hover:underline">Düzenle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`${editModal?.name} — Haftalık Limit`}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Haftalık Masa Limiti (0 = global)</label>
            <input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" />
          </div>
          <button onClick={handleSaveLimit} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium disabled:opacity-50">
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </Modal>
    </AdminShell>
  );
}
