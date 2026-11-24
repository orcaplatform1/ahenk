'use client';

import NextLink from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import { useEffect, useRef, useState } from 'react';
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

// label: çeviri anahtarı
const navLinks = [
  { label: 'nav.howItWorks', href: '#how-it-works' },
  { label: 'nav.meetups',    href: '#cities' },
  { label: 'nav.test',       href: '/kayit' },
  { label: 'nav.ourStory',   href: '/hikayemiz' },
];


/* ── Navbar ──────────────────────────────────────────────────────────── */
export default function Navbar() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router   = useRouter();
  const [navUser,  setNavUser]  = useState<NavUser | null>(null);
  const [checked,  setChecked]  = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!api.hasSession()) {
      setNavUser(null);
      setChecked(true);
      return;
    }

    api.get<NavUser>('/auth/me')
      .then(u => { setNavUser(u); })
      .catch(() => {
        if (!api.hasSession()) setNavUser(null);
      })
      .finally(() => { setChecked(true); });
  }, []);

  useEffect(() => {
    function onAuthChange() {
      if (!api.hasSession()) { setNavUser(null); return; }
      api.get<NavUser>('/auth/me').then(u => setNavUser(u)).catch(() => {});
    }
    window.addEventListener('ahenk:auth', onAuthChange);
    return () => window.removeEventListener('ahenk:auth', onAuthChange);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  async function handleLogout() {
    await api.logout();
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
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <style>{`@keyframes navbar-logo-spin{to{transform:rotate(360deg)}}`}</style>
            <Image src="/logo.webp" alt="Ahenk" width={28} height={28} className="rounded-full" style={{ animation: 'navbar-logo-spin 10s linear infinite' }} />
            <span className="font-sans font-semibold text-sm tracking-[0.12em] text-text">AHENK</span>
          </Link>

          {/* Sağ alan */}
          <div className="flex items-center gap-2">
            {checked && navUser && (navUser.role === 'ADMIN' || navUser.role === 'SUPERADMIN') && (
              <>
                <style>{`
                  @keyframes navAdminPulse {
                    0%, 100% { box-shadow: 0 0 10px rgba(59,130,246,0.2); border-color: #1a3a5c; }
                    50% { box-shadow: 0 0 18px rgba(59,130,246,0.4); border-color: #3b82f6; }
                  }
                  @keyframes navAdminDot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.35; }
                  }
                `}</style>
                <NextLink href="/admin" style={{ textDecoration: 'none' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)',
                    border: '1px solid #1a3a5c', color: '#93c5fd',
                    animation: 'navAdminPulse 2.5s ease-in-out infinite',
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0,
                      animation: 'navAdminDot 2.5s ease-in-out infinite',
                    }} />
                    {t('nav.adminPanel')}
                  </span>
                </NextLink>
              </>
            )}
            {checked && navUser && (
              <Link href="/profil" className="cursor-pointer shrink-0">
                <NavAvatar user={navUser} />
              </Link>
            )}

            {/* Dil seçici: hamburger menünün hemen solu (ENGLISH_ENABLED = false iken görünmez) */}
            <LanguageSwitcher />
            {/* Hamburger menü: header'ın en sağı */}
            <button
              className="flex flex-col justify-center items-center gap-[5px] p-1.5"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={t('nav.menu')}
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
              {/* Site linkleri */}
              <div className="flex flex-col px-4 pt-4 gap-1">
                {navLinks.map((item, i) => (
                  <motion.a
                    key={item.label} href={item.href.startsWith('/') && locale === 'en' ? `/en${item.href}` : item.href} onClick={() => setMenuOpen(false)}
                    className="text-sm py-3 px-2 rounded-lg transition-colors"
                    style={{ color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.10)' }}
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05, duration: 0.22 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f5f5f5'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#aaa'; }}
                  >
                    {t(item.label)}
                  </motion.a>
                ))}
              </div>

              {/* Auth butonları */}
              {checked && (
                <div className="flex flex-col px-4 pt-5 pb-6 gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)', marginTop: 8 }}>
                  {navUser ? (
                    <button onClick={handleLogout} className="w-full btn-ghost justify-center">
                      {t('nav.logout')}
                    </button>
                  ) : (
                    <>
                      {showGiris && (
                        <Link href="/giris" onClick={() => setMenuOpen(false)} className="w-full btn-ghost justify-center">
                          {t('nav.login')}
                        </Link>
                      )}
                      {showKayit && (
                        <Link href="/kayit" onClick={() => setMenuOpen(false)} className="w-full btn-primary justify-center">
                          {t('nav.register')}
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
