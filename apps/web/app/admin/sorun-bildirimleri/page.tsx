'use client';

import { useEffect, useState } from 'react';
import { api, API_PREFIX } from '@/lib/api';
import { SURFACE, BORDER, TEXT, MUTED, RED, SANS, LABEL } from '@/lib/adminTheme';

// Sorun Bildirimleri: mobil (salla-bildir) ve web (Profilim "Sorun Bildir") aynı listede, yeniden eskiye

type Platform = 'IOS' | 'ANDROID' | 'WEB';
const PLATFORM_LABEL: Record<Platform, string> = { IOS: 'iOS', ANDROID: 'Android', WEB: 'Web' };

interface ReportUser { id: string; profile: { firstName: string; lastName: string } | null }
interface ReportRow { id: string; platform: Platform; screen: string; description: string; createdAt: string; user: ReportUser }
interface ReportDetail extends ReportRow { appVersion: string | null; images: string[] }

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const nameOf = (u: ReportUser) => (u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : 'Silinmiş kullanıcı');
const firstLine = (s: string) => s.split('\n')[0];

export default function AdminProblemReports() {
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    api.get<ReportRow[]>('/admin/problem-reports').then(setItems)
      .catch((e: Error) => setError(`Bildirimler yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
    // Push'tan gelindiyse (?id=...) detay doğrudan açılır
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) open(id);
  }, []);

  function open(id: string) {
    setError('');
    api.get<ReportDetail>(`/admin/problem-reports/${id}`).then(setDetail)
      .catch((e: Error) => setError(`Bildirim açılamadı: ${e.message}`));
  }

  const imageUrl = (r: ReportDetail, name: string) => `${API_PREFIX}/admin/problem-reports/${r.id}/images/${encodeURIComponent(name)}`;

  return (
    <div style={{ padding: 24, fontFamily: SANS, color: TEXT }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>Sorun Bildirimleri</h1>
      {error && <p style={{ color: RED, fontSize: 13 }}>{error}</p>}
      {loading ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Henüz sorun bildirimi yok.</p>
      ) : (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ ...LABEL, color: MUTED, textAlign: 'left' }}>
                {['KULLANICI', 'TARİH-SAAT', 'PLATFORM', 'EKRAN', 'AÇIKLAMA'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} onClick={() => open(r.id)} style={{ cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}>
                  <td data-label="Kullanıcı" style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{nameOf(r.user)}</td>
                  <td data-label="Tarih" style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{fmt(r.createdAt)}</td>
                  <td data-label="Platform" style={{ padding: '10px 14px' }}>{PLATFORM_LABEL[r.platform]}</td>
                  <td data-label="Ekran" style={{ padding: '10px 14px' }}>{r.screen}</td>
                  <td data-label="Açıklama" style={{ padding: '10px 14px', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstLine(r.description)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Sorun Bildirimi</p>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            {([
              ['Kullanıcı', nameOf(detail.user)],
              ['Tarih-saat', fmt(detail.createdAt)],
              ['Platform', PLATFORM_LABEL[detail.platform]],
              ['Ekran / sayfa', detail.screen],
              ['Uygulama sürümü', detail.appVersion ?? '—'],
            ] as const).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '4px 0' }}>
                <span style={{ ...LABEL, color: MUTED, minWidth: 130 }}>{k.toLocaleUpperCase('tr-TR')}</span>
                <span>{v}</span>
              </div>
            ))}
            <p style={{ ...LABEL, color: MUTED, margin: '12px 0 4px' }}>AÇIKLAMA</p>
            <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: 0 }}>{detail.description}</p>
            {detail.images.length > 0 && (
              <>
                <p style={{ ...LABEL, color: MUTED, margin: '12px 0 6px' }}>GÖRSELLER</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {detail.images.map((name) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={name} src={imageUrl(detail, name)} alt="Sorun görseli" onClick={() => setZoom(imageUrl(detail, name))}
                      style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}`, cursor: 'zoom-in' }} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Sorun görseli (büyük)" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
