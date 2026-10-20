'use client';

import { useEffect, useState } from 'react';

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

// ─── Renk sabitleri (acil-yardım ile aynı) ────────────────────────────────────
const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const AMBER   = '#f59e0b';
const RED     = '#ef4444';
const BLUE    = '#3b82f6';
const CYAN    = '#22d3ee';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';
const SANS    = 'Inter, system-ui, sans-serif';

function trendColor(t: string) {
  if (t.startsWith('+')) return GREEN;
  if (t.startsWith('-')) return RED;
  return MUTED;
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
    { label: 'TOPLAM GELİR',     value: `₺${overview.totalRevenue.toLocaleString('tr-TR')}`,  color: CYAN  },
    { label: 'NET KOMİSYON',     value: `₺${overview.netCommission.toLocaleString('tr-TR')}`, color: GREEN },
    { label: 'AKTİF KULLANICI',  value: overview.activeUsers.toLocaleString('tr-TR'),          color: BLUE  },
    { label: 'KYC BEKLİYOR',     value: overview.kycPending.toLocaleString('tr-TR'),           color: overview.kycPending > 0 ? AMBER : MUTED },
  ];

  const matchColor = overview.matchRateThisWeek > 0 ? GREEN : overview.matchRateThisWeek < 0 ? RED : MUTED;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: SANS }}>

      {/* 4 Metrik kartı */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {METRICS.map((m) => (
          <div key={m.label} style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: '14px 16px',
          }}>
            <p style={{ margin: '0 0 6px', fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: MUTED, fontFamily: SANS }}>
              {m.label}
            </p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: m.color, fontFamily: MONO }}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Sadakat Programı + Eşleşme oranı */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Sadakat */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: MUTED, fontFamily: SANS }}>
            SADAKAT PROGRAMI
          </p>
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: MUTED }}>Davet ile Kayıt</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: CYAN, fontFamily: MONO }}>
                {(overview.referralRegisteredCount ?? 0).toLocaleString('tr-TR')}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: MUTED }}>Toplam İndirim</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: GREEN, fontFamily: MONO }}>
                ₺{(overview.referralTotalDiscountTL ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Eşleşme oranı */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 6px', fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: MUTED, fontFamily: SANS }}>
              BU HAFTA EŞLEŞİM ORANI
            </p>
            <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: matchColor, fontFamily: MONO }}>
              {overview.matchRateThisWeek >= 0 ? '+' : ''}{overview.matchRateThisWeek}%
            </p>
          </div>
          <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>geçen haftaya göre</p>
        </div>
      </div>

      {/* Şehir tablosu */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE, fontFamily: SANS }}>
            ŞEHİR DAĞILIMI
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Şehir', 'Masalar', 'Üyeler', 'Gelir', 'Trend'].map((h) => (
                  <th key={h} style={{
                    paddingBottom: 10, paddingRight: 16,
                    textAlign: 'left', fontSize: 9, fontWeight: 800,
                    letterSpacing: '0.14em', color: MUTED,
                  }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.city} style={{ borderBottom: `1px solid rgba(26,58,92,0.5)` }}>
                  <td style={{ padding: '11px 16px 11px 0', fontSize: 12, fontWeight: 600, color: TEXT }}>
                    {c.city}
                  </td>
                  <td style={{ padding: '11px 16px 11px 0', fontSize: 12, color: MUTED, fontFamily: MONO }}>
                    {c.totalTables}
                  </td>
                  <td style={{ padding: '11px 16px 11px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: TEXT, fontFamily: MONO, minWidth: 32 }}>
                        {c.activeMembers}
                      </span>
                      <div style={{ height: 4, width: 64, background: SURFACE, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{
                          height: '100%',
                          width: `${(c.activeMembers / maxMembers) * 100}%`,
                          background: `linear-gradient(90deg, ${BLUE}, ${CYAN})`,
                          borderRadius: 99,
                        }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px 11px 0', fontSize: 12, color: MUTED, fontFamily: MONO }}>
                    ₺{c.revenue.toLocaleString('tr-TR')}
                  </td>
                  <td style={{ padding: '11px 0', fontSize: 12, fontWeight: 700, color: trendColor(c.trend), fontFamily: MONO }}>
                    {c.trend}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
