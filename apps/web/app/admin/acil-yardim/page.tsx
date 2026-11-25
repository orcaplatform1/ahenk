'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api, API_PREFIX } from '@/lib/api';
import { AdminUserPhoto } from '@/components/AdminUserPhoto';
import { myRole, myId } from '@/lib/adminRole';
import { BG, SURFACE, CARD, BORDER, TEXT, MUTED, RED, GREEN, AMBER, BLUE, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';

// Harita yalnızca istemcide yüklenir (SSR yok): NEXT_PUBLIC_GOOGLE_MAPS_API_KEY varsa Google Maps, yoksa Leaflet / OSM
const SosLiveMap = dynamic(() => import('@/components/SosLiveMap'), { ssr: false });

// Canlı harita: sayfa düzeyindeki 1 sn'lik tek istekten gelen, talep edenin en yeni konumu
type LivePos = { lat: number; lng: number; timestamp: string };
// Açık adres: backend Nominatim'den 15 sn'de bir çözer, open-locations ucuyla birlikte gelir
type LiveAddress = {
  il: string | null; ilce: string | null; mahalle: string | null; caddeSokak: string | null;
  binaNo: string | null; postaKodu: string | null; tamAdres: string | null; guncelleme: string;
  kisaAdres?: string;
};

// ─── Tipler ─────────────────────────────────────────────────────────────────

interface LocUpdate { lat: number; lng: number; accuracy: number | null; timestamp: string; address?: LiveAddress | null; }

interface Participant {
  userId: string; firstName: string | null; lastName: string | null;
  email?: string; phone: string | null; age: number | null;
  gender: string | null; occupation: string | null; city: string | null;
  isRequester: boolean;
  isBot?: boolean; // sadece SUPERADMIN'e gelir
}

interface AdminRef { id: string; profile: { firstName: string; lastName: string } | null }

interface SosReport {
  id: string; createdAt: string; threats: string[];
  lat: number | null; lng: number | null; accuracy: number | null;
  resolvedAt: string | null;
  restricted: boolean; // başka admin üstlendi: veri gelmez
  claimedAt: string | null;
  claimedBy: AdminRef | null;
  resolvedBy?: AdminRef | null;
  lastAddress?: string | null;   // çözülünce: son konumun açık adresi (koordinat ve konum geçmişi silinir)
  lastLocationAt?: string | null;
  locationStale?: boolean;          // açık talep: son konum 2 dk'dan eski (admin detay)
  liveLocationAt?: string | null;
  participantSnapshot: Participant[];
  people?: Record<string, { photoUrl: string | null; kycId: string | null }>; // detay: profil fotoğrafı ve kimlik ön yüzü
  emergencyNotifyFailed?: boolean; // acil durum kişisine WhatsApp bildirimi gönderilemedi
  emergencyContacts?: { slot: 1 | 2; name: string | null; phone: string }[]; // detay: talebi açanın acil durum kişileri (1 ya da 2)
  // Kullanıcı / masa silinirse null (SOS kaydı korunur)
  user: { id: string; email?: string; phone: string | null; profile: { firstName: string; lastName: string } | null } | null;
  meeting: { id: string; type: string; scheduledAt: string; locationText: string | null; venueAddress: string | null } | null;
  locationUpdates: LocUpdate[];
}

// ─── Sabitler ────────────────────────────────────────────────────────────────

const THREAT_LABELS: Record<string, string> = {
  LIFE_DANGER: 'Hayatım tehlikede',
  PHYSICAL_VIOLENCE: 'Fiziksel şiddet gördüm',
  ABDUCTION: 'Zorla alıkoyuluyorum',
  HARASSMENT: 'Taciz veya istismara uğradım',
};
const GENDER_TR: Record<string, string> = {
  MALE: 'E', FEMALE: 'K',
};

// ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────

const REFRESH_SEC = 15;

function adminName(a: AdminRef | null | undefined) {
  return a?.profile ? `${a.profile.firstName} ${a.profile.lastName}` : 'Bir admin';
}

function fmtTR(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'medium' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function mapsHref(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
// ─── CSS / stil sabitleri ───────────────────────────────────────────────────

const RED_DIM = 'rgba(239,68,68,0.15)';
const BLUE_DIM= 'rgba(59,130,246,0.12)';

const s = {
  page: { minHeight: '100vh', background: BG, color: TEXT, fontFamily: SANS } as React.CSSProperties,
  main: { maxWidth: 1400, margin: '0 auto' } as React.CSSProperties,
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


// Talep edenin güncel konumunun açık adresi (emniyete iletmek için); veri 1 sn'lik open-locations çekmesinden gelir
function OpenAddress({ address }: { address: LiveAddress | null }) {
  const rows: [string, string | null][] = address ? [
    ['İl', address.il],
    ['İlçe', address.ilce],
    ['Mahalle', address.mahalle],
    ['Cadde/Sokak', address.caddeSokak],
    ['Bina No', address.binaNo],
    ['Posta Kodu', address.postaKodu],
    ['Tam Adres', address.tamAdres],
    ['Son güncelleme', fmtTime(address.guncelleme)],
  ] : [];
  return (
    <div style={{ marginBottom: 10 }}>
      <Section title="AÇIK ADRES" accent={CYAN}>
        {!address ? (
          <p style={{ fontSize: 11, color: MUTED, margin: '4px 0', fontFamily: SANS }}>Adres alınıyor…</p>
        ) : (
          <div style={{ padding: '8px 10px', borderRadius: 6, background: RED_DIM, border: '1px solid rgba(239,68,68,0.3)' }}>
            {rows.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 10, fontSize: 11, lineHeight: 1.6, fontFamily: SANS }}>
                <span style={{ color: MUTED, minWidth: 96, flexShrink: 0 }}>{k}</span>
                <span style={{ color: TEXT, wordBreak: 'break-word' }}>{v || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// Konum geçmişi satırı: koordinat yerine açık adres bilgileri (backend Nominatim önbelleğinden, detayla birlikte gelir)
function HistoryRow({ lu }: { lu: LocUpdate }) {
  const a = lu.address ?? null;
  const rows: [string, string | null][] = a ? [
    ['İl', a.il],
    ['İlçe', a.ilce],
    ['Mahalle', a.mahalle],
    ['Cadde/Sokak', a.caddeSokak],
    ['Bina No', a.binaNo],
    ['Posta Kodu', a.postaKodu],
    ['Tam Adres', a.tamAdres],
  ] : [];
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{fmtTime(lu.timestamp)}</span>
      {!a ? (
        <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: SANS }}>Adres alınıyor…</p>
      ) : (
        <div style={{ marginTop: 2 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 10, fontSize: 10, lineHeight: 1.5, fontFamily: SANS }}>
              <span style={{ color: MUTED, minWidth: 80, flexShrink: 0 }}>{k}</span>
              <span style={{ color: 'rgba(34,211,238,0.85)', wordBreak: 'break-word' }}>{v || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, index, tick, onChanged, livePos, liveAddress, liveStale }: { report: SosReport; index: number; tick: number; onChanged: () => void; livePos?: LivePos | null; liveAddress?: LiveAddress | null; liveStale?: boolean }) {
  if (report.restricted) {
    return (
      <div style={{ borderRadius: 12, border: `1px solid ${BORDER}`, background: SURFACE, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        {!report.resolvedAt && <Pulse color={AMBER} />}
        <span style={{ fontSize: 13, color: TEXT }}>
          {report.resolvedAt ? 'Çözülmüş talep' : 'Aktif talep'}: <strong>{adminName(report.claimedBy)}</strong> ilgileniyor
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: MONO, color: MUTED }}>{fmtTR(report.createdAt)}</span>
      </div>
    );
  }
  return <ReportCardFull report={report} index={index} tick={tick} onChanged={onChanged} livePos={livePos ?? null} liveAddress={liveAddress ?? null} liveStale={liveStale} />;
}

function ReportCardFull({ report, index, tick, onChanged, livePos, liveAddress, liveStale }: { report: SosReport; index: number; tick: number; onChanged: () => void; livePos: LivePos | null; liveAddress: LiveAddress | null; liveStale?: boolean }) {
  const [open, setOpen]   = useState(index === 0 && !report.resolvedAt);
  const [detail, setDetail] = useState<SosReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');
  const isSuperadmin = myRole() === 'SUPERADMIN';
  const me = myId();
  const claimedByMe = !!report.claimedBy && report.claimedBy.id === me;
  const canClaim = !report.resolvedAt && !report.claimedBy;
  const canResolve = !report.resolvedAt && (isSuperadmin || claimedByMe);

  async function act(path: 'claim' | 'resolve') {
    setActing(true); setActionError('');
    try {
      await api.patch(`/sos/admin/reports/${report.id}/${path}`, {});
      onChanged();
    } catch (e) { setActionError((e as Error).message); }
    finally { setActing(false); }
  }

  const requester     = report.participantSnapshot.find(p => p.isRequester);
  const people        = detail?.people ?? {};
  const latest        = detail
    ? detail.locationUpdates[detail.locationUpdates.length - 1]
    : report.locationUpdates[report.locationUpdates.length - 1];
  const displayLat    = latest?.lat ?? report.lat;
  const displayLng    = latest?.lng ?? report.lng;
  const elapsedMin    = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / 60000);

  async function loadDetail() {
    setLoading(true);
    try {
      const d = await api.get<SosReport>(`/sos/admin/reports/${report.id}`);
      setDetail(d);
    } catch { /* yetki değiştiyse liste yenilemesi kartı kısıtlı gösterir */ }
    finally { setLoading(false); }
  }

  // Açık kart her yenilemede (sayaç / Yenile) canlı konumla birlikte güncellenir
  useEffect(() => { if (open) loadDetail(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) loadDetail();
  }

  // Haritadaki işaret: talep edenin en yeni konumu (talep konum güncellemesi, yoksa talep anındaki konum)
  const mapPos = displayLat != null && displayLng != null ? { lat: displayLat, lng: displayLng } : null;
  // 1 sn'lik canlı konum varsa işaret onu izler
  const markerPos = livePos ?? mapPos;

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
                ...LABEL,
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
          {/* Konum kesildi: açık talepte son konum 2 dk'dan eski (1 sn'lik open-locations ya da detay); yeni konum gelince kalkar */}
          {!report.resolvedAt && (liveStale ?? detail?.locationStale) && (() => {
            const at = livePos?.timestamp ?? detail?.liveLocationAt ?? null;
            const addr = liveAddress?.tamAdres ?? liveAddress?.kisaAdres ?? null;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                <span style={{ ...LABEL, padding: '2px 8px', borderRadius: 99, background: RED, color: '#fff', border: `1px solid ${RED}` }}>KONUM KESİLDİ</span>
                {at && <span style={{ fontSize: 9, fontFamily: MONO, color: MUTED }}>Son konum: {fmtTR(at)}</span>}
                {addr && <span style={{ fontSize: 10, color: TEXT, fontFamily: SANS }}>{addr}</span>}
              </div>
            );
          })()}
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
          {/* "Haritada Gör" ve "Kapat" / "Detay" buton görünümünde */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {!report.resolvedAt && displayLat && displayLng && (
              <a href={mapsHref(displayLat, displayLng)} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ padding: '5px 12px', borderRadius: 99, border: `1px solid ${CYAN}`, color: CYAN, fontSize: 11, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Haritada Gör
              </a>
            )}
            <span style={{ padding: '5px 12px', borderRadius: 99, border: `1px solid ${open ? BLUE : BORDER}`, color: open ? BLUE : TEXT, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{open ? 'Kapat' : 'Detay'}</span>
          </div>
        </div>
      </div>

      {/* Detay paneli */}
      {open && (
        <div style={{ padding: '18px', borderTop: `1px solid ${BORDER}` }}>
          {/* Üstlenme / çözme */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: MUTED }}>
              {report.claimedBy ? <>İlgilenen: <strong style={{ color: TEXT }}>{claimedByMe ? 'Sen' : adminName(report.claimedBy)}</strong></> : 'Henüz kimse ilgilenmiyor'}
              {report.resolvedAt && <> · Çözen: <strong style={{ color: GREEN }}>{adminName(report.resolvedBy)}</strong> ({fmtTR(report.resolvedAt)})</>}
            </span>
            {canClaim && (
              <button onClick={() => act('claim')} disabled={acting}
                style={{ marginLeft: 'auto', background: BLUE_DIM, border: '1px solid rgba(59,130,246,0.4)', color: BLUE, fontSize: 11, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: SANS, opacity: acting ? 0.5 : 1 }}>
                İlgileniyorum
              </button>
            )}
            {canResolve && (
              <button onClick={() => act('resolve')} disabled={acting}
                style={{ marginLeft: canClaim ? 0 : 'auto', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: GREEN, fontSize: 11, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: SANS, opacity: acting ? 0.5 : 1 }}>
                Çözüldü olarak işaretle
              </button>
            )}
          </div>
          {actionError && <p style={{ margin: '0 0 12px', fontSize: 11, color: RED }}>{actionError}</p>}
          {loading && !detail && (
            <p style={{ color: MUTED, fontSize: 13, fontFamily: MONO }}>Veriler yükleniyor…</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Sol: Katılımcılar */}
            <div>
              {/* Talep Eden */}
              <Section title="ACİL YARDIM TALEP EDEN" accent={RED}>
                <PersonRow p={requester} extra={requester ? people[requester.userId] : undefined} highlight />
              </Section>
              {(detail?.emergencyNotifyFailed ?? report.emergencyNotifyFailed) && (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: RED }}>Acil durum kişisine bildirim gönderilemedi</p>
              )}
              {/* Talebi açanın acil durum kişileri (ad + telefon) */}
              {!!detail?.emergencyContacts?.length && (
                <Section title="ACİL DURUM KİŞİLERİ" accent={RED} mt>
                  {detail.emergencyContacts.map((c) => (
                    <p key={c.slot} style={{ margin: '0 0 4px', fontSize: 12, color: '#e2e8f0' }}>{c.slot}. {c.name ?? '—'} · {c.phone}</p>
                  ))}
                </Section>
              )}

              {/* Diğer katılımcılar */}
              <Section title="DİĞER KATILIMCILAR" accent={BLUE} mt>
                {report.participantSnapshot.filter(p => !p.isRequester).map((p, i) => (
                  <PersonRow key={i} p={p} extra={people[p.userId]} />
                ))}
              </Section>

              {/* Masa */}
              <Section title="MASA BİLGİSİ" accent={CYAN} mt>
                {report.meeting ? (<>
                <Row label="Tür" value={report.meeting.type === 'GROUP' ? 'Grup' : 'Baş Başa'} />
                <Row label="Saat" value={fmtTR(report.meeting.scheduledAt)} />
                <Row label="Mekan" value={[report.meeting.locationText, report.meeting.venueAddress].filter(Boolean).join(', ') || '—'} />
                <Row label="ID" value={<code style={{ fontSize: 9, color: MUTED }}>{report.meeting.id}</code>} />
                </>) : <Row label="Masa" value="Silinmiş" />}
              </Section>
            </div>

            {/* Sağ: Konum takibi */}
            <div>
              {report.resolvedAt ? (
                // Çözülmüş talep: harita ve koordinat yok; yalnız son konumun açık adresi ve zamanı
                <Section title="SON KONUM" accent={CYAN}>
                  {report.lastAddress ? (
                    <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
                      <p style={{ margin: 0, fontSize: 11, color: TEXT, lineHeight: 1.6, fontFamily: SANS }}>{report.lastAddress}</p>
                      {report.lastLocationAt && <p style={{ margin: '4px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>{fmtTR(report.lastLocationAt)}</p>}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: MUTED, margin: '8px 0' }}>Konum verisi yok</p>
                  )}
                </Section>
              ) : (
              <Section title="CANLI KONUM TAKİBİ" accent={CYAN}>
                {markerPos && <SosLiveMap lat={markerPos.lat} lng={markerPos.lng} />}
                {markerPos && <OpenAddress address={liveAddress} />}
                {!markerPos && (
                  <p style={{ fontSize: 11, color: MUTED, margin: '8px 0' }}>Konum verisi yok</p>
                )}
              </Section>
              )}

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
        <span style={{ ...LABEL, color: accent }}>
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

// Kişi kartı (talep eden ve diğer katılımcılar aynı yapı): profil fotoğrafı (büyür, "Sil"), ad soyad, telefon, "Detay".
// Detay'a basınca kişinin tüm bilgileri ve kimlik ön yüzü (basınca büyür) açılır
function PersonRow({ p, extra, highlight }: { p: Participant | undefined; extra?: { photoUrl: string | null; kycId: string | null }; highlight?: boolean }) {
  const [open, setOpen] = useState(false);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!open || !extra?.kycId || idUrl) return;
    fetch(`${API_PREFIX}/kyc/admin/file/${extra.kycId}/front`, { credentials: 'include' })
      .then(async r => (r.ok ? URL.createObjectURL(await r.blob()) : null)).then(setIdUrl).catch(() => {});
  }, [open, extra?.kycId, idUrl]);
  if (!p) return <p style={{ fontSize: 11, color: MUTED }}>—</p>;
  const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—';
  const rows: [string, React.ReactNode][] = [
    ['Yaş', p.age ?? '—'], ['Cinsiyet', p.gender ? (GENDER_TR[p.gender] ?? p.gender) : '—'], ['E-posta', p.email ?? '—'],
    ['Telefon', p.phone ?? '—'], ['Meslek', p.occupation ?? '—'], ['Şehir', p.city ?? '—'],
  ];
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, marginBottom: 4,
      background: highlight ? RED_DIM : BLUE_DIM,
      border: `1px solid ${highlight ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.2)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AdminUserPhoto userId={p.userId} photoUrl={photo === undefined ? extra?.photoUrl : photo} gender={p.gender} size={44}
          initials={`${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toLocaleUpperCase('tr-TR') || '?'} onDeleted={() => setPhoto(null)} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: highlight ? RED : CYAN }}>
            {name}
            {p.isBot ? <span style={{ fontWeight: 700, color: AMBER, marginLeft: 6, fontSize: 9, letterSpacing: '0.1em' }}>BOT</span> : null}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>{p.phone ?? '—'}</p>
          <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
            style={{ marginTop: 4, padding: '2px 10px', borderRadius: 99, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            Detay
          </button>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map(([k, v]) => <Row key={k} label={k} value={v} />)}
          <span style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Kimlik ön yüzü</span>
          {extra?.kycId ? (idUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={idUrl} alt="Kimlik ön yüzü" onClick={() => setZoom(true)} style={{ width: 160, borderRadius: 6, cursor: 'zoom-in', border: `1px solid ${BORDER}` }} />
            : <span style={{ fontSize: 10, color: MUTED }}>Yükleniyor…</span>)
            : <span style={{ fontSize: 10, color: MUTED }}>Kimlik yok</span>}
        </div>
      )}
      {zoom && idUrl && (
        <div role="dialog" aria-label="Kimlik ön yüzü" onClick={() => setZoom(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={idUrl} alt="Kimlik ön yüzü" style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
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
  const [fetchError, setFetchError] = useState('');
  const [left, setLeft] = useState(REFRESH_SEC);
  const [tick, setTick] = useState(0);
  // Yenile butonunda görünür geri bildirim: Yenileniyor… → Yenilendi ✓
  const [refreshState, setRefreshState] = useState<'idle' | 'loading' | 'done'>('idle');
  const fetchReports = useCallback(async (manual = false) => {
    setLeft(REFRESH_SEC);
    setTick(t => t + 1); // açık kartların detayı (canlı konum) da yenilenir
    if (manual) setRefreshState('loading');
    let ok = false;
    try {
      const data = await api.get<SosReport[]>('/sos/admin/reports');
      setReports(data);
      setFetchError('');
      setLastFetch(new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }));
      ok = true;
    } catch (e) {
      setFetchError(`Yenilenemedi: ${(e as Error).message}`);
    } finally {
      setLoading(false);
      if (manual) setRefreshState(ok ? 'done' : 'idle');
    }
  }, []);
  useEffect(() => {
    if (refreshState !== 'done') return;
    const id = setTimeout(() => setRefreshState('idle'), 1500);
    return () => clearTimeout(id);
  }, [refreshState]);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => {
    const id = setInterval(() => setLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (left <= 0) fetchReports(); }, [left, fetchReports]);

  const active   = reports.filter(r => !r.resolvedAt);
  const resolved = reports.filter(r => !!r.resolvedAt);

  // Canlı harita: kaç açık talep olursa olsun saniyede tek istek; konumlar reportId ile kartlara dağıtılır.
  // Yalnızca bu sayfa açıkken ve en az bir açık talep varken çalışır; önceki istek bitmeden yenisi gitmez.
  // Açık talep kalmayınca (liste ya da uç boş dönünce) veya sayfadan çıkılınca durur. 15 sn yenileme ayrı çalışır.
  const [liveLocs, setLiveLocs] = useState<Record<string, LivePos>>({});
  const [liveAddrs, setLiveAddrs] = useState<Record<string, LiveAddress>>({});
  const [liveStale, setLiveStale] = useState<Record<string, boolean>>({});
  const openKey = active.filter(r => !r.restricted).map(r => r.id).join(',');
  useEffect(() => {
    if (!openKey) return;
    let busy = false;
    const id = setInterval(() => {
      if (busy) return;
      busy = true;
      api.get<{ reportId: string; location: LivePos | null; address: LiveAddress | null; stale?: boolean }[]>('/sos/admin/reports/open-locations')
        .then((rows) => {
          if (rows.length === 0) { clearInterval(id); return; }
          setLiveLocs((prev) => {
            const next = { ...prev };
            for (const r of rows) if (r.location) next[r.reportId] = r.location;
            return next;
          });
          setLiveAddrs((prev) => {
            const next = { ...prev };
            for (const r of rows) if (r.address) next[r.reportId] = r.address;
            return next;
          });
          setLiveStale(Object.fromEntries(rows.map((r) => [r.reportId, !!r.stale])));
        })
        .catch(() => undefined)
        .finally(() => { busy = false; });
    }, 1000);
    return () => clearInterval(id);
  }, [openKey]);

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
        <header className="adm-topbar">
          <div className="adm-topbar-title">
            <button onClick={() => router.push('/admin')}
              style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
              ←
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Pulse color={active.length > 0 ? RED : GREEN} />
              <h1 className="ll-title" style={{ color: active.length > 0 ? RED : TEXT }}>Acil Yardım Merkezi</h1>
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
          <div className="adm-topbar-meta">
            <span style={{ color: MUTED, fontFamily: MONO }}>
              Son: {lastFetch || '—'} · Yenileme: {Math.max(0, left)} sn
            </span>
            <Clock />
            <button
              onClick={() => fetchReports(true)}
              disabled={refreshState === 'loading'}
              style={{
                background: refreshState === 'done' ? 'rgba(34,197,94,0.12)' : BLUE_DIM,
                border: `1px solid ${refreshState === 'done' ? 'rgba(34,197,94,0.35)' : 'rgba(59,130,246,0.3)'}`,
                color: refreshState === 'done' ? GREEN : BLUE, fontSize: 11, padding: '5px 12px', borderRadius: 6,
                cursor: refreshState === 'loading' ? 'wait' : 'pointer', fontFamily: SANS, whiteSpace: 'nowrap',
                opacity: refreshState === 'loading' ? 0.7 : 1,
              }}
            >
              {refreshState === 'loading' ? 'Yenileniyor…' : refreshState === 'done' ? 'Yenilendi ✓' : 'Yenile'}
            </button>
          </div>
        </header>

        <main className="adm-page" style={s.main}>
          {fetchError && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{fetchError}</p>}
          {/* İstatistik şeridi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'AKTİF TALEP',   value: active.length,   color: active.length > 0 ? RED : GREEN },
              { label: 'TOPLAM TALEP',  value: reports.length,  color: BLUE },
              { label: 'ÇÖZÜMLENDI',    value: resolved.length, color: GREEN },
              { label: 'ÜYE TAKİBİ',   value: active.reduce((a, r) => a + (r.participantSnapshot?.length ?? 0), 0), color: CYAN },
            ].map(stat => (
              <div key={stat.label} className="ll-card">
                <p style={{ margin: '0 0 4px', ...LABEL, color: MUTED }}>
                  {stat.label}
                </p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: stat.color, fontFamily: MONO }}>
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
              <p style={{ fontSize: 14, color: GREEN, fontWeight: 600 }}>Sistem nominal. Aktif talep yok</p>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 6, fontFamily: MONO }}>Otomatik izleme aktif · 15s</p>
            </div>
          ) : (
            <div>
              {active.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Pulse color={RED} />
                    <span style={{ ...LABEL, color: RED }}>
                      AKTİF TALEPLER: {active.length}
                    </span>
                  </div>
                  {active.map((r, i) => <ReportCard key={r.id} report={r} index={i} tick={tick} onChanged={fetchReports} livePos={liveLocs[r.id] ?? null} liveAddress={liveAddrs[r.id] ?? null} liveStale={liveStale[r.id]} />)}
                </div>
              )}

              {resolved.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ ...LABEL, color: MUTED }}>
                      ÇÖZÜMLENEN: {resolved.length}
                    </span>
                  </div>
                  {resolved.map((r, i) => <ReportCard key={r.id} report={r} index={i} tick={tick} onChanged={fetchReports} />)}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
