'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return (decoded.role as string) ?? null;
  } catch { return null; }
}

const NAV_TOP = [
  { href: '/',       label: 'Anasayfa' },
  { href: '/profil', label: 'Profilim' },
];

const NAV: { href: string; label: string; alertKey?: boolean; sos?: boolean }[] = [
  { href: '/admin/acil-yardim',  label: '🚨 Acil Yardım', sos: true },
  { href: '/admin/stats',        label: 'İstatistikler' },
  { href: '/admin/matches',      label: 'Masalar' },
  { href: '/admin/kyc',          label: 'KYC Bekleyenler' },
  { href: '/admin/users',        label: 'Kullanıcılar' },
  { href: '/admin/alerts',       label: 'Uyarılar', alertKey: true },
  { href: '/admin/refunds',      label: 'İade Talepleri' },
  { href: '/admin/venues',       label: 'Mekanlar' },
  { href: '/admin/bots',         label: 'Bot Yönetimi' },
  { href: '/admin/quality',      label: 'Şikayetler' },
  { href: '/admin/partnerships', label: 'İş Ortaklığı' },
  { href: '/admin/careers',      label: 'Kariyer' },
  { href: '/admin/settings',     label: 'Ayarlar' },
];

function NavLinks({ pathname, onClose, onLogout, unread }: {
  pathname: string; onClose?: () => void; onLogout: () => void; unread: number;
}) {
  return (
    <nav className="flex flex-col p-3 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-0.5 pb-3 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
        {NAV_TOP.map((n) => (
          <Link key={n.href} href={n.href} onClick={onClose}
            className="px-3 py-2 rounded-xl text-sm transition-all"
            style={{ color: '#555', border: '1px solid transparent' }}>
            {n.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 flex-1">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          const linkStyle = n.sos
            ? active
              ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', fontWeight: 700 }
              : { color: '#ef4444', border: '1px solid transparent', fontWeight: 600 }
            : active
              ? { background: 'linear-gradient(135deg,rgba(192,57,43,0.2),rgba(192,57,43,0.08))', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.25)' }
              : { color: '#666', border: '1px solid transparent' };
          return (
            <Link key={n.href} href={n.href} onClick={onClose}
              className="px-3 py-2 rounded-xl text-sm transition-all flex items-center justify-between"
              style={linkStyle}
            >
              {n.label}
              {n.alertKey && unread > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  style={{ background: '#c0392b', color: '#fff', fontSize: 10 }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <button onClick={onLogout}
          className="w-full px-3 py-2 text-xs text-[#555] hover:text-[#ff6b6b] transition-colors text-left rounded-xl">
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

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.replace('/giris'); return; }
    const role = decodeJwtRole(token);
    if (role !== 'ADMIN' && role !== 'SUPERADMIN') { router.replace('/dashboard'); return; }
    setReady(true);
    api.get<{ unreadCount: number }>('/admin/alerts').then(d => setUnread(d.unreadCount ?? 0)).catch(() => {});
  }, [router]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  function handleLogout() { api.clearToken(); router.push('/'); }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-[#f5f5f5] flex flex-col">
      <header className="flex items-center gap-3 px-4 h-12 flex-shrink-0 sticky top-0 z-30"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.10)', background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)' }}>
        <button className="md:hidden flex flex-col justify-center items-center gap-[5px] flex-shrink-0"
          onClick={() => setDrawerOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} aria-label="Menü">
          <span style={{ display: 'block', width: 18, height: 1.5, background: '#888', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 18, height: 1.5, background: '#888', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 18, height: 1.5, background: '#888', borderRadius: 2 }} />
        </button>
        <Link href="/admin" className="flex items-center gap-2 flex-shrink-0">
          <Image src="/logo.webp" alt="Ahenk" width={22} height={22} className="rounded-full" />
          <span className="text-xs font-semibold tracking-[0.15em] text-[#888]">AHENK ADMIN</span>
        </Link>
        {unread > 0 && (
          <Link href="/admin/alerts" className="md:hidden ml-auto">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#c0392b', color: '#fff' }}>
              {unread} uyarı
            </span>
          </Link>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex w-52 flex-shrink-0 flex-col sticky top-12 h-[calc(100vh-48px)]"
          style={{ borderRight: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.02)' }}>
          <NavLinks pathname={pathname} onLogout={handleLogout} unread={unread} />
        </aside>
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div className="md:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }} onClick={() => setDrawerOpen(false)} />
            <motion.div className="md:hidden fixed top-0 left-0 bottom-0 z-50 flex flex-col"
              style={{ width: 200, background: 'linear-gradient(160deg,#111010 0%,#0d0b0b 60%,#120808 100%)',
                borderRight: '1px solid rgba(255,255,255,0.08)', boxShadow: '8px 0 32px rgba(0,0,0,0.7)', paddingTop: 48 }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}>
              <NavLinks pathname={pathname} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} unread={unread} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
