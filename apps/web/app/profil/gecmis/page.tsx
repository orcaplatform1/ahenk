'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AhenkHistory } from '@ahenk/ui';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co';

export default function GecmisPage() {
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
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-[#f5f5f5]">
      <header className="sticky top-0 z-40 bg-[#121212]/80 backdrop-blur-md border-b border-[#1f1f1f]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[#888] hover:text-[#f5f5f5] transition-colors">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.webp" alt="Ahenk" width={26} height={26} className="rounded-full" />
              <span className="font-sans font-semibold tracking-[0.1em] text-sm">AHENK</span>
            </Link>
          </div>
          <h1 className="font-serif text-lg">Geçmişim</h1>
        </div>
      </header>

      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 40% 50% at 80% 20%, rgba(192,57,43,0.08) 0%, transparent 70%)' }}
      />

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <AhenkHistory
          apiBase={`${API_BASE}/api/v1`}
          token={token ?? undefined}
        />
      </main>
    </div>
  );
}
