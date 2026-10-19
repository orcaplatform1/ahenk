'use client';

import { AdminShell } from '@/components/AdminShell';
import { AdminMatchManager } from '@ahenk/ui';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function MatchesPage() {
  return (
    <AdminShell>
      <MatchesContent />
    </AdminShell>
  );
}

function MatchesContent() {
  const token = typeof window !== 'undefined' ? api.getToken() : null;

  return (
    <div className="p-6 min-h-screen">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-[#f5f5f5]">Eşleştirme Yönetimi</h1>
        <p className="text-sm text-muted mt-1">Bekleyen masaları incele, onayla veya bot ekle.</p>
      </div>
      <AdminMatchManager
        apiBase={`${API_BASE}/api/v1`}
        token={token ?? undefined}
      />
    </div>
  );
}
