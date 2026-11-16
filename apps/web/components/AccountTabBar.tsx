'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const TABS = [
  { key: 'dashboard', href: '/dashboard' },
  { key: 'masalar',   href: '/profil?tab=masalar' },
  { key: 'profil',    href: '/profil?tab=profil' },
  { key: 'test',      href: '/profil?tab=test' },
  { key: 'paket',     href: '/profil?tab=paket' },
  { key: 'rehber',    href: '/profil?tab=rehber' },
  { key: 'kyc',       href: '/profil?tab=kyc' },
];

export function AccountTabBar({ activeKey, kycApproved }: { activeKey?: string; kycApproved?: boolean }) {
  const t = useTranslations();
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
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        scrollbarWidth: 'none',
      }}
    >
      <div className="flex gap-1 px-3 py-2" style={{ minWidth: 'max-content' }}>
        {tabs.map(tab => {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="text-xs font-medium whitespace-nowrap px-3 py-1.5 rounded-lg shrink-0 transition-all"
              style={isActive(tab.key)
                ? { background: 'rgba(192,57,43,0.18)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.35)', textDecoration: 'none' }
                : { background: 'transparent', color: '#666', border: '1px solid transparent', textDecoration: 'none' }
              }
            >
              {t(`tabs.${tab.key}`)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
