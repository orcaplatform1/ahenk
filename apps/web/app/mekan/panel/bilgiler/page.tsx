'use client';

import { useEffect, useState } from 'react';
import SiteSelect from '@/components/SiteSelect';
import { api } from '@/lib/api';
import { VenueAuthError, VenueMe, mediaUrl, venueApi } from '@/lib/venueApi';
import { panelCard, useVenuePanel } from '../context';

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALCOHOL_OPTIONS = [{ value: 'ALCOHOLIC', label: 'Alkollü' }, { value: 'NON_ALCOHOLIC', label: 'Alkolsüz' }];

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

export default function BilgilerPage() {
  const { me, setMe, onAuthLost } = useVenuePanel();
  const [form, setForm] = useState({
    description: me.venue.description ?? '',
    address: me.venue.address ?? '',
    district: me.venue.district ?? '',
    locationUrl: me.venue.locationUrl ?? '',
    websiteOrSocial: me.venue.websiteOrSocial ?? '',
    venueType: me.venue.venueType as string,
  });
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const districtOptions = districts[me.venue.city] ?? [];
  useEffect(() => {
    api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => undefined);
  }, []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function fail(e: unknown) {
    if (e instanceof VenueAuthError) onAuthLost();
    else setError((e as Error).message);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      setMe(await venueApi.patch<VenueMe>('/info', { ...form, locationUrl: form.locationUrl.trim() }));
      setMessage('Bilgiler kaydedildi.');
    } catch (err) { fail(err); } finally { setSaving(false); }
  }

  async function addPhotos(list: FileList | null) {
    if (!list?.length) return;
    const picked = Array.from(list);
    setError(''); setMessage('');
    if (picked.some((f) => f.size > MAX_PHOTO_BYTES)) { setError('Her fotoğraf en fazla 5 MB olabilir.'); return; }
    if (me.venue.photos.length + picked.length > MAX_PHOTOS) { setError(`En fazla ${MAX_PHOTOS} fotoğraf eklenebilir.`); return; }
    const body = new FormData();
    picked.forEach((f) => body.append('photos', f));
    setUploading(true);
    try { setMe(await venueApi.post<VenueMe>('/photos', body)); }
    catch (err) { fail(err); } finally { setUploading(false); }
  }

  async function removePhoto(url: string) {
    setError(''); setMessage('');
    try { setMe(await venueApi.delete<VenueMe>('/photos', { url })); }
    catch (err) { fail(err); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="font-serif" style={{ fontSize: '1.6rem', margin: 0 }}>Mekân Bilgileri</h1>

      <form onSubmit={save} style={{ ...panelCard, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Labeled label="Tanıtım (en fazla 500 karakter)">
          <textarea className="input-glass w-full px-4 py-3 text-sm" aria-label="Tanıtım" rows={4} maxLength={500} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Labeled>
        <Labeled label="Açık Adres">
          <textarea className="input-glass w-full px-4 py-3 text-sm" aria-label="Açık adres" rows={2} maxLength={300} required value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </Labeled>
        <Labeled label="İlçe">
          {districtOptions.length > 0 ? (
            <SiteSelect value={form.district} options={districtOptions} onChange={(v) => setForm((f) => ({ ...f, district: v }))} placeholder="İlçe seçin" required ariaLabel="İlçe" searchable searchPlaceholder="İlçe ara" />
          ) : (
            <input className="input-glass w-full px-4 py-3 text-sm" aria-label="İlçe" maxLength={60} required value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
          )}
        </Labeled>
        <Labeled label="Google Maps Konum Linki">
          <input className="input-glass w-full px-4 py-3 text-sm" aria-label="Konum linki" type="url" required value={form.locationUrl} onChange={(e) => setForm((f) => ({ ...f, locationUrl: e.target.value }))} />
        </Labeled>
        <Labeled label="Website veya Instagram">
          <input className="input-glass w-full px-4 py-3 text-sm" aria-label="Website veya Instagram" maxLength={300} value={form.websiteOrSocial} onChange={(e) => setForm((f) => ({ ...f, websiteOrSocial: e.target.value }))} />
        </Labeled>
        <Labeled label="Alkol Durumu">
          <SiteSelect value={form.venueType} options={ALCOHOL_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, venueType: v }))} required ariaLabel="Alkol durumu" />
        </Labeled>
        <button type="submit" disabled={saving} className="btn-primary w-full justify-center disabled:opacity-70">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </form>

      <section style={{ ...panelCard, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Fotoğraflar</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {me.venue.photos.map((url, i) => (
            <div key={url} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(url)} alt={`Mekân fotoğrafı ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {me.venue.photos.length > 1 && (
                <button type="button" aria-label={`Fotoğraf ${i + 1} sil`} onClick={() => removePhoto(url)} style={{ position: 'absolute', top: 4, right: 4, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', cursor: 'pointer' }}>✕</button>
              )}
            </div>
          ))}
        </div>
        {me.venue.photos.length < MAX_PHOTOS && (
          <label style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 10, color: '#ff6b6b', fontSize: '0.9rem', cursor: 'pointer' }}>
            {uploading ? 'Yükleniyor…' : '+ Fotoğraf ekle'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          </label>
        )}
      </section>

      {message && <p style={{ color: '#4ade80', fontSize: '0.85rem', margin: 0 }}>{message}</p>}
      {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
    </div>
  );
}
