'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const BG     = '#020c1b';
const SURFACE = '#0a1628';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const BLUE   = '#3b82f6';
const AMBER  = '#f59e0b';
const CYAN   = '#22d3ee';
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

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

function StatCard({ label, value, sub, prefix = '', fmtFn, accent }: {
  label: string; value: number; sub?: string; prefix?: string;
  fmtFn?: (n: number) => string; accent?: string;
}) {
  const v = useCountUp(value);
  const color = accent ?? CYAN;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 2, height: 12, borderRadius: 1, background: color }} />
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color }}>{label.toUpperCase()}</span>
      </div>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: TEXT, fontFamily: MONO, letterSpacing: '-0.02em' }}>
        {prefix}{fmtFn ? fmtFn(v) : v.toLocaleString('tr-TR')}
      </p>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED }}>{sub}</p>}
    </div>
  );
}

function PackageBar({ label, pct, count, color }: { label: string; pct: number; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: TEXT }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{count} abone</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, fontFamily: MONO }}>%{pct}</span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: SURFACE, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, background: color, width: `${pct}%`, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

interface DashboardSummary {
  totalUsers: number;
  kycPending: number;
  activeMeetingsThisWeek: number;
  groupMeetingsThisWeek: number;
  oneOnOneMeetingsThisWeek: number;
  pioneer: { count: number; remaining: number };
}

export default function AdminStats() {
  const [data, setData] = useState<StatsOverview | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<StatsOverview>('/admin/stats/overview'),
      api.get<CityRow[]>('/admin/stats/cities').catch(() => [] as CityRow[]),
      api.get<DashboardSummary>('/admin/dashboard').catch(() => null),
    ])
      .then(([overview, cityRows, dash]) => { setData(overview); setCities(cityRows); setSummary(dash); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const pkg = data?.packageDistribution;

  const totalMeetingsAnim    = useCountUp(data?.totalMeetings ?? 0);
  const groupMeetingsAnim    = useCountUp(data?.groupMeetings ?? 0);
  const oneOnOneAnim         = useCountUp(data?.oneOnOneMeetings ?? 0);
  const algoSuccessAnim      = useCountUp(data?.algorithmSuccessRate ?? 0);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>İstatistikler</h1>
      </div>

      {error && <p style={{ margin: '0 0 20px', fontSize: 12, color: RED }}>{error}</p>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 88, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, opacity: 0.5 }} />)}
        </div>
      ) : data && (
        <>
          {/* Genel bakış */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
              <StatCard
                label="Toplam Üye"
                value={summary.totalUsers}
                accent={BLUE}
                sub={summary.kycPending > 0 ? `${summary.kycPending} KYC bekliyor` : 'Bekleyen KYC yok'}
              />
              <StatCard
                label="Bu Hafta Masa"
                value={summary.activeMeetingsThisWeek}
                accent={CYAN}
                sub={`Grup ${summary.groupMeetingsThisWeek} · Başbaşa ${summary.oneOnOneMeetingsThisWeek}`}
              />
              <StatCard
                label="Öncü Rozeti"
                value={summary.pioneer.count}
                accent={AMBER}
                sub={`Kalan kota: ${summary.pioneer.remaining}`}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
            <StatCard
              label="Brüt Ciro"
              value={data.totalRevenue}
              prefix="₺"
              fmtFn={fmtK}
              accent={GREEN}
              sub={data.matchRateThisWeek !== 0
                ? `${data.matchRateThisWeek > 0 ? '↑' : '↓'} %${Math.abs(data.matchRateThisWeek)} bu hafta`
                : undefined}
            />
            <StatCard
              label="Aktif Üye"
              value={data.activeUsers}
              accent={BLUE}
              sub={data.kycPending > 0 ? `${data.kycPending} KYC bekliyor` : undefined}
            />
          </div>

          {/* Kurulan Masa */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>KURULAN MASA</span>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 36, fontWeight: 800, color: TEXT, fontFamily: MONO, letterSpacing: '-0.02em' }}>
              {totalMeetingsAnim.toLocaleString('tr-TR')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: MUTED }}>Grup</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: MONO }}>{groupMeetingsAnim.toLocaleString('tr-TR')}</p>
              </div>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: MUTED }}>Başbaşa</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: MONO }}>{oneOnOneAnim.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          </div>

          {/* Algoritma */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ width: 2, height: 12, borderRadius: 1, background: AMBER }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: AMBER }}>ALGORİTMA BAŞARISI</span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 36, fontWeight: 800, color: TEXT, fontFamily: MONO }}>%{algoSuccessAnim}</p>
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Tamamlanan / toplam masa oranı</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
            <StatCard label="Referans Kayıt" value={data.referralRegisteredCount} accent={CYAN} />
            <StatCard label="Toplam İndirim" value={data.referralTotalDiscountTL} prefix="₺" accent={AMBER} />
          </div>
        </>
      )}

      {/* Şehir tablosu */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE }}>ŞEHİR BAZLI PERFORMANS</span>
        </div>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[0,1,2,3].map(i => <div key={i} style={{ height: 32, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />)}
          </div>
        ) : cities.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 380, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Şehir', 'Masa', 'Üye', 'Ciro', 'Trend'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: MUTED }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map((row, i) => (
                  <tr key={row.city} style={{ borderBottom: i < cities.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none' }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: TEXT }}>{row.city}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: MUTED }}>{row.totalTables}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: MUTED }}>{row.activeMembers}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: MUTED }}>₺{fmtK(row.revenue)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: String(row.trend).startsWith('-') ? RED : GREEN }}>
                      {String(row.trend).startsWith('-') ? '↓ ' : '↑ '}{String(row.trend).replace('-', '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Veri yok</p>
          </div>
        )}
      </div>

      {/* Paket dağılımı */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>PAKET DAĞILIMI</span>
        </div>
        {!loading && pkg ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PackageBar label="Masada"   pct={pkg.masadaPct}   count={pkg.masadaCount}   color={BLUE}  />
            <PackageBar label="Karşımda" pct={pkg.karsimdaPct} count={pkg.karsimdaCount} color={CYAN}  />
            <PackageBar label="İçerde"   pct={pkg.icerdePct}   count={pkg.icerdeCount}   color={GREEN} />
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0,1,2].map(i => <div key={i} style={{ height: 32, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PackageBar label="Masada"   pct={0} count={0} color={BLUE}  />
            <PackageBar label="Karşımda" pct={0} count={0} color={CYAN}  />
            <PackageBar label="İçerde"   pct={0} count={0} color={GREEN} />
          </div>
        )}
      </div>
    </div>
  );
}
