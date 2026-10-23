'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api, API_PREFIX } from '@/lib/api';
import OtpInput from '@/components/ui/OtpInput';

const API_BASE = API_PREFIX;

interface LoginResponse {
  accessToken: string;
  user: { id: string; firstName: string; lastName: string };
}

interface SanctionPayload {
  type: 'WARNING' | 'SUSPENSION' | 'BAN';
  reason: string;
  expiresAt: string | null;
  message: string;
}

type Method = 'whatsapp' | 'email';

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as Partial<SanctionPayload> & { message?: string | string[] };
    if (res.status === 403 && (err.type === 'SUSPENSION' || err.type === 'BAN' || err.type === 'WARNING')) {
      const e = new Error(err.message as string ?? 'Erişim engellendi') as Error & { sanction?: SanctionPayload };
      e.sanction = err as SanctionPayload;
      throw e;
    }
    const msg = Array.isArray(err.message) ? err.message[0] : (err.message ?? 'Bir hata oluştu');
    throw new Error(msg);
  }
  return data as T;
}

export default function GirisPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('whatsapp');

  /* WhatsApp akışı */
  const [phone,    setPhone]    = useState('');
  const [otpStep,  setOtpStep]  = useState(false);
  const [otp,      setOtp]      = useState(['', '', '', '', '', '']);
  const [otpShake, setOtpShake] = useState(false);

  /* E-posta akışı */
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);

  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [sanction,    setSanction]    = useState<SanctionPayload | null>(null);
  const [welcomeUser, setWelcomeUser] = useState<{ firstName: string; lastName: string } | null>(null);

  /* ── Validasyon ─────────────────────────────────────────────── */
  const phoneDigits  = phone.replace(/\D/g, '');
  const phoneValid   = phoneDigits.length === 10 && phoneDigits.startsWith('5');
  const emailValid   = email.includes('@') && email.includes('.');
  const passValid    = password.length >= 6 && password.length <= 20;
  const canSubmit    = method === 'whatsapp' ? (otpStep ? otp.join('').length === 6 : phoneValid) : (emailValid && passValid);

  /* ── WhatsApp: Kod Gönder ───────────────────────────────────── */
  async function handleSendOtp() {
    setLoading(true); setError(''); setSanction(null);
    try {
      await authPost('/auth/send-login-otp', { phone: `+90${phoneDigits}` });
      setOtpStep(true);
    } catch (e) {
      const err = e as Error & { sanction?: SanctionPayload };
      if (err.sanction) { setSanction(err.sanction); }
      else { setError(err.message); }
    }
    finally { setLoading(false); }
  }

  async function afterLogin(data: LoginResponse) {
    api.setToken(data.accessToken);
    window.dispatchEvent(new Event('ahenk:auth'));
    // WARNING uyarısı varsa: giriş başarılı ama uyarıyı göster
    try {
      const me = await api.get<{ role?: string; activeSanction?: SanctionPayload | null }>('/auth/me');
      if (me?.activeSanction?.type === 'WARNING') {
        setSanction(me.activeSanction);
        return; // dashboard'a geçmeden uyarıyı göster
      }
      if (me?.role === 'ADMIN' || me?.role === 'SUPERADMIN') {
        window.location.href = '/admin';
        return;
      }
    } catch { /* yoksa devam */ }
    setWelcomeUser({ firstName: data.user.firstName, lastName: data.user.lastName ?? '' });
    setTimeout(() => router.push('/dashboard'), 2000);
  }

  /* ── WhatsApp: Kod Doğrula ──────────────────────────────────── */
  async function handleVerifyOtp() {
    const code = otp.join('');
    setLoading(true); setError(''); setSanction(null);
    try {
      const data = await authPost<LoginResponse>('/auth/verify-login-otp', { phone: `+90${phoneDigits}`, code });
      await afterLogin(data);
    } catch (e) {
      const err = e as Error & { sanction?: SanctionPayload };
      if (err.sanction) { setSanction(err.sanction); }
      else {
        setError(err.message);
        setOtpShake(true);
        setTimeout(() => setOtpShake(false), 500);
      }
    }
    finally { setLoading(false); }
  }

  /* ── E-posta: Giriş ─────────────────────────────────────────── */
  async function handleEmailLogin() {
    setLoading(true); setError(''); setSanction(null);
    try {
      const data = await authPost<LoginResponse>('/auth/login', { email, password });
      await afterLogin(data);
    } catch (e) {
      const err = e as Error & { sanction?: SanctionPayload };
      if (err.sanction) setSanction(err.sanction);
      else setError(err.message);
    }
    finally { setLoading(false); }
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
      style={{ background: '#121212' }}
    >
      {/* Yaptırım modalı */}
      <AnimatePresence>
        {sanction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[200] px-6"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
              style={{ background: '#1a0505', border: '1px solid rgba(192,57,43,0.5)' }}
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-[#ff6b6b]">
                  {sanction.type === 'WARNING'    && 'Uyarı'}
                  {sanction.type === 'SUSPENSION' && 'Hesap Askıya Alındı'}
                  {sanction.type === 'BAN'        && 'Hesap Engellendi'}
                </h2>
                {sanction.expiresAt && (
                  <p className="text-xs text-[#888]">
                    Bitiş: {new Date(sanction.expiresAt).toLocaleString('tr-TR')}
                  </p>
                )}
              </div>
              <p className="text-sm text-[#ccc] leading-relaxed">{sanction.reason}</p>
              <p className="text-xs text-[#666]">
                Hatalı olduğunu düşünüyorsan{' '}
                <a href="mailto:bilgi@ahenk.co" className="text-[#c0392b] underline">bilgi@ahenk.co</a>{' '}
                adresiyle iletişime geç.
              </p>
              {sanction.type === 'WARNING' ? (
                <div className="flex gap-3 mt-1">
                  <button onClick={() => { api.clearToken(); setSanction(null); }} className="flex-1 btn-ghost justify-center">
                    İptal
                  </button>
                  <button onClick={() => { setSanction(null); router.push('/dashboard'); }} className="flex-1 btn-primary justify-center">
                    Devam Et
                  </button>
                </div>
              ) : (
                <button onClick={() => setSanction(null)} className="w-full btn-ghost justify-center mt-1">
                  Kapat
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {welcomeUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 flex flex-col items-center justify-start pt-[18%] z-[100]"
            style={{ background: '#121212' }}
          >
            <div className="fixed inset-0 pointer-events-none">
              <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.12) 0%, transparent 60%)', filter: 'blur(60px)' }} />
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center gap-2 mb-8"
            >
              <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
              <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
              className="font-serif text-4xl text-[#f5f5f5] mb-1"
            >
              Hoş geldin,
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.35, ease: 'easeOut' }}
              className="font-serif text-4xl text-[#f5f5f5]"
            >
              {welcomeUser.firstName} {welcomeUser.lastName}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
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
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
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
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                  >
                    +90
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                    placeholder="5XX XXX XX XX"
                    onKeyDown={(e) => e.key === 'Enter' && phoneValid && handleSendOtp()}
                    className="input-glass flex-1 px-4 py-3.5 text-sm"
                  />
                </div>
                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || !phoneValid}
                  className="mx-auto block btn-primary mt-1 disabled:opacity-40"
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
                <OtpInput
                  value={otp.join('')}
                  onChange={(code) => { setOtp(Array.from({ length: 6 }, (_, i) => code[i] ?? '')); setError(''); }}
                  error={otpShake}
                />
                {error && <p className="text-[#ff6b6b] text-sm text-center">{error}</p>}
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading || !canSubmit}
                  className="w-full btn-primary disabled:opacity-40"
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
                  className="mx-auto block btn-primary mt-1 disabled:opacity-40"
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
          <Link href="/sifremi-unuttum" className="mx-auto block btn-ghost" style={{ width: '72%' }}>
            Şifremi Unuttum
          </Link>
        </div>
      </div>
    </div>
  );
}
