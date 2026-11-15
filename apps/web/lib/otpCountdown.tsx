'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { resendSecondsOf, type OtpNoticeCode } from './otpResend';

// WhatsApp kodu ekranlarının ortak sayacı: süre backend'in döndüğü saniyeden (resendSeconds) başlar.
// Kod gönderen bütün web ekranları bu hook'u ve OtpCountdown bileşenini kullanır.

export function useOtpCountdown() {
  // Bitiş anı tutulur: sekme arka planda kalsa da kalan süre doğru hesaplanır
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (endsAt === null) { setSeconds(0); return; }
    const tick = () => {
      const left = Math.ceil((endsAt - Date.now()) / 1000);
      if (left <= 0) { setSeconds(0); setEndsAt(null); } else setSeconds(left);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  // Backend'den gelen saniyeyle başlatır
  const start = useCallback((resendSeconds: number | null | undefined) => {
    setEndsAt(resendSeconds && resendSeconds > 0 ? Date.now() + resendSeconds * 1000 : null);
  }, []);

  // Backend bekleme süresi dolmadan gelen isteği reddettiyse sayaç kalan saniyeden başlar; true = hata buydu
  const startFromError = useCallback((e: unknown): boolean => {
    const left = resendSecondsOf(e);
    if (left === null) return false;
    setEndsAt(Date.now() + left * 1000);
    return true;
  }, []);

  return { seconds, waiting: seconds > 0, start, startFromError };
}

// Kod giriş alanının hemen altında gösterilir; sayaç 0 olunca kalkar
export function OtpCountdown({ seconds, className }: { seconds: number; className?: string }) {
  if (seconds <= 0) return null;
  return (
    <p className={className ?? 'text-[#a39c93] text-[13px] text-center'} aria-live="off">
      Yeni kod isteyebilmen için kalan süre: {seconds} sn
    </p>
  );
}

// Numara uyarısının altındaki buton: kayıtlı olmayan numarada "Kayıt ol" / "Mekân ekle", kayıtlı numarada "Giriş yap"
const NOTICE_ACTIONS: Record<OtpNoticeCode, { label: string; href: string }> = {
  PHONE_NOT_REGISTERED: { label: 'Kayıt ol', href: '/kayit' },
  VENUE_NOT_REGISTERED: { label: 'Mekân ekle', href: '/is-ortakligi' },
  PHONE_ALREADY_REGISTERED: { label: 'Giriş yap', href: '/giris' },
};

export function OtpNoticeAction({ code, className }: { code: OtpNoticeCode | null; className?: string }) {
  if (!code) return null;
  const { label, href } = NOTICE_ACTIONS[code];
  return <Link href={href} className={className ?? 'btn-ghost w-full justify-center'}>{label}</Link>;
}
