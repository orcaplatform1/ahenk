// WhatsApp kodu ekranlarının ortak sayacı (web apps/web/lib/otpCountdown.tsx karşılığı): süre backend'in döndüğü
// saniyeden (resendSeconds) başlar. Kod gönderen bütün mobil ekranlar bu hook'u ve OtpCountdown bileşenini kullanır.
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { StdButton, T } from './ui';
import { ll } from '@/theme/theme';

import { useTranslation } from 'react-i18next';
// Hata yanıtındaki kalan saniye (bekleme süresi dolmadan yeni kod istenince backend döner)
export function resendSecondsOf(e: unknown): number | null {
  const err = e as { resendSeconds?: unknown; data?: { resendSeconds?: unknown } | null } | null;
  const n = err?.resendSeconds ?? err?.data?.resendSeconds;
  return typeof n === 'number' && n > 0 ? Math.ceil(n) : null;
}

export function useOtpCountdown() {
  // Bitiş anı tutulur: uygulama arka planda kalsa da kalan süre doğru hesaplanır
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
export function OtpCountdown({ seconds, fontSize = 13 }: { seconds: number; fontSize?: number }) {
  if (seconds <= 0) return null;
  return <T style={{ fontSize, color: ll.label, textAlign: 'center' }}>Yeni kod isteyebilmen için kalan süre: {seconds} sn</T>;
}

// Numara bu akış için uygun değilse sunucunun döndüğü uyarı kodu (uyarının altındaki buton için).
// Mobilde mekân paneli olmadığı için mekân uyarısı ("Mekân ekle") yalnız web'de vardır.
export type OtpNoticeCode = 'PHONE_NOT_REGISTERED' | 'PHONE_ALREADY_REGISTERED';
export function otpNoticeOf(e: unknown): OtpNoticeCode | null {
  const err = e as { code?: unknown; data?: { code?: unknown } | null } | null;
  const code = err?.code ?? err?.data?.code;
  return code === 'PHONE_NOT_REGISTERED' || code === 'PHONE_ALREADY_REGISTERED' ? code : null;
}

// Uyarının altındaki buton: kayıtlı olmayan numarada "Kayıt ol", kayıtlı numarada "Giriş yap"
export function OtpNoticeAction({ code }: { code: OtpNoticeCode | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  if (!code) return null;
  return code === 'PHONE_NOT_REGISTERED'
    ? <StdButton variant="ghost" full label={t('otp.register')} onPress={() => router.push('/kayit')} />
    : <StdButton variant="ghost" full label={t('otp.login')} onPress={() => router.replace('/giris')} />;
}
