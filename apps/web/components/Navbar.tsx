'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

const AV_D    = 38;
const AV_R    = AV_D / 2;
const AV_BR   = AV_R - 2;
const AV_CIRC = +(2 * Math.PI * AV_BR).toFixed(2);

interface NavUser {
  firstName: string;
  lastName: string;
  profile?: { gender?: string };
}

function initials(u: NavUser) {
  const f = u.firstName?.[0]?.toUpperCase() ?? '?';
  const l = u.lastName?.[0]?.toUpperCase() ?? '?';
  return `${f}.${l}.`;
}

function genderTheme(gender?: string) {
  if (gender === 'MALE') return {
    color:    '#4fc3f7',
    bg:       'rgba(79,195,247,0.12)',
    shadow:   'drop-shadow(0 0 5px rgba(79,195,247,0.5))',
    pulseMin: 0.45,
    pulseMax: 1.0,
    pulseDur: 2.4,
  };
  if (gender === 'FEMALE') return {
    color:    '#f48fb1',
    bg:       'rgba(244,143,177,0.12)',
    shadow:   'drop-shadow(0 0 5px rgba(244,143,177,0.45))',
    pulseMin: 0.4,
    pulseMax: 0.95,
    pulseDur: 2.8,
  };
  return {
    color:    'rgba(255,255,255,0.4)',
    bg:       'rgba(255,255,255,0.06)',
    shadow:   'drop-shadow(0 0 4px rgba(255,255,255,0.2))',
    pulseMin: 0.3,
    pulseMax: 0.7,
    pulseDur: 2.6,
  };
}

function NavAvatar({ user }: { user: NavUser }) {
  const t = genderTheme(user.profile?.gender);
  return (
    <div style={{ position: 'relative', width: AV_D, height: AV_D, flexShrink: 0 }}>
      <svg
        width={AV_D} height={AV_D}
        viewBox={`0 0 ${AV_D} ${AV_D}`}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {/* Arka plan */}
        <circle cx={AV_R} cy={AV_R} r={AV_R - 1} fill={t.bg} />

        {/* Draw-in border */}
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none"
          stroke={t.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={AV_CIRC}
          style={{ rotate: '-90deg', transformOrigin: `${AV_R}px ${AV_R}px` }}
          initial={{ strokeDashoffset: AV_CIRC }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ delay: 0.1, duration: 0.85, ease: 'easeOut' }}
        />

        {/* Pulse glow ring */}
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none"
          stroke={t.color}
          strokeWidth={2.5}
          style={{ filter: t.shadow }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [t.pulseMin, t.pulseMax, t.pulseMin] }}
          transition={{
            delay: 1.05,
            duration: t.pulseDur,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </svg>

      {/* Baş harfler */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#f0f0f0',
        letterSpacing: '0.05em', userSelect: 'none',
      }}>
        {initials(user)}
      </div>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [navUser, setNavUser] = useState<NavUser | null>(null);
  const [checked, setChecked] = useState(false);

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border">
      <style>{`
        @keyframes _gBtn {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .nav-giris {
          background: linear-gradient(135deg,#c0392b,#ff6b6b,#c0392b);
          background-size: 200% 200%;
          animation: _gBtn 2.5s ease infinite;
          color: #fff; border-radius: 9999px; font-weight: 500; transition: opacity .15s;
        }
        .nav-giris:hover { opacity: .85; }
        .nav-kayit {
          background: linear-gradient(135deg,#1a5c2a,#27ae60,#1a5c2a);
          background-size: 200% 200%;
          animation: _gBtn 2.5s ease infinite;
          color: #fff; border-radius: 9999px; font-weight: 500; transition: opacity .15s;
        }
        .nav-kayit:hover { opacity: .85; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 h-[52px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.webp" alt="Ahenk" width={28} height={28} className="rounded-full" />
          <span className="font-sans font-semibold text-sm tracking-[0.12em] text-text">AHENK</span>
        </Link>

        {/* Orta linkler */}
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
        <div className="flex items-center gap-2 sm:gap-3">
          {!checked ? null : navUser ? (
            <Link href="/profil" className="cursor-pointer">
              <NavAvatar user={navUser} />
            </Link>
          ) : (
            <>
              <Link href="/giris" className="nav-giris px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
                Giriş Yap
              </Link>
              <Link href="/kayit" className="nav-kayit px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
                Kayıt Ol
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
