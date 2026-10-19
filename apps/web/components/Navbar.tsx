'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

/* ── Avatar ─────────────────────────────────────────────────────────── */
const AV_D    = 36;
const AV_R    = AV_D / 2;
const AV_BR   = AV_R - 2;
const AV_CIRC = +(2 * Math.PI * AV_BR).toFixed(2);

interface NavUser { firstName: string; lastName: string; role?: string; profile?: { gender?: string }; }

function initials(u: NavUser) {
  return `${u.firstName?.[0]?.toUpperCase() ?? '?'}.${u.lastName?.[0]?.toUpperCase() ?? '?'}.`;
}

function genderTheme(g?: string) {
  if (g === 'MALE')   return { color: '#4fc3f7', bg: 'rgba(79,195,247,0.12)',  shadow: 'drop-shadow(0 0 5px rgba(79,195,247,0.5))',   pulseMin: 0.45, pulseMax: 1.0,  pulseDur: 2.4 };
  if (g === 'FEMALE') return { color: '#f48fb1', bg: 'rgba(244,143,177,0.12)', shadow: 'drop-shadow(0 0 5px rgba(244,143,177,0.45))', pulseMin: 0.4,  pulseMax: 0.95, pulseDur: 2.8 };
  return { color: 'rgba(255,255,255,0.88)', bg: 'rgba(255,255,255,0.10)', shadow: 'drop-shadow(0 0 4px rgba(255,255,255,0.2))', pulseMin: 0.3, pulseMax: 0.7, pulseDur: 2.6 };
}

