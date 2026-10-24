'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

function decodeJwtRole(token: string): string | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(b64));
    return (decoded.role as string) ?? null;
  } catch { return null; }
}

const NAV_TOP = [
  { href: '/',       label: 'Anasayfa' },
  { href: '/profil', label: 'Profilim' },
];

const NAV: { href: string; label: string; alertKey?: boolean; sos?: boolean; superadminOnly?: boolean }[] = [
  { href: '/admin/acil-yardim',  label: '🚨 Acil Yardım', sos: true },
  { href: '/admin/stats',        label: 'İstatistikler' },
  { href: '/admin/matches',      label: 'Masalar' },
  { href: '/admin/kyc',          label: 'KYC Bekleyenler' },
  { href: '/admin/users',        label: 'Kullanıcılar' },
  { href: '/admin/subscriptions', label: 'Abonelikler' },
  { href: '/admin/alerts',       label: 'Uyarılar', alertKey: true },
  { href: '/admin/refunds',      label: 'İade Talepleri' },
  { href: '/admin/venues',       label: 'Mekanlar' },
  { href: '/admin/cities',       label: 'Şehirler' },
  { href: '/admin/denge',        label: 'Bot Yönetimi', superadminOnly: true },
  { href: '/admin/quality',      label: 'Şikayetler' },
  { href: '/admin/partnerships', label: 'İş Ortaklığı' },
  { href: '/admin/careers',      label: 'Kariyer' },
  { href: '/admin/settings',     label: 'Ayarlar' },
];

const BG      = '#020c1b';
const SURFACE = '#0a1628';
const BORDER  = '#1a3a5c';
const RED     = '#ef4444';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';

function NavLinks({ pathname, onClose, onLogout, unread, role }: {
  pathname: string; onClose?: () => void; onLogout: () => void; unread: number; role: string | null;
}) {
  return (
    <nav style={{ display: 'flex', flexDirection: 'column', padding: 12, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
        {NAV_TOP.map((n) => (
          <Link key={n.href} href={n.href} onClick={onClose}
            style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13, color: MUTED, border: '1px solid transparent', transition: 'color 0.15s' }}>
            {n.label}
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV.filter((n) => !n.superadminOnly || role === 'SUPERADMIN').map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          const style = n.sos
            ? active
              ? { background: 'rgba(239,68,68,0.2)', color: RED, border: `1px solid rgba(239,68,68,0.4)`, fontWeight: 700 }
              : { color: RED, border: '1px solid transparent', fontWeight: 600 }
            : active
              ? { background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }
              : { color: MUTED, border: '1px solid transparent' };
          return (
            <Link key={n.href} href={n.href} onClick={onClose}
              style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...style }}>
              {n.label}
              {n.alertKey && unread > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: RED, color: '#fff', minWidth: 18, textAlign: 'center' }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div style={{ paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
        <button onClick={onLogout}
          style={{ width: '100%', padding: '8px 12px', fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 10 }}>
          Çıkış
        </button>
      </div>
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.replace('/giris'); return; }
    const r = decodeJwtRole(token);
    if (r !== 'ADMIN' && r !== 'SUPERADMIN') { router.replace('/dashboard'); return; }
    setRole(r);
    setReady(true);
    api.get<{ unreadCount: number }>('/admin/alerts').then(d => setUnread(d.unreadCount ?? 0)).catch(() => {});
  }, [router]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Bot sayfaları yalnızca SUPERADMIN
  const blocked = ready && role !== 'SUPERADMIN' && NAV.some((n) => n.superadminOnly && (pathname === n.href || pathname.startsWith(n.href + '/')));
  useEffect(() => { if (blocked) router.replace('/admin/stats'); }, [blocked, router]);

  async function handleLogout() { await api.logout(); router.push('/'); }

  if (!ready || blocked) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${RED}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 52, flexShrink: 0, position: 'sticky', top: 0, zIndex: 30, background: SURFACE, borderBottom: `1px solid ${BORDER}`, boxShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
        <button className="md:hidden" onClick={() => setDrawerOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 5 }} aria-label="Menü">
          <span style={{ display: 'block', width: 18, height: 1.5, background: MUTED, borderRadius: 2 }} />
          <span style={{ display: 'block', width: 18, height: 1.5, background: MUTED, borderRadius: 2 }} />
          <span style={{ display: 'block', width: 18, height: 1.5, background: MUTED, borderRadius: 2 }} />
        </button>
        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}>
          <Image src="/logo.webp" alt="Ahenk" width={22} height={22} style={{ borderRadius: '50%' }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: MUTED }}>AHENK YÖNETİM PANELİ</span>
        </Link>
        {unread > 0 && (
          <Link href="/admin/alerts" className="md:hidden" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: RED, color: '#fff' }}>
              {unread} uyarı
            </span>
          </Link>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex" style={{ width: 208, flexShrink: 0, flexDirection: 'column', position: 'sticky', top: 52, height: 'calc(100vh - 52px)', background: SURFACE, borderRight: `1px solid ${BORDER}` }}>
          <NavLinks pathname={pathname} onLogout={handleLogout} unread={unread} role={role} />
        </aside>
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden', background: BG }}>{children}</main>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }} onClick={() => setDrawerOpen(false)} />
            <motion.div className="md:hidden" style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, width: 208, background: SURFACE, borderRight: `1px solid ${BORDER}`, boxShadow: '8px 0 32px rgba(0,0,0,0.7)', paddingTop: 52, display: 'flex', flexDirection: 'column' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}>
              <NavLinks pathname={pathname} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} unread={unread} role={role} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
