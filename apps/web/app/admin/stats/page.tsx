'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface StatsOverview {
  totalRevenue: number;
  netCommission: number;
  activeUsers: number;
  kycPending: number;
  matchRateThisWeek: number;
  referralRegisteredCount: number;
  referralTotalDiscountTL: number;
}

interface CityRow {
  city: string;
  totalTables: number;
  activeMembers: number;
  revenue: number;
  trend: string;
}

/* ── Count-up hook ─────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1200, enabled = true) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!enabled || target === 0) { setVal(target); return; }
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(e * target));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, enabled]);
  return val;
}

/* ── Metrik kartı ──────────────────────────────────────────────── */
function MetricCard({ label, value, sub, prefix = '', suffix = '', fmt }: {
  label: string; value: number; sub?: string; prefix?: string; suffix?: string;
  fmt?: (n: number) => string;
}) {
  const displayed = useCountUp(value, 1200, value > 0);
  return (
    <div className="glass-card p-5 flex flex-col gap-1">
      <p className="text-xs text-[#555] uppercase tracking-[0.14em]">{label}</p>
      <p className="font-serif text-3xl text-[#f5f5f5] leading-tight">
        {prefix}{fmt ? fmt(displayed) : displayed.toLocaleString('tr-TR')}{suffix}
      </p>
      {sub && <p className="text-xs text-[#666] mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────── */
function Skel({ h = 'h-24' }: { h?: string }) {
  return <div className={`${h} rounded-2xl animate-pulse`} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />;
}

export default function AdminStats() {
  const [data, setData] = useState<StatsOverview | null>(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<StatsOverview>('/admin/stats/overview'),
      api.get<CityRow[]>('/admin/stats/cities').catch(() => [] as CityRow[]),
    ])
      .then(([overview, cityRows]) => {
        setData(overview);
        setCities(cityRows);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs text-[#555] uppercase tracking-[0.14em]">Admin</p>
          <h1 className="font-serif text-2xl text-[#f5f5f5]">İstatistikler</h1>
        </div>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm mb-6">{error}</p>}

      {/* Metrik kartlar */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0,1,2,3].map(i => <Skel key={i} h="h-28" />)}
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricCard
              label="Brüt Ciro"
              value={data.totalRevenue}
              prefix="₺"
              fmt={(n) => n.toLocaleString('tr-TR')}
            />
            <MetricCard
              label="Net Komisyon"
              value={data.netCommission}
              prefix="₺"
              fmt={(n) => n.toLocaleString('tr-TR')}
            />
            <MetricCard
              label="Aktif Üye"
              value={data.activeUsers}
            />
            <MetricCard
              label="KYC Bekleyen"
              value={data.kycPending}
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <MetricCard
              label="Haftalık Eşleşme Değişimi"
              value={data.matchRateThisWeek}
              suffix="%"
            />
            <MetricCard
              label="Referans Kayıt"
              value={data.referralRegisteredCount}
            />
            <MetricCard
              label="Toplam Referans İndirimi"
              value={data.referralTotalDiscountTL}
              prefix="₺"
              fmt={(n) => n.toLocaleString('tr-TR')}
            />
          </div>
        </>
      )}

      {/* Şehir tablosu */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Şehir Bazlı Performans</h2>
        </div>
        {loading ? (
          <div className="p-5 flex flex-col gap-3">
            {[0,1,2,3].map(i => <Skel key={i} h="h-10" />)}
          </div>
        ) : cities.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Şehir', 'Masa', 'Üye', 'Ciro', 'Trend'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs text-[#555] uppercase tracking-[0.12em] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cities.map((row, i) => (
                <motion.tr
                  key={row.city}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3, ease: 'easeOut' }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td className="px-5 py-3.5 text-sm text-[#f5f5f5] font-medium">{row.city}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">{row.totalTables}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">{row.activeMembers}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">₺{row.revenue.toLocaleString('tr-TR')}</td>
                  <td className="px-5 py-3.5 text-sm" style={{ color: row.trend.startsWith('-') ? '#ff6b6b' : '#4ade80' }}>{row.trend}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-[#555]">Veri yok.</p>
        )}
      </div>
    </div>
  );
}
