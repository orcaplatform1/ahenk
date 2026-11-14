'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { SURFACE, CARD, BORDER, TEXT, MUTED, RED, GREEN, AMBER, BLUE, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';


interface PackageDist {
  masadaPct: number; karsimdaPct: number; icerdePct: number; kankamlaPct: number;
  masadaCount: number; karsimdaCount: number; icerdeCount: number; kankamlaCount: number;
}

interface StatsOverview {
  totalRevenue: number;
  netRevenue: number;
  vatAmount: number;
  netCommission: number;
  activeUsers: number;
  kycPending: number;
  matchRateThisWeek: number;
  referralRegisteredCount: number;
  referralTotalDiscountTL: number;
  totalMeetings: number;
  groupMeetings: number;
  oneOnOneMeetings: number;
  kankaMeetings: number;
  algorithmSuccessRate: number;
  packageDistribution: PackageDist;
}

interface CityRow {
  city: string;
  totalTables: number;
  kankaTables: number;
  activeMembers: number;
  revenue: number;
  discount: number;
  net: number;
  vat: number;
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
    <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 2, height: 12, borderRadius: 1, background: color }} />
        <span style={{ ...LABEL, color }}>{label.toUpperCase()}</span>
      </div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: TEXT, fontFamily: MONO }}>
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
        <span style={{ fontSize: 13, color: TEXT }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{count} abone</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, fontFamily: MONO }}>%{pct}</span>
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
  kankaMeetingsThisWeek: number;
  pioneer: { count: number; remaining: number };
}

