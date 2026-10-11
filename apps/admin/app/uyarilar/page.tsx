'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

interface AdminAlert {
  id: string;
  userId: string;
  alertType: 'MISSED_GROUP_CYCLES' | 'MISSED_ONEONE_CYCLES';
  isRead: boolean;
  createdAt: string;
  user: { profile: { firstName: string; lastName: string } | null };
}

interface RefundRequest {
  id: string;
  userId: string;
  refundType: 'GROUP' | 'ONEONE' | 'FULL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
  user: { profile: { firstName: string; lastName: string } | null };
  subscription: { plan: string; createdAt: string };
}

const ALERT_TYPE_LABEL: Record<string, string> = {
  MISSED_GROUP_CYCLES: '4 Grup Döngüsü Kaçırıldı',
  MISSED_ONEONE_CYCLES: '4 Başbaşa Döngüsü Kaçırıldı',
};
const REFUND_TYPE_LABEL: Record<string, string> = {
  GROUP: 'Grup İadesi', ONEONE: 'Başbaşa İadesi', FULL: 'Tam İade',
};
const REFUND_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi',
};
const REFUND_STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-yellow-400', APPROVED: 'text-green-400', REJECTED: 'text-red-400',
};

type Tab = 'alerts' | 'refunds';

export default function UyarilarPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('alerts');
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundNote, setRefundNote] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ alerts: AdminAlert[]; refunds: RefundRequest[] }>('/admin/alerts');
      setAlerts(d.alerts);
      setRefunds(d.refunds);
    } catch {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    try {
      await api.patch(`/admin/alerts/${id}/read`, {});
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
    } catch {
      toast.error('İşlem başarısız');
    }
  }

  async function updateRefund(id: string, status: 'APPROVED' | 'REJECTED') {
    setProcessingId(id);
    try {
      await api.patch(`/admin/refunds/${id}`, { status, adminNote: refundNote[id] || undefined });
      toast.success(status === 'APPROVED' ? 'İade onaylandı' : 'İade reddedildi');
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'İşlem başarısız');
    } finally {
      setProcessingId(null);
    }
  }

  const unread = alerts.filter(a => !a.isRead).length;

  return (
    <AdminShell>
      <h1 className="text-xl font-serif mb-6">Uyarılar & İade Talepleri</h1>
      <div className="flex gap-2 mb-6">
        {(['alerts', 'refunds'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-white' : 'bg-surface text-muted hover:text-text'}`}
          >
            {t === 'alerts' ? (
              <span>Eşleşme Uyarıları {unread > 0 && <span className="ml-1 bg-accent text-white text-xs rounded-full px-1.5">{unread}</span>}</span>
            ) : 'İade Talepleri'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted text-sm">Yükleniyor...</p>
      ) : tab === 'alerts' ? (
        <div className="flex flex-col gap-3">
          {alerts.length === 0 && <p className="text-muted text-sm">Uyarı yok.</p>}
          {alerts.map(a => (
            <div key={a.id} className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${a.isRead ? 'border-border opacity-60' : 'border-yellow-600/50 bg-yellow-900/10'}`}>
              <div>
                <p className="text-sm font-medium text-text">{a.user.profile ? `${a.user.profile.firstName} ${a.user.profile.lastName}` : a.userId}</p>
                <p className="text-xs text-muted mt-0.5">{ALERT_TYPE_LABEL[a.alertType]}</p>
                <p className="text-xs text-muted">{new Date(a.createdAt).toLocaleDateString('tr-TR')}</p>
              </div>
              {!a.isRead && (
                <button
                  onClick={() => markRead(a.id)}
                  className="text-xs px-3 py-1 rounded-lg bg-surface border border-border text-muted hover:text-text transition-colors"
                >
                  Okundu İşaretle
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {refunds.length === 0 && <p className="text-muted text-sm">İade talebi yok.</p>}
          {refunds.map(r => (
            <div key={r.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm font-medium text-text">{r.user.profile ? `${r.user.profile.firstName} ${r.user.profile.lastName}` : r.userId}</p>
                  <p className="text-xs text-muted mt-0.5">{REFUND_TYPE_LABEL[r.refundType]} — Paket: {r.subscription.plan}</p>
                  <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</p>
                </div>
                <span className={`text-xs font-semibold ${REFUND_STATUS_COLOR[r.status]}`}>{REFUND_STATUS_LABEL[r.status]}</span>
              </div>
              {r.adminNote && (
                <p className="text-xs text-muted border-t border-border pt-2 mb-3">Not: {r.adminNote}</p>
              )}
              {r.status === 'PENDING' && (
                <div className="flex flex-col gap-2">
                  <input
                    value={refundNote[r.id] ?? ''}
                    onChange={e => setRefundNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Admin notu (opsiyonel)"
                    className="w-full px-3 py-1.5 rounded-lg bg-bg border border-border text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={processingId === r.id}
                      onClick={() => updateRefund(r.id, 'APPROVED')}
                      className="px-4 py-1.5 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                      Onayla
                    </button>
                    <button
                      disabled={processingId === r.id}
                      onClick={() => updateRefund(r.id, 'REJECTED')}
                      className="px-4 py-1.5 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
