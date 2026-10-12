'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface PackageDist {
  masadaPct: number; karsimdaPct: number; icerdePct: number;
  masadaCount: number; karsimdaCount: number; icerdeCount: number;
}

interface StatsOverview {
  totalRevenue: number;
  netCommission: number;
  activeUsers: number;
  kycPending: number;
  matchRateThisWeek: number;
  referralRegisteredCount: number;
  referralTotalDiscountTL: number;
  totalMeetings: number;
  groupMeetings: number;
  oneOnOneMeetings: number;
  algorithmSuccessRate: number;
  packageDistribution: PackageDist;
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
    cancelAnimationFrame(raf.current);
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

function fmtK(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'K';
  return n.toLocaleString('tr-TR');
}

const RED_CARD = {
  background: 'rgba(192,57,43,0.06)',
  border: '1px solid rgba(192,57,43,0.18)',
};

function BigCard({ label, value, sub, prefix = '', fmtFn }: {
  label: string; value: number; sub?: string; prefix?: string; fmtFn?: (n: number) => string;
}) {
  const v = useCountUp(value);
  return (
    <motion.div
      className="glass-card p-5 flex flex-col gap-1"
      style={RED_CARD}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
    >
      <p className="text-xs text-[#888] uppercase tracking-[0.14em] mb-1">{label}</p>
      <p className="font-serif text-3xl font-bold leading-tight" style={{ color: '#c0392b' }}>
        {prefix}{fmtFn ? fmtFn(v) : v.toLocaleString('tr-TR')}
      </p>
      {sub && <p className="text-xs text-[#666] mt-1">{sub}</p>}
    </motion.div>
  );
}

function MasaCard({ total, group, oneOnOne }: { total: number; group: number; oneOnOne: number }) {
  const vTotal = useCountUp(total);
  const vGroup = useCountUp(group);
  const vOne = useCountUp(oneOnOne);
  return (
    <motion.div
      className="glass-card p-5 flex flex-col gap-3"
      style={RED_CARD}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
    >
      <p className="text-xs text-[#888] uppercase tracking-[0.14em]">Kurulan Masa</p>
      <p className="font-serif text-4xl font-bold" style={{ color: '#c0392b' }}>{vTotal.toLocaleString('tr-TR')}</p>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-[#555] mb-1">Grup</p>
          <p className="text-xl font-semibold text-[#f5f5f5]">{vGroup.toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-[#555] mb-1">Başbaşa</p>
          <p className="text-xl font-semibold text-[#f5f5f5]">{vOne.toLocaleString('tr-TR')}</p>
        </div>
      </div>
    </motion.div>
  );
}

function AlgoCard({ rate }: { rate: number }) {
  const v = useCountUp(rate);
  return (
    <motion.div
      className="glass-card p-5 flex flex-col gap-2"
      style={RED_CARD}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
    >
      <p className="text-xs text-[#888] uppercase tracking-[0.14em]">Algoritma Başarısı</p>
      <p className="font-serif text-4xl font-bold" style={{ color: '#c0392b' }}>%{v}</p>
      <p className="text-xs text-[#555]">Tamamlanan / toplam masa oranı</p>
    </motion.div>
  );
}

function PackageBar({ label, pct, count, delay }: { label: string; pct: number; count: number; delay: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#ccc]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#555]">{count} abone</span>
          <span className="text-sm font-medium text-[#f5f5f5]">%{pct}</span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg,#c0392b,#ff6b6b)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function Skel({ h = 'h-24' }: { h?: string }) {
  return (
    <div className={`${h} rounded-2xl animate-pulse`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} />
  );
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

  const pkg = data?.packageDistribution;

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
          <Skel h="h-36" /><Skel h="h-28" />
          <Skel h="h-40" /><Skel h="h-32" />
        </div>
      ) : data && (
        <>
          {/* Brüt Ciro + Aktif Üye */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <BigCard
              label="Brüt Ciro"
              value={data.totalRevenue}
              prefix="₺"
              fmtFn={fmtK}
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

          {/* Kurulan Masa */}
          <div className="mb-4">
            <MasaCard total={data.totalMeetings} group={data.groupMeetings} oneOnOne={data.oneOnOneMeetings} />
          </div>

          {/* Algoritma Başarısı */}
          <div className="mb-4">
            <AlgoCard rate={data.algorithmSuccessRate} />
          </div>

          {/* Referans Kayıt + Toplam İndirim (kırmızı BigCard) */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <BigCard label="Referans Kayıt" value={data.referralRegisteredCount} />
            <BigCard label="Toplam İndirim" value={data.referralTotalDiscountTL} prefix="₺" />
          </div>
        </>
      )}

      {/* Şehir tablosu */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs text-[#888] uppercase tracking-[0.14em]">Şehir Bazlı Performans</p>
        </div>
        {loading ? (
          <div className="p-4 flex flex-col gap-3">{[0,1,2,3].map(i => <Skel key={i} h="h-10" />)}</div>
        ) : cities.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[340px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Şehir', 'Masa', 'Üye', 'Ciro', 'Trend'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs text-[#555] uppercase tracking-[0.08em] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map((row, i) => (
                  <motion.tr key={row.city}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-3 py-3 text-sm font-semibold text-[#f5f5f5]">{row.city}</td>
                    <td className="px-3 py-3 text-sm text-[#888]">{row.totalTables}</td>
                    <td className="px-3 py-3 text-sm text-[#888]">{row.activeMembers}</td>
                    <td className="px-3 py-3 text-sm text-[#888]">₺{fmtK(row.revenue)}</td>
                    <td className="px-3 py-3 text-sm font-medium"
                      style={{ color: String(row.trend).startsWith('-') ? '#ff6b6b' : '#4ade80' }}>
                      {String(row.trend).startsWith('-') ? '↓ ' : '↑ '}{String(row.trend).replace('-', '')}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-[#555]">Veri yok.</p>
        )}
      </div>

      {/* Paket Dağılımı */}
      <div className="glass-card p-5">
        <p className="text-xs text-[#888] uppercase tracking-[0.14em] mb-4">Paket Dağılımı</p>
        {!loading && pkg ? (
          <div className="flex flex-col gap-4">
            <PackageBar label="Masada" pct={pkg.masadaPct} count={pkg.masadaCount} delay={0} />
            <PackageBar label="Karşımda" pct={pkg.karsimdaPct} count={pkg.karsimdaCount} delay={0.1} />
            <PackageBar label="İçerde" pct={pkg.icerdePct} count={pkg.icerdeCount} delay={0.2} />
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-4">{[0,1,2].map(i => <Skel key={i} h="h-8" />)}</div>
        ) : (
          <div className="flex flex-col gap-4">
            <PackageBar label="Masada" pct={0} count={0} delay={0} />
            <PackageBar label="Karşımda" pct={0} count={0} delay={0.1} />
            <PackageBar label="İçerde" pct={0} count={0} delay={0.2} />
          </div>
        )}
      </div>
    </div>
  );
}
