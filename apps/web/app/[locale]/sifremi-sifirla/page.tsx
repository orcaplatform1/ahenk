'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import OtpInput from '@/components/ui/OtpInput';
import { OtpCountdown, useOtpCountdown } from '@/lib/otpCountdown';
import { StdButton } from '@ahenk/ui';

function errorText(e: unknown, tooMany: string): string {
  const msg = (e as Error).message;
  return msg === '__rate_limit__' ? tooMany : msg;
}

function SifremiSifirlaForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  // E.164 numara (ülke kodlu)
  const phoneValid = /^\+[1-9]\d{6,14}$/.test(phone);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  // Yeni kod isteme bekleme süresi backend'den gelir: önceki ekrandan bitiş anı (until) olarak taşınır
  const countdown = useOtpCountdown();
  const until = Number(searchParams.get('until') ?? 0);
  const startCountdown = countdown.start;
  useEffect(() => {
    if (until > 0) startCountdown((until - Date.now()) / 1000);
  }, [until, startCountdown]);

  async function handleResend() {
    setResending(true); setError('');
    try {
      const r = await api.post<{ resendSeconds?: number }>('/auth/forgot-password', { phone });
      setCode(''); countdown.start(r.resendSeconds);
    } catch (e) { countdown.startFromError(e); setError(errorText(e, t('reg.tooMany'))); }
    finally { setResending(false); }
  }

  async function handleSubmit() {
    if (code.length !== 6) { setError(t('resetPw.enterCode')); return; }
    if (!password || !confirm) { setError(t('reg.fillAll')); return; }
    if (password.length < 6 || password.length > 20) { setError(t('reg.pwLength')); return; }
    if (password !== confirm) { setError(t('reg.pwMismatch')); return; }

    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { phone, code, newPassword: password });
      setSuccess(true);
      setTimeout(() => router.push('/giris'), 2000);
    } catch (e) {
      setError(errorText(e, t('reg.tooMany')));
      setCodeError(true);
      setTimeout(() => setCodeError(false), 500);
    } finally {
      setLoading(false);
    }
  }

  if (!phoneValid) {
    return (
      <div className="ll-card text-center flex flex-col items-center gap-4">
        <p className="text-[#c9c2b8] text-sm">{t('resetPw.invalidLink')}</p>
        <StdButton variant="primary" as={Link} href="/sifremi-unuttum">{t('resetPw.requestCode')}</StdButton>
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
            className="flex flex-col gap-4"
          >
            <div className="ll-card flex flex-col gap-3">
            <p className="text-[#a39c93] text-[13px] text-center">
              {t('phone.codeSentTo', { phone })}
            </p>
            <OtpInput value={code} onChange={(c) => { setCode(c); setError(''); }} error={codeError} />
            <OtpCountdown seconds={countdown.seconds} />
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder={t('resetPw.newPw')}
                maxLength={20}
                className="input-glass px-4 py-3.5 text-sm pr-12 w-full"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? t('phone.hidePw') : t('phone.showPw')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a39c93] hover:text-[#c0392b] transition-colors"
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
                placeholder={t('resetPw.pwRepeat')}
                maxLength={20}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="input-glass px-4 py-3.5 text-sm pr-12 w-full"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? t('phone.hidePw') : t('phone.showPw')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a39c93] hover:text-[#c0392b] transition-colors"
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
            </div>
            <div className="flex flex-col gap-3">
            <StdButton variant="primary"
              type="button"
              onClick={handleSubmit}
              disabled={loading || code.length !== 6}
              className="w-full mt-1 disabled:opacity-40"
            >
              {loading ? t('resetPw.saving') : t('resetPw.reset')}
            </StdButton>
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown.waiting || resending}
              className="text-[13px] text-[#a39c93] hover:text-[#888] transition-colors text-center disabled:opacity-40 disabled:hover:text-[#555] disabled:cursor-not-allowed mb-2"
            >
              {resending ? t('resetPw.sending') : t('resetPw.resend')}
            </button>
            </div>
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
              <p className="text-[#f5f5f5] font-semibold mb-1">{t('resetPw.updated')}</p>
              <p className="text-[#a39c93] text-[13px]">{t('resetPw.redirecting')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SifremiSifirlaPage() {
  const t = useTranslations();
  return (
    <div
      className="live-layer ll-form min-h-screen flex flex-col items-center justify-center md:justify-start px-6 md:pt-[80px]"
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
          <h1 className="ll-title" style={{ marginBottom: 8 }}>{t('resetPw.title')}</h1>
          <p className="text-[#a39c93] text-[13px]">{t('resetPw.info')}</p>
        </div>

        <Suspense fallback={null}>
          <SifremiSifirlaForm />
        </Suspense>

        <div className="mt-8 flex justify-center">
          <StdButton variant="ghost" as={Link} href="/giris">
            {t('resetPw.backToLogin')}
          </StdButton>
        </div>
      </div>
    </div>
  );
}
