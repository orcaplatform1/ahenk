'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

interface Subscription {
  id: string;
  plan: string;
  platform: string;
  startedAt: string;
  expiresAt?: string;
  cancelNote?: string;
  cancelledAt?: string;
  user: { firstName: string; lastName: string; email: string };
}

const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde' };
const PLATFORM_LABEL: Record<string, string> = { WEB: 'Web', GOOGLE: 'Google Play', APPLE: 'App Store' };

export default function AboneliklerPage() {
  const toast = useToast();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'cancelled'>('active');
  const [cancelModal, setCancelModal] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    // Backend'de /admin/subscriptions yok; kullanıcı bazlı liste var.
    // Genel abonelik listesi için /admin/users üzerinden geliyor, burada simüle edildi.
    // Gerçek endpoint eklendiğinde burası güncellenir.
    api.get<{ items: Subscription[] }>(`/admin/subscriptions?status=${tab}`)
      .then((r) => setSubs(r.items ?? []))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel() {
    if (!cancelModal) return;
    setSaving(true);
    try {
      await api.patch(`/admin/subscriptions/${cancelModal}/cancel`, { cancelNote: reason || undefined });
      toast.success('Abonelik iptal edildi.');
      setCancelModal(null); setReason(''); load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-6">Abonelikler</h1>

      <div className="flex gap-1 mb-6">
        {(['active', 'cancelled'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${tab === t ? 'bg-primary text-white' : 'text-muted hover:text-text hover:bg-surface'}`}>
            {t === 'active' ? 'Aktif' : 'İptal Edilmiş'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-surface rounded-xl animate-pulse" />)}</div>
      ) : subs.length === 0 ? <p className="text-muted text-sm">Kayıt yok.</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase">
              <th className="text-left py-3 px-2">Kullanıcı</th>
              <th className="text-left py-3 px-2">Paket</th>
              <th className="text-left py-3 px-2">Platform</th>
              <th className="text-left py-3 px-2">Başlangıç</th>
              <th className="text-left py-3 px-2">Bitiş</th>
              {tab === 'active' && <th className="py-3 px-2" />}
              {tab === 'cancelled' && <th className="text-left py-3 px-2">Sebep</th>}
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                <td className="py-3 px-2">{s.user.firstName} {s.user.lastName}</td>
                <td className="py-3 px-2 font-medium">{PLAN_LABEL[s.plan] ?? s.plan}</td>
                <td className="py-3 px-2 text-muted">{PLATFORM_LABEL[s.platform] ?? s.platform}</td>
                <td className="py-3 px-2 text-muted">{new Date(s.startedAt).toLocaleDateString('tr-TR')}</td>
                <td className="py-3 px-2 text-muted">{s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('tr-TR') : '—'}</td>
                {tab === 'active' && (
                  <td className="py-3 px-2 text-right">
                    <button onClick={() => { setCancelModal(s.id); setReason(''); }}
                      className="text-xs text-muted hover:text-accent transition-colors">İptal Et</button>
                  </td>
                )}
                {tab === 'cancelled' && (
                  <td className="py-3 px-2 text-muted text-xs max-w-xs truncate">{s.cancelNote ?? '—'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title="Aboneliği İptal Et">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">İptal Sebebi (opsiyonel)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none resize-none" />
          </div>
          <button onClick={handleCancel} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium disabled:opacity-50">
            {saving ? 'İptal ediliyor…' : 'İptal Et'}
          </button>
        </div>
      </Modal>
    </AdminShell>
  );
}
