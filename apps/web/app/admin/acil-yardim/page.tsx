'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ─── Tipler ─────────────────────────────────────────────────────────────────

interface LocUpdate { lat: number; lng: number; accuracy: number | null; timestamp: string; }

interface ParticipantLoc {
  id: string; userId: string; lat: number; lng: number; accuracy: number | null; timestamp: string;
  user: { id: string; profile: { firstName: string; lastName: string } | null };
}

interface Participant {
  userId: string; firstName: string | null; lastName: string | null;
  email: string; phone: string | null; age: number | null;
  gender: string | null; occupation: string | null; city: string | null;
  isRequester: boolean;
}

interface SosReport {
  id: string; createdAt: string; threats: string[];
  lat: number | null; lng: number | null; accuracy: number | null;
  resolvedAt: string | null;
  participantSnapshot: Participant[];
  user: { id: string; email: string; phone: string | null; profile: { firstName: string; lastName: string } | null };
  meeting: { id: string; type: string; scheduledAt: string; locationText: string | null; venueAddress: string | null };
  locationUpdates: LocUpdate[];
  allParticipantLocations?: ParticipantLoc[];
  participantLocationHistory?: ParticipantLoc[];
}

// ─── Sabitler ────────────────────────────────────────────────────────────────

const THREAT_LABELS: Record<string, string> = {
  LIFE_DANGER: 'Hayatım tehlikede',
  PHYSICAL_VIOLENCE: 'Fiziksel şiddet gördüm',
  ABDUCTION: 'Zorla alıkoyuluyorum',
  HARASSMENT: 'Taciz veya istismara uğradım',
};
const GENDER_TR: Record<string, string> = {
  MALE: 'E', FEMALE: 'K', OTHER: 'D', PREFER_NOT_TO_SAY: '—',
};

// ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────

function fmtTR(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'medium' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function secondsAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}
function mapsHref(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── CSS / stil sabitleri ───────────────────────────────────────────────────

const BG      = '#020c1b';
const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const RED     = '#ef4444';
const RED_DIM = 'rgba(239,68,68,0.15)';
const BLUE    = '#3b82f6';
const BLUE_DIM= 'rgba(59,130,246,0.12)';
const CYAN    = '#22d3ee';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const AMBER   = '#f59e0b';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';
const SANS    = 'Inter, system-ui, sans-serif';

const s = {
  page: { minHeight: '100vh', background: BG, color: TEXT, fontFamily: SANS } as React.CSSProperties,
  topbar: {
    background: SURFACE, borderBottom: `1px solid ${BORDER}`,
    padding: '0 24px', height: 56, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', position: 'sticky' as const, top: 0, zIndex: 100,
    boxShadow: '0 2px 20px rgba(0,0,0,0.5)',
  },
  main: { padding: '24px', maxWidth: 1400, margin: '0 auto' } as React.CSSProperties,
};

// ─── Bileşenler ──────────────────────────────────────────────────────────────

function Pulse({ color = RED }: { color?: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 10, height: 10, flexShrink: 0 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', background: color,
        animation: 'pulse-ring 1.4s ease-out infinite',
      }} />
      <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: color }} />
    </span>
  );
}

function LiveBadge({ ts }: { ts: string }) {
  const [ago, setAgo] = useState(secondsAgo(ts));
  useEffect(() => {
    const id = setInterval(() => setAgo(secondsAgo(ts)), 1000);
    return () => clearInterval(id);
  }, [ts]);
  const fresh = ago < 60;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontFamily: MONO, fontWeight: 700,
      background: fresh ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)',
      border: `1px solid ${fresh ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.35)'}`,
      color: fresh ? GREEN : AMBER,
    }}>
      <Pulse color={fresh ? GREEN : AMBER} />
      {ago < 60 ? `${ago}s önce` : `${Math.floor(ago / 60)}d ${ago % 60}s önce`}
    </span>
  );
}

