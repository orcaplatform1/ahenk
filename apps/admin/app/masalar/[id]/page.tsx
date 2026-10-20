'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { api } from '@/lib/api';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────
const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const RED     = '#ef4444';
const BLUE    = '#3b82f6';
const CYAN    = '#22d3ee';
const AMBER   = '#f59e0b';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const LEAVE_REASON_TR: Record<string, string> = {
  VENUE_NOT_SUITABLE: 'Mekan uygun değil',
  TIME_CHANGED:       'Zaman değişti',
  PERSONAL:           'Kişisel sebep',
  OTHER:              'Diğer',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Bekliyor',
  ACTIVE:    'Aktif',
  REVEALED:  'Onaylandı',
  CANCELLED: 'İptal',
  COMPLETED: 'Tamamlandı',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:   AMBER,
  ACTIVE:    BLUE,
  REVEALED:  GREEN,
  CANCELLED: RED,
  COMPLETED: MUTED,
};
const STATUS_BG: Record<string, string> = {
  PENDING:   'rgba(245,158,11,0.12)',
  ACTIVE:    'rgba(59,130,246,0.12)',
  REVEALED:  'rgba(34,197,94,0.12)',
  CANCELLED: 'rgba(239,68,68,0.12)',
  COMPLETED: 'rgba(100,116,139,0.1)',
};
const STATUS_BORDER: Record<string, string> = {
  PENDING:   'rgba(245,158,11,0.35)',
  ACTIVE:    'rgba(59,130,246,0.3)',
  REVEALED:  'rgba(34,197,94,0.3)',
  CANCELLED: 'rgba(239,68,68,0.3)',
  COMPLETED: 'rgba(100,116,139,0.25)',
};

interface Participant {
  userId: string;
  initials: string;
  gender: string;
  status: string;
  cancelledAt?: string | null;
  leaveReason?: string | null;
  leaveNote?: string | null;
}

interface Meeting {
  id: string;
  status: string;
  type: string;
  scheduledAt: string;
  locationText?: string;
  locationUrl?: string;
  venueAddress?: string;
  venuePhotoUrl?: string | null;
  venuePhoto2Url?: string | null;
  venuePhoto3Url?: string | null;
  venuePhotoCaption1?: string | null;
  venuePhotoCaption2?: string | null;
  venuePhotoCaption3?: string | null;
  maxParticipants: number;
  participants?: Participant[];
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  senderInitials: string;
  senderId: string;
  reportCount: number;
  reports?: { reporterInitials: string; createdAt: string }[];
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: SURFACE,
  border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 12, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 800,
  letterSpacing: '0.14em', color: MUTED,
  marginBottom: 6, fontFamily: SANS,
};

