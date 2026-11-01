'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { AdminSelect } from '@/components/AdminSelect';
import { SURFACE, BORDER, TEXT, MUTED, RED, GREEN, AMBER, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  PENDING:  AMBER,
  REVIEWED: GREEN,
  APPROVED: GREEN,
  REJECTED: RED,
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'BEKLİYOR', REVIEWED: 'İNCELENDİ', APPROVED: 'ONAYLANDI', REJECTED: 'REDDEDİLDİ',
};
const ACCOUNT_LABEL: Record<string, string> = {
  PENDING: 'Onay bekliyor', ACTIVE: 'Aktif', REJECTED: 'Reddedildi', DEACTIVATED: 'Pasif (mekân kapattı)',
};
const STATUS_BG: Record<string, string> = {
  PENDING:  'rgba(245,158,11,0.12)',
  REVIEWED: 'rgba(34,197,94,0.12)',
  APPROVED: 'rgba(34,197,94,0.12)',
  REJECTED: 'rgba(239,68,68,0.12)',
};
const STATUS_BORDER: Record<string, string> = {
  PENDING:  'rgba(245,158,11,0.35)',
  REVIEWED: 'rgba(34,197,94,0.3)',
  APPROVED: 'rgba(34,197,94,0.3)',
  REJECTED: 'rgba(239,68,68,0.3)',
};

interface Partnership {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  venueType?: string;
  capacity?: number;
  description?: string;
  websiteOrSocial?: string;
  address?: string | null;
  district?: string | null;
  locationUrl?: string | null;
  alcoholStatus?: 'ALCOHOLIC' | 'NON_ALCOHOLIC' | null;
  referenceCode?: string | null;
  photos?: string[];
  account?: { status: string; registeredAt: string; approvedAt: string | null; deactivatedAt: string | null } | null;
  status: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : null;
}

