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

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
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
  }, [target, duration]);
  return val;
}

function BigCard({ label, value, sub, prefix = '', suffix = '', fmt }: {
  label: string; value: number; sub?: string; prefix?: string; suffix?: string;
  fmt?: (n: number) => string;
}) {
  const v = useCountUp(value);
  return (
    <div className="glass-card p-5 flex flex-col gap-1" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.15)' }}>
      <p className="text-xs text-[#888] uppercase tracking-[0.14em] mb-1">{label}</p>
      <p className="font-serif text-3xl font-bold leading-tight" style={{ color: '#c0392b' }}>
        {prefix}{fmt ? fmt(v) : v.toLocaleString('tr-TR')}{suffix}
      </p>
      {sub && <p className="text-xs text-[#666] mt-1">{sub}</p>}
    </div>
  );
}

function SmallCard({ label, value, sub, prefix = '', suffix = '', fmt }: {
  label: string; value: number; sub?: string; prefix?: string; suffix?: string;
  fmt?: (n: number) => string;
}) {
  const v = useCountUp(value);
  return (
    <div className="glass-card p-4 flex flex-col gap-0.5">
      <p className="text-xs text-[#666] uppercase tracking-[0.12em]">{label}</p>
      <p className="text-xl font-semibold text-[#f5f5f5] leading-tight">
        {prefix}{fmt ? fmt(v) : v.toLocaleString('tr-TR')}{suffix}
      </p>
      {sub && <p className="text-xs text-[#555] mt-0.5">{sub}</p>}
    </div>
  );
}

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
      .then(([overview, cityRows]) => { setData(overview); setCities(cityRows); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-[#f5f5f5]">Admin · İstatistikler</h1>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm mb-5">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4"><Skel h="h-28" /><Skel h="h-28" /></div>
          <Skel h="h-28" /><Skel h="h-24" />
        </div>
      ) : data && (
        <>
          {/* Üst: Ciro + Aktif Üye */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <BigCard
              label="Brüt Ciro"
              value={data.totalRevenue}
              prefix="₺"
              fmt={(n) => {
                if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'K';
                return n.toLocaleString('tr-TR');
              }}
              sub={data.matchRateThisWeek !== 0
                ? `${data.matchRateThisWeek > 0 ? '↑' : '↓'} %${Math.abs(data.matchRateThisWeek)} bu hafta`
                : undefined}
            />
            <BigCard
              label="Aktif Üye"
              value={data.activeUsers}
              sub={data.kycPending > 0 ? `${data.kycPending} KYC bekliyor` : undefined}
            />
          </div>

          {/* Referans satırı */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <SmallCard label="Referans Kayıt" value={data.referralRegisteredCount} />
            <SmallCard label="Toplam İndirim" value={data.referralTotalDiscountTL} prefix="₺" fmt={(n) => n.toLocaleString('tr-TR')} />
          </div>
        </>
      )}

      {/* Şehir tablosu */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs text-[#888] uppercase tracking-[0.14em]">Şehir Bazlı Performans</p>
        </div>
        {loading ? (
          <div className="p-5 flex flex-col gap-3">{[0,1,2,3].map(i => <Skel key={i} h="h-10" />)}</div>
        ) : cities.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Şehir', 'Masa', 'Üye', 'Ciro', 'Trend'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs text-[#555] uppercase tracking-[0.1em] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cities.map((row, i) => (
                <motion.tr key={row.city}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td className="px-5 py-3.5 text-sm font-semibold text-[#f5f5f5]">{row.city}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">{row.totalTables}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">{row.activeMembers}</td>
                  <td className="px-5 py-3.5 text-sm text-[#888]">
                    ₺{row.revenue >= 1000
                      ? (row.revenue / 1000).toFixed(1).replace('.', ',') + 'K'
                      : row.revenue.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium"
                    style={{ color: row.trend.startsWith('-') ? '#ff6b6b' : '#4ade80' }}>
                    {row.trend.startsWith('-') ? '↓ ' : '↑ '}{row.trend.replace('-', '')}
                  </td>
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
