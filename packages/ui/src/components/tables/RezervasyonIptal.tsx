'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Rezervasyon iptali — bekleme ekranında (masa kuruldu, detay henüz açıklanmadı) gösterilir.
// Son an: masa gününden 1 gün önce (kilit günü) 20:00 TR; masa kartı buluşma günü 10:00'da açıldığı için kartta iptal yoktur.

// ── İptal Modal ───────────────────────────────────────────────────────────
function CancelModal({
  onConfirm,
  onClose,
  loading,
  error,
}: {
  onConfirm: (note: string) => void;
  onClose: () => void;
  loading: boolean;
  error: string;
}) {
  const [note, setNote] = useState('');
  const canSubmit = note.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(20,4,4,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: 'rgba(30,8,8,0.97)',
          border: '1px solid rgba(192,57,43,0.35)',
          borderRadius: 16, padding: '28px 22px 22px',
        }}
      >
        <p style={{
          margin: '0 0 18px',
          fontSize: 15, lineHeight: 1.6, fontWeight: 500,
          color: '#f5f5f5', fontFamily: 'Inter, sans-serif', textAlign: 'center',
        }}>
          Rezervasyon iptali diğer kullanıcıları da doğrudan etkilediğinden, kurulan bir masada tekrar iptal hakkın bulunmayacaktır ve sonraki kurulan masaya da katılmama durumunda 1. uyarı verilir, toplamda 3 uyarı alırsan hesabın 30 gün askıya alınır.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'rgba(245,245,245,0.6)', fontFamily: 'Inter, sans-serif' }}>
          İptal nedenini belirtin:
        </p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={300}
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#f5f5f5', fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'none',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => canSubmit && onConfirm(note.trim())}
            disabled={loading || !canSubmit}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 10,
              cursor: (loading || !canSubmit) ? 'not-allowed' : 'pointer',
              background: 'rgba(192,57,43,0.25)', border: '1px solid rgba(192,57,43,0.55)',
              color: '#ff6b6b', fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              opacity: (loading || !canSubmit) ? 0.45 : 1,
            }}
          >
            {loading ? '…' : 'İptali Onayla'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#b0b0b0', fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif',
            }}
          >
            Vazgeç
          </button>
        </div>
        {error && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#ff6b6b', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}


// Masa gününden 1 gün önce 20:00 (TR, UTC+3)
function cancelDeadline(scheduledAt: string): Date {
  const tr = new Date(new Date(scheduledAt).getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - 1, 20 - 3, 0, 0, 0));
}

// Bulanık (backdrop-filter) / animasyonlu kart içinde sabit konumlu pencere kartla sınırlanır; web uygulaması
// pencereyi sayfanın üst katmanına taşımak için portal fonksiyonu verir (ör. node => createPortal(node, document.body))
export type ModalPortal = (node: ReactNode) => ReactNode;

export function RezervasyonIptal({ meetingId, scheduledAt, cancelRightUsed, apiBase, token, onCancelled, modalPortal }: {
  meetingId: string;
  type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  scheduledAt: string;
  cancelRightUsed?: boolean;
  apiBase: string;
  // Verilirse Bearer başlığı eklenir; web oturumu HttpOnly çerezle gider
  token?: string;
  onCancelled?: () => void;
  modalPortal?: ModalPortal;
}) {
  const [showCancel, setShowCancel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');

  if (new Date() >= cancelDeadline(scheduledAt)) return null;

  async function handleCancel(note: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/meetings/${meetingId}/cancel-registration`, {
        method: 'POST',
        headers: token
          ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          : { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note }),
      });
      if (res.ok) { setCancelled(true); setShowCancel(false); onCancelled?.(); return; }
      const err = await res.json().catch(() => null) as { message?: string | string[] } | null;
      const msg = Array.isArray(err?.message) ? err?.message[0] : err?.message;
      setError(msg ?? 'İptal edilemedi, lütfen tekrar deneyin.');
    } catch {
      setError('İptal edilemedi, lütfen tekrar deneyin.');
    } finally { setLoading(false); }
  }

  if (cancelled) {
    return (
      <div style={{
        padding: '12px 14px', borderRadius: 10, marginTop: 16, textAlign: 'center',
        background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#c0392b', fontFamily: 'Inter, sans-serif' }}>
          Rezervasyonunuz iptal edildi.
        </p>
      </div>
    );
  }

  if (cancelRightUsed) {
    return (
      <p style={{ margin: '16px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.62)', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        Bu paket için iptal hakkınızı kullandınız.
      </p>
    );
  }

  return (
    <>
      {(modalPortal ?? ((n: ReactNode) => n))(
        <AnimatePresence>
          {showCancel && (
            <CancelModal
              onConfirm={handleCancel}
              onClose={() => { setShowCancel(false); setError(''); }}
              loading={loading}
              error={error}
            />
          )}
        </AnimatePresence>,
      )}
      <button
        onClick={() => setShowCancel(true)}
        style={{
          width: '100%', padding: '13px 0', marginTop: 16,
          background: 'rgba(192,57,43,0.2)', border: '1px solid rgba(192,57,43,0.5)',
          borderRadius: 9999, cursor: 'pointer',
          color: '#ff6b6b', fontSize: 12, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          fontFamily: 'Inter, sans-serif', transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,57,43,0.3)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(192,57,43,0.2)')}
      >
        Rezervasyon İptal
      </button>
    </>
  );
}
