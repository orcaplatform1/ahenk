'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

/* ── Avatar ─────────────────────────────────────────────────────────── */
const AV_D    = 36;
const AV_R    = AV_D / 2;
const AV_BR   = AV_R - 2;
const AV_CIRC = +(2 * Math.PI * AV_BR).toFixed(2);

interface NavUser { firstName: string; lastName: string; profile?: { gender?: string }; }

function initials(u: NavUser) {
  return `${u.firstName?.[0]?.toUpperCase() ?? '?'}.${u.lastName?.[0]?.toUpperCase() ?? '?'}.`;
}

function genderTheme(g?: string) {
  if (g === 'MALE')   return { color: '#4fc3f7', bg: 'rgba(79,195,247,0.12)',  shadow: 'drop-shadow(0 0 5px rgba(79,195,247,0.5))',   pulseMin: 0.45, pulseMax: 1.0,  pulseDur: 2.4 };
  if (g === 'FEMALE') return { color: '#f48fb1', bg: 'rgba(244,143,177,0.12)', shadow: 'drop-shadow(0 0 5px rgba(244,143,177,0.45))', pulseMin: 0.4,  pulseMax: 0.95, pulseDur: 2.8 };
  return { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)', shadow: 'drop-shadow(0 0 4px rgba(255,255,255,0.2))', pulseMin: 0.3, pulseMax: 0.7, pulseDur: 2.6 };
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
      {/* Sol: renkli label */}
      <span
        className="flex items-center justify-center whitespace-nowrap"
        style={{
          height: '30px',
          padding: '0 10px',
          borderRadius: '999px',
          background: leftBg,
          color: '#FFF7F4',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.14)',
          flexShrink: 0,
        }}
      >
        <span className="hidden sm:inline" style={{ fontSize: '12px' }}>{label}</span>
        <span className="sm:hidden" style={{ fontSize: '10px' }}>{label}</span>
      </span>
      {/* Sağ: ikon */}
      <span
        className="flex items-center justify-center"
        style={{
          width: '30px',
          height: '30px',
          flexShrink: 0,
          color: '#F7D9D5',
        }}
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

/* ── Navbar ──────────────────────────────────────────────────────────── */
export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [navUser,  setNavUser]  = useState<NavUser | null>(null);
  const [checked,  setChecked]  = useState(false);

  useEffect(() => {
    setNavUser(null);
    setChecked(false);
    const token = api.getToken();
    if (!token) { setChecked(true); return; }
    api.get<NavUser>('/auth/me')
      .then(u => setNavUser(u))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [pathname]);

  function handleLogout() {
    api.clearToken();
    router.push('/');
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-[52px] flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <Image src="/logo.webp" alt="Ahenk" width={28} height={28} className="rounded-full" />
          <span className="font-sans font-semibold text-sm tracking-[0.12em] text-text">AHENK</span>
        </Link>

        {/* Orta linkler — sadece desktop */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: 'Nasıl Çalışır?', href: '#how-it-works' },
            { label: 'Buluşmalar',     href: '#cities' },
            { label: 'Test',           href: '/kayit' },
            { label: 'Hakkımızda',     href: '#faq' },
          ].map(item => (
            <a key={item.label} href={item.href} className="text-sm text-muted hover:text-text transition-colors">
              {item.label}
            </a>
          ))}
        </div>

        {/* Sağ alan */}
        <div className="flex items-center gap-2">
          {!checked ? null : navUser ? (
            /* Giriş yapmış: Avatar + Çıkış Yap */
            <>
              <Link href="/profil" className="cursor-pointer flex-shrink-0">
                <NavAvatar user={navUser} />
              </Link>
              <CapsuleBtn
                label="Çıkış Yap"
                leftBg="linear-gradient(115deg,#1a1a1a 0%,#111 100%)"
                outerBorder="rgba(255,255,255,0.18)"
                outerGlow="inset 0 1px 1px rgba(255,255,255,0.05), 0 0 6px rgba(255,255,255,0.06), 0 0 14px rgba(255,255,255,0.04)"
                icon={IkonCikis}
                onClick={handleLogout}
              />
            </>
          ) : (
            /* Giriş yapmamış: Giriş Yap + Kayıt Ol */
            <>
              <CapsuleBtn
                label="Giriş Yap"
                href="/giris"
                leftBg="linear-gradient(115deg,#1a5c2a 0%,#27ae60 100%)"
                outerBorder="rgba(39,174,96,0.75)"
                outerGlow="inset 0 1px 1px rgba(255,255,255,0.08), 0 0 6px rgba(39,174,96,0.22), 0 0 16px rgba(39,174,96,0.12)"
                icon={IkonGiris}
              />
              <CapsuleBtn
                label="Kayıt Ol"
                href="/kayit"
                leftBg="linear-gradient(115deg,#E83F3D 0%,#FF6669 100%)"
                outerBorder="rgba(255,85,90,0.8)"
                outerGlow="inset 0 1px 1px rgba(255,125,110,0.10), 0 0 6px rgba(255,55,65,0.22), 0 0 16px rgba(255,45,55,0.12)"
                icon={IkonKayit}
              />
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
