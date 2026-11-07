'use client';

import { useEffect, useState } from 'react';
import { api, API_PREFIX } from '@/lib/api';
import { SURFACE, BORDER, TEXT, MUTED, RED, CYAN, SANS, MONO } from '@/lib/adminTheme';

// Janti Haydar teklif talepleri: en yeni üstte; yalnızca görüntüleme (onay/red/silme yok)

interface JantiFile { file: string; originalName: string; type: string; size: number }

interface JantiRequest {
  id: string;
  fullName: string;
  phone: string;
  adTypes: string[];
  storyOwner: string;
  websiteOrSocial: string | null;
  message: string;
  files: JantiFile[] | null;
  createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
}
function fmtSize(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
// Elle yazılan adres: http(s) yoksa bağlantı yapılmaz, düz metin gösterilir
function safeUrl(v: string): string | null {
  return /^https?:\/\//i.test(v.trim()) ? v.trim() : null;
}

export default function AdminJantiHaydar() {
  const [items, setItems] = useState<JantiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<JantiRequest[]>('/admin/janti-haydar').then(setItems)
      .catch((e: Error) => setError(`Talepler yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  const rowLabel: React.CSSProperties = { color: TEXT, fontWeight: 600 };
  const row: React.CSSProperties = { margin: 0, fontSize: 13, color: MUTED, overflowWrap: 'anywhere', minWidth: 0 };

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="ll-title">Janti Haydar</h1>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ll-title">Teklif Talepleri</h2>
          {!loading && items.length > 0 && (
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{items.length} kayıt</span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 64, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Talep yok</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>Yeni talepler burada görünür</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((r, i) => {
              const open = expanded === r.id;
              const url = r.websiteOrSocial ? safeUrl(r.websiteOrSocial) : null;
              const files = Array.isArray(r.files) ? r.files : [];
              return (
                <div key={r.id} style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(26,58,92,0.5)' : 'none' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fullName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: MUTED, overflowWrap: 'anywhere' }}>{r.adTypes.join(', ')}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>{fmtDate(r.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => setExpanded(e => e === r.id ? null : r.id)}
                      style={{
                        flexShrink: 0, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                        background: open ? 'rgba(34,211,238,0.08)' : 'transparent',
                        border: `1px solid ${open ? 'rgba(34,211,238,0.3)' : BORDER}`,
                        fontSize: 10, color: open ? CYAN : MUTED, fontFamily: SANS,
                      }}
                    >
                      {open ? '▲ Kapat' : '▼ Detay'}
                    </button>
                  </div>

                  {open && (
                    <div style={{ margin: '0 18px 14px', padding: '14px 16px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                      <p style={row}><span style={rowLabel}>Ad Soyad:</span> {r.fullName}</p>
                      <p style={row}>
                        <span style={rowLabel}>Telefon:</span>{' '}
                        <a href={`tel:${r.phone}`} style={{ color: CYAN }}>{r.phone}</a>
                      </p>
                      <p style={row}><span style={rowLabel}>Reklam türleri:</span> {r.adTypes.join(', ') || '—'}</p>
                      <p style={row}><span style={rowLabel}>Kurgu:</span> {r.storyOwner}</p>
                      <p style={row}>
                        <span style={rowLabel}>Web / Instagram:</span>{' '}
                        {r.websiteOrSocial
                          ? url ? <a href={url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: CYAN }}>{r.websiteOrSocial}</a> : r.websiteOrSocial
                          : '—'}
                      </p>
                      <p style={{ ...row, whiteSpace: 'pre-wrap' }}><span style={rowLabel}>Mesaj:</span> {r.message}</p>
                      <div style={{ ...row, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={rowLabel}>Dosyalar:</span>
                        {files.length === 0 ? <span>—</span> : files.map((f, k) => (
                          <div key={f.file} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ minWidth: 0, overflowWrap: 'anywhere', color: TEXT }}>{f.originalName}</span>
                            <span style={{ fontSize: 10, fontFamily: MONO }}>{f.type.toUpperCase()} · {fmtSize(f.size)}</span>
                            <a href={`${API_PREFIX}/admin/janti-haydar/${r.id}/files/${k}`} target="_blank" rel="noopener noreferrer" style={{ color: CYAN, fontSize: 12 }}>Görüntüle</a>
                            <a href={`${API_PREFIX}/admin/janti-haydar/${r.id}/files/${k}?download=1`} style={{ color: CYAN, fontSize: 12 }}>İndir</a>
                          </div>
                        ))}
                      </div>
                      <p style={row}><span style={rowLabel}>Gönderim tarihi:</span> {fmtDate(r.createdAt)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
