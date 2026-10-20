'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────
const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const RED     = '#ef4444';
const BLUE    = '#3b82f6';
const AMBER   = '#f59e0b';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

// ─── Tipler ───────────────────────────────────────────────────────────────────
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
  MISSED_GROUP_CYCLES:  '4 Grup Döngüsü Kaçırıldı',
  MISSED_ONEONE_CYCLES: '4 Başbaşa Döngüsü Kaçırıldı',
};
const REFUND_TYPE_LABEL: Record<string, string> = {
  GROUP: 'Grup İadesi', ONEONE: 'Başbaşa İadesi', FULL: 'Tam İade',
};
const REFUND_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi',
};
const REFUND_STATUS_COLOR: Record<string, string> = {
  PENDING:  AMBER,
  APPROVED: GREEN,
  REJECTED: RED,
};
const REFUND_STATUS_BG: Record<string, string> = {
  PENDING:  'rgba(245,158,11,0.12)',
  APPROVED: 'rgba(34,197,94,0.12)',
  REJECTED: 'rgba(239,68,68,0.12)',
};
const REFUND_STATUS_BORDER: Record<string, string> = {
  PENDING:  'rgba(245,158,11,0.35)',
  APPROVED: 'rgba(34,197,94,0.3)',
  REJECTED: 'rgba(239,68,68,0.3)',
};

type Tab = 'alerts' | 'refunds';

// ─── Sayfa ────────────────────────────────────────────────────────────────────
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
      <div style={{ fontFamily: SANS }}>

        {/* Başlık */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
            Uyarılar & İade Talepleri
          </h1>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {(['alerts', 'refunds'] as Tab[]).map(t => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                  background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : BORDER}`,
                  fontSize: 11, fontWeight: active ? 700 : 400,
                  color: active ? BLUE : MUTED,
                  fontFamily: SANS,
                }}
              >
                {t === 'alerts' ? (
                  <>
                    Eşleşme Uyarıları
                    {unread > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 900,
                        background: AMBER, color: '#000',
                        borderRadius: 99, padding: '1px 6px',
                        fontFamily: MONO,
                      }}>
                        {unread}
                      </span>
                    )}
                  </>
                ) : 'İade Talepleri'}
              </button>
            );
          })}
        </div>

        {/* İçerik */}
        {loading ? (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: '24px 20px',
          }}>
            <p style={{ margin: 0, fontSize: 12, color: MUTED, fontFamily: MONO }}>Yükleniyor…</p>
          </div>
        ) : tab === 'alerts' ? (

          /* ── Uyarılar ── */
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            {/* Kart başlığı */}
            <div style={{
              padding: '12px 18px',
              borderBottom: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 2, height: 12, borderRadius: 1, background: AMBER }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: AMBER }}>
                EŞLEŞİM UYARILARI
              </span>
              <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
                {alerts.length} kayıt
              </span>
            </div>

            {alerts.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: GREEN }}>
                  Bekleyen uyarı yok
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>
                  Tüm eşleşmeler nominal
                </p>
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
                        {a.user.profile
                          ? `${a.user.profile.firstName} ${a.user.profile.lastName}`
                          : a.userId}
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: AMBER }}>
                        {ALERT_TYPE_LABEL[a.alertType]}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                        {new Date(a.createdAt).toLocaleDateString('tr-TR')}
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

        ) : (

          /* ── İade Talepleri ── */
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            {/* Kart başlığı */}
            <div style={{
              padding: '12px 18px',
              borderBottom: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE }}>
                İADE TALEPLERİ
              </span>
              <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
                {refunds.length} kayıt
              </span>
            </div>

            {refunds.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: GREEN }}>
                  İade talebi yok
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>
                  Bekleyen işlem bulunmuyor
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {refunds.map((r, i) => {
                  const sc = REFUND_STATUS_COLOR[r.status];
                  const sbg = REFUND_STATUS_BG[r.status];
                  const sbo = REFUND_STATUS_BORDER[r.status];
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: '16px 18px',
                        borderBottom: i < refunds.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                      }}
                    >
                      {/* Üst satır */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT }}>
                            {r.user.profile
                              ? `${r.user.profile.firstName} ${r.user.profile.lastName}`
                              : r.userId}
                          </p>
                          <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED }}>
                            {REFUND_TYPE_LABEL[r.refundType]}
                            <span style={{ marginLeft: 6, color: MUTED }}>·</span>
                            <span style={{ marginLeft: 6, fontFamily: MONO }}>{r.subscription.plan}</span>
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                            {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', flexShrink: 0,
                          padding: '2px 8px', borderRadius: 99,
                          background: sbg, color: sc, border: `1px solid ${sbo}`,
                        }}>
                          {REFUND_STATUS_LABEL[r.status]}
                        </span>
                      </div>

                      {/* Admin notu (varsa) */}
                      {r.adminNote && (
                        <p style={{
                          margin: '0 0 10px', fontSize: 10, color: MUTED,
                          borderTop: `1px solid ${BORDER}`, paddingTop: 8,
                        }}>
                          Not: {r.adminNote}
                        </p>
                      )}

                      {/* İşlem butonları */}
                      {r.status === 'PENDING' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input
                            value={refundNote[r.id] ?? ''}
                            onChange={e => setRefundNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                            placeholder="Admin notu (opsiyonel)"
                            style={{
                              width: '100%',
                              background: '#020c1b',
                              border: `1px solid ${BORDER}`,
                              borderRadius: 8,
                              padding: '7px 12px',
                              fontSize: 11, color: TEXT,
                              outline: 'none', fontFamily: SANS,
                              boxSizing: 'border-box',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              disabled={processingId === r.id}
                              onClick={() => updateRefund(r.id, 'APPROVED')}
                              style={{
                                padding: '5px 16px', borderRadius: 6, cursor: processingId === r.id ? 'not-allowed' : 'pointer',
                                background: 'rgba(34,197,94,0.1)',
                                border: '1px solid rgba(34,197,94,0.35)',
                                fontSize: 11, fontWeight: 600, color: GREEN,
                                fontFamily: SANS,
                                opacity: processingId === r.id ? 0.5 : 1,
                              }}
                            >
                              Onayla
                            </button>
                            <button
                              disabled={processingId === r.id}
                              onClick={() => updateRefund(r.id, 'REJECTED')}
                              style={{
                                padding: '5px 16px', borderRadius: 6, cursor: processingId === r.id ? 'not-allowed' : 'pointer',
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.35)',
                                fontSize: 11, fontWeight: 600, color: RED,
                                fontFamily: SANS,
                                opacity: processingId === r.id ? 0.5 : 1,
                              }}
                            >
                              Reddet
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
