'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { ToastProvider } from './Toast';
import { api } from '@/lib/api';

interface Me { role: string; }

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.replace('/giris'); return; }
    api.get<Me>('/auth/me')
      .then((me) => {
        if (me.role !== 'ADMIN' && me.role !== 'SUPERADMIN') {
          api.clearToken();
          router.replace('/giris');
        } else {
          setReady(true);
        }
      })
      .catch(() => { api.clearToken(); router.replace('/giris'); });
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted text-sm">Yükleniyor…</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
