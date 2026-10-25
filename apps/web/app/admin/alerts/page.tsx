'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const AMBER   = '#f59e0b';
const RED     = '#ef4444';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

interface AlertItem {
  id: string;
  alertType: string;
  userId: string;
  user?: { profile?: { firstName?: string; lastName?: string } | null } | null;
  isRead: boolean;
  createdAt: string;
}

const ALERT_LABELS: Record<string, string> = {
  MISSED_GROUP_CYCLES: 'Grup masası üst üste kurulamadı',
  MISSED_ONEONE_CYCLES: 'Başbaşa masası üst üste kurulamadı',
  MISSED_KANKA_CYCLES: 'Kankamla masası üst üste kurulamadı',
  SOS_ALERT: 'Acil yardım talebi',
  BOT_NOT_FOUND: 'Uygun bot bulunamadı',
};

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ alerts: AlertItem[]; unreadCount: number }>('/admin/alerts')
      .then(d => setAlerts(d.alerts ?? []))
      .catch((e: Error) => setError(`Uyarılar yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    setError('');
    try {
      await api.patch(`/admin/alerts/${id}/read`, {});
      setAlerts(a => a.map(x => x.id === id ? { ...x, isRead: true } : x));
    } catch (e) {
      setError(`Güncellenemedi: ${(e as Error).message}`);
    }
  }

  const unread = alerts.filter(a => !a.isRead).length;

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
          Uyarılar
        </h1>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 12, color: RED }}>{error}</p>}

      {loading ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: AMBER }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: AMBER }}>UYARILAR</span>
          </div>
          <div style={{ padding: '24px 20px' }}>
            <p style={{ margin: 0, fontSize: 12, color: MUTED, fontFamily: MONO }}>Yükleniyor…</p>
          </div>
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: AMBER }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: AMBER }}>UYARILAR</span>
            {unread > 0 && (
              <span style={{ fontSize: 9, fontWeight: 900, background: AMBER, color: '#000', borderRadius: 99, padding: '1px 6px', fontFamily: MONO }}>
                {unread}
              </span>
            )}
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
              {alerts.length} kayıt
            </span>
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: GREEN }}>Bekleyen uyarı yok</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>Tüm eşleşmeler nominal</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {alerts.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    padding: '14px 18px',
                    borderBottom: i < alerts.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
                    background: a.isRead ? 'transparent' : 'rgba(245,158,11,0.05)',
                    opacity: a.isRead ? 0.55 : 1,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT }}>
                      {ALERT_LABELS[a.alertType] ?? a.alertType}
                      {a.user?.profile && ` — ${a.user.profile.firstName ?? ''} ${a.user.profile.lastName ?? ''}`}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                      {new Date(a.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                    </p>
                  </div>
                  {!a.isRead && (
                    <button
                      onClick={() => markRead(a.id)}
                      style={{
                        flexShrink: 0,
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: SURFACE, border: `1px solid ${BORDER}`,
                        fontSize: 10, color: MUTED, fontFamily: SANS,
                      }}
                    >
                      Okundu
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
