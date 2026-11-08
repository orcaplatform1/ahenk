// apps/web/app/mekan/panel/bilgiler/page.tsx karşılığı. RAPORLANDI: galeriden seçim paketi kurulu değil; fotoğraf kamerayla eklenir.
import React, { useEffect, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { VenueAuthError, mediaUrl, venueApi, type VenueMe } from '@/lib/venueApi';
import { panelCard, useVenuePanel } from '@/lib/venueContext';
import { PhotoCamera } from '@/components/profil/KycTab';
import { ListPicker } from '@/components/Pickers';
import { BtnPrimary, Input, Serif, T } from '@/components/ui';
import { c, inputGlass, sans, tw } from '@/theme/theme';

const MAX_PHOTOS = 3;
const ALCOHOL = [{ value: 'ALCOHOLIC', label: 'Alkollü' }, { value: 'NON_ALCOHOLIC', label: 'Alkolsüz' }];

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ gap: 6 }}><T w={500} style={{ fontSize: 12.5, color: c.t888 }}>{label}</T>{children}</View>;
}
const area = { backgroundColor: inputGlass.bg, borderWidth: 1, borderColor: inputGlass.border, borderRadius: inputGlass.radius, color: tw.text, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontFamily: sans(400), textAlignVertical: 'top' as const };

export default function Bilgiler() {
  const { me, setMe, onAuthLost } = useVenuePanel();
  const [form, setForm] = useState({ description: me.venue.description ?? '', address: me.venue.address ?? '', district: me.venue.district ?? '', locationUrl: me.venue.locationUrl ?? '', websiteOrSocial: me.venue.websiteOrSocial ?? '', venueType: me.venue.venueType as string });
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cam, setCam] = useState(false);
  const districtOptions = districts[me.venue.city] ?? [];
  useEffect(() => { api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => undefined); }, []);
  const fail = (e: unknown) => { if (e instanceof VenueAuthError) onAuthLost(); else setError((e as Error).message); };

  async function save() {
    setSaving(true); setError(''); setMessage('');
    try { setMe(await venueApi.patch<VenueMe>('/info', { ...form, locationUrl: form.locationUrl.trim() })); setMessage('Bilgiler kaydedildi.'); } catch (e) { fail(e); } finally { setSaving(false); }
  }
  async function addPhoto(uri: string) {
    setError(''); setMessage('');
    if (me.venue.photos.length + 1 > MAX_PHOTOS) { setError(`En fazla ${MAX_PHOTOS} fotoğraf eklenebilir.`); return; }
    const body = new FormData();
    body.append('photos', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    setUploading(true);
    try { setMe(await venueApi.post<VenueMe>('/photos', body)); } catch (e) { fail(e); } finally { setUploading(false); }
  }
  async function removePhoto(url: string) {
    setError(''); setMessage('');
    try { setMe(await venueApi.delete<VenueMe>('/photos', { url })); } catch (e) { fail(e); }
  }
  const setF = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <View style={{ gap: 12 }}>
      <Serif style={{ fontSize: 25.6 }}>Mekân Bilgileri</Serif>
      <View style={[panelCard, { gap: 14 }]}>
        <Labeled label="Mekân Türü"><T style={{ fontSize: 14.4 }}>{me.venue.venueKind || '—'}</T></Labeled>
        <Labeled label="Tanıtım (en fazla 500 karakter)"><TextInput accessibilityLabel="Tanıtım" multiline numberOfLines={4} maxLength={500} value={form.description} onChangeText={setF('description')} keyboardAppearance="dark" style={[area, { minHeight: 96 }]} /></Labeled>
        <Labeled label="Açık Adres"><TextInput accessibilityLabel="Açık adres" multiline numberOfLines={2} maxLength={300} value={form.address} onChangeText={setF('address')} keyboardAppearance="dark" style={[area, { minHeight: 56 }]} /></Labeled>
        <Labeled label="İlçe">
          {districtOptions.length > 0
            ? <ListPicker label="" value={form.district} onChange={setF('district')} options={districtOptions.map(d => ({ value: d, label: d }))} placeholder="İlçe seçin" title="İlçe" searchable searchPlaceholder="İlçe ara" />
            : <Input accessibilityLabel="İlçe" maxLength={60} value={form.district} onChangeText={setF('district')} />}
        </Labeled>
        <Labeled label="Google Maps Konum Linki"><Input accessibilityLabel="Konum linki" keyboardType="url" autoCapitalize="none" value={form.locationUrl} onChangeText={setF('locationUrl')} /></Labeled>
        <Labeled label="Website veya Instagram"><Input accessibilityLabel="Website veya Instagram" autoCapitalize="none" maxLength={300} value={form.websiteOrSocial} onChangeText={setF('websiteOrSocial')} /></Labeled>
        <Labeled label="Alkol Durumu"><ListPicker label="" value={form.venueType} onChange={setF('venueType')} options={ALCOHOL} placeholder="Seçin" title="Alkol durumu" /></Labeled>
        <BtnPrimary label={saving ? 'Kaydediliyor…' : 'Kaydet'} full disabled={saving} onPress={save} />
      </View>
      <View style={[panelCard, { gap: 12 }]}>
        <T w={600} style={{ fontSize: 16 }}>Fotoğraflar (en az 1, en fazla {MAX_PHOTOS}; her biri en fazla 5 MB)</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {me.venue.photos.map((url, i) => (
            <View key={url} style={{ width: 100, aspectRatio: 1, borderRadius: 10, overflow: 'hidden' }}>
              <Image source={{ uri: mediaUrl(url) }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`Mekân fotoğrafı ${i + 1}`} />
              {me.venue.photos.length > 1 && (
                <Pressable onPress={() => removePhoto(url)} accessibilityLabel={`Fotoğraf ${i + 1} sil`} hitSlop={6} style={{ position: 'absolute', top: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ color: '#fff' }}>✕</T>
                </Pressable>
              )}
            </View>
          ))}
        </View>
        {me.venue.photos.length < MAX_PHOTOS && (
          <Pressable disabled={uploading} onPress={() => setCam(true)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 10 }}>
            <T style={{ color: tw.accent, fontSize: 14.4 }}>{uploading ? 'Yükleniyor…' : '+ Fotoğraf ekle'}</T>
          </Pressable>
        )}
      </View>
      {!!message && <T style={{ color: c.ok, fontSize: 13.6 }}>{message}</T>}
      {!!error && <T style={{ color: tw.accent, fontSize: 13.6 }}>{error}</T>}
      <PhotoCamera visible={cam} onClose={() => setCam(false)} onShot={(s) => addPhoto(s.uri)} />
    </View>
  );
}