export default function MasaDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meeting, setMeeting]             = useState<Meeting | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [loadingMeeting, setLoadingMeeting] = useState(true);
  const [loadingChat, setLoadingChat]     = useState(true);
  const [error, setError]                 = useState('');

  // Mekan düzenleme formu
  const [venueForm, setVenueForm] = useState({ locationText: '', locationUrl: '', scheduledAt: '' });
  const [venueSaving, setVenueSaving] = useState(false);
  const [venueSaved, setVenueSaved]   = useState(false);
  const [venueError, setVenueError]   = useState('');

  useEffect(() => {
    api.get<Meeting>(`/admin/meetings/${id}`)
      .then(m => {
        setMeeting(m);
        setVenueForm({
          locationText: m.locationText ?? '',
          locationUrl:  m.locationUrl  ?? '',
          scheduledAt:  m.scheduledAt  ? new Date(m.scheduledAt).toISOString().slice(0, 16) : '',
        });
      })
      .catch(() => setError('Masa bilgisi alınamadı'))
      .finally(() => setLoadingMeeting(false));

    api.get<ChatMessage[]>(`/chat/admin/${id}`)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingChat(false));
  }, [id]);

  async function saveVenue() {
    setVenueSaving(true); setVenueError('');
    try {
      await api.patch(`/admin/meetings/${id}/venue`, {
        locationText: venueForm.locationText || undefined,
        locationUrl:  venueForm.locationUrl  || undefined,
        scheduledAt:  venueForm.scheduledAt  ? new Date(venueForm.scheduledAt).toISOString() : undefined,
      });
      setVenueSaved(true);
      setTimeout(() => setVenueSaved(false), 2500);
      const updated = await api.get<Meeting>(`/admin/meetings/${id}`);
      setMeeting(updated);
    } catch (e) {
      setVenueError((e as Error).message);
    } finally {
      setVenueSaving(false);
    }
  }

  const reportedMessages = messages.filter((m) => m.reportCount > 0);
  const deletedMessages  = messages.filter((m) => m.deletedAt);

  const photos = meeting ? [
    { url: meeting.venuePhotoUrl,  caption: meeting.venuePhotoCaption1 },
    { url: meeting.venuePhoto2Url, caption: meeting.venuePhotoCaption2 },
    { url: meeting.venuePhoto3Url, caption: meeting.venuePhotoCaption3 },
  ].filter(p => p.url) : [];

  return (
    <AdminShell>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: SANS }}>

        {/* Geri */}
        <button
          onClick={() => router.back()}
          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: MUTED, fontFamily: SANS, padding: 0 }}
        >
          ← Masalar
        </button>

        {/* Masa özeti */}
        {loadingMeeting ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16 }}>
            <div style={{ height: 20, background: SURFACE, borderRadius: 6, opacity: 0.5, marginBottom: 10 }} />
            <div style={{ height: 60, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />
          </div>
        ) : error ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: RED }}>{error}</p>
          </div>
        ) : meeting && (
          <>
            {/* ── Temel bilgiler ── */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE }}>MASA DETAYI</span>
                </div>
                <span style={{
                  fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                  padding: '2px 8px', borderRadius: 99,
                  background: STATUS_BG[meeting.status] ?? 'transparent',
                  border: `1px solid ${STATUS_BORDER[meeting.status] ?? BORDER}`,
                  color: STATUS_COLOR[meeting.status] ?? MUTED,
                }}>
                  {STATUS_LABEL[meeting.status] ?? meeting.status}
                </span>
              </div>

              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* ID */}
                <p style={{ margin: 0, fontSize: 10, color: MUTED, fontFamily: MONO }}>{meeting.id}</p>

                {/* Grid bilgiler */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InfoRow label="TÜR"      value={meeting.type === 'GROUP' ? 'Grup' : 'Baş Başa'} />
                  <InfoRow label="TARİH"    value={new Date(meeting.scheduledAt).toLocaleString('tr-TR')} />
                  <InfoRow label="KAPASİTE" value={`${meeting.participants?.filter(p => p.status !== 'CANCELLED').length ?? 0} / ${meeting.maxParticipants}`} />
                  {meeting.locationText && <InfoRow label="MEKAN"   value={meeting.locationText} />}
                  {meeting.venueAddress  && <InfoRow label="ADRES"   value={meeting.venueAddress}  />}
                  {meeting.locationUrl   && (
                    <div>
                      <span style={labelStyle}>HARİTA</span>
                      <a href={meeting.locationUrl} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: CYAN, textDecoration: 'none' }}>
                        Haritada Gör ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Mekan fotoğrafları */}
                {photos.length > 0 && (
                  <div>
                    <span style={{ ...labelStyle, marginBottom: 8 }}>MEKAN FOTOĞRAFLARI</span>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${photos.length}, 1fr)`, gap: 8 }}>
                      {photos.map((p, i) => (
                        <div key={i}>
                          <img src={p.url!} alt={p.caption ?? `Fotoğraf ${i + 1}`}
                            style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                          {p.caption && (
                            <p style={{ margin: '4px 0 0', fontSize: 10, color: MUTED }}>{p.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Katılımcılar */}
                {meeting.participants && meeting.participants.length > 0 && (
                  <div>
                    <span style={labelStyle}>KATILIMCILAR</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {meeting.participants.map((p) => (
                        <div key={p.userId} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 99, fontSize: 11,
                            border: `1px solid ${p.status === 'CANCELLED' ? 'rgba(239,68,68,0.3)' : BORDER}`,
                            color: p.status === 'CANCELLED' ? RED : TEXT,
                            opacity: p.status === 'CANCELLED' ? 0.5 : 1,
                            textDecoration: p.status === 'CANCELLED' ? 'line-through' : 'none',
                          }}>
                            {p.initials} ({p.gender === 'MALE' ? 'E' : p.gender === 'FEMALE' ? 'K' : '?'})
                          </span>
                          {p.status === 'CANCELLED' && p.cancelledAt && (
                            <span style={{ fontSize: 9, color: RED, paddingLeft: 4, fontFamily: MONO }}>
                              {new Date(p.cancelledAt).toLocaleString('tr-TR')}
                              {p.leaveReason && ` — ${LEAVE_REASON_TR[p.leaveReason] ?? p.leaveReason}`}
                              {p.leaveNote && ` (${p.leaveNote})`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Mekan & Saat güncelle ── */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>MEKAN & SAAT GÜNCELLE</span>
              </div>

              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>MEKAN ADI</label>
                    <input
                      type="text"
                      value={venueForm.locationText}
                      onChange={e => setVenueForm(f => ({ ...f, locationText: e.target.value }))}
                      placeholder="Mekan adı"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>HARİTA URL</label>
                    <input
                      type="text"
                      value={venueForm.locationUrl}
                      onChange={e => setVenueForm(f => ({ ...f, locationUrl: e.target.value }))}
                      placeholder="https://maps.google.com/..."
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ maxWidth: 280 }}>
                  <label style={labelStyle}>TARİH & SAAT</label>
                  <input
                    type="datetime-local"
                    value={venueForm.scheduledAt}
                    onChange={e => setVenueForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  />
                </div>

                {venueError && (
                  <p style={{ margin: 0, fontSize: 11, color: RED }}>{venueError}</p>
                )}

                <button
                  onClick={saveVenue}
                  disabled={venueSaving}
                  style={{
                    alignSelf: 'flex-start', padding: '8px 20px', borderRadius: 8,
                    cursor: venueSaving ? 'not-allowed' : 'pointer',
                    background: venueSaved ? 'rgba(34,197,94,0.12)' : 'rgba(34,211,238,0.1)',
                    border: `1px solid ${venueSaved ? 'rgba(34,197,94,0.3)' : 'rgba(34,211,238,0.3)'}`,
                    fontSize: 12, fontWeight: 600,
                    color: venueSaved ? GREEN : CYAN,
                    fontFamily: SANS,
                    opacity: venueSaving ? 0.5 : 1,
                  }}
                >
                  {venueSaving ? 'Kaydediliyor…' : venueSaved ? 'Kaydedildi ✓' : 'Güncelle'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Sohbet Geçmişi ── */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: AMBER }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: AMBER }}>SOHBET GEÇMİŞİ</span>
            {!loadingChat && messages.length > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{messages.length} mesaj</span>
                {reportedMessages.length > 0 && (
                  <span style={{ fontSize: 10, color: AMBER, fontFamily: MONO }}>{reportedMessages.length} şikayet</span>
                )}
                {deletedMessages.length > 0 && (
                  <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{deletedMessages.length} silindi</span>
                )}
              </div>
            )}
          </div>

          {loadingChat ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Henüz mesaj gönderilmemiş</p>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  background: SURFACE,
                  border: `1px solid ${msg.reportCount > 0 ? 'rgba(245,158,11,0.4)' : BORDER}`,
                  borderRadius: 8, padding: '10px 14px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  opacity: msg.deletedAt ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: BLUE }}>{msg.senderInitials}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {msg.reportCount > 0 && (
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 6,
                          background: 'rgba(245,158,11,0.12)', color: AMBER,
                          border: '1px solid rgba(245,158,11,0.3)',
                        }}>
                          ⚠ {msg.reportCount} şikayet
                        </span>
                      )}
                      {msg.deletedAt && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 6,
                          background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`,
                        }}>silindi</span>
                      )}
                      <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>
                        {new Date(msg.createdAt).toLocaleString('tr-TR')}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: msg.deletedAt ? MUTED : TEXT, fontStyle: msg.deletedAt ? 'italic' : 'normal' }}>
                    {msg.deletedAt ? '[Silinen mesaj]' : msg.content}
                  </p>
                  {msg.reports && msg.reports.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(245,158,11,0.15)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {msg.reports.map((r, i) => (
                        <span key={i} style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>
                          {r.reporterInitials} — {new Date(r.createdAt).toLocaleString('tr-TR')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{
        display: 'block', fontSize: 9, fontWeight: 800,
        letterSpacing: '0.14em', color: MUTED, marginBottom: 4, fontFamily: 'Inter, system-ui, sans-serif',
      }}>{label}</span>
      <span style={{ fontSize: 12, color: TEXT }}>{value}</span>
    </div>
  );
}
