import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Auth kontrolü client-side yapılıyor (profil/page.tsx + apiFetch 401 handler).
// Burada redirect yok — tarayıcı önbelleği cookie süresi geçince middleware false-logout yapıyordu.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/profil/:path*', '/admin/:path*'],
};
