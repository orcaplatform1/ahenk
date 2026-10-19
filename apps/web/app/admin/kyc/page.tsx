'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

async function openAuthFile(path: string) {
  const token = document.cookie.match(/(?:^|;\s*)ahenk_token=([^;]+)/)?.[1];
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {} });
  if (!res.ok) return;
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), '_blank');
}

interface KycApplication {
  id: string;
  userId: string;
  submittedAt: string;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  livenessUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';
  user: { email: string; phone: string | null; profile: { firstName: string; lastName: string } | null };
}

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Skel() {
  return <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }} />;
}

export default function AdminKyc() {
  const [items, setItems] = useState<KycApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<Record<string, 'approve' | 'reject'>>({});
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ items: KycApplication[]; total: number }>('/kyc/admin?status=PENDING&limit=50')
      .then(r => setItems(r.items ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-[#555] uppercase tracking-[0.14em]">Admin</p>
        <h1 className="font-serif text-2xl text-[#f5f5f5]">KYC Bekleyenler</h1>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm mb-4">{error}</p>}

      {loading && (
        <div className="flex flex-col gap-4">
          {[0,1,2].map(i => <Skel key={i} />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="glass-card p-10 text-center">
          <p className="text-[#888] text-sm">Bekleyen KYC başvurusu yok.</p>
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
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                Bekliyor
              </span>
            </div>

            {/* Kimlik görselleri */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[{ url: item.idFrontUrl, label: 'Ön Yüz' }, { url: item.idBackUrl, label: 'Arka Yüz' }, { url: item.livenessUrl, label: 'Video' }].map(({ url, label }) => (
                <div key={label} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', aspectRatio: '16/9' }}>
                  {url ? (
                    <button onClick={() => openAuthFile(url)} className="block w-full h-full flex items-center justify-center">
                      <span className="text-xs text-[#aaa] hover:text-white transition-colors">📎 {label} Görüntüle</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-xs text-[#444]">{label} yüklenmemiş</p>
                    </div>
                  )}
                  <p className="text-xs text-[#555] px-2 py-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Reddet notu */}
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

            {/* Butonlar */}
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
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
