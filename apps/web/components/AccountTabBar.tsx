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

export function AccountTabBar({ activeKey, kycApproved, role }: { activeKey?: string; kycApproved?: boolean; role?: string }) {
  const pathname = usePathname();
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  const tabs = [
    ...(isAdmin ? [{ key: 'admin', label: 'Yönetim Paneli', href: '/admin' }] : []),
    ...TABS.filter(t => !(t.key === 'kyc' && kycApproved)),
  ];

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
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        scrollbarWidth: 'none',
      }}
    >
      <div className="flex gap-1 px-3 py-2" style={{ minWidth: 'max-content' }}>
        {tabs.map(t => {
          if (t.key === 'admin') {
            return (
              <Link key={t.key} href={t.href} style={{ textDecoration: 'none' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)',
                  border: '1px solid #1a3a5c',
                  color: '#93c5fd',
                  boxShadow: '0 0 12px rgba(59,130,246,0.25)',
                  animation: 'adminPulse 2.5s ease-in-out infinite',
                  whiteSpace: 'nowrap' as const,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0,
                    animation: 'adminDot 2.5s ease-in-out infinite',
                  }} />
                  {t.label}
                </span>
                <style>{`
                  @keyframes adminPulse {
                    0%, 100% { box-shadow: 0 0 12px rgba(59,130,246,0.25); border-color: #1a3a5c; }
                    50% { box-shadow: 0 0 20px rgba(59,130,246,0.45); border-color: #3b82f6; }
                  }
                  @keyframes adminDot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                  }
                `}</style>
              </Link>
            );
          }
          return (
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
          );
        })}
      </div>
    </div>
  );
}
