'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import SiteSelect from '@/components/SiteSelect';
import { api } from '@/lib/api';
import { VenueAuthError, VenueMe, mediaUrl, venueApi } from '@/lib/venueApi';
import { isVenuePhoto, VENUE_PHOTO_ACCEPT } from '@/lib/imageType';
import { panelCard, useVenuePanel } from '../context';

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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
  const t = useTranslations();
  const ALCOHOL_OPTIONS = [{ value: 'ALCOHOLIC', label: t('vp.alcoholic') }, { value: 'NON_ALCOHOLIC', label: t('vp.nonAlcoholic') }];
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
      setMessage(t('vp.saved'));
    } catch (err) { fail(err); } finally { setSaving(false); }
  }

  async function addPhotos(list: FileList | null) {
    if (!list?.length) return;
    const picked = Array.from(list);
    setError(''); setMessage('');
    if (picked.some((f) => f.size > MAX_PHOTO_BYTES)) { setError(t('vp.photoTooBig')); return; }
    if (me.venue.photos.length + picked.length > MAX_PHOTOS) { setError(t('vp.photoMax', { n: MAX_PHOTOS })); return; }
    // Tür içerikten kontrol edilir (uzantı değil); HEIC/HEIF kabul edilir, sunucuda WebP'ye çevrilir
    for (const f of picked) {
      if (!(await isVenuePhoto(f))) { setError(t('vp.photoFormat')); return; }
    }
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
      <h1 className="font-serif" style={{ fontSize: '1.6rem', margin: 0 }}>{t('vp.navInfo')}</h1>

      <form onSubmit={save} style={{ ...panelCard, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Labeled label={t('vp.venueKind')}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{me.venue.venueKind || '—'}</p>
        </Labeled>
        <Labeled label={t('vp.description')}>
          <textarea className="input-glass w-full px-4 py-3 text-sm" aria-label={t('vp.descriptionAria')} rows={4} maxLength={500} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Labeled>
        <Labeled label={t('vp.address')}>
          <textarea className="input-glass w-full px-4 py-3 text-sm" aria-label={t('vp.addressAria')} rows={2} maxLength={300} required value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </Labeled>
        <Labeled label={t('vp.district')}>
          {districtOptions.length > 0 ? (
            <SiteSelect value={form.district} options={districtOptions} onChange={(v) => setForm((f) => ({ ...f, district: v }))} placeholder={t('vp.pickDistrict')} required ariaLabel={t('vp.district')} searchable searchPlaceholder={t('vp.searchDistrict')} />
          ) : (
            <input className="input-glass w-full px-4 py-3 text-sm" aria-label={t('vp.district')} maxLength={60} required value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
          )}
        </Labeled>
        <Labeled label={t('vp.mapsLink')}>
          <input className="input-glass w-full px-4 py-3 text-sm" aria-label={t('vp.mapsAria')} type="url" required value={form.locationUrl} onChange={(e) => setForm((f) => ({ ...f, locationUrl: e.target.value }))} />
        </Labeled>
        <Labeled label={t('vp.website')}>
          <input className="input-glass w-full px-4 py-3 text-sm" aria-label={t('vp.website')} maxLength={300} value={form.websiteOrSocial} onChange={(e) => setForm((f) => ({ ...f, websiteOrSocial: e.target.value }))} />
        </Labeled>
        <Labeled label={t('vp.alcohol')}>
          <SiteSelect value={form.venueType} options={ALCOHOL_OPTIONS} onChange={(v) => setForm((f) => ({ ...f, venueType: v }))} required ariaLabel={t('vp.alcoholAria')} />
        </Labeled>
        <button type="submit" disabled={saving} className="btn-primary w-full justify-center disabled:opacity-70">{saving ? t('vp.saving') : t('vp.save')}</button>
      </form>

      <section style={{ ...panelCard, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{t('vp.photosTitle', { n: MAX_PHOTOS })}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {me.venue.photos.map((url, i) => (
            <div key={url} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(url)} alt={t('vp.photoAlt', { n: i + 1 })} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {me.venue.photos.length > 1 && (
                <button type="button" aria-label={t('vp.photoDelete', { n: i + 1 })} onClick={() => removePhoto(url)} style={{ position: 'absolute', top: 4, right: 4, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', cursor: 'pointer' }}>✕</button>
              )}
            </div>
          ))}
        </div>
        {me.venue.photos.length < MAX_PHOTOS && (
          <label style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 10, color: '#ff6b6b', fontSize: '0.9rem', cursor: 'pointer' }}>
            {uploading ? t('vp.loading') : t('vp.addPhoto')}
            <input type="file" accept={VENUE_PHOTO_ACCEPT} multiple disabled={uploading} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          </label>
        )}
      </section>

      {message && <p style={{ color: '#4ade80', fontSize: '0.85rem', margin: 0 }}>{message}</p>}
      {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
    </div>
  );
}
