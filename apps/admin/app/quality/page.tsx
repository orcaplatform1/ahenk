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
    <div className="p-6 min-h-screen">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-[#f5f5f5]">Kalite Kontrol</h1>
        <p className="text-sm text-muted mt-1">Bekleyen şikayetleri incele, karantina veya ban uygula.</p>
      </div>
      <AdminQualityControl
        apiBase={`${API_BASE}/api/v1`}
        token={token ?? undefined}
      />
    </div>
  );
}
