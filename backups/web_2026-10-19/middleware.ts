import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('ahenk_token')?.value;

  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/profil') || pathname.startsWith('/admin');
  const isAuth = pathname === '/giris' || pathname === '/kayit';

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/giris', request.url));
  }

  if (isAuth && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/profil/:path*', '/admin/:path*', '/giris', '/kayit'],
};
