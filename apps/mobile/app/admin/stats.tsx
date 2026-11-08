// apps/web/app/admin/stats/page.tsx karşılığı (İstatistikler)
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { ACard, AError, ALabel, AMono, APage, AT, ATableRow, ATitle } from '@/components/admin/AdminUi';
import { adm } from '@/theme/theme';

interface PackageDist { masadaPct: number; karsimdaPct: number; icerdePct: number; kankamlaPct: number; masadaCount: number; karsimdaCount: number; icerdeCount: number; kankamlaCount: number }
interface StatsOverview { totalRevenue: number; totalRefund: number; netRevenue: number; vatAmount: number; netCommission: number; activeUsers: number; kycPending: number; matchRateThisWeek: number; referralRegisteredCount: number; referralTotalDiscountTL: number; totalMeetings: number; groupMeetings: number; oneOnOneMeetings: number; kankaMeetings: number; algorithmSuccessRate: number; packageDistribution: PackageDist }
interface CityRow { city: string; totalTables: number; kankaTables: number; activeMembers: number; revenue: number; discount: number; refund: number; net: number; vat: number; trend: string }
interface DashboardSummary { totalUsers: number; kycPending: number; activeMeetingsThisWeek: number; groupMeetingsThisWeek: number; oneOnOneMeetingsThisWeek: number; kankaMeetingsThisWeek: number; pioneer: { count: number; remaining: number } }

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (target === 0) { setVal(0); return; }
    let start = 0;
    const step = (ts: number) => { if (!start) start = ts; const p = Math.min((ts - start) / duration, 1); setVal(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}
const fmtK = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'K' : n.toLocaleString('tr-TR'));

function StatCard({ label, value, sub, prefix = '', fmtFn, accent }: { label: string; value: number; sub?: string; prefix?: string; fmtFn?: (n: number) => string; accent?: string }) {
  const v = useCountUp(value);
  const color = accent ?? adm.cyan;
  return (
    <ACard style={{ flexBasis: '47%', flexGrow: 1, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <View style={{ width: 2, height: 12, borderRadius: 1, backgroundColor: color }} />
        <ALabel style={{ color, flexShrink: 1 }}>{label.toLocaleUpperCase('tr-TR')}</ALabel>
      </View>
      <AMono w={600} style={{ fontSize: 20, color: adm.text }}>{prefix}{fmtFn ? fmtFn(v) : v.toLocaleString('tr-TR')}</AMono>
      {!!sub && <AT style={{ marginTop: 4, fontSize: 11, color: adm.muted }}>{sub}</AT>}
    </ACard>
  );
}
function PackageBar({ label, pct, count, color }: { label: string; pct: number; count: number; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AT style={{ fontSize: 13 }}>{label}</AT>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AMono style={{ fontSize: 10 }}>{count} abone</AMono>
          <AMono w={600} style={{ fontSize: 13, color: adm.text }}>%{pct}</AMono>
        </View>
      </View>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: adm.surface, overflow: 'hidden' }}><View style={{ height: '100%', borderRadius: 99, backgroundColor: color, width: `${pct}%` }} /></View>
    </View>
  );
}
const Grid = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>{children}</View>;

