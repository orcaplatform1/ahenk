// apps/web/app/admin/venues/page.tsx karşılığı (Mekanlar, yalnız SUPERADMIN). Fotoğraf: galeri veya kamera (expo-image-picker).
import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, TextInput, View } from 'react-native';
import { File as FsFile } from 'expo-file-system';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { chooseSource, pickFromCamera, pickFromLibrary, type PickedImage } from '@/lib/imagePick';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminSelect, AInput } from '@/components/admin/AdminControls';
import { ADialog } from '@/components/admin/ADialog';
import { StatusPill } from '@/components/admin/StatusPill';
import { adm, sans } from '@/theme/theme';

interface City { id: string; name: string; isActive?: boolean }
interface Venue { id: string; name: string; category: string; venueType?: string; address?: string | null; district?: string | null; description?: string | null; isActive: boolean; locationUrl?: string | null; websiteOrSocial?: string | null; seatCapacity?: number | null; latitude?: number | null; longitude?: number | null; photos: string[]; venueKind?: string | null; city: City; account?: { email: string; phone: string; status: string; application?: { contactName: string } | null } | null }
const EMPTY = { name: '', category: 'SADE', venueType: 'NON_ALCOHOLIC', cityId: '', address: '', district: '', description: '', locationUrl: '', websiteOrSocial: '', seatCapacity: '', latitude: '', longitude: '', venueKind: '' };
const MAX_PHOTOS = 3;
const orNull = (v: string) => v.trim() || null;
const numOrNull = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);
const sortCities = (l: City[]) => [...l].sort((a, b) => Number(!!b.isActive) - Number(!!a.isActive) || a.name.localeCompare(b.name, 'tr'));
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <View><ALabel style={{ marginBottom: 4 }}>{label}</ALabel>{children}</View>;

