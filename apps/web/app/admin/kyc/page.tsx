'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

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
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div style={{ aspectRatio: '16/9', position: 'relative' }}>
        {blobUrl ? (
          isVideo
            ? <video src={blobUrl} controls preload="metadata" className="w-full h-full object-cover" style={{ display: 'block' }} />
            : <img src={blobUrl} alt={label} className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(blobUrl, '_blank')} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-[#444]">{url ? 'Yükleniyor…' : `${label} yüklenmemiş`}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-[#555] px-2 py-1">{label}</p>
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
  PENDING:    { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  color: '#fbbf24', label: 'Bekliyor'   },
  APPROVED:   { bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',   color: '#4ade80', label: 'Onaylandı'  },
  REJECTED:   { bg: 'rgba(255,107,107,0.1)', border: 'rgba(255,107,107,0.3)',  color: '#ff6b6b', label: 'Reddedildi' },
  SUSPICIOUS: { bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.3)',   color: '#fb923c', label: 'Şüpheli'    },
};

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Skel() {
  return <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }} />;
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
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-xs text-[#555] uppercase tracking-[0.14em]">Admin</p>
        <h1 className="font-serif text-2xl text-[#f5f5f5]">KYC Başvuruları</h1>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => loadTab(t.key)}
            className="text-xs font-medium px-4 py-2 rounded-xl transition-all"
            style={activeTab === t.key
              ? { background: STATUS_STYLE[t.key].bg, border: `1px solid ${STATUS_STYLE[t.key].border}`, color: STATUS_STYLE[t.key].color }
              : { background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#555' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-[#ff6b6b] text-sm mb-4">{error}</p>}

      {loading && (
        <div className="flex flex-col gap-4">
          {[0,1,2].map(i => <Skel key={i} />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="glass-card p-10 text-center">
          <p className="text-[#888] text-sm">Bu kategoride başvuru yok.</p>
        </div>
      )}

      <AnimatePresence>
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' }}
            className="glass-card p-5 mb-4"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-semibold text-[#f5f5f5]">{item.user?.profile?.firstName} {item.user?.profile?.lastName}</p>
                <p className="text-xs text-[#555] mt-0.5">{fmtDate(item.submittedAt)}</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                {st.label}
              </span>
            </div>

            {/* Red sebebi (onaylananlar/reddedilenler için) */}
            {item.rejectReason && (
              <div className="mb-4 px-3 py-2 rounded-xl text-xs text-[#ff6b6b]" style={{ background: 'rgba(255,107,107,0.07)', border: '1px solid rgba(255,107,107,0.2)' }}>
                <span className="text-[#888] mr-1">Red sebebi:</span>{item.rejectReason}
              </div>
            )}

            {/* Kimlik görselleri */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MediaPreview url={item.idFrontUrl} label="Ön Yüz" />
              <MediaPreview url={item.idBackUrl} label="Arka Yüz" />
              <MediaPreview url={item.livenessUrl} label="Video" isVideo />
            </div>

            {/* Butonlar sadece PENDING için */}
            {activeTab === 'PENDING' && (
              <>
                <AnimatePresence>
                  {rejectOpen === item.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 overflow-hidden"
                    >
                      <textarea
                        value={rejectNote[item.id] ?? ''}
                        onChange={e => setRejectNote(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Red sebebi (opsiyonel)..."
                        rows={2}
                        className="input-glass w-full px-3 py-2 text-sm resize-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2">
                  <button
                    onClick={() => approve(item.id)}
                    disabled={!!processing[item.id]}
                    className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
                    style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                  >
                    {processing[item.id] === 'approve' ? '…' : 'Onayla'}
                  </button>

                  {rejectOpen !== item.id ? (
                    <button
                      onClick={() => setRejectOpen(item.id)}
                      className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all"
                      style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b' }}
                    >
                      Reddet
                    </button>
                  ) : (
                    <button
                      onClick={() => reject(item.id)}
                      disabled={!!processing[item.id]}
                      className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
                      style={{ background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.4)', color: '#ff6b6b' }}
                    >
                      {processing[item.id] === 'reject' ? '…' : 'Reddi Onayla'}
                    </button>
                  )}

                  {rejectOpen === item.id && (
                    <button
                      onClick={() => setRejectOpen(null)}
                      className="px-4 py-2.5 text-sm text-[#555] hover:text-[#888] transition-colors rounded-xl"
                      style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                    >
                      İptal
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