export default function AdminStats() {
  const [data, setData] = useState<StatsOverview | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Şehir tablosu ve özet ayrı ayrı düşebilir; genel bakışı engellemesin ama hata görünsün
    const partErrors: string[] = [];
    Promise.all([
      api.get<StatsOverview>('/admin/stats/overview'),
      api.get<CityRow[]>('/admin/stats/cities').catch((e: Error) => { partErrors.push(`Şehir tablosu yüklenemedi: ${e.message}`); return [] as CityRow[]; }),
      api.get<DashboardSummary>('/admin/dashboard').catch((e: Error) => { partErrors.push(`Özet yüklenemedi: ${e.message}`); return null; }),
    ])
      .then(([overview, cityRows, dash]) => {
        setData(overview); setCities(cityRows); setSummary(dash);
        if (partErrors.length) setError(partErrors.join(' · '));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const pkg = data?.packageDistribution;

  const totalMeetingsAnim    = useCountUp(data?.totalMeetings ?? 0);
  const groupMeetingsAnim    = useCountUp(data?.groupMeetings ?? 0);
  const oneOnOneAnim         = useCountUp(data?.oneOnOneMeetings ?? 0);
  const kankaAnim            = useCountUp(data?.kankaMeetings ?? 0);
  const algoSuccessAnim      = useCountUp(data?.algorithmSuccessRate ?? 0);

  return (
    <div className="adm-page" style={{ maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 className="ll-title">İstatistikler</h1>
      </div>

      {error && <p style={{ margin: '0 0 20px', fontSize: 13, color: RED }}>{error}</p>}

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
                sub={`Grup ${summary.groupMeetingsThisWeek} · Başbaşa ${summary.oneOnOneMeetingsThisWeek} · Kankamla ${summary.kankaMeetingsThisWeek}`}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
            <StatCard label="Net Ciro" value={data.netRevenue} prefix="₺" fmtFn={fmtK} accent={GREEN} sub="Brüt ciro" />
            <StatCard label="KDV (%20)" value={data.vatAmount} prefix="₺" fmtFn={fmtK} accent={AMBER} sub="Net ciro içindeki vergi" />
          </div>

          {/* Kurulan Masa */}
          <div className="ll-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <h2 className="ll-title">Kurulan Masa</h2>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: TEXT, fontFamily: MONO }}>
              {totalMeetingsAnim.toLocaleString('tr-TR')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: MUTED }}>Grup</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: TEXT, fontFamily: MONO }}>{groupMeetingsAnim.toLocaleString('tr-TR')}</p>
              </div>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: MUTED }}>Başbaşa</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: TEXT, fontFamily: MONO }}>{oneOnOneAnim.toLocaleString('tr-TR')}</p>
              </div>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: MUTED }}>Kankamla</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: TEXT, fontFamily: MONO }}>{kankaAnim.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          </div>

          {/* Algoritma */}
          <div className="ll-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <h2 className="ll-title">Algoritma Başarısı</h2>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: TEXT, fontFamily: MONO }}>%{algoSuccessAnim}</p>
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Tamamlanan / toplam masa oranı (Grup, Başbaşa ve Kankamla)</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
            <StatCard label="Referans Kayıt" value={data.referralRegisteredCount} accent={CYAN} />
            <StatCard label="Toplam İndirim" value={data.referralTotalDiscountTL} prefix="₺" accent={AMBER} />
          </div>
        </>
      )}

      {/* Şehir tablosu */}
      <div className="ll-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ll-title">Şehir Bazlı Performans</h2>
        </div>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[0,1,2,3].map(i => <div key={i} style={{ height: 32, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />)}
          </div>
        ) : cities.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Şehir', 'Masa', 'Kankamla', 'Üye', 'Ciro', 'İndirim', 'Net', 'KDV', 'Trend'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', ...LABEL, color: MUTED }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map((row, i) => (
                  <tr key={row.city} style={{ borderBottom: i < cities.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none' }}>
                    <td data-label="Şehir" style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: TEXT }}>{row.city}</td>
                    <td data-label="Masa" style={{ padding: '10px 14px', fontSize: 13, color: MUTED }}>{row.totalTables}</td>
                    <td data-label="Kankamla" style={{ padding: '10px 14px', fontSize: 13, color: MUTED }}>{row.kankaTables ?? 0}</td>
                    <td data-label="Üye" style={{ padding: '10px 14px', fontSize: 13, color: MUTED }}>{row.activeMembers}</td>
                    <td data-label="Ciro" style={{ padding: '10px 14px', fontSize: 13, color: MUTED }}>₺{fmtK(row.revenue)}</td>
                    <td data-label="İndirim" style={{ padding: '10px 14px', fontSize: 13, color: MUTED }}>₺{fmtK(row.discount)}</td>
                    <td data-label="Net" style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: TEXT }}>₺{fmtK(row.net)}</td>
                    <td data-label="KDV" style={{ padding: '10px 14px', fontSize: 13, color: MUTED }}>₺{fmtK(row.vat)}</td>
                    <td data-label="Trend" style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: String(row.trend).startsWith('-') ? RED : GREEN }}>
                      {String(row.trend).startsWith('-') ? '↓ ' : '↑ '}{String(row.trend).replace('-', '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Veri yok</p>
          </div>
        )}
      </div>

      {/* Paket dağılımı */}
      <div className="ll-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          <h2 className="ll-title">Paket Dağılımı</h2>
        </div>
        {!loading && pkg ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PackageBar label="Masada"   pct={pkg.masadaPct}   count={pkg.masadaCount}   color={BLUE}  />
            <PackageBar label="Karşımda" pct={pkg.karsimdaPct} count={pkg.karsimdaCount} color={CYAN}  />
            <PackageBar label="İçerde"   pct={pkg.icerdePct}   count={pkg.icerdeCount}   color={GREEN} />
            <PackageBar label="Kankamla" pct={pkg.kankamlaPct ?? 0} count={pkg.kankamlaCount ?? 0} color={AMBER} />
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0,1,2,3].map(i => <div key={i} style={{ height: 32, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PackageBar label="Masada"   pct={0} count={0} color={BLUE}  />
            <PackageBar label="Karşımda" pct={0} count={0} color={CYAN}  />
            <PackageBar label="İçerde"   pct={0} count={0} color={GREEN} />
            <PackageBar label="Kankamla" pct={0} count={0} color={AMBER} />
          </div>
        )}
      </div>
    </div>
  );
}
