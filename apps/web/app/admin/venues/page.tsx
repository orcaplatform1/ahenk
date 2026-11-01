'use client';

import { useEffect, useState } from 'react';
import { api, API_PREFIX } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { AdminSelect } from '@/components/AdminSelect';
import { BG, SURFACE, BORDER, TEXT, MUTED, RED, GREEN, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';


const inputStyle: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 13, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface City { id: string; name: string; isActive?: boolean; }

// Önce aktif şehirler, sonra diğerleri; ikisi de Türkçe alfabetik
function sortCities(list: City[]): City[] {
  return [...list].sort((a, b) =>
    Number(!!b.isActive) - Number(!!a.isActive) || a.name.localeCompare(b.name, 'tr'));
}

const labelStyle: React.CSSProperties = { ...LABEL, color: MUTED, margin: '0 0 4px' };
const photoRemove: React.CSSProperties = {
  position: 'absolute', top: 3, right: 3, width: 20, height: 20, padding: 0, borderRadius: '50%', cursor: 'pointer',
  background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 11, lineHeight: 1,
};
interface Venue {
  id: string; name: string; category: string; venueType?: string;
  address?: string | null; district?: string | null; description?: string | null; isActive: boolean;
  locationUrl?: string | null; websiteOrSocial?: string | null; capacity?: number | null;
  latitude?: number | null; longitude?: number | null; photos: string[]; venueKind?: string | null;
  city: City;
  account?: { email: string; phone: string; status: string; application?: { contactName: string } | null } | null;
}

const EMPTY_FORM = {
  name: '', category: 'SADE', venueType: 'NON_ALCOHOLIC', cityId: '', address: '', district: '', description: '',
  locationUrl: '', websiteOrSocial: '', capacity: '', latitude: '', longitude: '', venueKind: '',
};
const MAX_PHOTOS = 3;

const orNull = (v: string) => v.trim() || null;
const numOrNull = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);

const CATS = ['SADE', 'ORTA', 'PREMIUM'];

