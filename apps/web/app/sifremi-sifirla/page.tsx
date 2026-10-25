'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import OtpInput from '@/components/ui/OtpInput';

function errorText(e: unknown): string {
  const msg = (e as Error).message;
  return msg === '__rate_limit__' ? 'Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar dene.' : msg;
}

function SifremiSifirlaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const phoneValid = /^\+905[0-9]{9}$/.test(phone);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function handleResend() {
    setResending(true); setError('');
    try {
      await api.post('/auth/forgot-password', { phone });
      setCode(''); setResendIn(60);
    } catch (e) { setError(errorText(e)); }
    finally { setResending(false); }
  }

  async function handleSubmit() {
    if (code.length !== 6) { setError('6 haneli kodu girin.'); return; }
    if (!password || !confirm) { setError('Tüm alanları doldurun.'); return; }
    if (password.length < 6 || password.length > 20) { setError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }

    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { phone, code, newPassword: password });
      setSuccess(true);
      setTimeout(() => router.push('/giris'), 2000);
    } catch (e) {
      setError(errorText(e));
      setCodeError(true);
      setTimeout(() => setCodeError(false), 500);
    } finally {
      setLoading(false);
    }
  }

  if (!phoneValid) {
    return (
      <div className="glass-card p-6 text-center flex flex-col items-center gap-4">
        <p className="text-[#888] text-sm">Bağlantı geçersiz. Lütfen kodu yeniden iste.</p>
        <Link href="/sifremi-unuttum" className="btn-primary">Kod İste</Link>
      </div>
    );
  }

  return (
    <div className="mb-0">
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col gap-3"
          >
            <p className="text-[#666] text-sm text-center">
              {phone} numarasına WhatsApp ile gönderilen 6 haneli kodu gir.
            </p>
            <OtpInput value={code} onChange={(c) => { setCode(c); setError(''); }} error={codeError} />
            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0 || resending}
              className="text-sm text-[#555] hover:text-[#888] transition-colors text-center disabled:hover:text-[#555] disabled:cursor-not-allowed mb-2"
            >
              {resending ? 'Gönderiliyor…' : resendIn > 0 ? `Kodu tekrar gönder (${resendIn} sn)` : 'Kodu tekrar gönder'}
            </button>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Yeni şifre"
                maxLength={20}
                className="input-glass px-4 py-3.5 text-sm pr-12 w-full"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? 'Şifreyi gizle' : 'Şifreyi göster'}
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
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                placeholder="Şifre tekrar"
                maxLength={20}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="input-glass px-4 py-3.5 text-sm pr-12 w-full"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? 'Şifreyi gizle' : 'Şifreyi göster'}
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
              onClick={handleSubmit}
              disabled={loading || code.length !== 6}
              className="w-full btn-primary mt-1 disabled:opacity-40"
            >
              {loading ? 'Kaydediliyor…' : 'Şifremi Sıfırla'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-5 py-4"
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', times: [0, 0.7, 1] }}
              className="flex items-center justify-center"
              style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#c0392b,#ff6b6b)' }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <motion.path
                  d="M6 16 L13 23 L26 10"
                  stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
                />
              </svg>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
              className="text-center"
            >
              <p className="text-[#f5f5f5] font-semibold mb-1">Şifren güncellendi</p>
              <p className="text-[#666] text-sm">Giriş sayfasına yönlendiriliyorsun…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SifremiSifirlaPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center md:justify-start px-6 md:pt-[80px]"
      style={{ background: '#121212' }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.09) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative w-full max-w-sm" style={{ zIndex: 1 }}>
        <div className="mb-10 text-center">
          <div className="flex flex-col items-center gap-2 mb-6">
            <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
            <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
          </div>
          <h1 className="font-serif text-4xl text-[#f5f5f5] mb-2">Yeni Şifre</h1>
          <p className="text-[#555] text-sm">Kodu gir ve hesabın için yeni bir şifre belirle.</p>
        </div>

        <Suspense fallback={null}>
          <SifremiSifirlaForm />
        </Suspense>

        <div className="mt-8 flex justify-center">
          <Link href="/giris" className="btn-ghost">
            Girişe Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
