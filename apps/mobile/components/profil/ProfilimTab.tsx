// apps/web/app/profil/tabs/TabProfilim.tsx karşılığı
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { gColor } from '@/lib/masa';
import { Btn, BtnGhost, BtnPrimary, Card, Head, Input, ModalBox, Row, Sheet, Switch, T } from '../ui';
import { getShakeEnabled, setShakeEnabled } from '@/lib/shakePref';
import { OtpInput } from '../OtpInput';
import { KankaSection } from './KankaSection';
import { ProblemReport } from './ProblemReport';
import { accountBtn, c, ll, sans, tw } from '@/theme/theme';

export interface City { id: string; name: string }
type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE';
export interface UserData {
  id: string; firstName: string; lastName: string; email: string; phone?: string; role?: string; activeCity?: string | null; occupationSector?: string;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null; maintenanceMode?: boolean;
  profile?: { gender?: string; birthDate?: string; primaryCity?: City; venuePreference?: VenuePreference };
  kyc?: { status: string }; noShowWarning?: { count: number; remaining: number } | null;
}

const VENUE_OPTIONS: { value: VenuePreference; label: string; description: string }[] = [
  { value: 'ALCOHOLIC', label: 'Alkollü Mekan', description: 'Alkollü içecek servisi olan restoran veya bar' },
  { value: 'NON_ALCOHOLIC', label: 'Alkolsüz Mekan', description: 'Kafe veya alkolsüz restoran' },
  { value: 'NO_PREFERENCE', label: 'Her ikisi de uygun', description: 'Her iki mekan türü de uygundur' },
];
const VENUE_LABELS: Record<VenuePreference, string> = { ALCOHOLIC: 'Alkollü Mekan', NON_ALCOHOLIC: 'Alkolsüz Mekan', NO_PREFERENCE: 'Her ikisi de uygun' };
const KYC_BADGE: Record<string, { label: string; approved: boolean }> = {
  PENDING: { label: 'Doğrulanmamış', approved: false }, APPROVED: { label: 'Doğrulandı', approved: true }, REJECTED: { label: 'Doğrulanmamış', approved: false }, SUSPICIOUS: { label: 'Doğrulanmamış', approved: false },
};
const ORDINAL = ['İlk', 'İkinci', 'Üçüncü'];
const CITY_ORDER = ['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Balıkesir', 'Aydın', 'Muğla'];
const cityLabel = (n: string) => (n === 'Balıkesir' ? 'Balıkesir (Ayvalık / Akçay)' : n);
function sortCities(cs: City[]) {
  return [...cs].sort((a, b) => { const ia = CITY_ORDER.indexOf(a.name), ib = CITY_ORDER.indexOf(b.name); if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, 'tr'); if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib; });
}

function SmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return <Btn variant="rowAction" label={label} onPress={onPress} />;
}

function CardP({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <Card>
      <Head title={title} right={action ? <Btn variant="cardAction" label={action.label} onPress={action.onPress} /> : undefined} />
      <View style={{ gap: 12 }}>{children}</View>
    </Card>
  );
}

