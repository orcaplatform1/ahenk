'use client';

import { AdminShell } from '@/components/AdminShell';
import { AdminQualityControl } from '@ahenk/ui';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function QualityPage() {
  return (
    <AdminShell>
      <QualityContent />
    </AdminShell>
  );
}

function QualityContent() {
  const token = typeof window !== 'undefined' ? api.getToken() : null;

  return (
    <div style={{ padding: 24, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
          Kalite Kontrol
        </h1>
      </div>
      <AdminQualityControl
        apiBase={`${API_BASE}/api/v1`}
        token={token ?? undefined}
      />
    </div>
  );
}
