'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface OverviewStats {
  totalRevenue: number;
  netCommission: number;
  activeUsers: number;
  kycPending: number;
  matchRateThisWeek: number;
  referralRegisteredCount?: number;
  referralTotalDiscountTL?: number;
}

export interface CityStats {
  city: string;
  totalTables: number;
  activeMembers: number;
  revenue: number;
  trend: string;
}

interface Props {
  apiBase?: string;
  token?: string;
}

const MOCK_OVERVIEW: OverviewStats = {
  totalRevenue: 43618,
  netCommission: 6542.7,
  activeUsers: 1248,
  kycPending: 23,
  matchRateThisWeek: 12,
  referralRegisteredCount: 0,
  referralTotalDiscountTL: 0,
};

const MOCK_CITIES: CityStats[] = [
  { city: 'İstanbul',  totalTables: 47, activeMembers: 640, revenue: 22330, trend: '+14%' },
  { city: 'Ankara',    totalTables: 18, activeMembers: 218, revenue: 7602,  trend: '+8%'  },
  { city: 'İzmir',     totalTables: 15, activeMembers: 187, revenue: 6513,  trend: '+3%'  },
  { city: 'Antalya',   totalTables: 8,  activeMembers: 94,  revenue: 3282,  trend: '0%'   },
  { city: 'Muğla',     totalTables: 5,  activeMembers: 61,  revenue: 2128,  trend: '-2%'  },
  { city: 'Aydın',     totalTables: 3,  activeMembers: 30,  revenue: 1047,  trend: '0%'   },
  { city: 'Balıkesir', totalTables: 2,  activeMembers: 18,  revenue: 698,   trend: '0%'   },
];

async function fetchJSON<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('fetch failed');
  return res.json() as Promise<T>;
}

export function AdminStatsDashboard({ apiBase = '', token }: Props) {
  const [overview, setOverview] = useState<OverviewStats>(MOCK_OVERVIEW);
  const [cities,   setCities]   = useState<CityStats[]>(MOCK_CITIES);

  useEffect(() => {
    if (!apiBase) return;

    function load() {
      fetchJSON<OverviewStats>(`${apiBase}/api/v1/admin/stats/overview`, token).then(setOverview).catch(() => {});
      fetchJSON<CityStats[]>(`${apiBase}/api/v1/admin/stats/cities`, token).then(setCities).catch(() => {});
    }

    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [apiBase, token]);

  const maxMembers = Math.max(...cities.map((c) => c.activeMembers), 1);

  const METRICS = [
    { label: 'Toplam Gelir',      value: `₺${overview.totalRevenue.toLocaleString('tr-TR')}`, color: '#c0392b' },
    { label: 'Net Komisyon',      value: `₺${overview.netCommission.toLocaleString('tr-TR')}`, color: '#b5651d' },
    { label: 'Aktif Kullanıcı',   value: overview.activeUsers.toLocaleString('tr-TR'),         color: '#c0392b' },
    { label: 'KYC Bekleyen',      value: overview.kycPending.toLocaleString('tr-TR'),           color: '#888888' },
  ];

  const trendColor = (t: string) => {
    if (t.startsWith('+')) return '#4ade80';
    if (t.startsWith('-')) return '#f87171';
    return '#888888';
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 4 Metrik kartı — glassmorphism */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 200, damping: 22 }}
            className="relative overflow-hidden rounded-2xl border border-border p-5"
            style={{ background: 'rgba(20,20,20,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ background: `radial-gradient(circle at 80% 20%, ${m.color}, transparent 70%)` }} />
            <p className="text-xs text-muted mb-2">{m.label}</p>
            <motion.p
              className="text-2xl font-bold text-text"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 + 0.15 }}
            >
              {m.value}
            </motion.p>
          </motion.div>
        ))}
      </div>

      {/* Sadakat Programı kartı */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 22 }}
        className="relative overflow-hidden rounded-2xl border border-border p-5"
        style={{ background: 'rgba(20,20,20,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 20%, #c0392b, transparent 70%)' }} />
        <p className="text-xs text-muted uppercase tracking-wide mb-4">Sadakat Programı</p>
        <div className="flex gap-8">
          <div>
            <p className="text-xs text-muted mb-1">Davet ile Kayıt</p>
            <p className="text-2xl font-bold text-text">
              {(overview.referralRegisteredCount ?? 0).toLocaleString('tr-TR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Toplam İndirim</p>
            <p className="text-2xl font-bold text-text">
              ₺{(overview.referralTotalDiscountTL ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Haftalık eşleşme oranı */}
      <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted mb-1">Bu Hafta Eşleşme Oranı</p>
          <p className="text-3xl font-bold" style={{ color: trendColor(overview.matchRateThisWeek >= 0 ? `+${overview.matchRateThisWeek}` : String(overview.matchRateThisWeek)) }}>
            {overview.matchRateThisWeek >= 0 ? '+' : ''}{overview.matchRateThisWeek}%
          </p>
        </div>
        <p className="text-xs text-muted">geçen haftaya göre</p>
      </div>

      {/* Şehir tablosu */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="text-sm text-muted uppercase tracking-wide mb-4">Şehir Dağılımı</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs uppercase tracking-wide border-b border-border">
                <th className="pb-2 pr-4">Şehir</th>
                <th className="pb-2 pr-4">Masalar</th>
                <th className="pb-2 pr-4">Üyeler</th>
                <th className="pb-2 pr-4">Gelir</th>
                <th className="pb-2">Trend</th>
              </tr>
            </thead>
            <tbody>
              {cities.map((c, i) => (
                <motion.tr
                  key={c.city}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-3 pr-4 text-text font-medium">{c.city}</td>
                  <td className="py-3 pr-4 text-muted">{c.totalTables}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-text">{c.activeMembers}</span>
                      <div className="h-1 flex-1 max-w-16 bg-bg rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full"
                          style={{ background: 'linear-gradient(90deg, #c0392b, #b5651d)' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(c.activeMembers / maxMembers) * 100}%` }}
                          transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted">₺{c.revenue.toLocaleString('tr-TR')}</td>
                  <td className="py-3 font-medium text-sm" style={{ color: trendColor(c.trend) }}>{c.trend}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
