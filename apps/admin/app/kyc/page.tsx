'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
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
const CYAN    = '#22d3ee';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';
const SANS    = 'Inter, system-ui, sans-serif';

// ─── Tipler ───────────────────────────────────────────────────────────────────
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

const TAB_COLOR: Record<KycStatusFilter, string> = {
  PENDING:    AMBER,
  APPROVED:   GREEN,
  REJECTED:   RED,
  SUSPICIOUS: '#fb923c',
};
const TAB_BG: Record<KycStatusFilter, string> = {
  PENDING:    'rgba(245,158,11,0.12)',
  APPROVED:   'rgba(34,197,94,0.12)',
  REJECTED:   'rgba(239,68,68,0.12)',
  SUSPICIOUS: 'rgba(251,146,60,0.12)',
};
const TAB_BORDER: Record<KycStatusFilter, string> = {
  PENDING:    'rgba(245,158,11,0.35)',
  APPROVED:   'rgba(34,197,94,0.3)',
  REJECTED:   'rgba(239,68,68,0.3)',
  SUSPICIOUS: 'rgba(251,146,60,0.3)',
};

async function openFile(url: string) {
  const token = localStorage.getItem('admin_token');
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return;
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), '_blank');
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────
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
      <div style={{ fontFamily: SANS }}>

        {/* Başlık */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
            KYC Sistemi
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
            Kimlik doğrulama başvuruları.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: SANS,
                  background: active ? TAB_BG[t] : 'transparent',
                  border: `1px solid ${active ? TAB_BORDER[t] : BORDER}`,
                  color: active ? TAB_COLOR[t] : MUTED,
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {TAB_LABEL[t]}
              </button>
            );
          })}
        </div>

        {/* İçerik */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 56, background: CARD, borderRadius: 8, border: `1px solid ${BORDER}`, opacity: 0.5 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p style={{ fontSize: 12, color: MUTED }}>Başvuru yok.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Kullanıcı', 'Telefon', 'Başvuru', 'Belgeler',
                    ...(tab === 'PENDING' ? ['İşlem'] : []),
                    ...(tab === 'REJECTED' ? ['Sebep'] : []),
                  ].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left',
                      padding: '0 12px 10px',
                      fontSize: 9, fontWeight: 800,
                      letterSpacing: '0.14em', color: MUTED,
                    }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: `1px solid rgba(26,58,92,0.5)` }}
                  >
                    <td style={{ padding: '11px 12px', fontSize: 12, fontWeight: 600, color: TEXT }}>
                      {item.user.firstName} {item.user.lastName}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 11, color: MUTED, fontFamily: MONO }}>
                      {item.user.phone ?? '—'}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 11, color: MUTED, fontFamily: MONO }}>
                      {new Date(item.submittedAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {item.idFrontUrl && (
                          <button onClick={() => openFile(item.idFrontUrl!)} style={docBtnStyle}>Ön</button>
                        )}
                        {item.idBackUrl && (
                          <button onClick={() => openFile(item.idBackUrl!)} style={docBtnStyle}>Arka</button>
                        )}
                        {item.livenessUrl && (
                          <button onClick={() => openFile(item.livenessUrl!)} style={docBtnStyle}>Video</button>
                        )}
                      </div>
                    </td>

                    {tab === 'PENDING' && (
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => review(item.id, 'APPROVED')}
                            disabled={acting === item.id}
                            style={{
                              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                              background: 'rgba(34,197,94,0.1)',
                              border: '1px solid rgba(34,197,94,0.35)',
                              fontSize: 10, color: GREEN, fontFamily: SANS,
                              opacity: acting === item.id ? 0.5 : 1,
                            }}
                          >
                            {acting === item.id ? '…' : 'Onayla'}
                          </button>
                          <button
                            onClick={() => { setRejectModal({ id: item.id, suspicious: false }); setReason(''); }}
                            style={{
                              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.35)',
                              fontSize: 10, color: RED, fontFamily: SANS,
                            }}
                          >
                            Reddet
                          </button>
                          <button
                            onClick={() => { setRejectModal({ id: item.id, suspicious: true }); setReason(''); }}
                            style={{
                              padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                              background: 'rgba(251,146,60,0.1)',
                              border: '1px solid rgba(251,146,60,0.35)',
                              fontSize: 10, color: '#fb923c', fontFamily: SANS,
                            }}
                          >
                            Şüpheli
                          </button>
                        </div>
                      </td>
                    )}

                    {tab === 'REJECTED' && (
                      <td style={{
                        padding: '11px 12px', fontSize: 11, color: MUTED,
                        maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.rejectReason ?? '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Red / Şüpheli modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title={rejectModal?.suspicious ? 'Şüpheli İşaretle' : 'Reddet'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{
              display: 'block', fontSize: 9, fontWeight: 800,
              letterSpacing: '0.14em', color: MUTED, marginBottom: 6, fontFamily: SANS,
            }}>
              SEBEP *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                background: '#020c1b',
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: TEXT,
                outline: 'none',
                fontFamily: SANS,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={() => {
              if (!rejectModal) return;
              review(rejectModal.id, rejectModal.suspicious ? 'SUSPICIOUS' : 'REJECTED', reason);
              setRejectModal(null);
            }}
            disabled={!reason.trim()}
            style={{
              width: '100%', padding: '10px',
              borderRadius: 8, cursor: reason.trim() ? 'pointer' : 'not-allowed',
              background: reason.trim() ? 'rgba(59,130,246,0.18)' : SURFACE,
              border: `1px solid ${reason.trim() ? 'rgba(59,130,246,0.4)' : BORDER}`,
              color: reason.trim() ? BLUE : MUTED,
              fontSize: 13, fontWeight: 600,
              fontFamily: SANS,
              opacity: reason.trim() ? 1 : 0.5,
            }}
          >
            Gönder
          </button>
        </div>
      </Modal>
    </AdminShell>
  );
}

const docBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: 6,
  cursor: 'pointer',
  background: 'rgba(34,211,238,0.08)',
  border: '1px solid rgba(34,211,238,0.25)',
  fontSize: 10,
  color: '#22d3ee',
  fontFamily: '"Inter, system-ui, sans-serif"',
};
