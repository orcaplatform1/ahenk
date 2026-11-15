// WhatsApp kodu bekleme süresi: sunucu yanıtındaki kalan saniye (resendSeconds) için yardımcılar (sayaç: otpCountdown.tsx)

// Hata yanıtındaki kalan saniye (bekleme süresi dolmadan yeni kod istenince backend döner)
export function resendSecondsOf(e: unknown): number | null {
  const n = (e as { resendSeconds?: unknown } | null)?.resendSeconds;
  return typeof n === 'number' && n > 0 ? Math.ceil(n) : null;
}

// İstek hatasına sunucu yanıtındaki kalan saniyeyi ve uyarı kodunu ekler (api.ts, venueApi.ts ve özel fetch'ler kullanır)
export function withResendSeconds(error: Error, body: unknown): Error {
  const n = (body as { resendSeconds?: unknown } | null)?.resendSeconds;
  if (typeof n === 'number') (error as Error & { resendSeconds?: number }).resendSeconds = n;
  const code = (body as { code?: unknown } | null)?.code;
  if (typeof code === 'string') (error as Error & { code?: string }).code = code;
  return error;
}

// Numara bu akış için uygun değilse sunucunun döndüğü uyarı kodu (uyarının altındaki buton için)
export type OtpNoticeCode =
  | 'PHONE_NOT_REGISTERED' | 'VENUE_NOT_REGISTERED' | 'PHONE_ALREADY_REGISTERED' | 'VENUE_ACCOUNT_INACTIVE' | 'VENUE_PHONE_MULTIPLE';
const NOTICE_CODES: readonly string[] = ['PHONE_NOT_REGISTERED', 'VENUE_NOT_REGISTERED', 'PHONE_ALREADY_REGISTERED', 'VENUE_ACCOUNT_INACTIVE', 'VENUE_PHONE_MULTIPLE'];
export function otpNoticeOf(e: unknown): OtpNoticeCode | null {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && NOTICE_CODES.includes(code) ? (code as OtpNoticeCode) : null;
}
