'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { DEFAULT_PHONE_COUNTRY, formatDateTime, toE164 } from '@ahenk/shared';
import { CountryCodeButton } from '@/components/PhoneCountryField';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api, API_PREFIX, langHeaders } from '@/lib/api';
import { venueApi } from '@/lib/venueApi';
import OtpInput from '@/components/ui/OtpInput';
import { OtpCountdown, OtpNoticeAction, useOtpCountdown } from '@/lib/otpCountdown';
import { otpNoticeOf, withResendSeconds, type OtpNoticeCode } from '@/lib/otpResend';
import { StdButton } from '@ahenk/ui';

const API_BASE = API_PREFIX;

// Token'lar HttpOnly çerezle gelir; yanıt gövdesinde sadece kullanıcı
interface LoginResponse {
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
    headers: { 'Content-Type': 'application/json', ...langHeaders() },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as Partial<SanctionPayload> & { message?: string | string[] };
    if (res.status === 403 && (err.type === 'SUSPENSION' || err.type === 'BAN' || err.type === 'WARNING')) {
      const e = new Error(err.message as string ?? 'Access denied') as Error & { sanction?: SanctionPayload };
      e.sanction = err as SanctionPayload;
      throw e;
    }
    const msg = Array.isArray(err.message) ? err.message[0] : (err.message ?? 'Error');
    throw withResendSeconds(new Error(msg), data);
  }
  return data as T;
}

