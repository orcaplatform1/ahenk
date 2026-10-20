'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────
const SURFACE  = '#0a1628';
const BORDER   = '#1a3a5c';
const TEXT     = '#e2e8f0';
const MUTED    = '#64748b';
const RED      = '#ef4444';
const BLUE     = '#3b82f6';
const AMBER    = '#f59e0b';
const SANS     = 'Inter, system-ui, sans-serif';
const MONO     = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

interface NavLink { href: string; label: string; sos?: boolean; }
const LINKS: NavLink[] = [
  { href: '/acil-yardim', label: '🚨 Acil Yardım', sos: true },
  { href: '/matches',     label: 'Eşleştirme' },
  { href: '/',            label: 'Dashboard' },
  { href: '/stats',       label: 'İstatistikler' },
  { href: '/quality',     label: 'Kalite Kontrol' },
  { href: '/kyc',         label: 'KYC Sistemi' },
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
    <aside style={{
      width: 224,
      flexShrink: 0,
      background: SURFACE,
      borderRight: `1px solid ${BORDER}`,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: SANS,
    }}>
      {/* Logo / Başlık */}
      <div style={{
        padding: '18px 20px',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: '0.18em',
          color: TEXT,
          fontFamily: SANS,
          display: 'block',
          lineHeight: 1.3,
        }}>
          AHENK
        </span>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: MUTED,
          fontFamily: MONO,
          marginTop: 2,
          display: 'block',
        }}>
          YÖNETİM PANELİ
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {LINKS.map((l) => {
          const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
          const isSos  = l.sos;

          let color   = active ? TEXT   : MUTED;
          let bg      = active ? 'rgba(59,130,246,0.12)' : 'transparent';
          let border  = active ? `1px solid rgba(59,130,246,0.25)` : '1px solid transparent';
          if (isSos) {
            color  = active ? RED : 'rgba(239,68,68,0.85)';
            bg     = active ? 'rgba(239,68,68,0.15)' : 'transparent';
            border = active ? `1px solid rgba(239,68,68,0.35)` : '1px solid transparent';
          }

          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: isSos ? 700 : active ? 600 : 400,
                color,
                background: bg,
                border,
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              <span>{l.label}</span>
              {l.href === '/uyarilar' && unreadAlerts > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  background: AMBER, color: '#000',
                  borderRadius: 99, padding: '1px 6px',
                  fontFamily: MONO,
                }}>
                  {unreadAlerts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Çıkış */}
      <div style={{ padding: '12px 8px', borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '7px 12px',
            borderRadius: 8,
            fontSize: 12,
            color: MUTED,
            background: 'none',
            border: '1px solid transparent',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: SANS,
            transition: 'color 0.15s',
          }}
        >
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
