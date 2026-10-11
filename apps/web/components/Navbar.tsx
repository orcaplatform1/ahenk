'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// SIZE=36 → R=18, BORDER_R=16.5, CIRCUMF=2π×16.5≈103.67
const AV_SIZE  = 36;
const AV_R     = AV_SIZE / 2;               // 18
const AV_BR    = AV_R - 1.5;               // 16.5
const AV_CIRC  = +(2 * Math.PI * AV_BR).toFixed(2); // 103.67

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
    color:  '#4fc3f7',
    bg:     'rgba(79,195,247,0.12)',
    glow:   'drop-shadow(0 0 5px rgba(79,195,247,0.5))',
    pulse:  '_avPulseM 2.4s ease-in-out 1.2s infinite',
  };
  if (gender === 'FEMALE') return {
    color:  '#f48fb1',
    bg:     'rgba(244,143,177,0.12)',
    glow:   'drop-shadow(0 0 5px rgba(244,143,177,0.45))',
    pulse:  '_avPulseF 2.8s ease-in-out 1.2s infinite',
  };
  return {
    color:  'rgba(255,255,255,0.35)',
    bg:     'rgba(255,255,255,0.05)',
    glow:   'none',
    pulse:  '_avPulseM 2.4s ease-in-out 1.2s infinite',
  };
}

function NavAvatar({ user }: { user: NavUser }) {
  const theme = genderTheme(user.profile?.gender);
  return (
    <div style={{ position: 'relative', width: AV_SIZE, height: AV_SIZE, flexShrink: 0 }}>
      <svg
        width={AV_SIZE} height={AV_SIZE}
        viewBox={`0 0 ${AV_SIZE} ${AV_SIZE}`}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {/* Arka plan dairesi */}
        <circle cx={AV_R} cy={AV_R} r={AV_R - 1} fill={theme.bg} />

        {/* Draw-in border (stroke-dashoffset animasyonu) */}
        <circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none"
          stroke={theme.color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={AV_CIRC}
          style={{
            transform: `rotate(-90deg)`,
            transformOrigin: `${AV_R}px ${AV_R}px`,
            animation: `_avDraw 0.85s ease-out 0.1s forwards`,
          }}
        />

        {/* Pulse glow ring */}
        <circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none"
          stroke={theme.color}
          strokeWidth={1.5}
          style={{
            filter: theme.glow,
            animation: theme.pulse,
          }}
        />
      </svg>

      {/* Baş harfler */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600, color: '#ffffff',
        letterSpacing: '0.05em', userSelect: 'none', pointerEvents: 'none',
      }}>
        {initials(user)}
      </div>
    </div>
  );
}

export default function Navbar() {
  const [navUser, setNavUser] = useState<NavUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (!token) { setChecked(true); return; }
    api.get<NavUser>('/auth/me')
      .then(u => setNavUser(u))
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border">
      <style>{`
        @keyframes _avDraw {
          from { stroke-dashoffset: ${AV_CIRC}; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes _avPulseM {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
        @keyframes _avPulseF {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.95; }
        }
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

      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.webp" alt="Ahenk" width={36} height={36} className="rounded-full" />
          <span className="font-sans font-semibold text-lg tracking-[0.12em] text-text">AHENK</span>
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
