'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { otpNoticeOf, resendSecondsOf, type OtpNoticeCode } from '@/lib/otpResend';
import { OtpNoticeAction } from '@/lib/otpCountdown';

function errorText(e: unknown): string {
  const msg = (e as Error).message;
  return msg === '__rate_limit__' ? 'Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar dene.' : msg;
}

// Kod ekranına bekleme süresinin bitiş anı taşınır (sayaç oradan devam eder)
function resetUrl(phone: string, resendSeconds: number | undefined): string {
  const until = resendSeconds && resendSeconds > 0 ? `&until=${Date.now() + resendSeconds * 1000}` : '';
  return `/sifremi-sifirla?phone=${encodeURIComponent(phone)}${until}`;
}

export default function SifremiUnuttumPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Numara kayıtlı değilse uyarının altında "Kayıt ol" butonu
  const [notice, setNotice] = useState<OtpNoticeCode | null>(null);

  const phoneValid = phone.length === 10 && phone.startsWith('5');

  async function handleSubmit() {
    if (!phoneValid) { setError('Geçerli bir telefon numarası girin.'); return; }
    setLoading(true); setError(''); setNotice(null);
    const full = `+90${phone}`;
    try {
      const r = await api.post<{ resendSeconds?: number }>('/auth/forgot-password', { phone: full });
      router.push(resetUrl(full, r.resendSeconds));
    } catch (e) {
      // Bekleme süresi dolmadan istendi: kod daha önce gönderildi; kod ekranı sunucunun döndüğü kalan saniyeyle açılır
      const left = resendSecondsOf(e);
      if (left !== null) { router.push(resetUrl(full, left)); return; }
      setError(errorText(e)); setNotice(otpNoticeOf(e)); setLoading(false);
    }
  }

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
          <h1 className="ll-title">Şifre Sıfırla</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="ll-card flex flex-col gap-3"
        >
          <p className="text-[#a39c93] text-[13px] text-center mb-1">
            Kayıtlı telefon numarana WhatsApp ile 6 haneli bir kod göndereceğiz.
          </p>
          <div className="flex gap-2">
            <div
              className="flex items-center px-4 text-[#a39c93] text-[13px] select-none shrink-0"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
            >
              +90
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
              placeholder="5XX XXX XX XX"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && phoneValid && handleSubmit()}
              className="input-glass flex-1 px-4 py-3.5 text-sm"
            />
          </div>
          {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
          {error && <OtpNoticeAction code={notice} />}
        </motion.div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !phoneValid}
            className="mx-auto block btn-primary mt-1 disabled:opacity-40"
            style={{ width: '72%' }}
          >
            {loading ? 'Gönderiliyor…' : 'Kod Gönder'}
          </button>
        </div>

        <div className="mt-4 flex justify-center">
          <Link href="/giris" className="mx-auto block btn-ghost" style={{ width: '72%' }}>
            Girişe Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