export default function AdminPartnerships() {
  const [items, setItems] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [cityIds, setCityIds] = useState<Record<string, string>>({});

  function load() {
    api.get<Partnership[]>('/admin/partnerships').then(setItems)
      .catch((e: Error) => setError(`Başvurular yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.get<{ id: string; name: string }[]>('/admin/cities').then(setCities).catch(() => undefined);
  }, []);

  // Başvurudaki şehir, şehir listesinde yoksa ("Diğer") onay için seçim istenir
  function cityMatches(city: string) {
    return cities.some(c => c.name === city.split(' (')[0].trim());
  }

  async function update(id: string, status: string) {
    setSaving(id);
    setError('');
    try {
      await api.patch(`/admin/partnerships/${id}`, { status, adminNote: notes[id] || undefined, cityId: cityIds[id] || undefined });
      setExpanded(null);
      load();
    } catch (e) {
      setError(`Güncellenemedi: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.85)', cursor: 'zoom-out' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Mekân fotoğrafı" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="ll-title">
          İş Ortaklığı Başvuruları
        </h1>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      {/* İçerik */}
      {loading ? (
        <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ll-title">Başvurular</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 64, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ll-title">Başvurular</h2>
          </div>
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Başvuru yok</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>
              Yeni başvurular burada görünür
            </p>
          </div>
        </div>
      ) : (
        <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Kart başlığı */}
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ll-title">Başvurular</h2>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
              {items.length} kayıt
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((p, i) => (
              <div key={p.id} style={{
                borderBottom: i < items.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
              }}>
                {/* Satır başlığı */}
                <div style={{
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.businessName}
                      </span>
                      <span style={{
                        ...LABEL, flexShrink: 0,
                        padding: '2px 7px', borderRadius: 99,
                        background: STATUS_BG[p.status] ?? 'transparent',
                        border: `1px solid ${STATUS_BORDER[p.status] ?? BORDER}`,
                        color: STATUS_COLOR[p.status] ?? MUTED,
                      }}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                      {p.contactName} · {p.email}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                      {p.city}{p.venueType ? ` · ${p.venueType}` : ''} · {new Date(p.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpanded(e => e === p.id ? null : p.id)}
                    style={{
                      flexShrink: 0, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                      background: expanded === p.id ? 'rgba(34,211,238,0.08)' : 'transparent',
                      border: `1px solid ${expanded === p.id ? 'rgba(34,211,238,0.3)' : BORDER}`,
                      fontSize: 10, color: expanded === p.id ? CYAN : MUTED,
                      fontFamily: SANS,
                    }}
                  >
                    {expanded === p.id ? '▲ Kapat' : '▼ Detay'}
                  </button>
                </div>

                {/* Detay paneli */}
                {expanded === p.id && (
                  <div style={{
                    margin: '0 18px 14px',
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    {([
                      ['Başvuru durumu', STATUS_LABEL[p.status] ?? p.status],
                      ['İşletme adı', p.businessName],
                      ['Yetkili', p.contactName],
                      ['E-posta', p.email],
                      ['Telefon', p.phone],
                      ['Şehir', p.city],
                      ['İlçe', p.district],
                      ['Adres', p.address],
                      ['Mekân türü', p.venueType],
                      ['Kapasite', p.capacity],
                      ['Alkol durumu', p.alcoholStatus ? (p.alcoholStatus === 'ALCOHOLIC' ? 'Alkollü' : 'Alkolsüz') : null],
                      ['Web / Sosyal', p.websiteOrSocial],
                      ['Referans kodu', p.referenceCode],
                      ['Başvuru tarihi', fmtDateTime(p.createdAt)],
                      ['Son güncelleme', fmtDateTime(p.updatedAt)],
                      ['Panel hesabı', p.account ? ACCOUNT_LABEL[p.account.status] ?? p.account.status : null],
                      ['Panel kayıt tarihi', fmtDateTime(p.account?.registeredAt)],
                      ['Onay tarihi', fmtDateTime(p.account?.approvedAt)],
                      ['Kapatılma tarihi', fmtDateTime(p.account?.deactivatedAt)],
                    ] as [string, string | number | null | undefined][]).map(([label, value]) => (
                      <p key={label} style={{ margin: 0, fontSize: 13, color: MUTED }}>
                        <span style={{ color: TEXT, fontWeight: 600 }}>{label}:</span> {value || '—'}
                      </p>
                    ))}
                    <p style={{ margin: 0, fontSize: 13, color: MUTED, wordBreak: 'break-all' }}>
                      <span style={{ color: TEXT, fontWeight: 600 }}>Maps linki:</span>{' '}
                      {p.locationUrl ? <a href={p.locationUrl} target="_blank" rel="noopener noreferrer" style={{ color: CYAN }}>{p.locationUrl}</a> : '—'}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                      <span style={{ color: TEXT, fontWeight: 600 }}>Açıklama:</span> {p.description || '—'}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                      <span style={{ color: TEXT, fontWeight: 600 }}>Admin notu:</span> {p.adminNote || '—'}
                    </p>
                    {!!p.photos?.length && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
                        {p.photos.map((src, k) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() => setLightbox(mediaUrl(src))}
                            aria-label={`Mekân fotoğrafı ${k + 1} büyüt`}
                            style={{ padding: 0, background: 'none', border: 'none', cursor: 'zoom-in' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mediaUrl(src)} alt={`Mekân fotoğrafı ${k + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                          </button>
                        ))}
                      </div>
                    )}

                    {p.status === 'PENDING' && (
                      <>
                        <textarea
                          value={notes[p.id] ?? ''}
                          onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))}
                          placeholder="Admin notu (opsiyonel)"
                          rows={2}
                          style={{
                            width: '100%', background: 'transparent',
                            border: `1px solid ${BORDER}`, borderRadius: 8,
                            padding: '7px 10px', fontSize: 11, color: TEXT,
                            outline: 'none', resize: 'none', fontFamily: SANS,
                            boxSizing: 'border-box',
                          }}
                        />
                        {p.account && !cityMatches(p.city) && (
                          <AdminSelect
                            value={cityIds[p.id] ?? ''}
                            onChange={v => setCityIds(c => ({ ...c, [p.id]: v }))}
                            options={cities.map(c => ({ value: c.id, label: c.name }))}
                            placeholder="Onay için şehir seçin"
                          />
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => update(p.id, p.account ? 'APPROVED' : 'REVIEWED')}
                            disabled={saving === p.id}
                            style={{
                              flex: 1, padding: '8px', borderRadius: 8, cursor: saving === p.id ? 'not-allowed' : 'pointer',
                              background: 'rgba(34,197,94,0.1)',
                              border: '1px solid rgba(34,197,94,0.3)',
                              fontSize: 11, fontWeight: 600, color: GREEN,
                              fontFamily: SANS, opacity: saving === p.id ? 0.4 : 1,
                            }}
                          >
                            {saving === p.id ? '…' : p.account ? 'Onayla' : 'İncelendi'}
                          </button>
                          <button
                            onClick={() => update(p.id, 'REJECTED')}
                            disabled={saving === p.id}
                            style={{
                              flex: 1, padding: '8px', borderRadius: 8, cursor: saving === p.id ? 'not-allowed' : 'pointer',
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              fontSize: 11, fontWeight: 600, color: RED,
                              fontFamily: SANS, opacity: saving === p.id ? 0.4 : 1,
                            }}
                          >
                            {saving === p.id ? '…' : 'Reddet'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