export default function AdminVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [photos, setPhotos] = useState<string[]>([]);
  const [pending, setPending] = useState<PickedImage[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const loadVenues = (cityId?: string) => { api.get<Venue[]>(`/admin/venues${cityId ? `?cityId=${cityId}` : ''}`).then(setVenues).catch((e: Error) => setError(`Mekanlar yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); };
  useEffect(() => {
    api.get<City[]>('/admin/cities').then(l => setCities(sortCities(l))).catch((e: Error) => setError(`Şehirler yüklenemedi: ${e.message}`));
    api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => {});
    loadVenues();
  }, []);
  const set = (k: keyof typeof EMPTY) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  function openAdd() { setEditing(null); setForm({ ...EMPTY, cityId: cities[0]?.id ?? '' }); setPhotos([]); setPending([]); setModalError(''); setModal('add'); }
  function openEdit(v: Venue) {
    setEditing(v);
    setForm({ name: v.name, category: v.category, venueType: v.venueType ?? 'NON_ALCOHOLIC', cityId: v.city.id, address: v.address ?? '', district: v.district ?? '', description: v.description ?? '', locationUrl: v.locationUrl ?? '', websiteOrSocial: v.websiteOrSocial ?? '',
      seatCapacity: v.seatCapacity != null ? String(v.seatCapacity) : '', latitude: v.latitude != null ? String(v.latitude) : '', longitude: v.longitude != null ? String(v.longitude) : '', venueKind: v.venueKind ?? '' });
    setPhotos(v.photos ?? []); setPending([]); setModalError(''); setModal('edit');
  }
  async function uploadPhotos(venueId: string, files: PickedImage[]) {
    const fd = new FormData();
    // Global fetch (expo/fetch) RN'nin { uri, name, type } parçasını desteklemiyor ("Unsupported FormDataPart implementation"); expo-file-system File kullanılır
    files.forEach(f => fd.append('photos', new FsFile(f.uri) as unknown as Blob));
    const r = await api.form<{ photos?: string[] }>(`/admin/venues/${venueId}/photos`, fd);
    return r.photos ?? [];
  }
  async function save() {
    setSaving(true); setModalError('');
    const body = { name: form.name, category: form.category, venueType: form.venueType, cityId: form.cityId, address: orNull(form.address), district: orNull(form.district), description: orNull(form.description), locationUrl: orNull(form.locationUrl), websiteOrSocial: orNull(form.websiteOrSocial), venueKind: orNull(form.venueKind), seatCapacity: numOrNull(form.seatCapacity), latitude: numOrNull(form.latitude), longitude: numOrNull(form.longitude) };
    try {
      if (modal === 'add') { const c = await api.post<{ id: string }>('/admin/venues', body); if (pending.length) await uploadPhotos(c.id, pending); }
      else if (editing) await api.patch(`/admin/venues/${editing.id}`, body);
      setModal(null); loadVenues(selectedCity || undefined);
    } catch (e) { setModalError(`Kaydedilemedi: ${(e as Error).message}`); } finally { setSaving(false); }
  }
  function addPhotos() {
    chooseSource(async (src) => {
      const files = src === 'library' ? await pickFromLibrary(MAX_PHOTOS - photos.length - pending.length) : await pickFromCamera();
      setModalError('');
      if (files === 'denied') { setModalError('Fotoğraflara erişim izni verilmedi'); return; }
      if (!files.length) return;
      if (photos.length + pending.length + files.length > MAX_PHOTOS) { setModalError(`En fazla ${MAX_PHOTOS} fotoğraf eklenebilir`); return; }
      if (files.some(f => !/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type))) { setModalError('Fotoğraflar JPEG, PNG, WebP, HEIC veya HEIF olmalı'); return; }
      if (!editing) { setPending(p => [...p, ...files]); return; }
      setPhotoBusy(true);
      try { setPhotos(await uploadPhotos(editing.id, files)); loadVenues(selectedCity || undefined); } catch (e) { setModalError((e as Error).message); } finally { setPhotoBusy(false); }
    });
  }
  function removePhoto(url: string) {
    if (!editing) return;
    Alert.alert('Fotoğraf silinsin mi?', undefined, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Tamam', style: 'destructive', onPress: async () => {
      setPhotoBusy(true); setModalError('');
      try {
        const r2 = await fetchDelete(editing.id, url);
        setPhotos(r2); loadVenues(selectedCity || undefined);
      } catch (e) { setModalError((e as Error).message); } finally { setPhotoBusy(false); }
    } }]);
  }
  async function fetchDelete(venueId: string, url: string) {
    const r = await api.deleteBody<{ photos?: string[] }>(`/admin/venues/${venueId}/photos`, { url });
    return r.photos ?? [];
  }
  function deleteVenue(v: Venue) {
    Alert.alert(`${v.name} silinsin mi? Bu işlem geri alınamaz. Masaların mekân adı ve adresi korunur.${v.account ? ' Panel hesabı kapatılır.' : ''}`, undefined, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Tamam', style: 'destructive', onPress: async () => {
      setError(''); try { await api.delete(`/admin/venues/${v.id}`); } catch (e) { setError(`Silinemedi: ${(e as Error).message}`); } loadVenues(selectedCity || undefined);
    } }]);
  }
  async function toggleActive(v: Venue) { setError(''); try { await api.patch(`/admin/venues/${v.id}`, { isActive: !v.isActive }); } catch (e) { setError(`Güncellenemedi: ${(e as Error).message}`); } loadVenues(selectedCity || undefined); }
  const districtOptions = districts[cities.find(c => c.id === form.cityId)?.name ?? ''] ?? [];
  const filtered = selectedCity ? venues.filter(v => v.city.id === selectedCity) : venues;
  const cityOpts = cities.map(c => ({ value: c.id, label: c.name, group: c.isActive ? 'Aktif şehirler' : 'Diğer şehirler' }));
  const mapUrl = form.address.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.address.trim()}, ${cities.find(c => c.id === form.cityId)?.name ?? ''}`)}` : null;
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <ATitle>Mekanlar</ATitle>
        <Btn variant="admAdd" label="+ Mekan Ekle" onPress={openAdd} />
      </View>
      <AError>{error}</AError>
      <View style={{ marginBottom: 20, maxWidth: 280 }}>
        <AdminSelect value={selectedCity} onChange={id => { setSelectedCity(id); loadVenues(id || undefined); }} placeholder="Tüm şehirler" title="Şehir seç" options={[{ value: '', label: 'Tüm şehirler' }, ...cityOpts]} />
      </View>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <ATitle>Mekanlar</ATitle>
          {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{filtered.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 48, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : filtered.length === 0 ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Mekan yok</AT></View>
          : filtered.map((v, i) => (
            <View key={v.id} style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: i < filtered.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)', flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <AT w={600} numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>{v.name}</AT>
                  {!v.isActive && <StatusPill text="PASİF" bg="rgba(100,116,139,0.12)" border="rgba(100,116,139,0.25)" pad={[1, 6]} />}
                </View>
                <AT style={{ fontSize: 10, color: adm.muted }}>{v.city.name} · {v.category}{v.address ? ` · ${v.address}` : ''}</AT>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Btn variant="admActivate" selected={v.isActive} label={v.isActive ? 'Pasifleştir' : 'Aktifleştir'} onPress={() => toggleActive(v)} />
                <Btn variant="admEditSm" label="Düzenle" onPress={() => openEdit(v)} />
                <Btn variant="admDelSm" label="Sil" onPress={() => deleteVenue(v)} />
              </View>
            </View>
          ))}
      </ACard>
      <ADialog visible={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Yeni Mekan' : 'Mekanı Düzenle'} maxWidth={460}>
        <View style={{ gap: 10 }}>
          <Field label="MEKAN ADI"><AInput value={form.name} onChangeText={set('name')} placeholder="Mekan adı" style={{ paddingHorizontal: 12 }} /></Field>
          <Field label="ŞEHİR"><AdminSelect value={form.cityId} onChange={v => setForm(f => ({ ...f, cityId: v, district: '' }))} placeholder="Şehir seçin" title="Şehir seç" options={cityOpts} /></Field>
          <Field label="İLÇE (OPSİYONEL)">{districtOptions.length > 0 ? <AdminSelect value={form.district} onChange={set('district')} options={districtOptions.map(d => ({ value: d, label: d }))} placeholder="İlçe seçin" /> : <AInput value={form.district} onChangeText={set('district')} placeholder="İlçe" maxLength={60} style={{ paddingHorizontal: 12 }} />}</Field>
          <Field label="KATEGORİ"><AdminSelect value={form.category} onChange={set('category')} placeholder="Kategori" options={['SADE', 'ORTA', 'PREMIUM'].map(c => ({ value: c, label: c }))} /></Field>
          <Field label="ADRES (OPSİYONEL)">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <AInput value={form.address} onChangeText={set('address')} placeholder="Adres" style={{ flex: 1, paddingHorizontal: 12 }} />
              <Btn variant="admMapSm" disabled={!mapUrl} label="Haritada gör" onPress={() => mapUrl && Linking.openURL(mapUrl)} />
            </View>
          </Field>
          <Field label="MAPS LİNKİ (OPSİYONEL)"><AInput value={form.locationUrl} onChangeText={set('locationUrl')} placeholder="https://maps.app.goo.gl/…" maxLength={500} autoCapitalize="none" style={{ paddingHorizontal: 12 }} /></Field>
          <Field label="MEKÂN TÜRÜ (OPSİYONEL)"><AInput value={form.venueKind} onChangeText={set('venueKind')} placeholder="Restoran, Kafe…" maxLength={60} style={{ paddingHorizontal: 12 }} /></Field>
          <Field label="ALKOL DURUMU"><AdminSelect value={form.venueType} onChange={set('venueType')} placeholder="Alkol durumu" options={[{ value: 'NON_ALCOHOLIC', label: 'Alkolsüz' }, { value: 'ALCOHOLIC', label: 'Alkollü' }]} /></Field>
          <Field label="Kapasite (kişi)"><AInput keyboardType="number-pad" value={form.seatCapacity} onChangeText={set('seatCapacity')} style={{ paddingHorizontal: 12 }} /></Field>
          <Field label="WEB / SOSYAL (OPSİYONEL)"><AInput value={form.websiteOrSocial} onChangeText={set('websiteOrSocial')} placeholder="Web sitesi veya sosyal medya" maxLength={300} autoCapitalize="none" style={{ paddingHorizontal: 12 }} /></Field>
          <Field label="AÇIKLAMA (OPSİYONEL)"><TextInput value={form.description} onChangeText={set('description')} multiline numberOfLines={3} keyboardAppearance="dark" style={{ backgroundColor: adm.bg, borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, fontSize: 13, color: adm.text, fontFamily: sans(400), minHeight: 72, textAlignVertical: 'top' }} /></Field>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="ENLEM (OPSİYONEL)"><AInput keyboardType="decimal-pad" value={form.latitude} onChangeText={set('latitude')} style={{ paddingHorizontal: 12 }} /></Field></View>
            <View style={{ flex: 1 }}><Field label="BOYLAM (OPSİYONEL)"><AInput keyboardType="decimal-pad" value={form.longitude} onChangeText={set('longitude')} style={{ paddingHorizontal: 12 }} /></Field></View>
          </View>
          {editing?.account && <Field label="PANEL HESABI İLETİŞİM"><AT style={{ fontSize: 13, color: adm.muted }}>{[editing.account.application?.contactName, editing.account.email, editing.account.phone].filter(Boolean).join(' · ')}</AT></Field>}
          <Field label={`FOTOĞRAFLAR (${photos.length + pending.length}/${MAX_PHOTOS}): EN AZ 1, EN FAZLA 3; HER BİRİ EN FAZLA 5 MB`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {photos.map(url => (
                <View key={url} style={{ width: 84, aspectRatio: 1 }}>
                  <Image source={{ uri: mediaUrl(url) }} style={{ width: '100%', height: '100%', borderRadius: 6 }} accessibilityLabel="Mekân fotoğrafı" />
                  <Btn variant="admPhotoX" label="✕" accessibilityLabel="Fotoğrafı sil" disabled={photoBusy} onPress={() => removePhoto(url)} />
                </View>
              ))}
              {pending.map((f, i) => (
                <View key={`${f.uri}-${i}`} style={{ width: 84, aspectRatio: 1 }}>
                  <Image source={{ uri: f.uri }} style={{ width: '100%', height: '100%', borderRadius: 6 }} />
                  <Btn variant="admPhotoX" label="✕" accessibilityLabel="Fotoğrafı çıkar" onPress={() => setPending(p => p.filter((_, k) => k !== i))} />
                </View>
              ))}
            </View>
            {photos.length + pending.length < MAX_PHOTOS && <Btn variant="admOutline" disabled={photoBusy} label="Fotoğraf seç" onPress={addPhotos} />}
          </Field>
          <Btn variant="admCyanFull" disabled={saving || !form.name || !form.cityId} label={saving ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} />
          {!!modalError && <AT style={{ marginTop: 8, fontSize: 13, color: adm.red }}>{modalError}</AT>}
        </View>
      </ADialog>
    </APage>
  );
}
