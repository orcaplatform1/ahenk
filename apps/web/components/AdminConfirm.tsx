'use client';

// Yönetim paneli ortak onay penceresi (admin paleti: ll-card, admin/matches "Masayı iptal et" penceresiyle aynı görünüm).
// Canlı destek: "Sonlandır" ve "Kötüye kullanım · {gün} gün" onayı. Evet → onYes, Hayır / dışarı basma / Esc → onNo (işlem yok).
import { useEffect } from 'react';
import { BORDER, MUTED, RED, SANS, TEXT } from '@/lib/adminTheme';

export function AdminConfirm({ open, text, onYes, onNo }: { open: boolean; text: string; onYes: () => void; onNo: () => void }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onNo(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onNo]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={onNo}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="ll-card" onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>{text}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onNo}
            style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', border: `1px solid ${BORDER}`, fontSize: 13, color: MUTED, cursor: 'pointer', fontFamily: SANS }}>Hayır</button>
          <button onClick={onYes}
            style={{ flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', fontSize: 13, fontWeight: 600, color: RED, fontFamily: SANS }}>Evet</button>
        </div>
      </div>
    </div>
  );
}
