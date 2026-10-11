'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface LoginResponse {
  accessToken: string;
  user: { id: string; firstName: string };
}

type Method = 'whatsapp' | 'email';

export default function GirisPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('whatsapp');

  /* WhatsApp akışı */
  const [phone,    setPhone]    = useState('');
  const [otpStep,  setOtpStep]  = useState(false);
  const [otp,      setOtp]      = useState(['', '', '', '', '', '']);
  const [otpShake, setOtpShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* E-posta akışı */
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  /* ── Validasyon ─────────────────────────────────────────────── */
  const phoneDigits  = phone.replace(/\D/g, '');
  const phoneValid   = phoneDigits.length === 10 && phoneDigits.startsWith('5');
  const emailValid   = email.includes('@') && email.includes('.');
  const passValid    = password.length >= 6 && password.length <= 20;
  const canSubmit    = method === 'whatsapp' ? (otpStep ? otp.join('').length === 6 : phoneValid) : (emailValid && passValid);

  /* ── WhatsApp: Kod Gönder ───────────────────────────────────── */
  async function handleSendOtp() {
    setLoading(true); setError('');
    try {
      await api.post('/auth/send-login-otp', { phone: `+90${phoneDigits}` });
      setOtpStep(true);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  /* ── WhatsApp: Kod Doğrula ──────────────────────────────────── */
  async function handleVerifyOtp() {
    const code = otp.join('');
    setLoading(true); setError('');
    try {
      const data = await api.post<LoginResponse>('/auth/verify-login-otp', { phone: `+90${phoneDigits}`, code });
      api.setToken(data.accessToken);
      router.push('/profil');
    } catch (e) {
      setError((e as Error).message);
      setOtpShake(true);
      setTimeout(() => setOtpShake(false), 500);
    }
    finally { setLoading(false); }
  }

  /* ── E-posta: Giriş ─────────────────────────────────────────── */
  async function handleEmailLogin() {
    setLoading(true); setError('');
    try {
      const data = await api.post<LoginResponse>('/auth/login', { email, password });
      api.setToken(data.accessToken);
      router.push('/profil');
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[index] = digit;
    setOtp(next); setError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKey(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }

  function switchMethod(m: Method) {
    setMethod(m);
    setError('');
    setOtpStep(false);
    setOtp(['', '', '', '', '', '']);
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d * 30, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -30, opacity: 0 }),
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center md:justify-start px-6 pt-[52px] md:pt-[80px]"
      style={{ background: '#0a0a0a' }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.09) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative w-full max-w-sm" style={{ zIndex: 1 }}>
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="flex flex-col items-center gap-2 mb-6">
            <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
            <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
          </div>
          <h1 className="font-serif text-4xl text-[#f5f5f5]">Giriş Yap</h1>
        </div>

        {/* Toggle */}
        <div
          className="flex mb-8 p-1 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {(['whatsapp', 'email'] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMethod(m)}
              className="flex-1 py-2 text-sm font-medium rounded-xl transition-all"
              style={
                method === m
                  ? { background: 'rgba(192,57,43,0.18)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.35)' }
                  : { color: '#666', border: '1px solid transparent' }
              }
            >
              {m === 'whatsapp' ? 'WhatsApp ile Giriş' : 'E-posta ile Giriş'}
            </button>
          ))}
        </div>

        {/* Form alanı */}
        <AnimatePresence mode="wait" custom={method === 'whatsapp' ? -1 : 1}>
          <motion.div
            key={method}
            custom={method === 'whatsapp' ? -1 : 1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* ── WhatsApp formu ── */}
            {method === 'whatsapp' && !otpStep && (
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
                    onKeyDown={(e) => e.key === 'Enter' && phoneValid && handleSendOtp()}
                    className="input-glass flex-1 px-4 py-3.5 text-sm"
                  />
                </div>
                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || !phoneValid}
                  className="mx-auto block py-2.5 text-sm btn-grad mt-1 disabled:opacity-40"
                  style={{ width: '72%' }}
                >
                  {loading ? 'Gönderiliyor…' : 'Kod Gönder'}
                </button>
              </div>
            )}

            {/* ── WhatsApp OTP ── */}
            {method === 'whatsapp' && otpStep && (
              <div className="flex flex-col gap-4">
                <p className="text-[#666] text-sm text-center">
                  +90{phoneDigits} numarasına gönderilen 6 haneli kodu gir.
                </p>
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
                      onKeyDown={(e) => handleOtpKey(i, e)}
                      autoFocus={i === 0}
                      className="text-center input-glass text-xl font-semibold"
                      style={{
                        borderRadius: 12, width: 48, height: 60,
                        border: otpShake ? '1px solid rgba(192,57,43,1)' : '1px solid rgba(255,255,255,0.08)',
                        transition: 'border-color 0.3s ease',
                      }}
                    />
                  ))}
                </motion.div>
                {error && <p className="text-[#ff6b6b] text-sm text-center">{error}</p>}
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading || !canSubmit}
                  className="w-full py-3.5 text-sm btn-grad disabled:opacity-40"
                >
                  {loading ? 'Doğrulanıyor…' : 'Giriş Yap'}
                </button>
                <button
                  type="button"
                  onClick={() => { setOtpStep(false); setOtp(['', '', '', '', '', '']); setError(''); }}
                  className="text-sm text-[#555] hover:text-[#888] transition-colors text-center"
                >
                  ← Numarayı değiştir
                </button>
              </div>
            )}

            {/* ── E-posta formu ── */}
            {method === 'email' && (
              <div className="flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="E-posta adresin"
                  autoFocus
                  className="input-glass px-4 py-3.5 text-sm"
                />
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value.slice(0, 20)); setError(''); }}
                    placeholder="Şifren"
                    onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleEmailLogin()}
                    className="input-glass px-4 py-3.5 text-sm pr-12 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#c0392b] transition-colors"
                  >
                    {showPass ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
                <button
                  type="button"
                  onClick={handleEmailLogin}
                  disabled={loading || !canSubmit}
                  className="mx-auto block py-2.5 text-sm btn-grad mt-1 disabled:opacity-40"
                  style={{ width: '72%' }}
                >
                  {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Alt linkler */}
        <div className="mt-4 flex justify-center">
          <Link
            href="/sifremi-unuttum"
            className="text-center py-2.5 text-sm font-medium rounded-xl transition-all"
            style={{ width: '72%', border: '1px solid #c0392b', color: '#c0392b', background: 'transparent' }}
          >
            Şifremi Unuttum
          </Link>
        </div>
      </div>
    </div>
  );
}