function NavAvatar({ user }: { user: NavUser }) {
  const t = genderTheme(user.profile?.gender);
  return (
    <div style={{ position: 'relative', width: AV_D, height: AV_D, flexShrink: 0 }}>
      <svg width={AV_D} height={AV_D} viewBox={`0 0 ${AV_D} ${AV_D}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <circle cx={AV_R} cy={AV_R} r={AV_R - 1} fill={t.bg} />
        <motion.circle cx={AV_R} cy={AV_R} r={AV_BR} fill="none" stroke={t.color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={AV_CIRC}
          style={{ rotate: '-90deg', transformOrigin: `${AV_R}px ${AV_R}px` }}
          initial={{ strokeDashoffset: AV_CIRC }} animate={{ strokeDashoffset: 0 }}
          transition={{ delay: 0.1, duration: 0.85, ease: 'easeOut' }} />
        <motion.circle cx={AV_R} cy={AV_R} r={AV_BR} fill="none" stroke={t.color} strokeWidth={2.5}
          style={{ filter: t.shadow }}
          initial={{ opacity: 0 }} animate={{ opacity: [t.pulseMin, t.pulseMax, t.pulseMin] }}
          transition={{ delay: 1.05, duration: t.pulseDur, repeat: Infinity, ease: 'easeInOut' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#f0f0f0', letterSpacing: '0.05em', userSelect: 'none' }}>
        {initials(user)}
      </div>
    </div>
  );
}

/* ── Kapsül Buton ────────────────────────────────────────────────────── */
interface CapsuleProps {
  label: string;
  leftBg: string;
  outerBorder: string;
  outerGlow: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

function CapsuleBtn({ label, leftBg, outerBorder, outerGlow, icon, href, onClick }: CapsuleProps) {
  const inner = (
    <span
      className="flex items-center gap-0 overflow-hidden"
      style={{
        height: '36px',
        padding: '2px 3px 2px 3px',
        background: 'linear-gradient(180deg,#160B0B 0%,#0B0809 100%)',
        border: `1px solid ${outerBorder}`,
        borderRadius: '999px',
        boxShadow: outerGlow,
        transition: 'box-shadow 220ms ease, border-color 220ms ease',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <span
        className="flex items-center justify-center whitespace-nowrap"
        style={{
          height: '30px',
          padding: '0 10px',
          borderRadius: '999px',
          background: leftBg,
          color: '#FFF7F4',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.14)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        className="flex items-center justify-center"
        style={{ width: '30px', height: '30px', flexShrink: 0, color: '#F7D9D5' }}
      >
        {icon}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="block" style={{ textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block' }}>
      {inner}
    </button>
  );
}

/* ── SVG İkonlar ─────────────────────────────────────────────────────── */
const IkonKayit = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="9" cy="8" r="4" />
    <path d="M3 21v-2a6 6 0 0 1 12 0v2" />
    <path d="M19 8v6" /><path d="M16 11h6" />
  </svg>
);

const IkonGiris = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

const IkonCikis = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const navLinks = [
  { label: 'Nasıl Çalışır?', href: '#how-it-works' },
  { label: 'Buluşmalar',     href: '#cities' },
  { label: 'Test',           href: '/kayit' },
  { label: 'Hikayemiz',      href: '/hikayemiz' },
];


/* ── Navbar ──────────────────────────────────────────────────────────── */
export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [navUser,  setNavUser]  = useState<NavUser | null>(null);
  const [checked,  setChecked]  = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    const token = document.cookie.split('; ').find(r => r.startsWith('ahenk_token='))?.split('=')[1];
    if (!token) {
      setNavUser(null);
      setChecked(true);
      return;
    }

    api.get<NavUser>('/auth/me')
      .then(u => { setNavUser(u); })
      .catch(() => {
        const tokenGone = !document.cookie.split('; ').find(r => r.startsWith('ahenk_token='))?.split('=')[1];
        if (tokenGone) setNavUser(null);
      })
      .finally(() => { setChecked(true); });
  }, []);

  useEffect(() => {
    function onAuthChange() {
      const token = document.cookie.split('; ').find(r => r.startsWith('ahenk_token='))?.split('=')[1];
      if (!token) { setNavUser(null); return; }
      api.get<NavUser>('/auth/me').then(u => setNavUser(u)).catch(() => {});
    }
    window.addEventListener('ahenk:auth', onAuthChange);
    return () => window.removeEventListener('ahenk:auth', onAuthChange);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  function handleLogout() {
    api.clearToken();
    setNavUser(null);
    setMenuOpen(false);
    window.dispatchEvent(new Event('ahenk:auth'));
    router.push('/');
  }

  const showGiris = !navUser && !(['/giris', '/sifremi-unuttum', '/sifremi-sifirla'].includes(pathname));
  const showKayit = !navUser && pathname !== '/kayit';

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-[52px] flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <style>{`@keyframes navbar-logo-spin{to{transform:rotate(360deg)}}`}</style>
            <Image src="/logo.webp" alt="Ahenk" width={28} height={28} className="rounded-full" style={{ animation: 'navbar-logo-spin 10s linear infinite' }} />
            <span className="font-sans font-semibold text-sm tracking-[0.12em] text-text">AHENK</span>
          </Link>

          {/* Sağ alan */}
          <div className="flex items-center gap-2">
            {checked && navUser && (
              <Link href="/profil" className="cursor-pointer flex-shrink-0">
                <NavAvatar user={navUser} />
              </Link>
            )}

            <button
              className="flex flex-col justify-center items-center gap-[5px] p-1.5"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menü"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <motion.span animate={menuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }} transition={{ duration: 0.22 }}
                style={{ display: 'block', width: 20, height: 1.5, background: '#ccc', borderRadius: 2, transformOrigin: 'center' }} />
              <motion.span animate={menuOpen ? { opacity: 0 } : { opacity: 1 }} transition={{ duration: 0.15 }}
                style={{ display: 'block', width: 20, height: 1.5, background: '#ccc', borderRadius: 2 }} />
              <motion.span animate={menuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }} transition={{ duration: 0.22 }}
                style={{ display: 'block', width: 20, height: 1.5, background: '#ccc', borderRadius: 2, transformOrigin: 'center' }} />
            </button>
          </div>

        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setMenuOpen(false)}
            />

            <motion.div
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-y-auto"
              style={{
                width: 'min(280px, 80vw)',
                background: 'linear-gradient(160deg,#111010 0%,#0d0b0b 60%,#120808 100%)',
                borderLeft: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
                paddingTop: 52,
              }}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
            >
              {/* Admin linki */}
              {checked && navUser && (navUser.role === 'ADMIN' || navUser.role === 'SUPERADMIN') && (
                <div className="flex flex-col px-4 pt-4 gap-0.5">
                  <motion.a
                    href="/admin" onClick={() => setMenuOpen(false)}
                    className="text-sm py-2.5 px-2 rounded-lg transition-colors"
                    style={{ color: '#c0392b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04, duration: 0.22 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ff6b6b'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#c0392b'; }}
                  >
                    Yönetim Paneli
                  </motion.a>
                </div>
              )}

              {/* Site linkleri */}
              <div className="flex flex-col px-4 pt-4 gap-1">
                {navLinks.map((item, i) => (
                  <motion.a
                    key={item.label} href={item.href} onClick={() => setMenuOpen(false)}
                    className="text-sm py-3 px-2 rounded-lg transition-colors"
                    style={{ color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.10)' }}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05, duration: 0.22 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f5f5f5'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#aaa'; }}
                  >
                    {item.label}
                  </motion.a>
                ))}
              </div>

              {/* Auth butonları */}
              {checked && (
                <div className="flex flex-col px-4 pt-5 pb-6 gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)', marginTop: 8 }}>
                  {navUser ? (
                    <button onClick={handleLogout} className="w-full btn-ghost justify-center">
                      Çıkış Yap
                    </button>
                  ) : (
                    <>
                      {showGiris && (
                        <Link href="/giris" onClick={() => setMenuOpen(false)} className="w-full btn-ghost justify-center">
                          Giriş Yap
                        </Link>
                      )}
                      {showKayit && (
                        <Link href="/kayit" onClick={() => setMenuOpen(false)} className="w-full btn-primary justify-center">
                          Kayıt Ol
                        </Link>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
