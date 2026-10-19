'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

type KycStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';

interface KycItem {
  id: string;
  userId: string;
  status: KycStatusFilter;
  submittedAt: string;
  rejectReason?: string;
  user: { firstName: string; lastName: string; phone?: string };
  idFrontUrl?: string;
  idBackUrl?: string;
  livenessUrl?: string;
}

const TABS: KycStatusFilter[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPICIOUS'];
const TAB_LABEL: Record<KycStatusFilter, string> = {
  PENDING: 'Bekleyen', APPROVED: 'Onaylı', REJECTED: 'Reddedilen', SUSPICIOUS: 'Şüpheli',
};

async function openFile(url: string) {
  const token = localStorage.getItem('admin_token');
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return;
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), '_blank');
}

export default function KycPage() {
  const toast = useToast();
  const [tab, setTab] = useState<KycStatusFilter>('PENDING');
  const [items, setItems] = useState<KycItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ id: string; suspicious: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ items: KycItem[] }>(`/kyc/admin?status=${tab}&limit=50`)
      .then((r) => setItems(r.items))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function review(id: string, status: 'APPROVED' | 'REJECTED' | 'SUSPICIOUS', rejectReason?: string) {
    setActing(id);
    try {
      await api.patch(`/kyc/admin/${id}/review`, { status, rejectReason });
      toast.success(status === 'APPROVED' ? 'Onaylandı.' : status === 'REJECTED' ? 'Reddedildi.' : 'Şüpheli işaretlendi.');
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setActing(''); }
  }

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-6">KYC Başvuruları</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${tab === t ? 'bg-primary text-white' : 'text-muted hover:text-text hover:bg-surface'}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-surface rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-muted text-sm">Başvuru yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase">
                <th className="text-left py-3 px-2">Kullanıcı</th>
                <th className="text-left py-3 px-2">Telefon</th>
                <th className="text-left py-3 px-2">Başvuru</th>
                <th className="text-left py-3 px-2">Belgeler</th>
                {tab === 'PENDING' && <th className="text-left py-3 px-2">İşlem</th>}
                {tab === 'REJECTED' && <th className="text-left py-3 px-2">Sebep</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                  <td className="py-3 px-2">{item.user.firstName} {item.user.lastName}</td>
                  <td className="py-3 px-2 text-muted">{item.user.phone ?? '—'}</td>
                  <td className="py-3 px-2 text-muted">{new Date(item.submittedAt).toLocaleDateString('tr-TR')}</td>
                  <td className="py-3 px-2">
                    <div className="flex gap-2">
                      {item.idFrontUrl  && <button onClick={() => openFile(item.idFrontUrl!)}  className="text-xs text-primary hover:underline">Ön</button>}
                      {item.idBackUrl   && <button onClick={() => openFile(item.idBackUrl!)}   className="text-xs text-primary hover:underline">Arka</button>}
                      {item.livenessUrl && <button onClick={() => openFile(item.livenessUrl!)} className="text-xs text-primary hover:underline">Video</button>}
                    </div>
                  </td>
                  {tab === 'PENDING' && (
                    <td className="py-3 px-2">
                      <div className="flex gap-2">
                        <button onClick={() => review(item.id, 'APPROVED')} disabled={acting === item.id}
                          className="px-3 py-1 rounded-lg bg-green-900/40 text-green-400 border border-green-800 text-xs hover:bg-green-900/60 disabled:opacity-50">
                          {acting === item.id ? '…' : 'Onayla'}
                        </button>
                        <button onClick={() => { setRejectModal({ id: item.id, suspicious: false }); setReason(''); }}
                          className="px-3 py-1 rounded-lg bg-red-900/40 text-accent border border-red-800 text-xs hover:bg-red-900/60">
                          Reddet
                        </button>
                        <button onClick={() => { setRejectModal({ id: item.id, suspicious: true }); setReason(''); }}
                          className="px-3 py-1 rounded-lg bg-orange-900/40 text-orange-400 border border-orange-800 text-xs hover:bg-orange-900/60">
                          Şüpheli
                        </button>
                      </div>
                    </td>
                  )}
                  {tab === 'REJECTED' && (
                    <td className="py-3 px-2 text-muted text-xs max-w-xs truncate">{item.rejectReason ?? '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title={rejectModal?.suspicious ? 'Şüpheli İşaretle' : 'Reddet'}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-muted mb-2">Sebep *</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
              rows={3} className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary resize-none" />
          </div>
          <button
            onClick={() => {
              if (!rejectModal) return;
              review(rejectModal.id, rejectModal.suspicious ? 'SUSPICIOUS' : 'REJECTED', reason);
              setRejectModal(null);
            }}
            disabled={!reason.trim()}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium disabled:opacity-50">
            Gönder
          </button>
        </div>
      </Modal>
    </AdminShell>
  );
}