const addrCache = new Map<string, string>();
const addrPending = new Map<string, Promise<string>>();
const ADDR_CACHE_MAX = 200;
// Nominatim ToS: max 1 istek/saniye — seri kuyruk; aynı key için tek istek (dedup)
let _geoQueue = Promise.resolve();
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (addrCache.has(key)) return addrCache.get(key)!;
  if (addrPending.has(key)) return addrPending.get(key)!;
  const p = new Promise<string>((resolve) => {
    _geoQueue = _geoQueue.then(async () => {
      try {
        if (addrCache.has(key)) { resolve(addrCache.get(key)!); return; }
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`,
          { headers: { 'User-Agent': 'Ahenk-Admin/1.0' } },
        );
        const data = await res.json();
        const a = data.address ?? {};
        const parts = [
          a.road ?? a.pedestrian ?? a.path,
          a.neighbourhood ?? a.suburb ?? a.quarter,
          a.district ?? a.county,
          a.city ?? a.town ?? a.village ?? a.state,
        ].filter(Boolean);
        const addr = parts.join(', ') || data.display_name?.split(',').slice(0, 3).join(',').trim() || '';
        if (addrCache.size >= ADDR_CACHE_MAX) addrCache.clear();
        addrCache.set(key, addr);
        addrPending.delete(key);
        resolve(addr);
      } catch { addrPending.delete(key); resolve(''); }
      await new Promise(r => setTimeout(r, 1100));
    });
  });
  addrPending.set(key, p);
  return p;
}

function CoordRow({ loc, isRequester }: { loc: ParticipantLoc; isRequester: boolean }) {
  const name = loc.user.profile ? `${loc.user.profile.firstName} ${loc.user.profile.lastName}` : loc.userId.slice(0, 8);
  const [addr, setAddr] = useState('');

  useEffect(() => {
    let alive = true;
    reverseGeocode(loc.lat, loc.lng).then(a => { if (alive) setAddr(a); });
    return () => { alive = false; };
  }, [loc.lat, loc.lng]);

  return (
    <div style={{
      padding: '8px 10px', borderRadius: 6,
      background: isRequester ? RED_DIM : BLUE_DIM,
      border: `1px solid ${isRequester ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.2)'}`,
      marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Pulse color={isRequester ? RED : BLUE} />
        <span style={{ fontSize: 11, fontWeight: 600, color: isRequester ? RED : CYAN, minWidth: 110, fontFamily: SANS, flexShrink: 0 }}>
          {name}{isRequester ? ' ★' : ''}
        </span>
        <a href={mapsHref(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontFamily: MONO, color: TEXT, flex: 1, textDecoration: 'none' }}>
          {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
        </a>
        {loc.accuracy && (
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, flexShrink: 0 }}>±{Math.round(loc.accuracy)}m</span>
        )}
        <LiveBadge ts={loc.timestamp} />
      </div>
      {addr && (
        <p style={{ margin: '4px 0 0 24px', fontSize: 10.5, color: isRequester ? 'rgba(239,100,100,0.8)' : CYAN, fontFamily: SANS, lineHeight: 1.4 }}>
          📍 {addr}
        </p>
      )}
    </div>
  );
}

function HistoryRow({ lu }: { lu: LocUpdate }) {
  const [addr, setAddr] = useState('');
  useEffect(() => {
    let alive = true;
    reverseGeocode(lu.lat, lu.lng).then(a => { if (alive) setAddr(a); });
    return () => { alive = false; };
  }, [lu.lat, lu.lng]);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, minWidth: 56 }}>{fmtTime(lu.timestamp)}</span>
        <a href={mapsHref(lu.lat, lu.lng)} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 10, color: CYAN, fontFamily: MONO, textDecoration: 'none' }}>
          {lu.lat.toFixed(5)}, {lu.lng.toFixed(5)}
        </a>
        {lu.accuracy && <span style={{ fontSize: 9, color: MUTED }}>±{Math.round(lu.accuracy)}m</span>}
      </div>
      {addr && (
        <p style={{ margin: '2px 0 0 56px', fontSize: 10, color: 'rgba(34,211,238,0.65)', fontFamily: SANS }}>
          {addr}
        </p>
      )}
    </div>
  );
}

