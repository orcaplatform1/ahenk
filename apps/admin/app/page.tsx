'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { api } from '@/lib/api';

interface Dashboard {
  totalUsers: number;
  kycPending: number;
  activeMeetingsThisWeek: number;
  pioneerCount: number;
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <p className="text-sm text-muted mb-2">{label}</p>
      <p className="text-4xl font-bold text-text">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Dashboard>('/admin/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell>
      <h1 className="font-serif text-3xl mb-8">Dashboard</h1>
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-surface border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Toplam Kullanıcı" value={data.totalUsers} />
          <StatCard label="KYC Bekleyen" value={data.kycPending} sub="İnceleme bekliyor" />
          <StatCard label="Bu Hafta Masalar" value={data.activeMeetingsThisWeek} />
          <StatCard label="Öncü Kullanıcı" value={data.pioneerCount} sub="Rozetli üye" />
        </div>
      ) : (
        <p className="text-muted text-sm">Veri yüklenemedi.</p>
      )}
    </AdminShell>
  );
}
