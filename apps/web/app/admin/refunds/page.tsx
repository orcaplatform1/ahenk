'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const BG     = '#020c1b';
const SURFACE = '#0a1628';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const AMBER  = '#f59e0b';
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

interface RefundItem {
  id: string; userId: string; refundType: string; status: string;
  adminNote?: string; createdAt: string; refundAmountKurus?: number | null;
  user?: { profile?: { firstName?: string; lastName?: string } };
  subscription?: { plan?: string };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: AMBER, APPROVED: GREEN, REJECTED: RED,
};
const STATUS_BG: Record<string, string> = {
  PENDING: 'rgba(245,158,11,0.12)', APPROVED: 'rgba(34,197,94,0.12)', REJECTED: 'rgba(239,68,68,0.12)',
};
const STATUS_BORDER: Record<string, string> = {
  PENDING: 'rgba(245,158,11,0.35)', APPROVED: 'rgba(34,197,94,0.3)', REJECTED: 'rgba(239,68,68,0.3)',
};

function RefundRow({ refund, onUpdate }: { refund: RefundItem; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  async function update(status: 'APPROVED' | 'REJECTED') {
    setLoading(true);
    setError('');
    try {
      await api.patch(`/admin/refunds/${refund.id}`, { status, adminNote: note || undefined });
      setOpen(false);
      onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ borderBottom: `1px solid rgba(26,58,92,0.5)` }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>
            {refund.user?.profile?.firstName ?? ''} {refund.user?.profile?.lastName ?? ''}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
            {refund.refundType}{refund.subscription?.plan ? ` · ${refund.subscription.plan}` : ''} · {new Date(refund.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
          </p>
          {refund.refundAmountKurus != null && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: TEXT, fontFamily: MONO }}>
              {refund.status === 'APPROVED' ? 'İade edildi' : 'İade tutarı'}: ₺{(refund.refundAmountKurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          {refund.adminNote && (
            <p style={{ margin: '4px 0 0', fontSize: 10, color: MUTED, fontStyle: 'italic' }}>{refund.adminNote}</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 99,
            background: STATUS_BG[refund.status] ?? 'transparent',
            border: `1px solid ${STATUS_BORDER[refund.status] ?? BORDER}`,
            color: STATUS_COLOR[refund.status] ?? MUTED,
          }}>
            {refund.status}
          </span>
          {refund.status === 'PENDING' && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                background: open ? 'rgba(34,211,238,0.08)' : 'transparent',
                border: `1px solid ${open ? 'rgba(34,211,238,0.3)' : BORDER}`,
                fontSize: 10, color: MUTED, fontFamily: SANS,
              }}
            >
              {open ? '▲' : 'İncele'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div style={{ margin: '0 18px 14px', padding: '12px 16px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Admin notu (opsiyonel)"
            style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 12px', fontSize: 11, color: TEXT, outline: 'none', fontFamily: SANS, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => update('APPROVED')} disabled={loading}
              style={{
                flex: 1, padding: '7px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                fontSize: 11, fontWeight: 600, color: GREEN, fontFamily: SANS, opacity: loading ? 0.5 : 1,
              }}
            >
              Onayla
            </button>
            <button
              onClick={() => update('REJECTED')} disabled={loading}
              style={{
                flex: 1, padding: '7px', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                fontSize: 11, fontWeight: 600, color: RED, fontFamily: SANS, opacity: loading ? 0.5 : 1,
              }}
            >
              Reddet
            </button>
          </div>
          {error && <p style={{ margin: 0, fontSize: 11, color: RED }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    api.get<{ alerts: unknown[]; refunds: RefundItem[] }>('/admin/alerts')
      .then(d => { setRefunds(d.refunds ?? []); setError(''); })
      .catch((e: Error) => setError(`İade talepleri yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>İade Talepleri</h1>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 12, color: RED }}>{error}</p>}

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: AMBER }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: AMBER }}>İADE TALEPLERİ</span>
          {!loading && <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{refunds.length} kayıt</span>}
        </div>

        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[0,1,2].map(i => <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        ) : refunds.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>İade talebi yok.</p>
          </div>
        ) : (
          <div>
            {refunds.map((r, i) => (
              <div key={r.id} style={i === refunds.length - 1 ? { borderBottom: 'none' } : undefined}>
                <RefundRow refund={r} onUpdate={load} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