export default function AdminStats() {
  const [data, setData] = useState<StatsOverview | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const errs: string[] = [];
    Promise.all([
      api.get<StatsOverview>('/admin/stats/overview'),
      api.get<CityRow[]>('/admin/stats/cities').catch((e: Error) => { errs.push(`Şehir tablosu yüklenemedi: ${e.message}`); return [] as CityRow[]; }),
      api.get<DashboardSummary>('/admin/dashboard').catch((e: Error) => { errs.push(`Özet yüklenemedi: ${e.message}`); return null; }),
    ]).then(([o, c, d]) => { setData(o); setCities(c); setSummary(d); if (errs.length) setError(errs.join(' · ')); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  const pkg = data?.packageDistribution;
  const tm = useCountUp(data?.totalMeetings ?? 0), gm = useCountUp(data?.groupMeetings ?? 0), om = useCountUp(data?.oneOnOneMeetings ?? 0), km = useCountUp(data?.kankaMeetings ?? 0), algo = useCountUp(data?.algorithmSuccessRate ?? 0);
  const skeleton = (h: number, n: number) => <View style={{ gap: 6 }}>{Array.from({ length: n }).map((_, i) => <View key={i} style={{ height: h, backgroundColor: adm.surface, borderRadius: 6, opacity: 0.5 }} />)}</View>;
  return (
    <APage maxWidth={900}>
      <View style={{ marginBottom: 24 }}><ATitle>İstatistikler</ATitle></View>
      <AError>{error}</AError>
      {loading ? <View style={{ gap: 12 }}>{[0, 1, 2, 3].map(i => <View key={i} style={{ height: 88, backgroundColor: adm.card, borderWidth: 1, borderColor: adm.border, borderRadius: 10, opacity: 0.5 }} />)}</View> : data && (
        <>
          {summary && (
            <Grid>
              <StatCard label="Toplam Üye" value={summary.totalUsers} accent={adm.blue} sub={summary.kycPending > 0 ? `${summary.kycPending} KYC bekliyor` : 'Bekleyen KYC yok'} />
              <StatCard label="Bu Hafta Masa" value={summary.activeMeetingsThisWeek} accent={adm.cyan} sub={`Grup ${summary.groupMeetingsThisWeek} · Başbaşa ${summary.oneOnOneMeetingsThisWeek} · Kankamla ${summary.kankaMeetingsThisWeek}`} />
              <StatCard label="Öncü Rozeti" value={summary.pioneer.count} accent={adm.amber} sub={`Kalan kota: ${summary.pioneer.remaining}`} />
            </Grid>
          )}
          <Grid>
            <StatCard label="Brüt Ciro" value={data.totalRevenue} prefix="₺" fmtFn={fmtK} accent={adm.green} sub={data.matchRateThisWeek !== 0 ? `${data.matchRateThisWeek > 0 ? '↑' : '↓'} %${Math.abs(data.matchRateThisWeek)} bu hafta` : undefined} />
            <StatCard label="Aktif Üye" value={data.activeUsers} accent={adm.blue} sub={data.kycPending > 0 ? `${data.kycPending} KYC bekliyor` : undefined} />
          </Grid>
          <Grid>
            <StatCard label="İade Tutarları" value={data.totalRefund} prefix="₺" fmtFn={fmtK} accent={adm.red} />
            <StatCard label="Net Ciro" value={data.netRevenue} prefix="₺" fmtFn={fmtK} accent={adm.green} sub="Brüt ciro − iadeler" />
            <StatCard label="KDV (%20)" value={data.vatAmount} prefix="₺" fmtFn={fmtK} accent={adm.amber} sub="Net ciro içindeki vergi" />
          </Grid>
          <ACard style={{ marginBottom: 12 }}>
            <ATitle style={{ marginBottom: 12 }}>Kurulan Masa</ATitle>
            <AMono w={600} style={{ marginBottom: 16, fontSize: 20, color: adm.text }}>{tm.toLocaleString('tr-TR')}</AMono>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([['Grup', gm], ['Başbaşa', om], ['Kankamla', km]] as const).map(([l, v]) => (
                <View key={l} style={{ flex: 1, minWidth: 0, backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16 }}>
                  <AT style={{ marginBottom: 4, fontSize: 10, color: adm.muted }}>{l}</AT>
                  <AMono w={600} style={{ fontSize: 20, color: adm.text }}>{v.toLocaleString('tr-TR')}</AMono>
                </View>
              ))}
            </View>
          </ACard>
          <ACard style={{ marginBottom: 12 }}>
            <ATitle style={{ marginBottom: 8 }}>Algoritma Başarısı</ATitle>
            <AMono w={600} style={{ marginBottom: 4, fontSize: 20, color: adm.text }}>%{algo}</AMono>
            <AT style={{ fontSize: 11, color: adm.muted }}>Tamamlanan / toplam masa oranı (Grup, Başbaşa ve Kankamla)</AT>
          </ACard>
          <Grid>
            <StatCard label="Referans Kayıt" value={data.referralRegisteredCount} accent={adm.cyan} />
            <StatCard label="Toplam İndirim" value={data.referralTotalDiscountTL} prefix="₺" accent={adm.amber} />
          </Grid>
        </>
      )}
      <ACard style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border }}><ATitle>Şehir Bazlı Performans</ATitle></View>
        {loading ? <View style={{ padding: 16 }}>{skeleton(32, 4)}</View> : cities.length > 0 ? cities.map((r, i) => (
          <ATableRow key={r.city} last={i === cities.length - 1} cells={[
            ['Şehir', <AT key="c" w={600} style={{ fontSize: 13 }}>{r.city}</AT>], ['Masa', <AT key="m" style={{ fontSize: 13, color: adm.muted }}>{r.totalTables}</AT>],
            ['Kankamla', <AT key="k" style={{ fontSize: 13, color: adm.muted }}>{r.kankaTables ?? 0}</AT>], ['Üye', <AT key="u" style={{ fontSize: 13, color: adm.muted }}>{r.activeMembers}</AT>],
            ['Ciro', <AT key="ci" style={{ fontSize: 13, color: adm.muted }}>₺{fmtK(r.revenue)}</AT>], ['İndirim', <AT key="i" style={{ fontSize: 13, color: adm.muted }}>₺{fmtK(r.discount)}</AT>],
            ['İade', <AT key="ia" style={{ fontSize: 13, color: r.refund > 0 ? adm.red : adm.muted }}>₺{fmtK(r.refund)}</AT>], ['Net', <AT key="n" w={600} style={{ fontSize: 13 }}>₺{fmtK(r.net)}</AT>],
            ['KDV', <AT key="v" style={{ fontSize: 13, color: adm.muted }}>₺{fmtK(r.vat)}</AT>],
            ['Trend', <AT key="t" w={600} style={{ fontSize: 13, color: String(r.trend).startsWith('-') ? adm.red : adm.green }}>{String(r.trend).startsWith('-') ? '↓ ' : '↑ '}{String(r.trend).replace('-', '')}</AT>],
          ]} />
        )) : <View style={{ paddingVertical: 24, alignItems: 'center' }}><AT style={{ fontSize: 13, color: adm.muted }}>Veri yok</AT></View>}
      </ACard>
      <ACard>
        <ATitle style={{ marginBottom: 20 }}>Paket Dağılımı</ATitle>
        {loading ? skeleton(32, 4) : (
          <View style={{ gap: 16 }}>
            <PackageBar label="Masada" pct={pkg?.masadaPct ?? 0} count={pkg?.masadaCount ?? 0} color={adm.blue} />
            <PackageBar label="Karşımda" pct={pkg?.karsimdaPct ?? 0} count={pkg?.karsimdaCount ?? 0} color={adm.cyan} />
            <PackageBar label="İçerde" pct={pkg?.icerdePct ?? 0} count={pkg?.icerdeCount ?? 0} color={adm.green} />
            <PackageBar label="Kankamla" pct={pkg?.kankamlaPct ?? 0} count={pkg?.kankamlaCount ?? 0} color={adm.amber} />
          </View>
        )}
      </ACard>
    </APage>
  );
}