function ProximityAlert({ requester, others }: { requester: ParticipantLoc | null; others: ParticipantLoc[] }) {
  if (!requester) return null;
  const close = others.filter(o => haversineM(requester.lat, requester.lng, o.lat, o.lng) < 100);
  if (close.length === 0) return null;
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 12,
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)',
    }}>
      <p style={{ margin: 0, fontSize: 12, color: RED, fontWeight: 700, fontFamily: SANS }}>
        ⚠ YAKINDA KATILIMCI TESPİT EDİLDİ
      </p>
      {close.map(p => {
        const m = Math.round(haversineM(requester.lat, requester.lng, p.lat, p.lng));
        const name = p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.userId.slice(0, 8);
        return (
          <p key={p.userId} style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(239,68,68,0.8)', fontFamily: MONO }}>
            → {name} — {m}m mesafede
          </p>
        );
      })}
    </div>
  );
}

function ReportCard({ report, index }: { report: SosReport; index: number }) {
  const [open, setOpen]   = useState(index === 0);
  const [detail, setDetail] = useState<SosReport | null>(null);
  const [loading, setLoading] = useState(false);

  const requester     = report.participantSnapshot.find(p => p.isRequester);
  const reqName       = requester?.firstName ? `${requester.firstName} ${requester.lastName}` : report.user.email;
  const latest        = detail
    ? detail.locationUpdates[detail.locationUpdates.length - 1]
    : report.locationUpdates[report.locationUpdates.length - 1];
  const displayLat    = latest?.lat ?? report.lat;
  const displayLng    = latest?.lng ?? report.lng;
  const elapsedMin    = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / 60000);

  async function loadDetail() {
    if (detail || loading) return;
    setLoading(true);
    try {
      const d = await api.get<SosReport>(`/sos/admin/reports/${report.id}`);
      setDetail(d);
    } finally { setLoading(false); }
  }

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) loadDetail();
  }

  const allLocs  = detail?.allParticipantLocations ?? [];
  const reqLoc   = allLocs.find(l => l.userId === report.user.id) ?? null;
  const otherLoc = allLocs.filter(l => l.userId !== report.user.id);

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: `1.5px solid ${report.resolvedAt ? BORDER : 'rgba(239,68,68,0.6)'}`,
      background: CARD,
      boxShadow: report.resolvedAt ? 'none' : '0 0 24px rgba(239,68,68,0.12)',
      marginBottom: 12,
    }}>
      {/* Başlık */}
      <div
        onClick={handleOpen}
        style={{
          padding: '14px 18px', cursor: 'pointer',
          background: report.resolvedAt ? SURFACE : 'rgba(239,68,68,0.08)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        {!report.resolvedAt && <Pulse color={RED} />}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
            {!report.resolvedAt && (
              <span style={{
                fontSize: 9, fontWeight: 900, letterSpacing: '0.15em',
                padding: '2px 8px', borderRadius: 99,
                background: 'rgba(239,68,68,0.25)', color: RED,
                border: '1px solid rgba(239,68,68,0.5)',
              }}>
                AKTİF TALEP
              </span>
            )}
            {report.resolvedAt && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: GREEN, border: '1px solid rgba(34,197,94,0.3)' }}>
                ÇÖZÜMLENDI
              </span>
            )}
            <span style={{ fontSize: 9, fontFamily: MONO, color: MUTED }}>{fmtTR(report.createdAt)}</span>
            {!report.resolvedAt && (
              <span style={{ fontSize: 9, fontFamily: MONO, color: AMBER }}>+{elapsedMin} dk</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT }}>
            {reqName}
            <span style={{ fontWeight: 400, color: MUTED, marginLeft: 8, fontSize: 11 }}>
              {report.user.phone ?? report.user.email}
            </span>
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 5 }}>
            {report.threats.map(t => (
              <span key={t} style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 99,
                background: 'rgba(239,68,68,0.18)', color: 'rgba(239,100,100,0.9)',
                border: '1px solid rgba(239,68,68,0.35)',
              }}>
                {THREAT_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
          {displayLat && displayLng && (
            <a href={mapsHref(displayLat, displayLng)} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 10, color: CYAN, display: 'block', marginBottom: 4, textDecoration: 'none' }}>
              📍 Haritada Gör
            </a>
          )}
          <span style={{ fontSize: 11, color: open ? BLUE : MUTED }}>{open ? '▲ Kapat' : '▼ Detay'}</span>
        </div>
      </div>

      {/* Detay paneli */}
      {open && (
        <div style={{ padding: '18px', borderTop: `1px solid ${BORDER}` }}>
          {loading && (
            <p style={{ color: MUTED, fontSize: 12, fontFamily: MONO }}>Veriler yükleniyor…</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Sol: Katılımcılar */}
            <div>
              {/* Talep Eden */}
              <Section title="ACİL YARDIM TALEP EDEN" accent={RED}>
                <PersonRow
                  p={requester}
                  email={report.user.email}
                  phone={report.user.phone}
                  highlight
                />
              </Section>

              {/* Diğer katılımcılar */}
              <Section title="DİĞER KATILIMCILAR" accent={BLUE} mt>
                {report.participantSnapshot.filter(p => !p.isRequester).map((p, i) => (
                  <PersonRow key={i} p={p} email={p.email} phone={p.phone} />
                ))}
              </Section>

              {/* Masa */}
              <Section title="MASA BİLGİSİ" accent={CYAN} mt>
                <Row label="Tür" value={report.meeting.type === 'GROUP' ? 'Grup' : 'Baş Başa'} />
                <Row label="Saat" value={fmtTR(report.meeting.scheduledAt)} />
                <Row label="Mekan" value={[report.meeting.locationText, report.meeting.venueAddress].filter(Boolean).join(' — ') || '—'} />
                <Row label="ID" value={<code style={{ fontSize: 9, color: MUTED }}>{report.meeting.id}</code>} />
              </Section>
            </div>

            {/* Sağ: Konum takibi */}
            <div>
              <Section title="CANLI KONUM TAKİBİ" accent={CYAN}>
                {allLocs.length === 0 && !displayLat ? (
                  <p style={{ fontSize: 11, color: MUTED, margin: '8px 0' }}>Konum verisi yok</p>
                ) : (
                  <>
                    <ProximityAlert requester={reqLoc} others={otherLoc} />
                    {reqLoc && <CoordRow loc={reqLoc} isRequester />}
                    {otherLoc.map(l => <CoordRow key={l.userId} loc={l} isRequester={false} />)}
                    {!reqLoc && displayLat && displayLng && (
                      <a href={mapsHref(displayLat, displayLng)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: CYAN, textDecoration: 'none' }}>
                        📍 {displayLat.toFixed(5)}, {displayLng.toFixed(5)} — ilk konum
                      </a>
                    )}
                  </>
                )}
              </Section>

              {/* Konum geçmişi (talep eden) */}
              {(detail?.locationUpdates?.length ?? 0) > 0 && (
                <Section title="KONUM GEÇMİŞİ (TALEP EDEN)" accent={MUTED} mt>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {(detail?.locationUpdates ?? []).slice().reverse().map((lu, i) => (
                      <HistoryRow key={i} lu={lu} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Rapor ID */}
              <p style={{ fontSize: 9, color: MUTED, fontFamily: MONO, marginTop: 12 }}>
                RAPOR {report.id}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, accent, children, mt }: { title: string; accent: string; children: React.ReactNode; mt?: boolean }) {
  return (
    <div style={{ marginTop: mt ? 16 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 2, height: 12, borderRadius: 1, background: accent }} />
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: accent, fontFamily: SANS }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: MUTED, minWidth: 56, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: TEXT }}>{value}</span>
    </div>
  );
}

function PersonRow({ p, email, phone, highlight }: { p: Participant | undefined; email: string; phone: string | null; highlight?: boolean }) {
  if (!p) return <p style={{ fontSize: 11, color: MUTED }}>—</p>;
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, marginBottom: 4,
      background: highlight ? RED_DIM : BLUE_DIM,
      border: `1px solid ${highlight ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.2)'}`,
    }}>
      <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: highlight ? RED : CYAN }}>
        {p.firstName} {p.lastName}
        {p.age ? <span style={{ fontWeight: 400, color: MUTED, marginLeft: 6, fontSize: 10 }}>{p.age} yaş</span> : null}
        {p.gender ? <span style={{ fontWeight: 400, color: MUTED, marginLeft: 4, fontSize: 10 }}>{GENDER_TR[p.gender] ?? p.gender}</span> : null}
      </p>
      <p style={{ margin: 0, fontSize: 10, color: MUTED, fontFamily: MONO }}>
        {email} {phone ? `· ${phone}` : ''}
      </p>
      {(p.occupation || p.city) && (
        <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED }}>
          {[p.occupation, p.city].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}

