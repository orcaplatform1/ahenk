import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/profil', '/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // api.ts, token varken 'auth=1' cookie'sini set eder
  const authCookie = request.cookies.get('auth');
  if (!authCookie?.value) {
    return NextResponse.redirect(new URL('/giris', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/profil/:path*', '/admin/:path*'],
};
