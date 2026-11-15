// apps/web/app/admin/denge/page.tsx karşılığı (Bot Yönetimi, yalnız SUPERADMIN)
import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { File as FsFile } from 'expo-file-system';
import { showAlert } from '@/components/AppAlert';
import { api } from '@/lib/api';
import { OCCUPATION_SECTORS } from '@/lib/occupations';
import { pickFromLibrary } from '@/lib/imagePick';
import { gColor } from '@/lib/masa';
import { absPhoto } from '@/components/ProfilePhoto';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminDatePicker, AdminSelect, AInput } from '@/components/admin/AdminControls';
import { ADialog } from '@/components/admin/ADialog';
import { StatusPill } from '@/components/admin/StatusPill';
import { adm } from '@/theme/theme';

interface Ocean { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }
interface Bot { id: string; status: string; botPhone?: string | null; occupationSector?: string; profile?: { firstName?: string | null; lastName?: string | null; gender?: string | null; birthDate?: string | null; primaryCity?: string | null } | null; oceanScore?: Ocean | null; photoUrl?: string | null }
interface City { id: string; name: string; isActive: boolean }
interface BotUsage { thisWeek: number; weeks: { start: string; end: string; count: number }[] }
// Hafta tarih aralığı (TR): 10.11 – 16.11.2026 (web weekRange ile aynı)
function weekRange(start: string, end: string) {
  const f = (d: string, year: boolean) => new Date(d).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', ...(year ? { year: 'numeric' } : {}) });
  return `${f(start, false)} – ${f(end, true)}`;
}
const OCEAN_FIELDS: { key: keyof Ocean; label: string }[] = [{ key: 'openness', label: 'Açıklık' }, { key: 'conscientiousness', label: 'Sorumluluk' }, { key: 'extraversion', label: 'Dışadönüklük' }, { key: 'agreeableness', label: 'Uyumluluk' }, { key: 'neuroticism', label: 'Duygusal Denge' }];
const EMPTY = { firstName: '', lastName: '', gender: '', occupationSector: '', birthDate: '', phone: '', cityId: '', openness: '50', conscientiousness: '50', extraversion: '50', agreeableness: '50', neuroticism: '50' };
type Form = typeof EMPTY;
function ageOf(b?: string | null) {
  if (!b) return null;
  const d = new Date(b); const now = new Date(Date.now() + 3 * 3600 * 1000);
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

export default function AdminBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [cities, setCities] = useState<City[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  // Bot profil fotoğrafı: seçilen dosya kaydet anında yüklenir (onay süreci yok, doğrudan onaylı)
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [usage, setUsage] = useState<BotUsage | null>(null);
  async function pickPhoto() {
    const picked = await pickFromLibrary(1);
    if (picked === 'denied') { showAlert('Profil Fotoğrafı', 'Galeri izni verilmedi.'); return; }
    if (!picked.length) return;
    setPhotoUri(picked[0].uri); setPhotoPreview(picked[0].uri);
  }
  const load = () => { api.get<Bot[]>('/matching/admin/bots').then(setBots).catch((e: Error) => setError(`Botlar yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); };
  // Bot kullanım sayacı: endpoint yalnız SUPERADMIN'e açık; diğer rollerde sayaç görünmez
  useEffect(() => { api.get<BotUsage>('/matching/admin/bots/usage').then(setUsage).catch(() => setUsage(null)); }, []);
  useEffect(() => { load(); api.get<City[]>('/admin/cities').then(c => setCities(c.filter(x => x.isActive))).catch((e: Error) => setError(`Şehirler yüklenemedi: ${e.message}`)); }, []);
  const cityName = (id?: string | null) => cities.find(c => c.id === id)?.name ?? '—';
  function openEdit(b: Bot) {
    setEditing(b); const o = b.oceanScore;
    setPhotoUri(null); setPhotoPreview(b.photoUrl ? absPhoto(b.photoUrl) : null);
    setForm({ firstName: b.profile?.firstName ?? '', lastName: b.profile?.lastName ?? '', gender: b.profile?.gender ?? '', occupationSector: b.occupationSector ?? '', birthDate: b.profile?.birthDate ? b.profile.birthDate.slice(0, 10) : '', phone: (b.botPhone ?? '').replace(/^\+90/, ''), cityId: b.profile?.primaryCity ?? '',
      openness: String(o?.openness ?? 50), conscientiousness: String(o?.conscientiousness ?? 50), extraversion: String(o?.extraversion ?? 50), agreeableness: String(o?.agreeableness ?? 50), neuroticism: String(o?.neuroticism ?? 50) });
    setModalError(''); setModal('edit');
  }
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const oceanValid = OCEAN_FIELDS.every(({ key }) => form[key] !== '' && Number(form[key]) >= 0 && Number(form[key]) <= 100);
  const missing = [!form.firstName.trim() && 'Ad', !form.lastName.trim() && 'Soyad', !form.gender && 'Cinsiyet', !form.birthDate && 'Doğum tarihi', !form.occupationSector && 'Meslek alanı',
    !(form.phone.length === 10 && form.phone.startsWith('5')) && 'Telefon (5 ile başlayan 10 hane)', !form.cityId && 'Şehir', !oceanValid && 'Kişilik testi skorları (0-100)'].filter(Boolean) as string[];
  async function save() {
    if (missing.length) { setModalError(`Eksik veya hatalı: ${missing.join(', ')}`); return; }
    setSaving(true); setModalError('');
    const body = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), gender: form.gender, occupationSector: form.occupationSector, birthDate: form.birthDate, phone: `+90${form.phone}`, cityId: form.cityId,
      openness: Number(form.openness), conscientiousness: Number(form.conscientiousness), extraversion: Number(form.extraversion), agreeableness: Number(form.agreeableness), neuroticism: Number(form.neuroticism) };
    try {
      let botId: string | null = null;
      if (modal === 'add') botId = (await api.post<{ id: string }>('/matching/admin/bots', body)).id;
      else if (editing) { await api.patch(`/matching/admin/bots/${editing.id}`, body); botId = editing.id; }
      if (botId && photoUri) {
        const fd = new FormData();
        // expo-file-system File nesnesi dosya içeriğini sağlar (profil fotoğrafı yüklemesiyle aynı yöntem)
        fd.append('photo', new FsFile(photoUri) as unknown as Blob);
        await api.form(`/matching/admin/bots/${botId}/profile-photo`, fd);
      }
      setModal(null); load();
    }
    catch (e) { setModalError(`Kaydedilemedi: ${(e as Error).message}`); } finally { setSaving(false); }
  }
  async function toggleStatus(b: Bot) { setError(''); try { await api.patch(`/matching/admin/bots/${b.id}/status`, { active: b.status !== 'ACTIVE' }); } catch (e) { setError(`Güncellenemedi: ${(e as Error).message}`); } load(); }
  function deleteBot(id: string) {
    showAlert('Botu sil?', undefined, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Tamam', style: 'destructive', onPress: async () => { setError(''); try { await api.delete(`/matching/admin/bots/${id}`); } catch (e) { setError(`Silinemedi: ${(e as Error).message}`); } load(); } }]);
  }
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <ATitle>Bot Yönetimi</ATitle>
        <Btn variant="admAdd" label="+ Bot Ekle" onPress={() => { setForm(EMPTY); setPhotoUri(null); setPhotoPreview(null); setModalError(''); setModal('add'); }} />
      </View>
      {usage && (
        <ACard style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          <View style={{ paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border }}>
            <AMono style={{ fontSize: 11, letterSpacing: 0.66 }}>BU HAFTA BOT KULLANILAN MASA</AMono>
            <AT w={700} style={{ marginTop: 4, fontSize: 40, lineHeight: 44 }}>{usage.thisWeek}</AT>
          </View>
          {usage.weeks.map((w, i) => (
            <View key={w.start} style={{ paddingVertical: 8, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: i < usage.weeks.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
              <AMono style={{ fontSize: 12 }}>{weekRange(w.start, w.end)}</AMono>
              <AT w={600} style={{ fontSize: 13 }}>{w.count}</AT>
            </View>
          ))}
        </ACard>
      )}
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <ATitle>Botlar</ATitle>
          {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{bots.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 48, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : bots.length === 0 ? <View style={{ paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Bot yok</AT><AMono style={{ marginTop: 4, fontSize: 11 }}>Yeni bot eklemek için + Bot Ekle butonunu kullan</AMono></View>
          : bots.map((b, i) => {
            const active = b.status === 'ACTIVE';
            return (
              <View key={b.id} style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: i < bots.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)', flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <AT w={600} style={{ fontSize: 13 }}>{b.profile?.firstName ?? ''} {b.profile?.lastName ?? ''}</AT>
                    <StatusPill text={active ? 'AKTİF' : 'PASİF'} color={active ? adm.green : adm.muted} bg={active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)'} border={active ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.25)'} />
                  </View>
                  <AT style={{ marginTop: 3, fontSize: 10, color: adm.muted }}>
                    {b.profile?.gender === 'MALE' ? 'Erkek' : b.profile?.gender === 'FEMALE' ? 'Kadın' : '—'} · {ageOf(b.profile?.birthDate) ?? '—'} yaş · {cityName(b.profile?.primaryCity)} · {b.occupationSector || '—'}{b.botPhone ? ` · ${b.botPhone}` : ''}
                  </AT>
                  {b.oceanScore && <AMono style={{ marginTop: 2, fontSize: 10 }}>{OCEAN_FIELDS.map(({ key, label }) => `${label[0]}${Math.round(b.oceanScore![key])}`).join(' · ')}</AMono>}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <Btn variant="admActivate" selected={active} label={active ? 'Pasifleştir' : 'Aktifleştir'} onPress={() => toggleStatus(b)} />
                  <Btn variant="admEditSm" label="Düzenle" onPress={() => openEdit(b)} />
                  <Btn variant="admDelSm" label="Sil" onPress={() => deleteBot(b.id)} />
                </View>
              </View>
            );
          })}
      </ACard>
      <ADialog visible={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Yeni Bot' : 'Botu Düzenle'} maxWidth={420} keyboardScroll>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: gColor(form.gender), overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' }}>
              {photoPreview
                ? <Image source={{ uri: photoPreview }} style={{ width: '100%', height: '100%' }} accessibilityLabel="Bot profil fotoğrafı" />
                : <AT w={700} style={{ fontSize: 18 }}>{`${form.firstName.trim()[0] ?? ''}${form.lastName.trim()[0] ?? ''}`.toLocaleUpperCase('tr-TR') || '?'}</AT>}
            </View>
            <Pressable onPress={pickPhoto} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)', opacity: pressed ? 0.8 : 1 })}>
              <AT w={600} style={{ fontSize: 12, color: adm.cyan }}>{photoPreview ? 'Fotoğrafı Değiştir' : 'Profil Fotoğrafı Yükle'}</AT>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AInput value={form.firstName} onChangeText={v => set('firstName', v)} placeholder="Ad" style={{ flex: 1, paddingHorizontal: 12 }} />
            <AInput value={form.lastName} onChangeText={v => set('lastName', v)} placeholder="Soyad" style={{ flex: 1, paddingHorizontal: 12 }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flex: 1 }}><AdminSelect value={form.gender} onChange={v => set('gender', v)} placeholder="Cinsiyet" options={[{ value: 'MALE', label: 'Erkek' }, { value: 'FEMALE', label: 'Kadın' }]} /></View>
            <View style={{ flex: 1 }}><AdminDatePicker value={form.birthDate} onChange={v => set('birthDate', v)} /></View>
          </View>
          <AdminSelect value={form.occupationSector} onChange={v => set('occupationSector', v)} placeholder="Meslek alanı" options={OCCUPATION_SECTORS.map(o => ({ value: o, label: o }))} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ justifyContent: 'center', backgroundColor: adm.bg, borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingHorizontal: 12 }}><AT style={{ fontSize: 13, color: adm.muted }}>+90</AT></View>
            <AInput keyboardType="number-pad" value={form.phone} onChangeText={v => set('phone', v.replace(/\D/g, '').slice(0, 10))} placeholder="5XX XXX XX XX" style={{ flex: 1, paddingHorizontal: 12 }} />
          </View>
          <AdminSelect value={form.cityId} onChange={v => set('cityId', v)} placeholder="Şehir" options={cities.map(c => ({ value: c.id, label: c.name }))} />
          <ALabel style={{ marginTop: 4 }}>KİŞİLİK TESTİ SKORLARI (0-100)</ALabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {OCEAN_FIELDS.map(({ key, label }) => (
              <View key={key} style={{ flex: 1, gap: 3 }}>
                <AT numberOfLines={1} style={{ fontSize: 9, color: adm.muted }}>{label}</AT>
                <AInput keyboardType="number-pad" value={form[key]} onChangeText={v => set(key, v)} style={{ paddingHorizontal: 6, paddingVertical: 6, textAlign: 'center' }} />
              </View>
            ))}
          </View>
          <Btn variant="admCyanFull" disabled={saving} label={saving ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} />
          {!!modalError && <AT style={{ marginTop: 8, fontSize: 13, color: adm.red }}>{modalError}</AT>}
        </View>
      </ADialog>
    </APage>
  );
}
