'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { api } from '@/lib/api';

interface OtpResponse {
  accessToken: string;
  user: { id: string; firstName: string };
}

export default function GirisPage() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleSendOtp() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('10 haneli numara girin.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/send-otp', { phone: `+90${digits}` });
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('6 haneli kodu girin.');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    setLoading(true);
    setError('');
    try {
      const data = await api.post<OtpResponse>('/auth/verify-otp', {
        phone: `+90${digits}`,
        code,
      });
      api.setToken(data.accessToken);
      router.push('/profil');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg text-text flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-3xl mb-2">
            {step === 0 ? 'Giriş Yap' : 'Kodu Gir'}
          </h1>
          <p className="text-muted text-sm mb-8">
            {step === 0
              ? 'WhatsApp numaranı gir, sana kod gönderelim.'
              : `+90${phone.replace(/\D/g, '')} numarasına gönderilen 6 haneli kodu gir.`}
          </p>

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="flex items-center bg-surface border border-border rounded-xl px-3 text-muted text-sm select-none">
                  +90
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setError('');
                  }}
                  placeholder="5XX XXX XX XX"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-primary"
                />
              </div>
              {error && <p className="text-accent text-sm">{error}</p>}
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Gönderiliyor…' : 'Kod Gönder'}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 justify-center">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    className="w-11 h-14 text-center bg-surface border border-border rounded-xl text-lg font-semibold focus:outline-none focus:border-primary text-text"
                  />
                ))}
              </div>
              {error && <p className="text-accent text-sm text-center">{error}</p>}
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Doğrulanıyor…' : 'Giriş Yap'}
              </button>
              <button
                type="button"
                onClick={() => { setStep(0); setOtp(['', '', '', '', '', '']); setError(''); }}
                className="text-sm text-muted hover:text-text transition-colors text-center"
              >
                Numarayı değiştir
              </button>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-muted hover:text-text transition-colors">
              ← Ana sayfaya dön
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
