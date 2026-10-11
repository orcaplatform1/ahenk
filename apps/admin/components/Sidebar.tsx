'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const LINKS = [
  { href: '/',            label: 'Dashboard' },
  { href: '/stats',       label: 'İstatistikler' },
  { href: '/matches',     label: 'Eşleştirme' },
  { href: '/quality',     label: 'Kalite Kontrol' },
  { href: '/kyc',         label: 'KYC' },
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
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted hover:text-text hover:bg-bg'}`}
            >
              {l.label}
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
