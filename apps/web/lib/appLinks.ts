// Mobil uygulama mağaza bağlantıları — lansmanda doldurulacak (boşken ilgili mağaza butonu pasif görünür)
export const APP_STORE_URL = '';
export const PLAY_STORE_URL = '';

export type DevicePlatform = 'ios' | 'android' | 'desktop';

export function devicePlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  // iPadOS 13+ masaüstü Safari gibi görünür: dokunmatik Mac de iOS sayılır
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
