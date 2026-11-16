import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { ENGLISH_ENABLED } from '@ahenk/shared';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);
// Admin ve mekân paneli Türkçe kalır: dil yönlendirmesi yapılmaz
// Dosyalar (public/, robots.txt, sitemap.xml) ve paylaşım görselleri de dil yönlendirmesine girmez
const NON_LOCALIZED = /^\/(admin|mekan|api|opengraph-image|twitter-image)(\/|$)|\.[a-zA-Z0-9]+$/;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://167.86.103.185:4000';

// Her istekte yeni nonce: sadece bu nonce'u taşıyan scriptler (Next.js'in kendi scriptleri) ve
// onların eklediği scriptler ('strict-dynamic' — iyzico ödeme formu) çalışır. unsafe-inline/unsafe-eval yok;
// geliştirme modunda Next.js hızlı yenileme eval kullandığı için sadece orada unsafe-eval açılır.
function buildCsp(nonce: string): string {
  const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.iyzipay.com https://www.googletagmanager.com https://connect.facebook.net${devEval}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.iyzipay.com",
    "font-src 'self' https://fonts.gstatic.com https://*.iyzipay.com",
    "img-src 'self' data: blob: https: https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com",
    `connect-src 'self' ${API_URL} https://ahenk.tr https://*.iyzipay.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://www.facebook.com`,
    "frame-src https://*.iyzipay.com",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Uygulamada Server Action ve POST alan sayfa yok (API ayrı sunucuda). Sayfalara gelen diğer yöntemler Next'in
  // action işleyicisine girmeden kesilir: bu istekler loglarda "reading 'digest'" hatası üretiyordu.
  if (request.method !== 'GET' && request.method !== 'HEAD' && !pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  // Oturum işareti (gizli değer taşımaz); token'lar HttpOnly çerezde. ahenk_token: eski sürümden kalan oturum
  const hasSession = !!(request.cookies.get('ahenk_session')?.value || request.cookies.get('ahenk_token')?.value);

  // Dil: Türkçe önek yok, İngilizce /en. bare = dilsiz yol
  const localized = !NON_LOCALIZED.test(pathname);
  const isEn = pathname === '/en' || pathname.startsWith('/en/');
  const bare = isEn ? pathname.slice(3) || '/' : pathname;
  const prefix = isEn ? '/en' : '';
  const toUrl = (path: string) => { const u = request.nextUrl.clone(); u.pathname = path; return u; };

  if (localized) {
    // İngilizce kapalıyken /en adresleri Türkçe adrese döner
    if (!ENGLISH_ENABLED && isEn) return NextResponse.redirect(toUrl(bare));
    // Dil belirleme (önek yokken): kayıtlı seçim (çerez) → tarayıcı dili Türkçe değilse English.
    // Hesaptaki dil, giriş yapınca istemcide (LocaleSync) uygulanır. Arama motorları (dil başlığı yok) Türkçe kalır.
    if (ENGLISH_ENABLED && !isEn && request.method === 'GET') {
      const stored = request.cookies.get('NEXT_LOCALE')?.value;
      const accept = (request.headers.get('accept-language') ?? '').trim().toLowerCase();
      const wantsEn = stored === 'en' || (!stored && accept !== '' && !accept.startsWith('tr'));
      if (wantsEn) return NextResponse.redirect(toUrl(bare === '/' ? '/en' : `/en${bare}`));
    }
  }

  const isProtected = bare.startsWith('/dashboard') || bare.startsWith('/profil') || pathname.startsWith('/admin');
  const isAuth = bare === '/giris' || bare === '/kayit';

  if (isProtected && !hasSession) {
    return NextResponse.redirect(toUrl(pathname.startsWith('/admin') ? '/giris' : `${prefix}/giris`));
  }

  if (isAuth && hasSession) {
    return NextResponse.redirect(toUrl(`${prefix}/dashboard`));
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Next.js nonce'u istek başlığındaki CSP'den okuyup kendi scriptlerine ekler
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  // Kullanıcı sayfaları next-intl'den geçer (önek yoksa Türkçe); başlıklar (nonce) yeniden yazılan isteğe aktarılır
  const response = localized
    ? intlMiddleware(new NextRequest(request, { headers: requestHeaders }))
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Statik dosyalar hariç tüm sayfalar (CSP her sayfada nonce ile verilir)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
