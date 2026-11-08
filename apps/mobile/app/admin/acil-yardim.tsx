// apps/web/app/admin/acil-yardim/page.tsx karşılığı (Acil Yardım Merkezi): 15 sn yenileme, açık taleplerde tek istekte 1 sn canlı konum + açık adres,
// Leaflet/OpenStreetMap canlı harita (WebView). Açık adres yalnız backend Nominatim önbelleğinden gelir; uygulama Nominatim'e istek atmaz.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { myId, myRole } from '@/lib/adminRole';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, AT, ATitle } from '@/components/admin/AdminUi';
import { StatusPill } from '@/components/admin/StatusPill';
import { SosLiveMap } from '@/components/admin/SosLiveMap';
import { adm, mono } from '@/theme/theme';

type LivePos = { lat: number; lng: number; timestamp: string };
type LiveAddress = { il: string | null; ilce: string | null; mahalle: string | null; caddeSokak: string | null; binaNo: string | null; postaKodu: string | null; tamAdres: string | null; guncelleme: string; kisaAdres?: string };
interface LocUpdate { lat: number; lng: number; accuracy: number | null; timestamp: string; address?: LiveAddress | null }
interface ParticipantLoc { id: string; userId: string; lat: number; lng: number; accuracy: number | null; timestamp: string; address?: LiveAddress | null; user: { id: string; profile: { firstName: string; lastName: string } | null } }
interface Participant { userId: string; firstName: string | null; lastName: string | null; email?: string; phone: string | null; age: number | null; gender: string | null; occupation: string | null; city: string | null; isRequester: boolean; isBot?: boolean }
interface AdminRef { id: string; profile: { firstName: string; lastName: string } | null }
interface SosReport { id: string; createdAt: string; threats: string[]; lat: number | null; lng: number | null; accuracy: number | null; resolvedAt: string | null; restricted: boolean; claimedAt: string | null; claimedBy: AdminRef | null; resolvedBy?: AdminRef | null; participantSnapshot: Participant[]; user: { id: string; email?: string; phone: string | null; profile: { firstName: string; lastName: string } | null } | null; meeting: { id: string; type: string; scheduledAt: string; locationText: string | null; venueAddress: string | null } | null; locationUpdates: LocUpdate[]; allParticipantLocations?: ParticipantLoc[] }
const THREAT: Record<string, string> = { LIFE_DANGER: 'Hayatım tehlikede', PHYSICAL_VIOLENCE: 'Fiziksel şiddet gördüm', ABDUCTION: 'Zorla alıkoyuluyorum', HARASSMENT: 'Taciz veya istismara uğradım' };
const GENDER_TR: Record<string, string> = { MALE: 'E', FEMALE: 'K' };
const REFRESH_SEC = 15;
const RED_DIM = 'rgba(239,68,68,0.15)'; const BLUE_DIM = 'rgba(59,130,246,0.12)';
const adminName = (a: AdminRef | null | undefined) => (a?.profile ? `${a.profile.firstName} ${a.profile.lastName}` : 'Bir admin');
const fmtTR = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'medium' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const secondsAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
const mapsHref = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
function haversineM(a1: number, o1: number, a2: number, o2: number) { const R = 6371000; const dA = (a2 - a1) * Math.PI / 180; const dO = (o2 - o1) * Math.PI / 180; const a = Math.sin(dA / 2) ** 2 + Math.cos(a1 * Math.PI / 180) * Math.cos(a2 * Math.PI / 180) * Math.sin(dO / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }

function Pulse({ color = adm.red }: { color?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true })); l.start(); return () => l.stop(); }, [v]);
  return (
    <View style={{ width: 10, height: 10 }}>
      <Animated.View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.9, 0, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 2.4, 2.4] }) }] }} />
      <View style={{ position: 'absolute', top: 2, left: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}
function LiveBadge({ ts }: { ts: string }) {
  const [ago, setAgo] = useState(secondsAgo(ts));
  useEffect(() => { const id = setInterval(() => setAgo(secondsAgo(ts)), 1000); return () => clearInterval(id); }, [ts]);
  const fresh = ago < 60;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 99, backgroundColor: fresh ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: fresh ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.35)' }}>
      <Pulse color={fresh ? adm.green : adm.amber} />
      <AMono w={600} style={{ fontSize: 10, color: fresh ? adm.green : adm.amber }}>{ago < 60 ? `${ago}s önce` : `${Math.floor(ago / 60)}d ${ago % 60}s önce`}</AMono>
    </View>
  );
}
function Section({ title, accent, children, mt }: { title: string; accent: string; children: React.ReactNode; mt?: boolean }) {
  return (
    <View style={{ marginTop: mt ? 16 : 0 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ width: 2, height: 12, borderRadius: 1, backgroundColor: accent }} />
        <ALabel style={{ color: accent, flexShrink: 1 }}>{title}</ALabel>
      </View>
      {children}
    </View>
  );
}
const KV = ({ label, value }: { label: string; value: React.ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}><AT style={{ fontSize: 11, color: adm.muted, minWidth: 56 }}>{label}</AT><AT style={{ fontSize: 11, flexShrink: 1 }}>{value}</AT></View>;
function CoordRow({ loc, isRequester }: { loc: ParticipantLoc; isRequester: boolean }) {
  const name = loc.user.profile ? `${loc.user.profile.firstName} ${loc.user.profile.lastName}` : loc.userId.slice(0, 8);
  const addr = loc.address ? loc.address.kisaAdres ?? '' : null;
  return (
    <View style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: isRequester ? RED_DIM : BLUE_DIM, borderWidth: 1, borderColor: isRequester ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.2)', marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Pulse color={isRequester ? adm.red : adm.blue} />
        <AT w={600} style={{ fontSize: 11, color: isRequester ? adm.red : adm.cyan, flexBasis: '100%' }}>{name}{isRequester ? ' ★' : ''}</AT>
        <AT style={{ fontSize: 11, fontFamily: mono(400) }} onPress={() => Linking.openURL(mapsHref(loc.lat, loc.lng))}>{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</AT>
        {!!loc.accuracy && <AMono style={{ fontSize: 10 }}>±{Math.round(loc.accuracy)}m</AMono>}
        <LiveBadge ts={loc.timestamp} />
      </View>
      {addr === null ? <AT style={{ marginTop: 4, marginLeft: 24, fontSize: 10.5, color: adm.muted }}>Adres alınıyor…</AT> : !!addr && <AT style={{ marginTop: 4, marginLeft: 24, fontSize: 10.5, color: isRequester ? 'rgba(239,100,100,0.8)' : adm.cyan }}>📍 {addr}</AT>}
    </View>
  );
}
function AddrRows({ a, color, keyW, fs }: { a: LiveAddress; color: string; keyW: number; fs: number }) {
  const rows: [string, string | null][] = [['İl', a.il], ['İlçe', a.ilce], ['Mahalle', a.mahalle], ['Cadde/Sokak', a.caddeSokak], ['Bina No', a.binaNo], ['Posta Kodu', a.postaKodu], ['Tam Adres', a.tamAdres]];
  return <>{rows.map(([k, v]) => <View key={k} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><AT style={{ fontSize: fs, color: adm.muted, minWidth: keyW, lineHeight: fs * 1.6 }}>{k}</AT><AT style={{ fontSize: fs, color, flexShrink: 1, lineHeight: fs * 1.6 }}>{v || '—'}</AT></View>)}</>;
}
function PersonRow({ p, email, phone, highlight }: { p?: Participant; email?: string; phone: string | null; highlight?: boolean }) {
  if (!p) return <AT style={{ fontSize: 11, color: adm.muted }}>—</AT>;
  return (
    <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4, backgroundColor: highlight ? RED_DIM : BLUE_DIM, borderWidth: 1, borderColor: highlight ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.2)' }}>
      <AT w={700} style={{ marginBottom: 2, fontSize: 13, color: highlight ? adm.red : adm.cyan }}>
        {p.firstName} {p.lastName}
        {p.age ? <AT style={{ fontSize: 10, color: adm.muted }}>  {p.age} yaş</AT> : null}
        {p.gender ? <AT style={{ fontSize: 10, color: adm.muted }}> {GENDER_TR[p.gender] ?? p.gender}</AT> : null}
        {p.isBot ? <AT w={700} style={{ fontSize: 9, color: adm.amber, letterSpacing: 0.9 }}>  BOT</AT> : null}
      </AT>
      <AMono style={{ fontSize: 10 }}>{[email, phone].filter(Boolean).join(' · ') || '—'}</AMono>
      {(p.occupation || p.city) && <AT style={{ marginTop: 2, fontSize: 10, color: adm.muted }}>{[p.occupation, p.city].filter(Boolean).join(' · ')}</AT>}
    </View>
  );
}

