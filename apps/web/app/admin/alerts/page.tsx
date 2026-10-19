'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface AlertItem {
  id: string;
  type: string;
  userId: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}


export default function AdminAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ alerts: AlertItem[]; unreadCount: number }>('/admin/alerts')
      .then(d => setAlerts(d.alerts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    await api.patch(`/admin/alerts/${id}/read`, {});
    setAlerts(a => a.map(x => x.id === id ? { ...x, isRead: true } : x));
  }

  const unread = alerts.filter(a => !a.isRead).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-serif text-2xl text-[#f5f5f5] mb-1">Uyarılar</h1>
      {unread > 0 && <p className="text-xs text-[#888] mb-6">{unread} okunmamış uyarı</p>}
      {!unread && <div className="mb-6" />}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0,1,2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />)}
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-[#555] text-sm">Uyarı yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((a, i) => (
            <motion.div key={a.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="glass-card px-4 py-3 flex items-start justify-between gap-3"
              style={!a.isRead ? { border: '1px solid rgba(192,57,43,0.25)' } : {}}>
              <div>
                <p className="text-sm text-[#f5f5f5] font-medium">{a.type}</p>
                <p className="text-xs text-[#555] mt-0.5">{new Date(a.createdAt).toLocaleString('tr-TR')}</p>
              </div>
              {!a.isRead && (
                <button onClick={() => markRead(a.id)}
                  className="text-xs px-3 py-1 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(192,57,43,0.15)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.2)' }}>
                  Okundu
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

