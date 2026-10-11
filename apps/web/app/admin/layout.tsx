'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';

function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return (decoded.role as string) ?? null;
  } catch {
    return null;
  }
}

const NAV_TOP = [
  { href: '/',       label: 'Anasayfa' },
  { href: '/profil', label: 'Profilim' },
];

const NAV = [
  { href: '/admin/stats',   label: 'İstatistikler' },
  { href: '/admin/kyc',     label: 'KYC Bekleyenler' },
  { href: '/admin/users',   label: 'Kullanıcılar' },
  { href: '/admin/matches', label: 'Masalar' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.replace('/giris'); return; }
    const role = decodeJwtRole(token);
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') { router.replace('/dashboard'); return; }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex">
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col sticky top-0 h-screen"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="px-5 py-5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Image src="/logo.webp" alt="Ahenk" width={24} height={24} className="rounded-full" />
          <span className="text-xs font-semibold tracking-[0.15em] text-[#888]">AHENK ADMIN</span>
        </div>
        <nav className="flex flex-col p-3 flex-1">
          {/* Anasayfa + Profilim */}
          <div className="flex flex-col gap-1 pb-3 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {NAV_TOP.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="px-3 py-2.5 rounded-xl text-sm transition-all"
                style={{ color: '#555', border: '1px solid transparent' }}
              >
                {n.label}
              </Link>
            ))}
          </div>
          {/* Admin menüsü */}
          <div className="flex flex-col gap-1">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={active ? {
                    background: 'linear-gradient(135deg,rgba(192,57,43,0.2),rgba(192,57,43,0.08))',
                    color: '#ff6b6b',
                    border: '1px solid rgba(192,57,43,0.25)',
                  } : {
                    color: '#666',
                    border: '1px solid transparent',
                  }}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => { api.clearToken(); router.push('/'); }}
            className="w-full px-3 py-2 text-xs text-[#555] hover:text-[#ff6b6b] transition-colors text-left rounded-xl"
          >
            Çıkış
          </button>
        </div>
      </aside>

      {/* İçerik */}
      <main className="flex-1 min-w-0 overflow-x-hidden" style={{ paddingBottom: '36px' }}>
        {children}
      </main>
    </div>
  );
}
