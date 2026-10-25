'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const SURFACE = '#0a1628';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const RED    = '#ef4444';
const AMBER  = '#f59e0b';
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

interface Report {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  detail?: string;
  createdAt: string;
  riskLevel: 'CRITICAL' | 'MEDIUM';
}

const RISK_COLOR: Record<string, string> = { CRITICAL: RED, MEDIUM: AMBER };
const RISK_BG: Record<string, string> = { CRITICAL: 'rgba(239,68,68,0.12)', MEDIUM: 'rgba(245,158,11,0.12)' };
const RISK_BORDER: Record<string, string> = { CRITICAL: 'rgba(239,68,68,0.3)', MEDIUM: 'rgba(245,158,11,0.35)' };

export default function AdminQuality() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get<Report[]>('/admin/reports/pending').then(setReports)
      .catch((e: Error) => setError(`Şikayetler yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.get<string[]>('/admin/sanction-reasons').then(setReasons).catch(() => {});
  }, []);

  async function quarantine(userId: string) {
    setActionLoading(userId + '_q');
    setError('');
    try {
      await api.post(`/admin/users/${userId}/quarantine`, reason ? { reason } : {});
      load();
    } catch (e) {
      setError(`Askıya alınamadı: ${(e as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function ban(userId: string) {
    if (!confirm('Kullanıcıyı ban et?')) return;
    setActionLoading(userId + '_b');
    setError('');
    try {
      await api.post(`/admin/users/${userId}/ban`, reason ? { reason } : {});
      load();
    } catch (e) {
      setError(`Banlanamadı: ${(e as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>Şikayetler</h1>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 12, color: RED }}>{error}</p>}

      {loading ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: RED }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: RED }}>ŞİKAYETLER</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: RED }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: RED }}>ŞİKAYETLER</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{reports.length} kayıt</span>
          </div>

          {reports.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Bekleyen şikayet yok</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {reports.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    borderBottom: i < reports.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                  }}
                >
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{r.userName}</span>
                        <span style={{
                          fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                          padding: '2px 7px', borderRadius: 99,
                          background: RISK_BG[r.riskLevel], border: `1px solid ${RISK_BORDER[r.riskLevel]}`, color: RISK_COLOR[r.riskLevel],
                        }}>
                          {r.riskLevel}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{r.reason}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                        {new Date(r.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                      </p>
                    </div>
                    <button
                      onClick={() => setExpanded(e => e === r.id ? null : r.id)}
                      style={{
                        flexShrink: 0, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: expanded === r.id ? 'rgba(34,211,238,0.08)' : 'transparent',
                        border: `1px solid ${expanded === r.id ? 'rgba(34,211,238,0.3)' : BORDER}`,
                        fontSize: 10, color: MUTED, fontFamily: SANS,
                      }}
                    >
                      {expanded === r.id ? '▲' : '▼'}
                    </button>
                  </div>

                  {expanded === r.id && (
                    <div style={{ margin: '0 18px 14px', padding: '12px 16px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {r.detail && (
                        <p style={{ margin: 0, fontSize: 11, color: MUTED, fontStyle: 'italic' }}>"{r.detail}"</p>
                      )}
                      <select
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        style={{
                          padding: '7px 10px', borderRadius: 8, background: CARD, border: `1px solid ${BORDER}`,
                          fontSize: 11, color: TEXT, fontFamily: SANS, outline: 'none',
                        }}
                      >
                        <option value="">Sebep seçin (boşsa: Yönetici kararı)</option>
                        {reasons.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => quarantine(r.userId)}
                          disabled={actionLoading !== null}
                          style={{
                            flex: 1, padding: '7px', borderRadius: 8, cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                            fontSize: 11, fontWeight: 600, color: AMBER, fontFamily: SANS,
                            opacity: actionLoading !== null ? 0.5 : 1,
                          }}
                        >
                          {actionLoading === r.userId + '_q' ? '…' : 'Askıya Al (1 ay)'}
                        </button>
                        <button
                          onClick={() => ban(r.userId)}
                          disabled={actionLoading !== null}
                          style={{
                            flex: 1, padding: '7px', borderRadius: 8, cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            fontSize: 11, fontWeight: 600, color: RED, fontFamily: SANS,
                            opacity: actionLoading !== null ? 0.5 : 1,
                          }}
                        >
                          {actionLoading === r.userId + '_b' ? '…' : 'Ban Et (süresiz)'}
                        </button>
                      </div>
                    </div>
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
