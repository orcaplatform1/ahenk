'use client';

import { useEffect, useState } from 'react';
import { MasalarDashboard, buildInitials } from '@ahenk/ui';
import { api } from '@/lib/api';
import { AccountTabBar } from '@/components/AccountTabBar';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co';

interface MeData {
  firstName: string;
  lastName: string;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
  profile?: { gender?: string | null };
  kyc?: { status: string };
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // apiFetch 401 alınca refresh token deniyor — localStorage boş olsa bile oturum devam edebilir
    api.get<MeData>('/auth/me')
      .then(u => { setToken(api.getToken()); setMe(u); })
      .catch(() => {})
      .finally(() => setMounted(true));
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  const selfParticipant = me
    ? { initials: buildInitials(me.firstName, me.lastName), gender: me.profile?.gender ?? null }
    : undefined;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#f5f5f5] pt-[52px]">
      <AccountTabBar kycApproved={me?.kyc?.status === 'APPROVED'} />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 70% 30%, rgba(192,57,43,0.1) 0%, transparent 70%)' }}
      />
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-[#f5f5f5] mb-1">Bu Haftanın Masası</h1>
        </div>
        <MasalarDashboard
          apiBase={`${API_BASE}/api/v1`}
          token={token ?? undefined}
          selfParticipant={selfParticipant}
          activePlan={me?.activePlan ?? null}
        />
      </main>
    </div>
  );
}