export default function AdminVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  function loadVenues(cityId?: string) {
    const q = cityId ? `?cityId=${cityId}` : '';
    api.get<Venue[]>(`/admin/venues${q}`).then(setVenues)
      .catch((e: Error) => setError(`Mekanlar yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api.get<City[]>('/admin/cities').then(list => setCities(sortCities(list))).catch((e: Error) => setError(`Şehirler yüklenemedi: ${e.message}`));
    api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => {});
    loadVenues();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, cityId: cities[0]?.id ?? '' });
    setPhotos([]);
    setPendingFiles([]);
    setModalError('');
    setModal('add');
  }

  function openEdit(v: Venue) {
    setEditing(v);
    setForm({
      name: v.name, category: v.category, venueType: v.venueType ?? 'NON_ALCOHOLIC', cityId: v.city.id,
      address: v.address ?? '', district: v.district ?? '', description: v.description ?? '',
      locationUrl: v.locationUrl ?? '', websiteOrSocial: v.websiteOrSocial ?? '', capacity: v.capacity != null ? String(v.capacity) : '',
      latitude: v.latitude != null ? String(v.latitude) : '', longitude: v.longitude != null ? String(v.longitude) : '',
      venueKind: v.venueKind ?? '',
    });
    setPhotos(v.photos ?? []);
    setPendingFiles([]);
    setModalError('');
    setModal('edit');
  }

  async function save() {
    setSaving(true);
    const body = {
      name: form.name, category: form.category, venueType: form.venueType, cityId: form.cityId,
      address: orNull(form.address), district: orNull(form.district), description: orNull(form.description),
      locationUrl: orNull(form.locationUrl), websiteOrSocial: orNull(form.websiteOrSocial), venueKind: orNull(form.venueKind),
      capacity: numOrNull(form.capacity), latitude: numOrNull(form.latitude), longitude: numOrNull(form.longitude),
    };
    setModalError('');
    try {
      if (modal === 'add') {
        const created = await api.post<{ id: string }>('/admin/venues', body);
        // Mekân kaydı oluştu: fotoğraf yüklenemezse hata gösterilir, düzenle ekranından yeniden eklenebilir
        if (pendingFiles.length) await uploadPhotos(created.id, pendingFiles);
      } else if (editing) await api.patch(`/admin/venues/${editing.id}`, body);
      setModal(null);
      loadVenues(selectedCity || undefined);
    } catch (e) {
      setModalError(`Kaydedilemedi: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhotos(venueId: string, files: File[]) {
    const data = new FormData();
    files.forEach(f => data.append('photos', f));
    const res = await fetch(`${API_PREFIX}/admin/venues/${venueId}/photos`, { method: 'POST', credentials: 'include', body: data });
    const json = await res.json().catch(() => ({})) as { photos?: string[]; message?: string | string[] };
    if (!res.ok) throw new Error([json.message].flat()[0] ?? 'Fotoğraf yüklenemedi');
    return json.photos ?? [];
  }

  // Düzenlemede fotoğraf anında kaydedilir; yeni mekânda kayıtla birlikte yüklenir
  async function addPhotos(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setModalError('');
    if (photos.length + pendingFiles.length + files.length > MAX_PHOTOS) { setModalError(`En fazla ${MAX_PHOTOS} fotoğraf eklenebilir`); return; }
    if (!editing) { setPendingFiles(p => [...p, ...files]); return; }
    setPhotoBusy(true);
    try {
      setPhotos(await uploadPhotos(editing.id, files));
      loadVenues(selectedCity || undefined);
    } catch (e) { setModalError((e as Error).message); }
    finally { setPhotoBusy(false); }
  }

  async function removePhoto(url: string) {
    if (!editing || !confirm('Fotoğraf silinsin mi?')) return;
    setPhotoBusy(true); setModalError('');
    try {
      const res = await fetch(`${API_PREFIX}/admin/venues/${editing.id}/photos`, {
        method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      });
      const json = await res.json().catch(() => ({})) as { photos?: string[]; message?: string };
      if (!res.ok) throw new Error(json.message ?? 'Fotoğraf silinemedi');
      setPhotos(json.photos ?? []);
      loadVenues(selectedCity || undefined);
    } catch (e) { setModalError((e as Error).message); }
    finally { setPhotoBusy(false); }
  }

  async function deleteVenue(v: Venue) {
    const note = v.account ? ' Panel hesabı kapatılır.' : '';
    if (!confirm(`${v.name} silinsin mi? Bu işlem geri alınamaz. Masaların mekân adı ve adresi korunur.${note}`)) return;
    setError('');
    try {
      await api.delete(`/admin/venues/${v.id}`);
    } catch (e) {
      setError(`Silinemedi: ${(e as Error).message}`);
    }
    loadVenues(selectedCity || undefined);
  }

  async function toggleActive(v: Venue) {
    setError('');
    try {
      await api.patch(`/admin/venues/${v.id}`, { isActive: !v.isActive });
    } catch (e) {
      setError(`Güncellenemedi: ${(e as Error).message}`);
    }
    loadVenues(selectedCity || undefined);
  }

  const districtOptions = districts[cities.find(c => c.id === form.cityId)?.name ?? ''] ?? [];
  const filtered = selectedCity ? venues.filter(v => v.city.id === selectedCity) : venues;

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="ll-title">Mekanlar</h1>
        <button
          onClick={openAdd}
          style={{
            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
            fontSize: 13, fontWeight: 600, color: CYAN, fontFamily: SANS,
          }}
        >
          + Mekan Ekle
        </button>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      {/* Şehir filtresi */}
      <div style={{ marginBottom: 20, maxWidth: 280 }}>
        <AdminSelect
          value={selectedCity}
          onChange={id => { setSelectedCity(id); loadVenues(id || undefined); }}
          placeholder="Tüm şehirler"
          title="Şehir seç"
          options={[
            { value: '', label: 'Tüm şehirler' },
            ...cities.map(c => ({ value: c.id, label: c.name, group: c.isActive ? 'Aktif şehirler' : 'Diğer şehirler' })),
          ]}
        />
      </div>

      {loading ? (
        <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ll-title">Mekanlar</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        </div>
      ) : (
        <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ll-title">Mekanlar</h2>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{filtered.length} kayıt</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Mekan yok</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filtered.map((v, i) => (
                <div
                  key={v.id}
                  style={{
                    padding: '12px 18px',
                    borderBottom: i < filtered.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                      {!v.isActive && (
                        <span style={{
                          ...LABEL,
                          padding: '1px 6px', borderRadius: 99,
                          background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.25)', color: MUTED,
                        }}>PASİF</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 10, color: MUTED }}>
                      {v.city.name} · {v.category}{v.address ? ` · ${v.address}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => toggleActive(v)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: v.isActive ? 'rgba(100,116,139,0.1)' : 'rgba(34,197,94,0.1)',
                        border: `1px solid ${v.isActive ? 'rgba(100,116,139,0.25)' : 'rgba(34,197,94,0.3)'}`,
                        fontSize: 10, color: v.isActive ? MUTED : GREEN, fontFamily: SANS,
                      }}
                    >
                      {v.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                    </button>
                    <button
                      onClick={() => openEdit(v)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                        fontSize: 10, color: '#93c5fd', fontFamily: SANS,
                      }}
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => deleteVenue(v)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        fontSize: 10, color: RED, fontFamily: SANS,
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="ll-card" style={{ width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="ll-title">
                {modal === 'add' ? 'Yeni Mekan' : 'Mekanı Düzenle'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <p style={labelStyle}>MEKAN ADI</p>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mekan adı" style={inputStyle} />
              </div>
              <div>
                <p style={labelStyle}>ŞEHİR</p>
                <AdminSelect
                  value={form.cityId}
                  onChange={v => setForm(f => ({ ...f, cityId: v, district: '' }))}
                  placeholder="Şehir seçin"
                  title="Şehir seç"
                  options={cities.map(c => ({ value: c.id, label: c.name, group: c.isActive ? 'Aktif şehirler' : 'Diğer şehirler' }))}
                />
              </div>
              <div>
                <p style={labelStyle}>İLÇE (OPSİYONEL)</p>
                {districtOptions.length > 0 ? (
                  <AdminSelect
                    value={form.district}
                    onChange={v => setForm(f => ({ ...f, district: v }))}
                    options={districtOptions.map(d => ({ value: d, label: d }))}
                    placeholder="İlçe seçin"
                  />
                ) : (
                  <input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="İlçe" maxLength={60} style={inputStyle} />
                )}
              </div>
              <div>
                <p style={labelStyle}>KATEGORİ</p>
                <AdminSelect
                  value={form.category}
                  onChange={v => setForm(f => ({ ...f, category: v }))}
                  placeholder="Kategori"
                  options={CATS.map(c => ({ value: c, label: c }))}
                />
              </div>
              <div>
                <p style={labelStyle}>ADRES (OPSİYONEL)</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adres" style={inputStyle} />
                  {/* Kaydetmeden önce adresi kontrol etmek için Google Haritalar'da açar (şehir adıyla) */}
                  <a
                    href={form.address.trim()
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.address.trim()}, ${cities.find(c => c.id === form.cityId)?.name ?? ''}`)}`
                      : undefined}
                    target="_blank" rel="noopener noreferrer"
                    aria-disabled={!form.address.trim()}
                    style={{
                      flexShrink: 0, padding: '7px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                      background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd',
                      opacity: form.address.trim() ? 1 : 0.4, pointerEvents: form.address.trim() ? 'auto' : 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    Haritada gör
                  </a>
                </div>
              </div>
              <div>
                <p style={labelStyle}>MAPS LİNKİ (OPSİYONEL)</p>
                <input value={form.locationUrl} onChange={e => setForm(f => ({ ...f, locationUrl: e.target.value }))} placeholder="https://maps.app.goo.gl/…" maxLength={500} style={inputStyle} />
              </div>
              <div>
                <p style={labelStyle}>MEKÂN TÜRÜ (OPSİYONEL)</p>
                <input value={form.venueKind} onChange={e => setForm(f => ({ ...f, venueKind: e.target.value }))} placeholder="Restoran, Kafe…" maxLength={60} style={inputStyle} />
              </div>
              <div>
                <p style={labelStyle}>ALKOL DURUMU</p>
                <AdminSelect
                  value={form.venueType}
                  onChange={v => setForm(f => ({ ...f, venueType: v }))}
                  placeholder="Alkol durumu"
                  options={[{ value: 'NON_ALCOHOLIC', label: 'Alkolsüz' }, { value: 'ALCOHOLIC', label: 'Alkollü' }]}
                />
              </div>
              <div>
                <p style={labelStyle}>KONTENJAN (KİŞİ, OPSİYONEL)</p>
                <input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Haftalık varsayılan kontenjan" style={inputStyle} />
              </div>
              <div>
                <p style={labelStyle}>WEB / SOSYAL (OPSİYONEL)</p>
                <input value={form.websiteOrSocial} onChange={e => setForm(f => ({ ...f, websiteOrSocial: e.target.value }))} placeholder="Web sitesi veya sosyal medya" maxLength={300} style={inputStyle} />
              </div>
              <div>
                <p style={labelStyle}>AÇIKLAMA (OPSİYONEL)</p>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={labelStyle}>ENLEM (OPSİYONEL)</p>
                  <input inputMode="decimal" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={labelStyle}>BOYLAM (OPSİYONEL)</p>
                  <input inputMode="decimal" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              {editing?.account && (
                <div>
                  <p style={labelStyle}>PANEL HESABI İLETİŞİM</p>
                  <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                    {[editing.account.application?.contactName, editing.account.email, editing.account.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
              )}
              <div>
                <p style={labelStyle}>FOTOĞRAFLAR ({photos.length + pendingFiles.length}/{MAX_PHOTOS}): EN AZ 1, EN FAZLA 3; HER BİRİ EN FAZLA 5 MB</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 6, marginBottom: 8 }}>
                  {photos.map(url => (
                    <div key={url} style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl(url)} alt="Mekân fotoğrafı" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                      <button type="button" onClick={() => removePhoto(url)} disabled={photoBusy} aria-label="Fotoğrafı sil" style={photoRemove}>✕</button>
                    </div>
                  ))}
                  {pendingFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, background: SURFACE, padding: 6, fontSize: 11, color: MUTED, overflow: 'hidden' }}>
                      {f.name}
                      <button type="button" onClick={() => setPendingFiles(p => p.filter((_, k) => k !== i))} aria-label="Fotoğrafı çıkar" style={photoRemove}>✕</button>
                    </div>
                  ))}
                </div>
                <input
                  type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photoBusy}
                  onChange={e => { addPhotos(e.target.files); e.target.value = ''; }}
                  style={{ fontSize: 13, color: MUTED, fontFamily: SANS, maxWidth: '100%' }}
                />
              </div>
              <button
                onClick={save}
                disabled={saving || !form.name || !form.cityId}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
                  fontSize: 13, fontWeight: 700, color: CYAN, fontFamily: SANS,
                  opacity: saving || !form.name || !form.cityId ? 0.5 : 1,
                }}
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              {modalError && <p style={{ margin: '8px 0 0', fontSize: 13, color: RED }}>{modalError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
