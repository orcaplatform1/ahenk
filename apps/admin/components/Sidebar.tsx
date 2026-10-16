'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/acil-yardim', label: '🚨 Acil Yardım', sos: true },
  { href: '/',            label: 'Dashboard' },
  { href: '/stats',       label: 'İstatistikler' },
  { href: '/matches',     label: 'Eşleştirme' },
  { href: '/quality',     label: 'Kalite Kontrol' },
  { href: '/kyc',         label: 'KYC' },
  { href: '/uyarilar',    label: 'Uyarılar' },
  { href: '/kullanicilar',label: 'Kullanıcılar' },
  { href: '/botlar',      label: 'Botlar' },
  { href: '/masalar',     label: 'Masalar' },
  { href: '/mekanlar',    label: 'Mekanlar' },
  { href: '/sehirler',    label: 'Şehirler' },
  { href: '/abonelikler', label: 'Abonelikler' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    api.get('/admin/alerts').then((d: any) => {
      if (d?.unreadCount) setUnreadAlerts(d.unreadCount);
    }).catch(() => {});
  }, [pathname]);

  function handleLogout() {
    api.clearToken();
    router.push('/giris');
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-surface border-r border-border min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <span className="font-serif text-xl">Ahenk</span>
        <span className="text-xs text-muted block">Admin Paneli</span>
      </div>
      <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2">
        {LINKS.map((l) => {
          const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
          const isSos = (l as any).sos;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2 rounded-xl text-sm transition-colors flex items-center justify-between ${
                isSos
                  ? active
                    ? 'bg-red-900/40 text-red-400 font-bold'
                    : 'text-red-500 hover:bg-red-900/20 font-semibold'
                  : active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:text-text hover:bg-bg'
              }`}
            >
              <span>{l.label}</span>
              {l.href === '/uyarilar' && unreadAlerts > 0 && (
                <span className="text-xs bg-accent text-white rounded-full px-1.5 py-0.5 leading-none">{unreadAlerts}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-border">
        <button onClick={handleLogout} className="w-full px-3 py-2 rounded-xl text-sm text-muted hover:text-accent hover:bg-bg transition-colors text-left">
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
