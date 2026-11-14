'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SURFACE, BORDER, TEXT, MUTED, RED, GREEN, SANS, MONO } from '@/lib/adminTheme';

// Onay bekleyen profil fotoğrafları: yüklenen fotoğraf ve KYC kimlik ön yüzü yan yana, altında Onayla / Reddet
interface PendingPhoto { id: string; userId: string; createdAt: string; firstName: string; lastName: string; gender: string | null; photoUrl: string; idFrontUrl: string | null }

async function fetchBlob(path: string): Promise<string | null> {
  try {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

// Görsele basınca sayfa içinde tam ekran büyük görünüm (görselin tamamı); ekrana basınca ya da Esc ile kapanır
function FullView({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} role="dialog" aria-label={label} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
      <img src={src} alt={label} style={{ maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain', display: 'block' }} />
    </div>
  );
}

function Preview({ url, label }: { url: string | null; label: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (url) fetchBlob(url).then(setBlobUrl); }, [url]);
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div style={{ aspectRatio: '1/1', position: 'relative' }}>
        {blobUrl
          ? <img src={blobUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }} onClick={() => setOpen(true)} />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><p style={{ margin: 0, fontSize: 10, color: MUTED }}>{url ? 'Yükleniyor…' : `${label} yok`}</p></div>}
      </div>
      <p style={{ margin: 0, fontSize: 10, color: MUTED, padding: '4px 8px' }}>{label}</p>
      {open && blobUrl && <FullView src={blobUrl} label={label} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function AdminProfilePhotos() {
  const [items, setItems] = useState<PendingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Record<string, 'approve' | 'reject'>>({});

  const load = useCallback(() => {
    api.get<PendingPhoto[]>('/admin/profile-photos').then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id: string, kind: 'approve' | 'reject') {
    setBusy((b) => ({ ...b, [id]: kind })); setError('');
    try { await api.post(`/admin/profile-photos/${id}/${kind}`, {}); setItems((xs) => xs.filter((x) => x.id !== id)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy((b) => { const n = { ...b }; delete n[id]; return n; }); }
  }

  const btn = (color: string, bg: string, border: string, disabled: boolean) => ({
    flex: 1, padding: '8px', minHeight: 44, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', background: bg, border: `1px solid ${border}`,
    fontSize: 11, fontWeight: 600, color, fontFamily: SANS, opacity: disabled ? 0.5 : 1,
  } as const);

  return (
    <div className="adm-page" style={{ maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>
      <div style={{ marginBottom: 24 }}><h1 className="ll-title">Profil Fotoğrafları</h1></div>
      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}
      {loading ? <p style={{ fontSize: 13, color: MUTED }}>Yükleniyor…</p> : items.length === 0 ? (
        <div className="ll-card" style={{ textAlign: 'center' }}><p style={{ margin: 0, fontSize: 13, color: MUTED }}>Onay bekleyen profil fotoğrafı yok</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item) => (
            <div key={item.id} className="ll-card">
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{item.firstName} {item.lastName}</p>
              <p style={{ margin: '3px 0 12px', fontSize: 10, color: MUTED, fontFamily: MONO }}>{new Date(item.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
                <Preview url={item.photoUrl} label="Yüklenen Fotoğraf" />
                <Preview url={item.idFrontUrl} label="Kimlik Ön Yüz" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => act(item.id, 'approve')} disabled={!!busy[item.id]} style={btn(GREEN, 'rgba(34,197,94,0.1)', 'rgba(34,197,94,0.3)', !!busy[item.id])}>{busy[item.id] === 'approve' ? '…' : 'Onayla'}</button>
                <button onClick={() => act(item.id, 'reject')} disabled={!!busy[item.id]} style={btn(RED, 'rgba(239,68,68,0.08)', 'rgba(239,68,68,0.3)', !!busy[item.id])}>{busy[item.id] === 'reject' ? '…' : 'Reddet'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
