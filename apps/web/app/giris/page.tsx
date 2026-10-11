'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
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
  const [otpShake, setOtpShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleSendOtp() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('10 haneli numara girin.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/send-otp', { phone: `+90${digits}` });
      setStep(1);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    const code = otp.join('');
    if (code.length !== 6) { setError('6 haneli kodu girin.'); return; }
    const digits = phone.replace(/\D/g, '');
    setLoading(true); setError('');
    try {
      const data = await api.post<OtpResponse>('/auth/verify-otp', { phone: `+90${digits}`, code });
      api.setToken(data.accessToken);
      router.push('/profil');
    } catch (e) {
      setError((e as Error).message);
      setOtpShake(true);
      setTimeout(() => setOtpShake(false), 500);
    }
    finally { setLoading(false); }
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[index] = digit;
    setOtp(next); setError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center md:justify-start px-6 pt-[52px] md:pt-[80px]"
      style={{ background: '#0a0a0a' }}
    >
      {/* Arka plan glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.09) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative w-full max-w-sm" style={{ zIndex: 1 }}>
        {/* Logo alanı */}
        <div className="mb-10 text-center">
          <div className="flex flex-col items-center gap-2 mb-6">
            <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
            <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
          </div>
          <h1 className="font-serif text-4xl text-[#f5f5f5] mb-2">
            {step === 0 ? 'Giriş Yap' : 'Kodu Gir'}
          </h1>
          <p className="text-[#555] text-sm">
            {step === 0
              ? 'WhatsApp numaranı gir, sana kod gönderelim.'
              : `+90${phone.replace(/\D/g, '')} numarasına gönderilen\n6 haneli kodu gir.`}
          </p>
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div
                className="flex items-center px-4 text-[#555] text-sm select-none flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}
              >
                +90
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                placeholder="5XX XXX XX XX"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                className="input-glass flex-1 px-4 py-3.5 text-sm"
              />
            </div>
            {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full py-3.5 text-sm btn-grad mt-1"
            >
              {loading ? 'Gönderiliyor…' : 'Kod Gönder'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <motion.div
              className="flex gap-2 justify-center"
              animate={otpShake ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
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
                  className="text-center input-glass text-xl font-semibold"
                  style={{
                    borderRadius: 12, width: 48, height: 60,
                    border: otpShake ? '1px solid rgba(192,57,43,1)' : '1px solid rgba(255,255,255,0.08)',
                    transition: 'border-color 0.3s ease',
                    boxShadow: otpShake ? '0 0 12px rgba(192,57,43,0.25)' : undefined,
                  }}
                />
              ))}
            </motion.div>
            {error && <p className="text-[#ff6b6b] text-sm text-center">{error}</p>}
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full py-3.5 text-sm btn-grad"
            >
              {loading ? 'Doğrulanıyor…' : 'Giriş Yap'}
            </button>
            <button
              type="button"
              onClick={() => { setStep(0); setOtp(['', '', '', '', '', '']); setError(''); }}
              className="text-sm text-[#555] hover:text-[#888] transition-colors text-center"
            >
              ← Numarayı değiştir
            </button>
          </div>
        )}

        <div className="mt-10 text-center flex flex-col gap-3">
          <Link href="/sifremi-unuttum" className="text-xs text-[#555] hover:text-[#888] transition-colors">
            Şifreni mi unuttun?
          </Link>
          <Link href="/" className="text-xs text-[#444] hover:text-[#888] transition-colors tracking-wide">
            ← Ana sayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}
