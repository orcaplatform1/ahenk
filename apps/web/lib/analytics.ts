// GA4 ve Meta Pixel için tek yardımcı. Kişisel veri gönderilmez; kimlik ve iletişim bilgisi içeren
// sorgu parametreleri ve token'lı yollar adrese yansıtılmaz.

import { api } from '@/lib/api';

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';

const CONSENT_KEY = 'cookie-consent';
const PENDING_PURCHASE_KEY = 'ahenk_pending_purchase';
const CLOCK_SKEW_MS = 10 * 60 * 1000;

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: unknown;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function isExcludedPath(pathname: string): boolean {
  return /^\/(admin|mekan\/panel)(\/|$)/.test(pathname);
}

// Yol içinde token veya kayıt kimliği taşıyan sayfalar araçlara genel adıyla gider
function safePath(pathname: string): string {
  if (pathname.startsWith('/kanka/')) return '/kanka';
  if (pathname.startsWith('/degerlendirme/')) return '/degerlendirme';
  return pathname;
}

// Pixel adresi kendisi okur: sorgu parametresinde telefon taşıyan veya token'lı sayfalarda PageView gönderilmez
function isPixelPageViewSafe(pathname: string): boolean {
  return !(
    pathname === '/sifremi-sifirla' ||
    pathname.startsWith('/kanka/') ||
    pathname.startsWith('/degerlendirme/')
  );
}

export function readConsent(): { analitik: boolean; pazarlama: boolean } {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === 'all') return { analitik: true, pazarlama: true };
    if (!stored || stored === 'essential') return { analitik: false, pazarlama: false };
    const parsed = JSON.parse(stored) as { analitik?: unknown; pazarlama?: unknown } | null;
    return { analitik: parsed?.analitik === true, pazarlama: parsed?.pazarlama === true };
  } catch {
    return { analitik: false, pazarlama: false };
  }
}

// gtag.js'ten önce çalışır: varsayılan red, ardından kayıtlı onay
export function gaConsentScript(): string {
  return `window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};
gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});
try{var c=localStorage.getItem(${JSON.stringify(CONSENT_KEY)}),a=c==='all',m=c==='all';
if(c&&c!=='all'&&c!=='essential'){var p=JSON.parse(c);a=!!p&&p.analitik===true;m=!!p&&p.pazarlama===true}
var g=function(v){return v?'granted':'denied'};
gtag('consent','update',{analytics_storage:g(a),ad_storage:g(m),ad_user_data:g(m),ad_personalization:g(m)})}catch(e){}`;
}

export function gaConfigScript(): string {
  return `gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{send_page_view:false});`;
}

let lastPixelPath: string | null = null;

function sendPixelPageView() {
  const pathname = window.location.pathname;
  if (!window.fbq || pathname === lastPixelPath || !isPixelPageViewSafe(pathname)) return;
  lastPixelPath = pathname;
  window.fbq('track', 'PageView');
}

function pixelAllowed(): boolean {
  return !!META_PIXEL_ID && !isExcludedPath(window.location.pathname) && readConsent().pazarlama;
}

function loadPixel() {
  if (window.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  // Sayfa görüntülemeleri bu dosyadan gönderilir
  fbq.disablePushState = true;
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  // autoConfig kapalı: form alanlarından otomatik veri toplanmaz
  fbq('set', 'autoConfig', false, META_PIXEL_ID);
  fbq('init', META_PIXEL_ID);
}

// Onay değiştiğinde ve sayfa açıldığında çağrılır
export function applyConsent() {
  if (typeof window === 'undefined') return;
  const { analitik, pazarlama } = readConsent();

  const state = (granted: boolean) => (granted ? 'granted' : 'denied');
  window.gtag?.('consent', 'update', {
    analytics_storage: state(analitik),
    ad_storage: state(pazarlama),
    ad_user_data: state(pazarlama),
    ad_personalization: state(pazarlama),
  });

  if (pixelAllowed()) {
    loadPixel();
    window.fbq?.('consent', 'grant');
    sendPixelPageView();
  } else if (window.fbq) {
    window.fbq('consent', 'revoke');
  }
}

export function trackPageView(pathname: string) {
  if (typeof window === 'undefined') return;
  const excluded = isExcludedPath(pathname);
  if (GA_ID) {
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = excluded;
  }
  if (excluded) return;

  const path = safePath(pathname);
  const pageLocation = `${window.location.origin}${path}`;
  window.gtag?.('set', { page_location: pageLocation, page_path: path, page_referrer: '' });
  window.gtag?.('event', 'page_view', { page_location: pageLocation, page_path: path });

  applyConsent();
}

function sendPixel(method: 'track' | 'trackCustom', event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !pixelAllowed()) return;
  loadPixel();
  window.fbq?.(method, event, params);
}

const sentOnce = new Set<string>();

function once(key: string): boolean {
  if (sentOnce.has(key)) return false;
  sentOnce.add(key);
  return true;
}

export function trackSignUp() {
  if (!once('sign_up')) return;
  window.gtag?.('event', 'sign_up');
  sendPixel('track', 'CompleteRegistration');
}

export function trackOceanTestComplete() {
  if (!once('ocean_test_complete')) return;
  window.gtag?.('event', 'ocean_test_complete');
  sendPixel('trackCustom', 'OceanTestComplete');
}

// Ödeme formu açılırken: tutar backend'in /payment/init yanıtından gelir
export function rememberPendingPurchase(plan: string, planName: string, amountKurus: number) {
  try {
    localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify({ plan, planName, amountKurus, startedAt: Date.now() }));
  } catch { /* olay gönderilmez, ödeme etkilenmez */ }
}

// Ödeme başarılı sayfasında: yalnızca kullanıcının başlattığı ödeme backend'de paid görünüyorsa, bir kez.
// Admin atamaları ve hediye paketlerde bekleyen ödeme ve paid kaydı olmadığı için olay oluşmaz.
export async function trackConfirmedPurchase() {
  let pending: { plan: string; planName: string; amountKurus: number; startedAt: number } | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(PENDING_PURCHASE_KEY) ?? 'null');
    localStorage.removeItem(PENDING_PURCHASE_KEY);
  } catch {
    return;
  }
  if (!pending) return;

  const { plan, planName, amountKurus, startedAt } = pending;
  try {
    const { subscriptions } = await api.get<{
      subscriptions: { plan: string; paid: boolean; createdAt: string }[];
    }>('/payment/subscriptions');
    const confirmed = subscriptions.some(
      (s) => s.paid && s.plan === plan && new Date(s.createdAt).getTime() >= startedAt - CLOCK_SKEW_MS,
    );
    if (!confirmed) return;
  } catch {
    return;
  }

  const value = amountKurus / 100;
  window.gtag?.('event', 'purchase', {
    value,
    currency: 'TRY',
    items: [{ item_name: planName, price: value, quantity: 1 }],
  });
  sendPixel('track', 'Purchase', { value, currency: 'TRY' });
}
