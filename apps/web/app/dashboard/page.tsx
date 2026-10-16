'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MasalarDashboard, buildInitials } from '@ahenk/ui';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const SCAN_CLR = '#c0392b';
const RADAR_SZ = 320;
const CX = RADAR_SZ / 2;
const CY = RADAR_SZ / 2;
const ORBIT_R = 118;

function buildFreeSweepPath(): string {
  const startRad = (-160 * Math.PI) / 180;
  const sx = CX + ORBIT_R * Math.cos(startRad);
  const sy = CY + ORBIT_R * Math.sin(startRad);
  return `M ${CX},${CY} L ${sx.toFixed(1)},${sy.toFixed(1)} A ${ORBIT_R},${ORBIT_R} 0 0,1 ${CX},${CY - ORBIT_R} Z`;
}

const FREE_SWEEP_PATH = buildFreeSweepPath();

function FreeScanView() {
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: '28px 20px 28px',
    maxWidth: 380,
    margin: '0 auto',
  };

  return (
    <div style={cardStyle}>
      <style>{`
        @keyframes ahenkSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ahenkDot { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
          fontSize: 22, fontWeight: 400, color: '#f5f5f5',
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px',
        }}>
          GRUP MASASI
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: SCAN_CLR,
            animation: 'ahenkDot 1.2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            color: SCAN_CLR, fontFamily: 'Inter, sans-serif',
          }}>
            TARAMA DEVAM EDİYOR
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', width: RADAR_SZ, height: RADAR_SZ, margin: '0 auto' }}>
        <svg
          width={RADAR_SZ} height={RADAR_SZ}
          viewBox={`0 0 ${RADAR_SZ} ${RADAR_SZ}`}
          style={{ display: 'block' }}
        >
          {[30, 62, 93, ORBIT_R].map((r, i) => (
            <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={SCAN_CLR}
              strokeWidth={i === 3 ? 1 : 0.8} opacity={i === 3 ? 0.35 : 0.18} />
          ))}
          <line x1={CX} y1={CY - ORBIT_R - 8} x2={CX} y2={CY + ORBIT_R + 8}
            stroke={SCAN_CLR} strokeWidth={0.6} opacity={0.14} />
          <line x1={CX - ORBIT_R - 8} y1={CY} x2={CX + ORBIT_R + 8} y2={CY}
            stroke={SCAN_CLR} strokeWidth={0.6} opacity={0.14} />
          <circle cx={CX} cy={CY} r={5} fill={SCAN_CLR} opacity={0.85} />
          <defs>
            <radialGradient id="freeSweepRG" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={SCAN_CLR} stopOpacity={0} />
              <stop offset="45%"  stopColor={SCAN_CLR} stopOpacity={0.05} />
              <stop offset="100%" stopColor={SCAN_CLR} stopOpacity={0.28} />
            </radialGradient>
          </defs>
          <g style={{
            animation: 'ahenkSweep 1.8s linear infinite',
            transformOrigin: `${CX}px ${CY}px`,
          }}>
            <path d={FREE_SWEEP_PATH} fill="url(#freeSweepRG)" />
            <line x1={CX} y1={CY} x2={CX} y2={CY - ORBIT_R}
              stroke={SCAN_CLR} strokeWidth={1.5} opacity={0.9} />
            <circle cx={CX} cy={CY - ORBIT_R} r={3.5} fill={SCAN_CLR} />
          </g>
        </svg>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20, padding: '0 8px' }}>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#999',
          lineHeight: 1.65, margin: '0 0 8px',
        }}>
          Tarama devam ediyor. Kişilik testi ve yaş ortalamanıza uygun kişiler masalara eşleştiriliyor.
        </p>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13,
          color: SCAN_CLR, fontWeight: 600, margin: '0 0 22px',
        }}>
          Elini çabuk tut, sen de katıl.
        </p>
        <Link
          href="/profil?tab=paket"
          style={{
            display: 'inline-block',
            padding: '10px 28px',
            background: 'rgba(192,57,43,0.15)',
            border: `1px solid rgba(192,57,43,0.45)`,
            borderRadius: 12,
            color: '#ff6b6b',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          Abonelik Al
        </Link>
      </div>
    </div>
  );
}

interface MeData {
  firstName: string;
  lastName: string;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
  profile?: { gender?: string | null };
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = api.getToken();
    if (!t) { router.replace('/giris'); return; }
    setToken(t);
    api.get<MeData>('/auth/me')
      .then(setMe)
      .catch(() => {})
      .finally(() => setMounted(true));
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  const pageWrapper = (content: React.ReactNode) => (
    <div className="min-h-screen bg-[#0A0A0A] text-[#f5f5f5] pt-[52px]">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 70% 30%, rgba(192,57,43,0.1) 0%, transparent 70%)' }}
      />
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-[#f5f5f5] mb-1">Bu Haftanın Masası</h1>
          <p className="text-sm text-[#888]">Algoritmik eşleştirmenizin detayları aşağıda.</p>
        </div>
        {content}
      </main>
    </div>
  );

  if (!me?.activePlan) {
    return pageWrapper(<FreeScanView />);
  }

  const selfParticipant = me
    ? { initials: buildInitials(me.firstName, me.lastName), gender: me.profile?.gender ?? null }
    : undefined;

  return pageWrapper(
    <MasalarDashboard
      apiBase={`${API_BASE}/api/v1`}
      token={token ?? undefined}
      selfParticipant={selfParticipant}
      activePlan={me.activePlan}
    />
  );
}