// İşletme Girişi: apps/mobile/app/giris.tsx VenueLogin'in aynısı (varsayılan WhatsApp kodu, ikinci seçenek e-posta + şifre)
function VenueLogin() {
  const t = useTranslations();
  // Mekân paneli dil öneki almaz (Türkçe)
  const router = useRouter(); // Mekân paneli de seçili dilde (/en/mekan…)
  const [method, setMethod] = useState<Method>('whatsapp');
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const countdown = useOtpCountdown();
  // Numara kayıtlı değilse uyarının altında "Mekân ekle" butonu
  const [notice, setNotice] = useState<OtpNoticeCode | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const phoneValid = phone.length === 10 && phone.startsWith('5');

  function done() { router.push('/mekan/panel/bilgiler'); }
  async function sendOtp() {
    setLoading(true); setError(''); setNotice(null);
    try {
      const r = await venueApi.post<{ resendSeconds?: number }>('/send-login-otp', { phone: `+90${phone}` });
      setOtpStep(true); setOtp(''); countdown.start(r.resendSeconds);
    } catch (e) {
      // Bekleme süresi dolmadan istendi: sayaç sunucunun döndüğü kalan saniyeden başlar
      if (countdown.startFromError(e)) setOtpStep(true);
      setError((e as Error).message); setNotice(otpNoticeOf(e));
    } finally { setLoading(false); }
  }
  async function verify() {
    setLoading(true); setError('');
    try { await venueApi.post('/verify-login-otp', { phone: `+90${phone}`, code: otp }); done(); } catch (e) { setError((e as Error).message); setLoading(false); }
  }
  async function emailLogin() {
    setLoading(true); setError('');
    try { await venueApi.post('/login', { email, password }); done(); } catch (e) { setError((e as Error).message); setLoading(false); }
  }
  function switchMethod(m: Method) { setMethod(m); setError(''); setOtpStep(false); setOtp(''); }

  return (
    <>
      <section className="ll-card">
        <div
          className="flex mb-6 p-1 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {(['whatsapp', 'email'] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMethod(m)}
              className="flex-1 py-2 text-[13px] font-medium rounded-xl transition-all"
              style={
                method === m
                  ? { background: 'rgba(192,57,43,0.18)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.35)' }
                  : { color: '#666', border: '1px solid transparent' }
              }
            >
              {m === 'whatsapp' ? t('login.withWhatsapp') : t('login.withEmail')}
            </button>
          ))}
        </div>

        {method === 'whatsapp' && !otpStep && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div
                className="flex items-center px-4 text-[#a39c93] text-[13px] select-none shrink-0"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
              >
                +90
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                placeholder="5XX XXX XX XX"
                onKeyDown={(e) => e.key === 'Enter' && phoneValid && sendOtp()}
                className="input-glass flex-1 px-4 py-3.5 text-sm"
              />
            </div>
            {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
            {error && <OtpNoticeAction code={notice} />}
          </div>
        )}

        {method === 'whatsapp' && otpStep && (
          <div className="flex flex-col gap-4">
            <p className="text-[#a39c93] text-[13px] text-center">
              {t('login.codeSentTo', { phone: `+90${phone}` })}
            </p>
            <OtpInput value={otp} onChange={(code) => { setOtp(code); setError(''); }} />
            <OtpCountdown seconds={countdown.seconds} />
            {error && <p className="text-[#ff6b6b] text-sm text-center">{error}</p>}
          </div>
        )}

        {method === 'email' && (
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder={t('login.email')}
              className="input-glass px-4 py-3.5 text-sm"
            />
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder={t('login.password')}
                onKeyDown={(e) => e.key === 'Enter' && emailLogin()}
                className="input-glass px-4 py-3.5 text-sm pr-12 w-full"
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                tabIndex={-1}
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
        )}
      </section>

      <div className="mt-4 flex flex-col gap-3">
        {method === 'whatsapp' && !otpStep && (
          <StdButton variant="primary"
            type="button"
            onClick={sendOtp}
            disabled={loading || !phoneValid}
            className="mx-auto block mt-1 disabled:opacity-40"
            style={{ width: '72%' }}
          >
            {loading ? t('login.sending') : t('login.sendCode')}
          </StdButton>
        )}
        {method === 'whatsapp' && otpStep && (
          <>
            <StdButton variant="primary"
              type="button"
              onClick={verify}
              disabled={loading || otp.length !== 6}
              className="w-full disabled:opacity-40"
            >
              {loading ? t('login.verifying') : t('login.submit')}
            </StdButton>
            <button
              type="button"
              onClick={sendOtp}
              disabled={countdown.waiting || loading}
              className="text-[13px] text-[#a39c93] hover:text-[#888] transition-colors text-center disabled:opacity-40 disabled:hover:text-[#555] disabled:cursor-not-allowed"
            >
              {t('login.resend')}
            </button>
            <button
              type="button"
              onClick={() => { setOtpStep(false); setOtp(''); setError(''); }}
              className="text-[13px] text-[#a39c93] hover:text-[#888] transition-colors text-center"
            >
              {t('login.changeNumber')}
            </button>
          </>
        )}
        {method === 'email' && (
          <StdButton variant="primary"
            type="button"
            onClick={emailLogin}
            disabled={loading || !email || !password}
            className="mx-auto block mt-1 disabled:opacity-40"
            style={{ width: '72%' }}
          >
            {loading ? t('login.loggingIn') : t('login.submit')}
          </StdButton>
        )}
      </div>

      {method === 'email' && (
        <div className="mt-4 flex justify-center">
          <StdButton variant="ghost" as={Link} href="/mekan/sifremi-unuttum" className="mx-auto block" style={{ width: '72%' }}>
            {t('login.forgot')}
          </StdButton>
        </div>
      )}
    </>
  );
}

// Giriş sonrası dönüş: yalnız izinli yollar (açık yönlendirme yok). /hesap-silme → giriş sonrası hesap silme sayfasına döner
const RETURN_PATHS = ['/hesap-silme'];
function afterLoginPath(): string {
  if (typeof window === 'undefined') return '/dashboard';
  const p = new URLSearchParams(window.location.search).get('donus');
  return p && RETURN_PATHS.includes(p) ? p : '/dashboard';
}

