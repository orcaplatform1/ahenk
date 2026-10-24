import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://167.86.103.185:4000';

// Her istekte yeni nonce: sadece bu nonce'u taşıyan scriptler (Next.js'in kendi scriptleri) ve
// onların eklediği scriptler ('strict-dynamic' — iyzico ödeme formu) çalışır. unsafe-inline/unsafe-eval yok;
// geliştirme modunda Next.js hızlı yenileme eval kullandığı için sadece orada unsafe-eval açılır.
function buildCsp(nonce: string): string {
  const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.iyzipay.com${devEval}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.iyzipay.com",
    "font-src 'self' https://fonts.gstatic.com https://*.iyzipay.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${API_URL} https://ahenk.tr https://*.iyzipay.com`,
    "frame-src https://*.iyzipay.com",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Oturum işareti (gizli değer taşımaz); token'lar HttpOnly çerezde. ahenk_token: eski sürümden kalan oturum
  const hasSession = !!(request.cookies.get('ahenk_session')?.value || request.cookies.get('ahenk_token')?.value);

  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/profil') || pathname.startsWith('/admin');
  const isAuth = pathname === '/giris' || pathname === '/kayit';

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL('/giris', request.url));
  }

  if (isAuth && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Next.js nonce'u istek başlığındaki CSP'den okuyup kendi scriptlerine ekler
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Statik dosyalar hariç tüm sayfalar (CSP her sayfada nonce ile verilir)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