function CitySelect({ label, value, onChange, cities, optional, placeholder, title }: { label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean; placeholder?: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [tmp, setTmp] = useState(value);
  const found = cities.find(x => x.id === value);
  const display = found ? cityLabel(found.name) : optional ? (placeholder ?? 'Seçmek istemiyorum') : 'Şehir seç';
  return (
    <View style={{ flex: 1 }}>
      {!!label && <T style={{ fontSize: 12, color: ll.text2, marginBottom: 4 }}>{label}</T>}
      <Btn variant="citySelectProfile" selected={!!value} label={display} onPress={() => { setTmp(value); setOpen(true); }} />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <T style={{ fontSize: 13, color: c.t888 }}>{title}</T>
          <Btn variant="closeX" label="×" accessibilityLabel="Kapat" onPress={() => setOpen(false)} />
        </View>
        <ScrollView style={{ maxHeight: 300 }}>
          {optional && (
            <Btn variant="listOption" selected={tmp === ''} label="Seçmek istemiyorum" textStyle={tmp === '' ? undefined : { color: c.t888 }} onPress={() => setTmp('')} />
          )}
          {sortCities(cities).map(x => (
            <Btn key={x.id} variant="listOption" selected={tmp === x.id} label={cityLabel(x.name)} onPress={() => setTmp(x.id)} />
          ))}
        </ScrollView>
        <BtnPrimary label="Seç" full style={{ marginTop: 16 }} onPress={() => { onChange(tmp); setOpen(false); }} />
      </Sheet>
    </View>
  );
}

export function ProfilimTab({ user, cities, onLoggedOut, onAdmin }: { user: UserData; cities: City[]; onLoggedOut: () => void; onAdmin: () => void }) {
  const [editingCities, setEditingCities] = useState(false);
  const [editingVenue, setEditingVenue] = useState(false);
  const [stats, setStats] = useState<{ totalInvites: number; availableDiscounts: number } | null>(null);
  const [refPhone, setRefPhone] = useState('');
  const [refSending, setRefSending] = useState(false);
  const [refMsg, setRefMsg] = useState('');
  const [primaryCityId, setPrimaryCityId] = useState(user.profile?.primaryCity?.id ?? '');
  const [displayPrimary, setDisplayPrimary] = useState<City | null>(user.profile?.primaryCity ?? null);
  const [venuePref, setVenuePref] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [displayVenue, setDisplayVenue] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [activeCity, setActiveCity] = useState(user.activeCity ?? '');
  const [activeConfirm, setActiveConfirm] = useState(false);
  const [pendingActive, setPendingActive] = useState<string | null>(null);
  const [savingActive, setSavingActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [phoneMode, setPhoneMode] = useState<'idle' | 'enter' | 'otp'>('idle');
  const [newPhone, setNewPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [currentPhone, setCurrentPhone] = useState(user.phone ?? '');
  const [emailMode, setEmailMode] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [currentEmail, setCurrentEmail] = useState(user.email);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletePending, setDeletePending] = useState(false);
  const [shake, setShake] = useState(true);

  useEffect(() => { getShakeEnabled().then(setShake); }, []);
  useEffect(() => {
    api.get<{ request: { id: string } | null }>('/users/me/deletion-request').then(r => setDeletePending(!!r?.request?.id)).catch(() => {});
    api.get<{ totalInvites: number; availableDiscounts: number }>('/referral/my-stats').then(setStats).catch(() => {});
  }, []);

  const badge = KYC_BADGE[user.kyc?.status ?? 'PENDING'] ?? KYC_BADGE.PENDING;

  async function logoutAll() {
    setLogoutAllBusy(true);
    try { await api.post('/auth/logout-all', {}); await api.logout(); onLoggedOut(); } catch (e) { setSaveError((e as Error).message); setLogoutAllBusy(false); }
  }
  async function logout() { await api.logout(); onLoggedOut(); }
  async function confirmDelete() {
    setDeleteBusy(true); setDeleteError('');
    try { await api.post('/users/me/deletion-request', {}); setDeletePending(true); setDeleteOpen(false); } catch (e) { setDeleteError((e as Error).message); } finally { setDeleteBusy(false); }
  }
  async function sendReferral() {
    if (!refPhone || refPhone.length !== 10 || !refPhone.startsWith('5')) { setRefMsg('Geçerli bir numara girin (5 ile başlayan 10 hane).'); return; }
    setRefSending(true); setRefMsg('');
    try { await api.post('/referral/invite', { phoneNumber: `+90${refPhone}` }); setRefMsg('Davet başarıyla gönderildi!'); setRefPhone(''); setStats(await api.get('/referral/my-stats')); }
    catch (e) { setRefMsg((e as Error).message || 'Gönderilemedi.'); } finally { setRefSending(false); }
  }
  async function sendPhoneOtp() {
    if (!newPhone || newPhone.length !== 10 || !newPhone.startsWith('5')) { setPhoneError('Geçerli bir numara girin (5 ile başlayan 10 hane).'); return; }
    setPhoneSaving(true); setPhoneError('');
    try { await api.post('/users/change-phone/request', { phone: `+90${newPhone}` }); setPhoneMode('otp'); } catch (e) { setPhoneError((e as Error).message); } finally { setPhoneSaving(false); }
  }
  async function verifyPhone(code = otp) {
    if (code.length !== 6) return;
    setPhoneSaving(true); setPhoneError('');
    try { await api.post('/users/change-phone/verify', { phone: `+90${newPhone}`, code }); setCurrentPhone(`+90${newPhone}`); setPhoneMode('idle'); setNewPhone(''); setOtp(''); }
    catch (e) { setPhoneError((e as Error).message); } finally { setPhoneSaving(false); }
  }
  async function saveEmail() {
    if (!newEmail.includes('@') || !newEmail.includes('.')) { setEmailError('Geçerli bir e-posta girin.'); return; }
    if (!emailPw) { setEmailError('Mevcut şifrenizi girin.'); return; }
    setEmailSaving(true); setEmailError('');
    try { await api.patch('/users/change-email', { email: newEmail, currentPassword: emailPw }); setCurrentEmail(newEmail); setEmailMode(false); setNewEmail(''); setEmailPw(''); }
    catch (e) { setEmailError((e as Error).message); } finally { setEmailSaving(false); }
  }
  async function saveCities() {
    if (!primaryCityId) { setSaveError('Ana şehir zorunlu.'); return; }
    setSaving(true); setSaveError('');
    try { await api.post('/users/cities', { primaryCityId }); setDisplayPrimary(cities.find(x => x.id === primaryCityId) ?? null); setEditingCities(false); }
    catch (e) { setSaveError((e as Error).message); } finally { setSaving(false); }
  }
  async function saveActiveCity(cityId: string | null) {
    setSavingActive(true);
    try { await api.patch('/users/active-city', { activeCityId: cityId }); setActiveCity(cityId ?? ''); } catch (e) { setSaveError((e as Error).message); } finally { setSavingActive(false); }
  }
  async function saveVenue() {
    setSaving(true); setSaveError('');
    try { await api.patch('/users/venue-preference', { venuePreference: venuePref }); setDisplayVenue(venuePref); setEditingVenue(false); }
    catch (e) { setSaveError((e as Error).message); } finally { setSaving(false); }
  }

  const age = user.profile?.birthDate ? Math.floor((Date.now() - new Date(user.profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

  return (
    <View style={{ gap: 24 }}>
      {(user.role === 'ADMIN' || user.role === 'SUPERADMIN') && (
        <Btn variant="adminChip" accessibilityLabel="Yönetim Paneli" onPress={onAdmin}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6' }} />
          <T w={700} style={{ fontSize: 11, color: '#93c5fd' }}>Yönetim Paneli</T>
        </Btn>
      )}
      <CardP title="Hesap Bilgileri">
        {user.noShowWarning && (
          <T w={500} style={{ fontSize: 14, lineHeight: 22, color: c.warnYellow }}>
            Uyarı: {ORDINAL[user.noShowWarning.count - 1] ?? `${user.noShowWarning.count}.`} ihlal, masaya katılım sağlamadınız. Kalan uyarı hakkı {user.noShowWarning.remaining}
          </T>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T style={{ fontSize: 13, color: ll.text2 }}>Kimlik Doğrulama</T>
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: badge.approved ? c.ok2 : c.red, backgroundColor: badge.approved ? 'rgba(34,197,94,0.08)' : 'rgba(192,57,43,0.08)' }}>
            <T style={{ fontSize: 12, color: badge.approved ? c.ok : tw.accent }}>{badge.label}</T>
          </View>
        </View>
        <Row label="Ad Soyad" value={`${user.firstName} ${user.lastName}`} />
        {emailMode ? (
          <View style={{ gap: 8, paddingTop: 4 }}>
            <T style={{ fontSize: 12, color: ll.label }}>Yeni e-posta adresi</T>
            <Input keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" value={newEmail} onChangeText={t => { setNewEmail(t); setEmailError(''); }} placeholder="yeni@eposta.com" />
            <Input secureTextEntry textContentType="password" value={emailPw} onChangeText={t => { setEmailPw(t); setEmailError(''); }} placeholder="Mevcut şifreniz" />
            {!!emailError && <T style={{ color: tw.accent, fontSize: 12 }}>{emailError}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label="İptal" style={{ flex: 1 }} onPress={() => { setEmailMode(false); setEmailError(''); }} />
              <BtnPrimary label={emailSaving ? '…' : 'Kaydet'} style={{ flex: 1 }} disabled={emailSaving} onPress={saveEmail} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <T style={{ fontSize: 13, color: ll.text2 }}>E-posta</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <T numberOfLines={1} style={{ fontSize: 13, color: ll.text, flexShrink: 1 }}>{currentEmail}</T>
              <SmallBtn label="Değiştir" onPress={() => setEmailMode(true)} />
            </View>
          </View>
        )}
        {phoneMode === 'idle' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontSize: 13, color: ll.text2 }}>Telefon</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T style={{ fontSize: 13, color: ll.text }}>{currentPhone || '—'}</T>
              <SmallBtn label={currentPhone ? 'Değiştir' : 'Ekle'} onPress={() => setPhoneMode('enter')} />
            </View>
          </View>
        )}
        {phoneMode === 'enter' && (
          <View style={{ gap: 8, paddingTop: 4 }}>
            <T style={{ fontSize: 12, color: ll.label }}>{currentPhone ? 'Yeni telefon numarası' : 'Telefon numarası ekle'}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12 }}><T style={{ color: ll.label, fontSize: 14 }}>+90</T></View>
              <Input style={{ flex: 1 }} keyboardType="number-pad" textContentType="telephoneNumber" value={newPhone} onChangeText={t => { setNewPhone(t.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }} placeholder="5XX XXX XX XX" />
            </View>
            {!!phoneError && <T style={{ color: tw.accent, fontSize: 12 }}>{phoneError}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label="İptal" style={{ flex: 1 }} onPress={() => { setPhoneMode('idle'); setPhoneError(''); setNewPhone(''); }} />
              <BtnPrimary label={phoneSaving ? '…' : 'Kod Gönder'} style={{ flex: 1 }} disabled={phoneSaving} onPress={sendPhoneOtp} />
            </View>
          </View>
        )}
        {phoneMode === 'otp' && (
          <View style={{ gap: 8, paddingTop: 4 }}>
            <T style={{ fontSize: 12, color: ll.label }}>+90{newPhone} numarasına WhatsApp kodu gönderildi.</T>
            <OtpInput value={otp} onChange={setOtp} onComplete={verifyPhone} />
            {!!phoneError && <T style={{ color: tw.accent, fontSize: 12, textAlign: 'center' }}>{phoneError}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label="Geri" style={{ flex: 1 }} onPress={() => { setPhoneMode('enter'); setPhoneError(''); setOtp(''); }} />
              <BtnPrimary label={phoneSaving ? '…' : 'Doğrula'} style={{ flex: 1 }} disabled={phoneSaving || otp.length !== 6} onPress={() => verifyPhone()} />
            </View>
          </View>
        )}
        {!!user.occupationSector && <Row label="Meslek" value={user.occupationSector} />}
        {age !== null && <Row label="Yaş" value={`${age}`} />}
        {!!user.profile?.gender && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontSize: 13, color: ll.text2 }}>Cinsiyet</T>
            <View style={{ paddingVertical: 6, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1.5, borderColor: gColor(user.profile.gender), shadowColor: gColor(user.profile.gender), shadowOpacity: 0.33, shadowRadius: 6 }}>
              <T style={{ fontSize: 13, color: gColor(user.profile.gender) }}>{user.profile.gender === 'MALE' ? 'Erkek' : 'Kadın'}</T>
            </View>
          </View>
        )}
        <KankaSection />
      </CardP>

      <Sheet visible={activeConfirm} onClose={() => setActiveConfirm(false)}>
        <T w={700} style={{ fontSize: 16, marginBottom: 10 }}>Dikkat</T>
        <T style={{ fontSize: 13, color: c.t888, lineHeight: 21, marginBottom: 20 }}>
          Eşleşme süreciniz <T style={{ fontSize: 13, color: tw.text }}>{displayPrimary?.name ?? 'ana şehriniz'}</T> üzerinden devam etmektedir. Şehri değiştirirseniz eşleşme sıranıza yeniden gireceksiniz.
        </T>
        <View style={{ gap: 8 }}>
          <BtnPrimary label="Kabul Ediyorum" full onPress={() => { setActiveConfirm(false); saveActiveCity(pendingActive); }} />
          <BtnGhost label="Kabul Etmiyorum" full onPress={() => setActiveConfirm(false)} />
        </View>
      </Sheet>

      <CardP title="Hangi Şehirdeki Masalara Katılmak İstersiniz?">
        <T style={{ fontSize: 12, color: ll.label }}>Bu şehirlerden birinde tatilde veya seyahatteyseniz, oradaki grup masası veya baş başa masasına katılabilirsiniz.</T>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <CitySelect label="" value={activeCity} onChange={setActiveCity} cities={cities} optional placeholder="Şehir seç" title="Hangi şehirdeki masalara katılmak istersiniz?" />
          <BtnPrimary label={savingActive ? '…' : 'Kaydet'} disabled={savingActive} onPress={() => { setPendingActive(activeCity || null); setActiveConfirm(true); }} />
        </View>
        {!!activeCity && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontSize: 12, color: ll.label }}>Aktif: <T style={{ fontSize: 12, color: tw.text }}>{cities.find(x => x.id === activeCity)?.name ?? '—'}</T></T>
            <Btn variant="textSmall" disabled={savingActive} label="Temizle" onPress={() => saveActiveCity(null)} />
          </View>
        )}
        {!!activeCity && <T style={{ fontSize: 12, color: ll.label }}>Siz iptal edene kadar bu şehirdeki masalarla eşleşirsiniz.</T>}
        {!!saveError && <T style={{ fontSize: 14, color: tw.accent }}>{saveError}</T>}
      </CardP>

      <CardP title="Şehir Tercihleri" action={!editingCities ? { label: 'Düzenle', onPress: () => setEditingCities(true) } : undefined}>
        {editingCities ? (
          <View style={{ gap: 12 }}>
            <CitySelect label="Ana Şehir *" value={primaryCityId} onChange={setPrimaryCityId} cities={cities} title="Ana şehir seç" />
            {!!saveError && <T style={{ fontSize: 14, color: tw.accent }}>{saveError}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label="İptal" style={{ flex: 1 }} onPress={() => setEditingCities(false)} />
              <BtnPrimary label={saving ? 'Kaydediliyor…' : 'Kaydet'} style={{ flex: 1 }} disabled={saving} onPress={saveCities} />
            </View>
          </View>
        ) : <Row label="Ana Şehir" value={displayPrimary?.name ?? '—'} />}
      </CardP>

      <CardP title="Mekan Tercihi" action={!editingVenue ? { label: 'Düzenle', onPress: () => setEditingVenue(true) } : undefined}>
        {editingVenue ? (
          <View style={{ gap: 12 }}>
            {VENUE_OPTIONS.map(o => {
              const sel = venuePref === o.value;
              return (
                <Btn key={o.value} variant="venuePrefProfile" selected={sel} accessibilityLabel={o.label} onPress={() => setVenuePref(o.value)}>
                  <T w={500} style={{ fontSize: 14, color: sel ? tw.accent : tw.text }}>{o.label}</T>
                  <T style={{ fontSize: 12, color: ll.label, marginTop: 2 }}>{o.description}</T>
                </Btn>
              );
            })}
            {!!saveError && <T style={{ fontSize: 14, color: tw.accent }}>{saveError}</T>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <BtnGhost label="İptal" style={{ flex: 1 }} onPress={() => setEditingVenue(false)} />
              <BtnPrimary label={saving ? 'Kaydediliyor…' : 'Kaydet'} style={{ flex: 1 }} disabled={saving} onPress={saveVenue} />
            </View>
          </View>
        ) : <Row label="Tercih" value={VENUE_LABELS[displayVenue]} />}
      </CardP>

      <CardP title="Sadakat Programı">
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14 }}>
            <T style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, marginRight: 4 }}>+90</T>
            <TextInput keyboardType="number-pad" keyboardAppearance="dark" placeholder="5XX XXX XX XX" placeholderTextColor={tw.muted} value={refPhone} onChangeText={t => setRefPhone(t.replace(/\D/g, '').slice(0, 10))}
              style={{ flex: 1, fontSize: 14, color: tw.text, paddingVertical: 12, fontFamily: sans(400) }} />
          </View>
          <BtnPrimary label={refSending ? '…' : 'Davet Gönder'} full disabled={refSending} onPress={sendReferral} />
        </View>
        {!!refMsg && <T style={{ fontSize: 12, color: refMsg.includes('başarı') ? c.ok : tw.accent }}>{refMsg}</T>}
        <View style={{ flexDirection: 'row', gap: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
          <View><T style={{ fontSize: 12, color: ll.text2 }}>Davetli Arkadaş</T><T w={600} style={{ fontSize: 16 }}>{stats?.totalInvites ?? '—'} kişi</T></View>
          <View><T style={{ fontSize: 12, color: ll.text2 }}>Toplam %10 İndirim Hakkı</T><T w={600} style={{ fontSize: 16 }}>{stats?.availableDiscounts ?? '—'} Adet</T></View>
        </View>
      </CardP>

      <CardP title="Salla-Bildir">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <T style={{ flex: 1, fontSize: 13, color: ll.text2 }}>Telefonu salladığında Sorun Bildir penceresi açılır, ekran görüntüsü otomatik eklenir.</T>
          <Switch value={shake} onChange={(v) => { setShake(v); setShakeEnabled(v); }} accessibilityLabel="Salla-Bildir" />
        </View>
      </CardP>

      <View style={{ alignItems: 'center', gap: 12, paddingBottom: 8 }}>
        <BtnGhost label="Sorun Bildir" style={accountBtn.box} textStyle={accountBtn.text} onPress={() => setReportOpen(true)} />
        <BtnGhost label={logoutAllBusy ? 'Çıkış yapılıyor…' : 'Tüm cihazlardan çıkış yap'} style={accountBtn.box} textStyle={accountBtn.text} disabled={logoutAllBusy} onPress={logoutAll} />
        {deletePending
          ? <T style={{ fontSize: 12, color: ll.label, textAlign: 'center' }}>Hesap silme talebin alındı, en geç 48 saat içinde sonuçlanır.</T>
          : <BtnGhost label="Hesabımı Sil" redDot style={accountBtn.box} textStyle={accountBtn.text} onPress={() => { setDeleteError(''); setDeleteOpen(true); }} />}
        <BtnGhost label="Çıkış Yap" full onPress={logout} />
      </View>

      <ProblemReport open={reportOpen} onClose={() => setReportOpen(false)} screen="Profilim" />

      <ModalBox visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Hesabımı Sil">
        <T style={{ fontSize: 14, color: ll.text2, lineHeight: 22 }}>
          Hesabını silmek üzeresin. Bu işlem geri alınamaz. Talebin onaylandıktan sonra hesabın en geç 48 saat içinde kalıcı olarak silinir. Profilin, kişilik testi sonuçların, kimlik doğrulama bilgilerin ve masa geçmişin sistemden kaldırılır. Kullanılmamış paket hakların iade edilmez ve kullanılamaz hâle gelir. Yasal zorunluluk gereği ödeme ve fatura kayıtların mevzuatta belirtilen süre boyunca saklanır.
        </T>
        {!!deleteError && <T style={{ color: tw.accent, fontSize: 14, marginTop: 12 }}>{deleteError}</T>}
        <View style={{ marginTop: 20, gap: 12 }}>
          <BtnPrimary label={deleteBusy ? 'Gönderiliyor…' : 'Onaylıyorum'} style={{ width: '72%', alignSelf: 'center' }} disabled={deleteBusy} onPress={confirmDelete} />
          <BtnGhost label="Vazgeç" style={{ width: '72%', alignSelf: 'center' }} onPress={() => setDeleteOpen(false)} />
        </View>
      </ModalBox>
    </View>
  );
}
