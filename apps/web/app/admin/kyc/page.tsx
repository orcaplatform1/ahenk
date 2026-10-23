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
const ORANGE = '#fb923c';
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

function getToken() {
  return document.cookie.match(/(?:^|;\s*)ahenk_token=([^;]+)/)?.[1] ?? null;
}

async function fetchBlob(path: string): Promise<string | null> {
  try {
    const token = getToken();
    const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {} });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

function MediaPreview({ url, label, isVideo }: { url: string | null; label: string; isVideo?: boolean }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    fetchBlob(url).then(setBlobUrl);
  }, [url]);

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ aspectRatio: '16/9', position: 'relative' }}>
        {blobUrl ? (
          isVideo
            ? <video src={blobUrl} controls preload="metadata" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={blobUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }} onClick={() => window.open(blobUrl, '_blank')} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ margin: 0, fontSize: 10, color: MUTED }}>{url ? 'Yükleniyor…' : `${label} yüklenmemiş`}</p>
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 10, color: MUTED, padding: '4px 8px' }}>{label}</p>
    </div>
  );
}

type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';

interface KycApplication {
  id: string;
  submittedAt: string;
  status: KycStatus;
  rejectReason: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  livenessUrl: string | null;
  user: { email: string; phone: string | null; profile: { firstName: string; lastName: string } | null };
}

const TABS: { key: KycStatus; label: string }[] = [
  { key: 'PENDING',    label: 'Bekleyenler' },
  { key: 'APPROVED',   label: 'Onaylananlar' },
  { key: 'REJECTED',   label: 'Reddedilenler' },
  { key: 'SUSPICIOUS', label: 'Şüpheli' },
];

const STATUS_STYLE: Record<KycStatus, { bg: string; border: string; color: string; label: string }> = {
  PENDING:    { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  color: AMBER,  label: 'Bekliyor'   },
  APPROVED:   { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',    color: GREEN,  label: 'Onaylandı'  },
  REJECTED:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',    color: RED,    label: 'Reddedildi' },
  SUSPICIOUS: { bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)',   color: ORANGE, label: 'Şüpheli'    },
};

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminKyc() {
  const [activeTab, setActiveTab] = useState<KycStatus>('PENDING');
  const [items, setItems] = useState<KycApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<Record<string, 'approve' | 'reject'>>({});
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);

  function loadTab(status: KycStatus) {
    setActiveTab(status);
    setLoading(true);
    setError('');
    setRejectOpen(null);
    api.get<{ items: KycApplication[]; total: number }>(`/kyc/admin?status=${status}&limit=50`)
      .then(r => setItems(r.items ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTab('PENDING'); }, []);

  async function approve(id: string) {
    setProcessing(p => ({ ...p, [id]: 'approve' }));
    try {
      await api.patch(`/kyc/admin/${id}/review`, { status: 'APPROVED' });
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(p => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  async function reject(id: string) {
    setProcessing(p => ({ ...p, [id]: 'reject' }));
    try {
      await api.patch(`/kyc/admin/${id}/review`, { status: 'REJECTED', rejectReason: rejectNote[id] ?? '' });
      setItems(prev => prev.filter(x => x.id !== id));
      setRejectOpen(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(p => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  const st = STATUS_STYLE[activeTab];

  return (
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
          KYC Başvuruları
        </h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const active = activeTab === t.key;
          const ts = STATUS_STYLE[t.key];
          return (
            <button
              key={t.key}
              onClick={() => loadTab(t.key)}
              style={{
                padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                background: active ? ts.bg : 'transparent',
                border: `1px solid ${active ? ts.border : BORDER}`,
                fontSize: 11, fontWeight: active ? 700 : 400,
                color: active ? ts.color : MUTED,
                fontFamily: SANS,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p style={{ margin: '0 0 16px', fontSize: 12, color: RED }}>{error}</p>
      )}

      {loading ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: st.color }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: st.color }}>KYC BAŞVURULARI</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 120, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: st.color }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: st.color }}>KYC BAŞVURULARI</span>
          </div>
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Bu kategoride başvuru yok</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}
            >
              {/* Üst satır */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>
                    {item.user?.profile?.firstName} {item.user?.profile?.lastName}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                    {fmtDate(item.submittedAt)}
                  </p>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', flexShrink: 0,
                  padding: '2px 8px', borderRadius: 99,
                  background: st.bg, border: `1px solid ${st.border}`, color: st.color,
                }}>
                  {st.label}
                </span>
              </div>

              {/* Red sebebi */}
              {item.rejectReason && (
                <div style={{
                  marginBottom: 16, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: 11, color: RED,
                }}>
                  <span style={{ color: MUTED }}>Red sebebi: </span>{item.rejectReason}
                </div>
              )}

              {/* Medya önizleme */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                <MediaPreview url={item.idFrontUrl} label="Ön Yüz" />
                <MediaPreview url={item.idBackUrl} label="Arka Yüz" />
                <MediaPreview url={item.livenessUrl} label="Video" isVideo />
              </div>

              {/* PENDING işlem butonları */}
              {activeTab === 'PENDING' && (
                <>
                  {rejectOpen === item.id && (
                    <textarea
                      value={rejectNote[item.id] ?? ''}
                      onChange={e => setRejectNote(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Red sebebi (opsiyonel)..."
                      rows={2}
                      style={{
                        display: 'block', width: '100%', marginBottom: 10,
                        background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                        padding: '7px 12px', fontSize: 11, color: TEXT,
                        outline: 'none', resize: 'none', fontFamily: SANS,
                        boxSizing: 'border-box',
                      }}
                    />
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => approve(item.id)}
                      disabled={!!processing[item.id]}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8, cursor: processing[item.id] ? 'not-allowed' : 'pointer',
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                        fontSize: 11, fontWeight: 600, color: GREEN, fontFamily: SANS,
                        opacity: processing[item.id] ? 0.5 : 1,
                      }}
                    >
                      {processing[item.id] === 'approve' ? '…' : 'Onayla'}
                    </button>

                    {rejectOpen !== item.id ? (
                      <button
                        onClick={() => setRejectOpen(item.id)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                          fontSize: 11, fontWeight: 600, color: RED, fontFamily: SANS,
                        }}
                      >
                        Reddet
                      </button>
                    ) : (
                      <button
                        onClick={() => reject(item.id)}
                        disabled={!!processing[item.id]}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 8, cursor: processing[item.id] ? 'not-allowed' : 'pointer',
                          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                          fontSize: 11, fontWeight: 600, color: RED, fontFamily: SANS,
                          opacity: processing[item.id] ? 0.5 : 1,
                        }}
                      >
                        {processing[item.id] === 'reject' ? '…' : 'Reddi Onayla'}
                      </button>
                    )}

                    {rejectOpen === item.id && (
                      <button
                        onClick={() => setRejectOpen(null)}
                        style={{
                          padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                          background: 'transparent', border: `1px solid ${BORDER}`,
                          fontSize: 11, color: MUTED, fontFamily: SANS,
                        }}
                      >
                        İptal
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
