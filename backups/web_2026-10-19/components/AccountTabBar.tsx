'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { key: 'dashboard', label: 'Eşleşme Paneli', href: '/dashboard' },
  { key: 'profil',    label: 'Profilim',        href: '/profil?tab=profil' },
  { key: 'test',      label: 'Kişilik Testim',  href: '/profil?tab=test' },
  { key: 'masalar',   label: 'Masalarım',        href: '/profil?tab=masalar' },
  { key: 'paket',     label: 'Paketim',          href: '/profil?tab=paket' },
  { key: 'kyc',       label: 'Kimlik Doğrulama', href: '/profil?tab=kyc' },
  { key: 'rehber',    label: 'Numara Engelleme', href: '/profil?tab=rehber' },
];

export function AccountTabBar({ activeKey, kycApproved }: { activeKey?: string; kycApproved?: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter(t => !(t.key === 'kyc' && kycApproved));

  function isActive(key: string) {
    if (key === 'dashboard') return pathname === '/dashboard';
    if (pathname !== '/profil') return false;
    if (!activeKey || activeKey === 'profil') return key === 'profil';
    return key === activeKey;
  }

  return (
    <div
      className="overflow-x-auto"
      style={{
        position: 'sticky',
        top: 52,
        zIndex: 40,
        background: 'rgba(10,10,10,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        scrollbarWidth: 'none',
      }}
    >
      <div className="flex gap-1 px-3 py-2" style={{ minWidth: 'max-content' }}>
        {tabs.map(t => (
          <Link
            key={t.key}
            href={t.href}
            className="text-xs font-medium whitespace-nowrap px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
            style={isActive(t.key)
              ? { background: 'rgba(192,57,43,0.18)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.35)', textDecoration: 'none' }
              : { background: 'transparent', color: '#666', border: '1px solid transparent', textDecoration: 'none' }
            }
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
