'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MasalarDashboard } from '@ahenk/ui';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = api.getToken();
    if (!t) {
      router.replace('/giris');
      return;
    }
    setToken(t);
    setMounted(true);
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#f5f5f5] pt-[52px]">
      {/* Arka plan glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 70% 30%, rgba(192,57,43,0.1) 0%, transparent 70%)' }}
      />

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-[#f5f5f5] mb-1">Bu Haftanın Masası</h1>
          <p className="text-sm text-[#888]">Algoritmik eşleştirmenizin detayları aşağıda.</p>
        </div>

        <MasalarDashboard
          apiBase={`${API_BASE}/api/v1`}
          token={token ?? undefined}
        />

        {/* Hızlı linkler */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/profil/gecmis"
            className="group glass-card p-5 transition-all hover:border-[rgba(192,57,43,0.4)]"
            style={{ display: 'block' }}
          >
            <h3 className="text-sm font-semibold text-[#f5f5f5] mb-1 group-hover:text-[#ff6b6b] transition-colors">
              Ahenk Geçmişim →
            </h3>
            <p className="text-xs text-[#888]">Önceki buluşmalarını ve uyumluluk skorlarını görün.</p>
          </Link>
          <Link
            href="/profil?tab=paket"
            className="group glass-card p-5 transition-all hover:border-[rgba(192,57,43,0.4)]"
            style={{ display: 'block' }}
          >
            <h3 className="text-sm font-semibold text-[#f5f5f5] mb-1 group-hover:text-[#ff6b6b] transition-colors">
              Aboneliğim →
            </h3>
            <p className="text-xs text-[#888]">Aktif paketini ve yenileme tarihlerini görün.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
