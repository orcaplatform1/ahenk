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

// Mobilde önce ahenk:// şemasıyla uygulama açılmaya çalışılır; 1,5 sn içinde sayfa görünür kalırsa (uygulama açılmadıysa)
// iOS'ta App Store'a, Android'de Play Store'a yönlendirilir. Uygulama açılırsa (sayfa gizlenirse) yönlendirme yapılmaz.
export function openAppOrStore(platform: 'ios' | 'android') {
  const store = platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
  let left = false;
  const onHide = () => { if (document.visibilityState === 'hidden') left = true; };
  const onPageHide = () => { left = true; };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);
  const timer = setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
    if (!left && document.visibilityState === 'visible' && store) window.location.href = store;
  }, 1500);
  try { window.location.href = 'ahenk://'; } catch { /* şema açılamadı: zamanlayıcı mağazaya yönlendirir */ }
  return () => clearTimeout(timer);
}
