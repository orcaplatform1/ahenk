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

const MUTED = '#64748b';
const TEXT  = '#e2e8f0';
const SANS  = 'Inter, system-ui, sans-serif';

function StatsContent() {
  const token = typeof window !== 'undefined' ? api.getToken() : null;

  return (
    <div style={{ padding: 24, minHeight: '100vh', fontFamily: SANS }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
          İstatistikler
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
          Platform metrikleri ve şehir bazlı dağılım.
        </p>
      </div>
      <AdminStatsDashboard
        apiBase={`${API_BASE}/api/v1`}
        token={token ?? undefined}
      />
    </div>
  );
}