function ReportCard({ report, index, tick, onChanged, livePos, liveAddress }: { report: SosReport; index: number; tick: number; onChanged: () => void; livePos?: LivePos | null; liveAddress?: LiveAddress | null }) {
  const [open, setOpen] = useState(index === 0 && !report.resolvedAt);
  const [detail, setDetail] = useState<SosReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');
  const loadDetail = useCallback(async () => { setLoading(true); try { setDetail(await api.get<SosReport>(`/sos/admin/reports/${report.id}`)); } catch { /* yetki değiştiyse */ } finally { setLoading(false); } }, [report.id]);
  useEffect(() => { if (open && !report.restricted) loadDetail(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  if (report.restricted) {
    return (
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: adm.border, backgroundColor: adm.surface, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {!report.resolvedAt && <Pulse color={adm.amber} />}
        <AT style={{ fontSize: 13, flexShrink: 1 }}>{report.resolvedAt ? 'Çözülmüş talep' : 'Aktif talep'}: <AT w={700} style={{ fontSize: 13 }}>{adminName(report.claimedBy)}</AT> ilgileniyor</AT>
        <AMono style={{ marginLeft: 'auto', fontSize: 9 }}>{fmtTR(report.createdAt)}</AMono>
      </View>
    );
  }
  const isSuper = myRole() === 'SUPERADMIN'; const me = myId();
  const claimedByMe = !!report.claimedBy && report.claimedBy.id === me;
  const canClaim = !report.resolvedAt && !report.claimedBy;
  const canResolve = !report.resolvedAt && (isSuper || claimedByMe);
  async function act(path: 'claim' | 'resolve') { setActing(true); setActionError(''); try { await api.patch(`/sos/admin/reports/${report.id}/${path}`, {}); onChanged(); } catch (e) { setActionError((e as Error).message); } finally { setActing(false); } }
  const requester = report.participantSnapshot.find(p => p.isRequester);
  const reqName = requester?.firstName ? `${requester.firstName} ${requester.lastName}` : report.user?.phone ?? '—';
  const latest = detail ? detail.locationUpdates[detail.locationUpdates.length - 1] : report.locationUpdates[report.locationUpdates.length - 1];
  const dLat = latest?.lat ?? report.lat; const dLng = latest?.lng ?? report.lng;
  const elapsed = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / 60000);
  const allLocs = detail?.allParticipantLocations ?? [];
  const reqLoc = allLocs.find(l => l.userId === report.user?.id) ?? null;
  const others = allLocs.filter(l => l.userId !== report.user?.id);
  const close = reqLoc ? others.filter(o => haversineM(reqLoc.lat, reqLoc.lng, o.lat, o.lng) < 100) : [];
  // Haritadaki işaret: talep edenin en yeni konumu (katılımcı konumu ya da talep konum güncellemesi); 1 sn'lik canlı konum varsa onu izler
  const mapPos = reqLoc && (!latest || new Date(reqLoc.timestamp) >= new Date(latest.timestamp)) ? { lat: reqLoc.lat, lng: reqLoc.lng } : dLat != null && dLng != null ? { lat: dLat, lng: dLng } : null;
  const marker = livePos ?? mapPos;
  return (
    <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: report.resolvedAt ? adm.border : 'rgba(239,68,68,0.6)', backgroundColor: adm.card, marginBottom: 12, shadowColor: 'rgba(239,68,68,0.12)', shadowOpacity: report.resolvedAt ? 0 : 1, shadowRadius: 12 }}>
      <Pressable onPress={() => { const n = !open; setOpen(n); if (n) loadDetail(); }} style={{ paddingVertical: 14, paddingHorizontal: 18, backgroundColor: report.resolvedAt ? adm.surface : 'rgba(239,68,68,0.08)', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        {!report.resolvedAt && <Pulse />}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            {!report.resolvedAt ? <StatusPill text="AKTİF TALEP" color={adm.red} bg="rgba(239,68,68,0.25)" border="rgba(239,68,68,0.5)" pad={[2, 8]} />
              : <AT w={700} style={{ fontSize: 9, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(34,197,94,0.15)', color: adm.green, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>ÇÖZÜMLENDI</AT>}
            <AMono style={{ fontSize: 9 }}>{fmtTR(report.createdAt)}</AMono>
            {!report.resolvedAt && <AMono style={{ fontSize: 9, color: adm.amber }}>+{elapsed} dk</AMono>}
          </View>
          <AT w={700} style={{ fontSize: 13 }}>{reqName}<AT style={{ fontSize: 11, color: adm.muted }}>  {report.user?.phone ?? report.user?.email ?? ''}</AT></AT>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
            {report.threats.map(t => <AT key={t} style={{ fontSize: 10, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(239,68,68,0.18)', color: 'rgba(239,100,100,0.9)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' }}>{THREAT[t] ?? t}</AT>)}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {!!dLat && !!dLng && <AT style={{ fontSize: 10, color: adm.cyan, marginBottom: 4 }} onPress={() => Linking.openURL(mapsHref(dLat, dLng))}>📍 Haritada Gör</AT>}
          <AT style={{ fontSize: 11, color: open ? adm.blue : adm.muted }}>{open ? '▲ Kapat' : '▼ Detay'}</AT>
        </View>
      </Pressable>
      {open && (
        <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: adm.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <AT style={{ fontSize: 11, color: adm.muted, flexShrink: 1 }}>
              {report.claimedBy ? <>İlgilenen: <AT w={700} style={{ fontSize: 11 }}>{claimedByMe ? 'Sen' : adminName(report.claimedBy)}</AT></> : 'Henüz kimse ilgilenmiyor'}
              {report.resolvedAt && <> · Çözen: <AT w={700} style={{ fontSize: 11, color: adm.green }}>{adminName(report.resolvedBy)}</AT> ({fmtTR(report.resolvedAt)})</>}
            </AT>
            {canClaim && <Btn variant="admBlueAct" style={{ marginLeft: 'auto' }} disabled={acting} label="İlgileniyorum" onPress={() => act('claim')} />}
            {canResolve && <Btn variant="admGreenAct" style={{ marginLeft: canClaim ? 0 : 'auto' }} disabled={acting} label="Çözüldü olarak işaretle" onPress={() => act('resolve')} />}
          </View>
          {!!actionError && <AT style={{ marginBottom: 12, fontSize: 11, color: adm.red }}>{actionError}</AT>}
          {loading && !detail && <AMono style={{ fontSize: 13 }}>Veriler yükleniyor…</AMono>}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Section title="ACİL YARDIM TALEP EDEN" accent={adm.red}><PersonRow p={requester} email={report.user?.email} phone={report.user?.phone ?? null} highlight /></Section>
              <Section title="DİĞER KATILIMCILAR" accent={adm.blue} mt>{report.participantSnapshot.filter(p => !p.isRequester).map((p, i) => <PersonRow key={i} p={p} email={p.email} phone={p.phone} />)}</Section>
              <Section title="MASA BİLGİSİ" accent={adm.cyan} mt>
                {report.meeting ? (<>
                  <KV label="Tür" value={report.meeting.type === 'GROUP' ? 'Grup' : 'Baş Başa'} />
                  <KV label="Saat" value={fmtTR(report.meeting.scheduledAt)} />
                  <KV label="Mekan" value={[report.meeting.locationText, report.meeting.venueAddress].filter(Boolean).join(', ') || '—'} />
                  <KV label="ID" value={<AT style={{ fontSize: 9, color: adm.muted, fontFamily: mono(400) }}>{report.meeting.id}</AT>} />
                </>) : <KV label="Masa" value="Silinmiş" />}
              </Section>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Section title="CANLI KONUM TAKİBİ" accent={adm.cyan}>
                {marker && <SosLiveMap lat={marker.lat} lng={marker.lng} />}
                {marker && !report.resolvedAt && (
                  <View style={{ marginBottom: 10 }}>
                    <Section title="AÇIK ADRES" accent={adm.cyan}>
                      {!liveAddress ? <AT style={{ fontSize: 11, color: adm.muted, marginVertical: 4 }}>Adres alınıyor…</AT> : (
                        <View style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: RED_DIM, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                          <AddrRows a={liveAddress} color={adm.text} keyW={96} fs={11} />
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><AT style={{ fontSize: 11, color: adm.muted, minWidth: 96 }}>Son güncelleme</AT><AT style={{ fontSize: 11 }}>{fmtTime(liveAddress.guncelleme)}</AT></View>
                        </View>
                      )}
                    </Section>
                  </View>
                )}
                {allLocs.length === 0 && !dLat ? <AT style={{ fontSize: 11, color: adm.muted, marginVertical: 8 }}>Konum verisi yok</AT> : (
                  <>
                    {close.length > 0 && reqLoc && (
                      <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginBottom: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)' }}>
                        <AT w={700} style={{ fontSize: 13, color: adm.red }}>⚠ YAKINDA KATILIMCI TESPİT EDİLDİ</AT>
                        {close.map(p => <AMono key={p.userId} style={{ marginTop: 4, fontSize: 11, color: 'rgba(239,68,68,0.8)' }}>→ {p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.userId.slice(0, 8)}: {Math.round(haversineM(reqLoc.lat, reqLoc.lng, p.lat, p.lng))}m mesafede</AMono>)}
                      </View>
                    )}
                    {reqLoc && <CoordRow loc={reqLoc} isRequester />}
                    {others.map(l => <CoordRow key={l.userId} loc={l} isRequester={false} />)}
                    {!reqLoc && !!dLat && !!dLng && <AT style={{ fontSize: 11, color: adm.cyan }} onPress={() => Linking.openURL(mapsHref(dLat, dLng))}>📍 {dLat.toFixed(5)}, {dLng.toFixed(5)} (ilk konum)</AT>}
                  </>
                )}
              </Section>
              {(detail?.locationUpdates?.length ?? 0) > 0 && (
                <Section title="KONUM GEÇMİŞİ (TALEP EDEN)" accent={adm.muted} mt>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {(detail?.locationUpdates ?? []).slice().reverse().map((lu, i) => (
                      <View key={i} style={{ marginBottom: 8 }}>
                        <AMono style={{ fontSize: 10 }}>{fmtTime(lu.timestamp)}</AMono>
                        {!lu.address ? <AT style={{ marginTop: 2, fontSize: 10, color: adm.muted }}>Adres alınıyor…</AT> : <View style={{ marginTop: 2 }}><AddrRows a={lu.address} color="rgba(34,211,238,0.85)" keyW={80} fs={10} /></View>}
                      </View>
                    ))}
                  </ScrollView>
                </Section>
              )}
              <AMono style={{ fontSize: 9, marginTop: 12 }}>RAPOR {report.id}</AMono>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Clock() {
  const [t, setT] = useState('');
  useEffect(() => { const u = () => setT(new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })); u(); const id = setInterval(u, 1000); return () => clearInterval(id); }, []);
  return <AMono style={{ fontSize: 13, color: adm.cyan, letterSpacing: 1.3 }}>{t}</AMono>;
}

export default function AcilYardim() {
  const router = useRouter();
  const [reports, setReports] = useState<SosReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [left, setLeft] = useState(REFRESH_SEC);
  const [tick, setTick] = useState(0);
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'done'>('idle');
  const fetchReports = useCallback(async (manual = false) => {
    setLeft(REFRESH_SEC); setTick(t => t + 1); if (manual) setRefreshState('loading');
    let ok = false;
    try { setReports(await api.get<SosReport[]>('/sos/admin/reports')); setFetchError(''); setLastFetch(new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })); ok = true; }
    catch (e) { setFetchError(`Yenilenemedi: ${(e as Error).message}`); } finally { setLoading(false); if (manual) setRefreshState(ok ? 'done' : 'idle'); }
  }, []);
  useEffect(() => { if (refreshState !== 'done') return; const id = setTimeout(() => setRefreshState('idle'), 1500); return () => clearTimeout(id); }, [refreshState]);
  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { const id = setInterval(() => setLeft(s => s - 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (left <= 0) fetchReports(); }, [left, fetchReports]);
  const active = reports.filter(r => !r.resolvedAt); const resolved = reports.filter(r => !!r.resolvedAt);
  const [liveLocs, setLiveLocs] = useState<Record<string, LivePos>>({});
  const [liveAddrs, setLiveAddrs] = useState<Record<string, LiveAddress>>({});
  const openKey = active.filter(r => !r.restricted).map(r => r.id).join(',');
  useEffect(() => {
    if (!openKey) return;
    let busy = false;
    const id = setInterval(() => {
      if (busy) return; busy = true;
      api.get<{ reportId: string; location: LivePos | null; address: LiveAddress | null }[]>('/sos/admin/reports/open-locations').then(rows => {
        if (rows.length === 0) { clearInterval(id); return; }
        setLiveLocs(p => { const n = { ...p }; for (const r of rows) if (r.location) n[r.reportId] = r.location; return n; });
        setLiveAddrs(p => { const n = { ...p }; for (const r of rows) if (r.address) n[r.reportId] = r.address; return n; });
      }).catch(() => undefined).finally(() => { busy = false; });
    }, 1000);
    return () => clearInterval(id);
  }, [openKey]);
  return (
    <View style={{ flex: 1, backgroundColor: adm.bg }}>
      {/* .adm-topbar (mobil: dikey) */}
      <View style={{ minHeight: 56, paddingVertical: 8, paddingHorizontal: 16, gap: 6, backgroundColor: adm.surface, borderBottomWidth: 1, borderBottomColor: adm.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Btn variant="admBack" label="←" accessibilityLabel="Geri" onPress={() => router.navigate('/admin/stats')} />
          <Pulse color={active.length > 0 ? adm.red : adm.green} />
          <ATitle style={{ fontSize: 18, color: active.length > 0 ? adm.red : adm.text }}>Acil Yardım Merkezi</ATitle>
          {active.length > 0 && <AT w={800} style={{ fontSize: 11, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(239,68,68,0.2)', color: adm.red, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)' }}>{active.length} AKTİF</AT>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <AMono style={{ fontSize: 10 }}>Son: {lastFetch || '—'} · Yenileme: {Math.max(0, left)} sn</AMono>
          <Clock />
          <Btn variant="admRefresh" selected={refreshState === 'done'} disabled={refreshState === 'loading'} label={refreshState === 'loading' ? 'Yenileniyor…' : refreshState === 'done' ? 'Yenilendi ✓' : 'Yenile'} textStyle={{ fontSize: 10 }} onPress={() => fetchReports(true)} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: adm.pagePad, paddingBottom: 48 }}>
        <AError>{fetchError}</AError>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'AKTİF TALEP', value: active.length, color: active.length > 0 ? adm.red : adm.green },
            { label: 'TOPLAM TALEP', value: reports.length, color: adm.blue },
            { label: 'ÇÖZÜMLENDI', value: resolved.length, color: adm.green },
            { label: 'ÜYE TAKİBİ', value: active.reduce((a, r) => a + (r.participantSnapshot?.length ?? 0), 0), color: adm.cyan },
          ].map(st => (
            <ACard key={st.label} style={{ flexBasis: '46%', flexGrow: 1 }}>
              <ALabel style={{ marginBottom: 4 }}>{st.label}</ALabel>
              <AMono w={600} style={{ fontSize: 20, color: st.color }}>{st.value}</AMono>
            </ACard>
          ))}
        </View>
        {loading ? <View style={{ gap: 8 }}>{[1, 2].map(i => <View key={i} style={{ height: 80, backgroundColor: adm.card, borderRadius: 12, borderWidth: 1, borderColor: adm.border, opacity: 0.5 }} />)}</View>
          : reports.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <AT style={{ fontSize: 48, marginBottom: 16 }}>✅</AT>
              <AT w={600} style={{ fontSize: 14, color: adm.green }}>Sistem nominal. Aktif talep yok</AT>
              <AMono style={{ fontSize: 11, marginTop: 6 }}>Otomatik izleme aktif · 15s</AMono>
            </View>
          ) : (
            <View>
              {active.length > 0 && (
                <View style={{ marginBottom: 32 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}><Pulse /><ALabel style={{ color: adm.red }}>AKTİF TALEPLER: {active.length}</ALabel></View>
                  {active.map((r, i) => <ReportCard key={r.id} report={r} index={i} tick={tick} onChanged={fetchReports} livePos={liveLocs[r.id] ?? null} liveAddress={liveAddrs[r.id] ?? null} />)}
                </View>
              )}
              {resolved.length > 0 && (
                <View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}><ALabel>ÇÖZÜMLENEN: {resolved.length}</ALabel></View>
                  {resolved.map((r, i) => <ReportCard key={r.id} report={r} index={i} tick={tick} onChanged={fetchReports} />)}
                </View>
              )}
            </View>
          )}
      </ScrollView>
    </View>
  );
}
