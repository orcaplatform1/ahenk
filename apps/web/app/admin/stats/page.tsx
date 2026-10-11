'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface CityRow { city: string; tables: number; members: number; revenue: number; trend: number; }
interface PkgRow  { name: string; count: number; percentage: number; }

interface StatsOverview {
  cycle:            { name: string; active: boolean };
  revenue:          { gross: number };
  activeMembers:    number;
  meetings:         { total: number; group: number; oneOnOne: number };
  algorithmSuccess: number;
  cityStats:        CityRow[];
  packages:         PkgRow[];
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

/* ── Trend badge ───────────────────────────────────────────────── */
function Trend({ v }: { v: number }) {
  if (v === 0) return <span className="text-[#555] text-xs">—</span>;
  const up = v > 0;
  return (
    <span className="text-xs font-medium" style={{ color: up ? '#4ade80' : '#ff6b6b' }}>
      {up ? '▲' : '▼'} {Math.abs(v)}%
    </span>
  );
}

export default function AdminStats() {
  const [data, setData] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<StatsOverview>('/admin/stats/overview')
      .then(setData)
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
        {data && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#888]">{data.cycle.name}</span>
            <span
              className="text-xs px-3 py-1 rounded-full font-medium"
              style={data.cycle.active
                ? { background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#666' }}
            >
              {data.cycle.active ? 'Aktif' : 'Pasif'}
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-[#ff6b6b] text-sm mb-6">{error}</p>}

      {/* Metrik kartlar */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0,1,2,3].map(i => <Skel key={i} h="h-28" />)}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Brüt Ciro"
            value={data.revenue.gross}
            prefix="₺"
            fmt={(n) => n.toLocaleString('tr-TR')}
          />
          <MetricCard
            label="Aktif Üye"
            value={data.activeMembers}
          />
          <MetricCard
            label="Kurulan Masa"
            value={data.meetings.total}
            sub={`Grup: ${data.meetings.group} · Başbaşa: ${data.meetings.oneOnOne}`}
          />
          <MetricCard
            label="Algoritma Başarısı"
            value={data.algorithmSuccess}
            suffix="%"
          />
        </div>
      )}

      {/* Şehir tablosu */}
      <div className="glass-card overflow-hidden mb-8">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Şehir Bazlı Performans</h2>
        </div>
        {loading ? (
          <div className="p-5 flex flex-col gap-3">
            {[0,1,2,3].map(i => <Skel key={i} h="h-10" />)}
          </div>
        ) : data && data.cityStats.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Şehir', 'Masa', 'Üye', 'Ciro', 'Trend'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs text-[#555] uppercase tracking-[0.12em] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cityStats.map((row, i) => (
                <motion.tr
                  key={row.city}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3, ease: 'easeOut' }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td className="px-5 py-3.5 text-sm text-[#f5f5f5] font-medium">{row.city}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">{row.tables}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">{row.members}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">₺{row.revenue.toLocaleString('tr-TR')}</td>
                  <td className="px-5 py-3.5"><Trend v={row.trend} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        ) : !loading && (
          <p className="p-6 text-sm text-[#555]">Veri yok.</p>
        )}
      </div>

      {/* Paket dağılımı */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-[#f5f5f5] mb-5">Paket Dağılımı</h2>
        {loading ? (
          <div className="flex flex-col gap-4">
            {[0,1,2].map(i => <Skel key={i} h="h-8" />)}
          </div>
        ) : data && (
          <div className="flex flex-col gap-4">
            {data.packages.map((pkg) => (
              <div key={pkg.name}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-[#ccc]">{pkg.name}</span>
                  <span className="text-xs text-[#666]">{pkg.count} üye · %{pkg.percentage}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#c0392b,#ff6b6b)' }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${pkg.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
