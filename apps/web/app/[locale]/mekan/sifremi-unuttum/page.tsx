'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import Image from 'next/image';
import OtpInput from '@/components/ui/OtpInput';
import { venueApi } from '@/lib/venueApi';
import { OtpCountdown, OtpNoticeAction, useOtpCountdown } from '@/lib/otpCountdown';
import { otpNoticeOf, type OtpNoticeCode } from '@/lib/otpResend';
import { StdButton } from '@ahenk/ui';

export default function MekanSifremiUnuttumPage() {
  const t = useTranslations();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Yeni kod isteme bekleme süresi backend'den gelir (ortak sayaç)
  const countdown = useOtpCountdown();
  // Numara kayıtlı değilse uyarının altında "Mekân ekle" butonu
  const [notice, setNotice] = useState<OtpNoticeCode | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true); setError(''); setNotice(null);
    try {
      const r = await venueApi.post<{ resendSeconds?: number }>('/forgot-password', { phone: `+90${phone}` });
      setSent(true); setCode(''); countdown.start(r.resendSeconds);
    } catch (err) {
      // Bekleme süresi dolmadan istendi: sayaç sunucunun döndüğü kalan saniyeden başlar
      if (countdown.startFromError(err)) setSent(true);
      setError((err as Error).message); setNotice(otpNoticeOf(err));
    }
    finally { setLoading(false); }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError(t('vp.enterCode')); return; }
    if (password.length < 6 || password.length > 20) { setError(t('vp.pwLength')); return; }
    if (password !== confirm) { setError(t('vp.pwMismatch')); return; }
    setLoading(true); setError('');
    try {
      await venueApi.post('/reset-password', { phone: `+90${phone}`, code, newPassword: password });
      router.push('/mekan/giris');
    } catch (err) { setError((err as Error).message); setLoading(false); }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24" style={{ background: '#121212' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
          <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
        </div>
        <h1 className="font-serif text-4xl text-[#f5f5f5] text-center mb-2">{t('vp.resetTitle')}</h1>
        {!sent ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3 mt-6">
            <p className="text-[#666] text-sm text-center">{t('vp.resetIntro')}</p>
            {/* Üye şifre sıfırlamadaki telefon satırı */}
            <div className="flex gap-2">
              <div className="flex items-center px-4 text-[#a39c93] text-[13px] select-none shrink-0" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>+90</div>
              <input className="input-glass flex-1 px-4 py-3 text-sm" type="tel" inputMode="numeric" aria-label={t('vp.phone')} placeholder="5XX XXX XX XX" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }} required />
            </div>
            {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
            {error && <OtpNoticeAction code={notice} />}
            <StdButton variant="primary" type="submit" disabled={loading || !(phone.length === 10 && phone.startsWith('5'))} className="w-full justify-center disabled:opacity-70">{loading ? t('vp.sending') : t('vp.sendCode')}</StdButton>
          </form>
        ) : (
          <form onSubmit={reset} className="flex flex-col gap-3 mt-6">
            <p className="text-[#666] text-sm text-center">{t('vp.codeSent')}</p>
            <OtpInput value={code} onChange={setCode} />
            <OtpCountdown seconds={countdown.seconds} />
            <input className="input-glass w-full px-4 py-3 text-sm" type="password" autoComplete="new-password" aria-label={t('vp.newPassword')} placeholder={t('vp.newPasswordHint')} maxLength={20} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <input className="input-glass w-full px-4 py-3 text-sm" type="password" autoComplete="new-password" aria-label={t('vp.newPasswordRepeat')} placeholder={t('vp.newPasswordRepeat')} maxLength={20} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
            <StdButton variant="primary" type="submit" disabled={loading} className="w-full justify-center disabled:opacity-70">{loading ? t('vp.saving') : t('vp.updatePassword')}</StdButton>
            <button type="button" onClick={() => sendCode()} disabled={countdown.waiting || loading} className="text-[13px] text-[#a39c93] hover:text-[#888] transition-colors text-center disabled:opacity-40 disabled:hover:text-[#555] disabled:cursor-not-allowed">{t('vp.resend')}</button>
          </form>
        )}
        <StdButton variant="ghost" as={Link} href="/mekan/giris" className="w-full justify-center mt-3">{t('vp.backToLogin')}</StdButton>
      </div>
    </main>
  );
}
