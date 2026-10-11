'use client';

import { AdminShell } from '@/components/AdminShell';
import { AdminStatsDashboard } from '@ahenk/ui';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function StatsPage() {
  return (
    <AdminShell>
      <StatsContent />
    </AdminShell>
  );
}

function StatsContent() {
  const token = typeof window !== 'undefined' ? api.getToken() : null;

  return (
    <div className="p-6 min-h-screen">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-[#f5f5f5]">İstatistikler</h1>
        <p className="text-sm text-[#888] mt-1">Platform metrikleri ve şehir bazlı dağılım.</p>
      </div>
      <AdminStatsDashboard
        apiBase={`${API_BASE}/api/v1`}
        token={token ?? undefined}
      />
    </div>
  );
}
