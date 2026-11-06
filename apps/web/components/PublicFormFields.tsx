'use client';

import { useEffect, useState } from 'react';
import OtpInput from '@/components/ui/OtpInput';
import { API_PREFIX } from '@/lib/api';
import { readError } from '@/lib/venueApi';

// Başvuru formlarının ortak alanları (.ll-form içinde kartla aynı zemin); kayıt formuyla aynı görünüm

export function FormLabel({ children }: { children: React.ReactNode }) {
  return <span className="block ll-mono text-[11px] text-[#a39c93] mb-1.5">{children}</span>;
}

export function TextField({ label, type = 'text', value, onChange, required, placeholder, maxLength }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; maxLength?: number;
}) {
  return (
    <label className="block">
      <FormLabel>{label}</FormLabel>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        placeholder={placeholder} maxLength={maxLength} className="input-glass px-4 py-3 text-[13px]"
      />
    </label>
  );
}

export function TextareaField({ label, value, onChange, maxLength, required, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; maxLength?: number; required?: boolean; rows?: number;
}) {
  return (
    <label className="block">
      <FormLabel>{label}</FormLabel>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} required={required} rows={rows}
        className="input-glass px-4 py-3 text-[13px]" style={{ resize: 'vertical', display: 'block' }}
      />
      {maxLength && <span className="block text-right ll-mono text-[11px] text-[#8f887f] mt-1">{value.length}/{maxLength}</span>}
    </label>
  );
}

export function PasswordInput({ label, value, onChange, required }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <FormLabel>{label}</FormLabel>
      <span className="relative block">
        <input
          type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          required={required} maxLength={20} className="input-glass px-4 py-3 text-[13px] pr-12"
        />
        <button
          type="button" onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a39c93] hover:text-[#c0392b] transition-colors"
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M6.2 6.3C4.3 7.6 2.8 9.6 2 12c1.3 4.3 5.3 7.5 10 7.5 1.8 0 3.5-.5 5-1.3M9.9 4.7c.7-.1 1.4-.2 2.1-.2 4.7 0 8.7 3.2 10 7.5-.4 1.3-1 2.5-1.9 3.5" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </span>
    </label>
  );
}

// Kayıt formundaki telefon + WhatsApp OTP alanı; base: /partnerships ya da /careers
export function VerifiedPhoneField({ base, phone, onPhone, phoneToken, onToken }: {
  base: string; phone: string; onPhone: (v: string) => void; phoneToken: string; onToken: (v: string) => void;
}) {
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  function change(v: string) {
    onPhone(v); onToken('');
    setOtpSent(false); setCode(''); setError('');
  }

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_PREFIX}${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await readError(res));
    return res.json() as Promise<T>;
  }

  async function send() {
    if (phone.length !== 10 || !phone.startsWith('5')) { setError('WhatsApp numaranızı girin (5 ile başlayan 10 hane).'); return; }
    setSending(true); setError('');
    try {
      const r = await postJson<{ resendSeconds: number }>('/send-otp', { phone: `+90${phone}` });
      setOtpSent(true); setCode(''); setResendIn(r.resendSeconds ?? 60);
    } catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  }

  async function verify(c: string) {
    setVerifying(true); setError('');
    try {
      const r = await postJson<{ phoneToken: string }>('/verify-otp', { phone: `+90${phone}`, code: c });
      onToken(r.phoneToken);
    } catch (e) {
      setError((e as Error).message);
      setCode('');
      setShake(true); setTimeout(() => setShake(false), 500);
    } finally { setVerifying(false); }
  }

  return (
    <div>
      <label className="block ll-mono text-[11px] text-[#a39c93] mb-1.5">Telefon Numarası *</label>
      <p className="text-xs text-[#a39c93] mb-2">WhatsApp&apos;a kayıtlı numaranızı yazın</p>
      <div className="flex gap-2">
        <div
          className="flex items-center px-4 text-[#a39c93] text-[13px] select-none shrink-0"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
        >
          +90
        </div>
        <input
          type="tel" inputMode="numeric" aria-label="Telefon Numarası" value={phone}
          onChange={(e) => change(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="5XX XXX XX XX" disabled={!!phoneToken} required
          className="input-glass flex-1 min-w-0 px-4 py-3 text-[13px] disabled:opacity-60"
        />
        {!phoneToken && (
          <button
            type="button" onClick={send} disabled={sending || resendIn > 0 || phone.length !== 10}
            className="shrink-0 px-3 text-xs font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: '1px solid rgba(192,57,43,0.5)', color: '#e74c3c', background: 'rgba(192,57,43,0.06)' }}
          >
            {sending ? 'Gönderiliyor…' : resendIn > 0 ? `Tekrar (${resendIn} sn)` : otpSent ? 'Tekrar gönder' : 'Kod gönder'}
          </button>
        )}
      </div>
      {phoneToken ? (
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-green-400">✓ Telefon numaranız doğrulandı</p>
          <button type="button" onClick={() => change(phone)} className="text-xs text-[#a39c93] hover:text-[#c9c2b8]">Numarayı değiştir</button>
        </div>
      ) : otpSent && (
        <div className="flex flex-col gap-2 mt-3">
          <p className="text-xs text-[#a39c93] text-center">+90{phone} numarasına WhatsApp ile gönderilen 6 haneli kodu girin.</p>
          <OtpInput value={code} onChange={(c) => { setCode(c); setError(''); }} onComplete={verify} error={shake} autoFocus={false} />
          {verifying && <p className="text-xs text-[#a39c93] text-center">Doğrulanıyor…</p>}
        </div>
      )}
      {error && <p className="text-xs text-[#ff6b6b] mt-2">{error}</p>}
    </div>
  );
}
