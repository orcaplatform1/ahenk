'use client';

import { useState } from 'react';

// Web ödeme ekranı: "Paket Al" / "Abone Ol" sonrası T.C. No istenir. Zorunlu, 11 haneli rakam.
// Numara yalnız iyzico'ya gönderilir, veritabanına yazılmaz; her web ödemesinde yeniden sorulur.
export default function TcknModal({ open, busy, error, onCancel, onSubmit }: {
  open: boolean;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (identityNumber: string) => void;
}) {
  const [tckn, setTckn] = useState('');
  if (!open) return null;
  const valid = /^\d{11}$/.test(tckn);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-labelledby="tckn-title">
      <div className="ll-card w-full max-w-md flex flex-col gap-3" style={{ background: '#121212' }}>
        <h3 id="tckn-title" className="ll-title">Ödeme</h3>
        <label htmlFor="tckn-input" className="text-sm text-[#f4f1ec]">T.C. No:</label>
        <input
          id="tckn-input"
          value={tckn}
          onChange={(e) => setTckn(e.target.value.replace(/\D/g, '').slice(0, 11))}
          inputMode="numeric"
          autoComplete="off"
          required
          maxLength={11}
          placeholder="11 haneli T.C. kimlik numarası"
          style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#f5f5f5', outline: 'none', letterSpacing: '0.06em' }}
        />
        {tckn.length > 0 && !valid && <p className="text-xs text-[#ff6b6b]">T.C. kimlik numarası 11 haneli rakam olmalı.</p>}
        <p style={{ fontSize: 11, lineHeight: 1.5, color: '#a39c93', margin: 0 }}>
          Ödeme altyapı hizmet sağlayıcı İyzico tarafından, mevzuat gereği satın alımlarda artık T.C.K.N. zorunludur.
        </p>
        {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
        <div className="flex gap-2 mt-1">
          <button onClick={() => { setTckn(''); onCancel(); }} className="btn-ghost flex-1 justify-center" style={{ minHeight: 44 }}>Vazgeç</button>
          <button onClick={() => valid && onSubmit(tckn)} disabled={!valid || busy} className="btn-primary flex-1 justify-center disabled:opacity-50" style={{ minHeight: 44 }}>
            {busy ? 'Yönlendiriliyor…' : 'Ödemeye Geç'}
          </button>
        </div>
      </div>
    </div>
  );
}