function Clock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const update = () => setT(new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontFamily: MONO, fontSize: 13, color: CYAN, letterSpacing: '0.1em' }}>{t}</span>;
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────

export default function AcilYardimPage() {
  const router = useRouter();
  const [reports, setReports] = useState<SosReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState('');
  const fetchReports = useCallback(async () => {
    try {
      const data = await api.get<SosReport[]>('/sos/admin/reports');
      setReports(data);
      setLastFetch(new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }));
    } catch {
      // sessiz hata — layout zaten auth kontrolü yapıyor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const id = setInterval(fetchReports, 15000);
    return () => clearInterval(id);
  }, [fetchReports]);

  const active   = reports.filter(r => !r.resolvedAt);
  const resolved = reports.filter(r => !!r.resolvedAt);

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.9; }
          70%  { transform: scale(2.4); opacity: 0;   }
          100% { transform: scale(2.4); opacity: 0;   }
        }
        @keyframes scanline {
          0%   { top: -10%; }
          100% { top: 110%; }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #020c1b; }
        ::-webkit-scrollbar-thumb { background: #1a3a5c; border-radius: 2px; }
      `}</style>

      <div style={s.page}>
        {/* Topbar */}
        <header style={s.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => router.push('/')}
              style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
              ←
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Pulse color={active.length > 0 ? RED : GREEN} />
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.18em', color: active.length > 0 ? RED : TEXT }}>
                ACİL YARDIM MERKEZİ
              </span>
            </div>
            {active.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 99,
                background: 'rgba(239,68,68,0.2)', color: RED,
                border: '1px solid rgba(239,68,68,0.5)',
                animation: 'none',
              }}>
                {active.length} AKTİF
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>
              Son: {lastFetch || '—'} · 15s yenileme
            </span>
            <Clock />
            <button
              onClick={fetchReports}
              style={{
                background: BLUE_DIM, border: `1px solid rgba(59,130,246,0.3)`,
                color: BLUE, fontSize: 11, padding: '5px 12px', borderRadius: 6,
                cursor: 'pointer', fontFamily: SANS,
              }}
            >
              Yenile
            </button>
          </div>
        </header>

        <main style={s.main}>
          {/* İstatistik şeridi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'AKTİF TALEP',   value: active.length,   color: active.length > 0 ? RED : GREEN },
              { label: 'TOPLAM TALEP',  value: reports.length,  color: BLUE },
              { label: 'ÇÖZÜMLENDI',    value: resolved.length, color: GREEN },
              { label: 'ÜYE TAKİBİ',   value: active.reduce((a, r) => a + r.participantSnapshot.length, 0), color: CYAN },
            ].map(stat => (
              <div key={stat.label} style={{
                background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px',
              }}>
                <p style={{ margin: '0 0 4px', fontSize: 8, fontWeight: 800, letterSpacing: '0.18em', color: MUTED, fontFamily: SANS }}>
                  {stat.label}
                </p>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: stat.color, fontFamily: MONO }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2].map(i => (
                <div key={i} style={{ height: 80, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`,
                  animation: 'none', opacity: 0.5 }} />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <p style={{ fontSize: 14, color: GREEN, fontWeight: 600 }}>Sistem nominal — Aktif talep yok</p>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 6, fontFamily: MONO }}>Otomatik izleme aktif · 15s</p>
            </div>
          ) : (
            <div>
              {active.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Pulse color={RED} />
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: RED }}>
                      AKTİF TALEPLER — {active.length}
                    </span>
                  </div>
                  {active.map((r, i) => <ReportCard key={r.id} report={r} index={i} />)}
                </div>
              )}

              {resolved.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: MUTED }}>
                      ÇÖZÜMLENEN — {resolved.length}
                    </span>
                  </div>
                  {resolved.map((r, i) => <ReportCard key={r.id} report={r} index={i} />)}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