export default function GirisPage() {
  const t = useTranslations();
  const router = useRouter();
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [kind, setKind] = useState<'uye' | 'isletme'>('uye');
  const [method, setMethod] = useState<Method>('whatsapp');

  /* WhatsApp akışı */
  const [phone,    setPhone]    = useState('');
  const [otpStep,  setOtpStep]  = useState(false);
  const [otp,      setOtp]      = useState(['', '', '', '', '', '']);
  const [otpShake, setOtpShake] = useState(false);
  // Yeni kod gönder: bekleme süresi backend'den gelir (ortak sayaç)
  const countdown = useOtpCountdown();
  // Numara kayıtlı değilse uyarının altında "Kayıt ol" butonu
  const [notice, setNotice] = useState<OtpNoticeCode | null>(null);

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
  // Seçilen ülkeye göre doğrulanmış E.164 numara (libphonenumber-js)
  const phoneE164    = toE164(country, phoneDigits);
  const phoneValid   = !!phoneE164;
  const emailValid   = email.includes('@') && email.includes('.');
  const passValid    = password.length >= 6 && password.length <= 20;
  const canSubmit    = method === 'whatsapp' ? (otpStep ? otp.join('').length === 6 : phoneValid) : (emailValid && passValid);

  /* ── WhatsApp: Kod Gönder ───────────────────────────────────── */
  async function handleSendOtp() {
    setLoading(true); setError(''); setSanction(null); setNotice(null);
    try {
      const r = await authPost<{ resendSeconds?: number }>('/auth/send-login-otp', { phone: phoneE164 });
      setOtpStep(true);
      setOtp(['', '', '', '', '', '']);
      countdown.start(r.resendSeconds);
    } catch (e) {
      const err = e as Error & { sanction?: SanctionPayload };
      if (err.sanction) { setSanction(err.sanction); }
      else {
        // Bekleme süresi dolmadan istendi: sayaç sunucunun döndüğü kalan saniyeden başlar
        if (countdown.startFromError(e)) setOtpStep(true);
        setError(err.message); setNotice(otpNoticeOf(e));
      }
    }
    finally { setLoading(false); }
  }

  async function afterLogin(data: LoginResponse) {
    api.onLogin();
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
    setTimeout(() => router.push(afterLoginPath()), 2000);
  }

  /* ── WhatsApp: Kod Doğrula ──────────────────────────────────── */
  async function handleVerifyOtp() {
    const code = otp.join('');
    setLoading(true); setError(''); setSanction(null);
    try {
      const data = await authPost<LoginResponse>('/auth/verify-login-otp', { phone: phoneE164, code });
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
      className="live-layer ll-form min-h-screen flex flex-col items-center justify-center md:justify-start px-6 pt-[52px] md:pt-[80px]"
    >
      {/* Yaptırım modalı */}
      <AnimatePresence>
        {sanction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-200 px-6"
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
                  {sanction.type === 'WARNING'    && t('login.warning')}
                  {sanction.type === 'SUSPENSION' && t('login.suspended')}
                  {sanction.type === 'BAN'        && t('login.banned')}
                </h2>
                {sanction.expiresAt && (
                  <p className="text-xs text-[#c9c2b8]">
                    {t('login.sanctionEnds', { date: formatDateTime(sanction.expiresAt) })}
                  </p>
                )}
              </div>
              <p className="text-sm text-[#ccc] leading-relaxed">{sanction.reason}</p>
              <p className="text-xs text-[#a39c93]">
                {t('login.contactPre')}{' '}
                <a href="mailto:bilgi@ahenk.co" className="text-[#c0392b] underline">bilgi@ahenk.co</a>{' '}
                {t('login.contactPost')}
              </p>
              {sanction.type === 'WARNING' ? (
                <div className="flex gap-3 mt-1">
                  <StdButton variant="ghost" onClick={async () => { await api.logout(); setSanction(null); }} className="flex-1 justify-center">
                    {t('login.cancel')}
                  </StdButton>
                  <StdButton variant="primary" onClick={() => { setSanction(null); router.push(afterLoginPath()); }} className="flex-1 justify-center">
                    {t('login.continue')}
                  </StdButton>
                </div>
              ) : (
                <StdButton variant="ghost" onClick={() => setSanction(null)} className="w-full justify-center mt-1">
                  {t('login.close')}
                </StdButton>
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
            className="fixed inset-0 flex flex-col items-center justify-start pt-[18%] z-100"
            style={{ background: '#000000' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center gap-2 mb-8"
            >
              <Image src="/logo-welcome.webp" alt="Ahenk" width={48} height={48} />
              <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
              className="font-serif text-4xl text-[#f5f5f5] mb-1"
            >
              {t('login.welcome')}
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
          <h1 className="ll-title">{t('login.submit')}</h1>
        </div>

        {/* Üye / İşletme seçimi */}
        <div
          className="flex mb-4 p-1 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {(['uye', 'isletme'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="flex-1 py-2 text-[13px] font-medium rounded-xl transition-all"
              style={
                kind === k
                  ? { background: 'rgba(192,57,43,0.18)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.35)' }
                  : { color: '#666', border: '1px solid transparent' }
              }
            >
              {k === 'uye' ? t('login.member') : t('login.venue')}
            </button>
          ))}
        </div>

        {kind === 'isletme' ? <VenueLogin /> : (<>
        <section className="ll-card">
        {/* Toggle */}
        <div
          className="flex mb-6 p-1 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {(['whatsapp', 'email'] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMethod(m)}
              className="flex-1 py-2 text-[13px] font-medium rounded-xl transition-all"
              style={
                method === m
                  ? { background: 'rgba(192,57,43,0.18)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.35)' }
                  : { color: '#666', border: '1px solid transparent' }
              }
            >
              {m === 'whatsapp' ? t('login.withWhatsapp') : t('login.withEmail')}
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
                  <CountryCodeButton country={country} onChange={(c) => { setCountry(c); setError(''); }} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 15)); setError(''); }}
                    placeholder={country === 'TR' ? '5XX XXX XX XX' : ''}
                    onKeyDown={(e) => e.key === 'Enter' && phoneValid && handleSendOtp()}
                    className="input-glass flex-1 px-4 py-3.5 text-sm"
                  />
                </div>
                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
                {error && <OtpNoticeAction code={notice} />}
              </div>
            )}

            {/* ── WhatsApp OTP ── */}
            {method === 'whatsapp' && otpStep && (
              <div className="flex flex-col gap-4">
                <p className="text-[#a39c93] text-[13px] text-center">
                  {t('login.codeSentTo', { phone: phoneE164 ?? phoneDigits })}
                </p>
                <OtpInput
                  value={otp.join('')}
                  onChange={(code) => { setOtp(Array.from({ length: 6 }, (_, i) => code[i] ?? '')); setError(''); }}
                  error={otpShake}
                />
                <OtpCountdown seconds={countdown.seconds} />
                {error && <p className="text-[#ff6b6b] text-sm text-center">{error}</p>}
              </div>
            )}

            {/* ── E-posta formu ── */}
            {method === 'email' && (
              <div className="flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder={t('login.emailPlaceholder')}
                  className="input-glass px-4 py-3.5 text-sm"
                />
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value.slice(0, 20)); setError(''); }}
                    placeholder={t('login.passwordPlaceholder')}
                    onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleEmailLogin()}
                    className="input-glass px-4 py-3.5 text-sm pr-12 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    tabIndex={-1}
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
            )}
          </motion.div>
        </AnimatePresence>

        </section>

        <div className="mt-4 flex flex-col gap-3">
            {method === 'whatsapp' && !otpStep && (
                <StdButton variant="primary"
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || !phoneValid}
                  className="mx-auto block mt-1 disabled:opacity-40"
                  style={{ width: '72%' }}
                >
                  {loading ? t('login.sending') : t('login.sendCode')}
                </StdButton>
            )}
            {method === 'whatsapp' && otpStep && (
              <>
                <StdButton variant="primary"
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading || !canSubmit}
                  className="w-full disabled:opacity-40"
                >
                  {loading ? t('login.verifying') : t('login.submit')}
                </StdButton>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={countdown.waiting || loading}
                  className="text-[13px] text-[#a39c93] hover:text-[#888] transition-colors text-center disabled:opacity-40 disabled:hover:text-[#555] disabled:cursor-not-allowed"
                >
                  {t('login.resend')}
                </button>
                <button
                  type="button"
                  onClick={() => { setOtpStep(false); setOtp(['', '', '', '', '', '']); setError(''); }}
                  className="text-[13px] text-[#a39c93] hover:text-[#888] transition-colors text-center"
                >
                  {t('login.changeNumber')}
                </button>
              </>
            )}
            {method === 'email' && (
                <StdButton variant="primary"
                  type="button"
                  onClick={handleEmailLogin}
                  disabled={loading || !canSubmit}
                  className="mx-auto block mt-1 disabled:opacity-40"
                  style={{ width: '72%' }}
                >
                  {loading ? t('login.loggingIn') : t('login.submit')}
                </StdButton>
            )}
        </div>

        {/* Alt linkler */}
        {method === 'email' && (
          <div className="mt-4 flex justify-center">
            <StdButton variant="ghost" as={Link} href="/sifremi-unuttum" className="mx-auto block" style={{ width: '72%' }}>
              {t('login.forgot')}
            </StdButton>
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}
