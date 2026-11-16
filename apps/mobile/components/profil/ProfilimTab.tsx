// apps/web/app/profil/tabs/TabProfilim.tsx karşılığı
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, View } from 'react-native';
import { useReduceMotion } from '@/lib/motion';
import { api } from '@/lib/api';
import { LogoutChoice } from '../LogoutChoice';

const APP_VERSION = '0.1.6';
import { gColor } from '@/lib/masa';
import { useMasaTabs } from '@/lib/useMasaTabs';
import { Btn, BtnGhost, BtnPrimary, BtnTone, Card, Head, Input, ModalBox, Row, Sheet, Switch, T } from '../ui';
import { getShakeEnabled, setShakeEnabled } from '@/lib/shakePref';
import { OtpInput } from '../OtpInput';
import { OtpCountdown, useOtpCountdown } from '../OtpCountdown';
import { KankaSection } from './KankaSection';
import { accountBtn, adminChipPulse, c, inputGlass, ll, llCard, tabBar, tw } from '@/theme/theme';
import Svg, { Path, Rect } from 'react-native-svg';
import { openLegal } from '@/lib/links';
import { useRememberAllowed } from '@/lib/adminLock';
import { useTranslation } from 'react-i18next';
import { ENGLISH_ENABLED, LANGS, occupationLabel, splitE164, toE164, type Lang } from '@ahenk/shared';
import { CountryCodeButton } from '../PhoneCountry';
import { chooseLanguage, currentLang } from '@/lib/i18n';

export interface City { id: string; name: string; isActive?: boolean }
type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE';
export interface UserData {
  id: string; firstName: string; lastName: string; email: string; phone?: string; role?: string; activeCity?: string | null; occupationSector?: string;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null; maintenanceMode?: boolean;
  profile?: { gender?: string; birthDate?: string; primaryCity?: City; venuePreference?: VenuePreference };
  language?: string; nativeLanguage?: string; speaksEnglish?: boolean; speaksTurkish?: boolean;
  kyc?: { status: string }; profilePhotoUrl?: string | null; profilePhotoPending?: boolean; noShowWarning?: { count: number; remaining: number } | null;
}

const VENUE_OPTIONS: { value: VenuePreference; label: string; description: string }[] = [
  { value: 'ALCOHOLIC', label: 'venue.alcoholic', description: 'venue.alcoholicDesc' },
  { value: 'NON_ALCOHOLIC', label: 'venue.nonAlcoholic', description: 'venue.nonAlcoholicDesc' },
  { value: 'NO_PREFERENCE', label: 'venue.both', description: 'venue.bothDesc' },
];
const VENUE_LABELS: Record<VenuePreference, string> = { ALCOHOLIC: 'venue.alcoholic', NON_ALCOHOLIC: 'venue.nonAlcoholic', NO_PREFERENCE: 'venue.both' };
const KYC_BADGE: Record<string, { label: string; approved: boolean }> = {
  PENDING: { label: 'prof.unverified', approved: false }, APPROVED: { label: 'prof.verified', approved: true }, REJECTED: { label: 'prof.unverified', approved: false }, SUSPICIOUS: { label: 'prof.unverified', approved: false },
};
const ORDINAL = ['prof.ordinal1', 'prof.ordinal2', 'prof.ordinal3'];
const CITY_ORDER = ['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Balıkesir', 'Aydın', 'Muğla'];
const cityLabel = (n: string) => (n === 'Balıkesir' ? 'Balıkesir (Ayvalık / Akçay)' : n);
function sortCities(cs: City[]) {
  return [...cs].sort((a, b) => { const ia = CITY_ORDER.indexOf(a.name), ib = CITY_ORDER.indexOf(b.name); if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, 'tr'); if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib; });
}

function SmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return <Btn variant="rowAction" label={label} onPress={onPress} />;
}

// Profilim → yasal bağlantılar kartı (web sayfaları: /gizlilik-politikasi, /kullanim-kosullari, /kvkk, /hesap-silme)
const LEGAL_LINKS = [
  { label: 'footer.privacy', path: '/gizlilik-politikasi' },
  { label: 'footer.terms', path: '/kullanim-kosullari' },
  { label: 'prof.kvkkNotice', path: '/kvkk' },
  { label: 'footer.deleteAccount', path: '/hesap-silme' },
];

function CardP({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <Card>
      <Head title={title} right={action ? <Btn variant="cardAction" label={action.label} onPress={action.onPress} /> : undefined} />
      <View style={{ gap: 12 }}>{children}</View>
    </Card>
  );
}

function CitySelect({ label, value, onChange, cities, optional, placeholder, title }: { label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean; placeholder?: string; title: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // "Yakında" grubu: pasif bölgeler (soluk, seçilemez, sağda "Haber ver" — bölge başına bir kez); web TabProfilim ile aynı
  const active = cities.filter(x => x.isActive !== false);
  const soon = cities.filter(x => x.isActive === false);
  const [notified, setNotified] = useState<string[]>([]);
  useEffect(() => { api.get<string[]>('/users/me/region-waitlist').then((r) => setNotified(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  const notify = (id: string) => { setNotified((p) => (p.includes(id) ? p : [...p, id])); api.post(`/users/me/region-waitlist/${id}`, {}).catch(() => undefined); };
  const [tmp, setTmp] = useState(value);
  const found = cities.find(x => x.id === value);
  const display = found ? cityLabel(found.name) : optional ? (placeholder ?? t('reg.noCity')) : t('reg.pickCityShort');
  return (
    <View style={{ flex: 1 }}>
      {!!label && <T style={{ fontSize: 12, color: ll.text2, marginBottom: 4 }}>{label}</T>}
      <Btn variant="citySelectProfile" selected={!!value} label={display} onPress={() => { setTmp(value); setOpen(true); }} />
      <Sheet visible={open} onClose={() => setOpen(false)} pad={{ top: 20, h: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <T style={{ fontSize: 13, color: c.t888 }}>{title}</T>
          <Btn variant="closeX" label="×" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} />
        </View>
        <ScrollView style={{ maxHeight: 300 }}>
          {optional && (
            <Btn variant="listOption" selected={tmp === ''} label={t('reg.noCity')} textStyle={tmp === '' ? undefined : { color: c.t888 }} onPress={() => setTmp('')} />
          )}
          {sortCities(active).map(x => (
            <Btn key={x.id} variant="listOption" selected={tmp === x.id} label={cityLabel(x.name)} onPress={() => setTmp(x.id)} />
          ))}
          {soon.length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                <T style={{ fontSize: 11, color: '#8f887f' }}>{t('common.comingSoon')}</T>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
              </View>
              {soon.map(x => {
                const done = notified.includes(x.id);
                return (
                  <View key={x.id} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}><T style={{ fontSize: 14, color: c.t888, opacity: 0.6 }}>{x.name}</T><View style={{ paddingVertical: 1, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(143,136,127,0.4)' }}><T style={{ fontSize: 10, color: '#8f887f' }}>{t('common.comingSoon')}</T></View></View>
                    <Pressable disabled={done} onPress={() => notify(x.id)} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                      <T style={{ fontSize: 11, color: done ? '#8f887f' : '#ff6b6b' }}>{done ? t('common.notified') : t('common.notifyMe')}</T>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
        <BtnPrimary label={t('prof.select')} full style={{ marginTop: 16 }} onPress={() => { onChange(tmp); setOpen(false); }} />
      </Sheet>
    </View>
  );
}

// Dil / Language: seçili tarafı kayan segment kontrol (iki eşit parça; kayan zemin tabBar.activeBg + activeBorder, iz inputGlass form
// zemini; seçili yazı tw.accent, diğeri ll.text2). Hareketi Azalt açıkken kayma animasyonsuz
function LangSegment({ value, onChange, labels }: { value: Lang; onChange: (l: Lang) => void; labels: Record<Lang, string> }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(value === 'en' ? 1 : 0)).current;
  useEffect(() => {
    const to = value === 'en' ? 1 : 0;
    if (reduce) { x.setValue(to); return; }
    Animated.timing(x, { toValue: to, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [value, reduce, x]);
  const seg = w > 0 ? (w - 4) / 2 : 0;
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', minWidth: 196, padding: 2, borderRadius: 12, borderWidth: 1, borderColor: inputGlass.formBorder, backgroundColor: inputGlass.formBg }}>
      {seg > 0 && (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 2, bottom: 2, left: 2, width: seg, borderRadius: 10, borderWidth: 1, borderColor: tabBar.activeBorder, backgroundColor: tabBar.activeBg,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, seg] }) }] }} />
      )}
      {LANGS.map((l) => (
        <Pressable key={l} onPress={() => onChange(l)} accessibilityRole="tab" accessibilityState={{ selected: value === l }}
          style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
          <T w={value === l ? 600 : 400} style={{ fontSize: 13, color: value === l ? tw.accent : ll.text2 }}>{labels[l]}</T>
        </Pressable>
      ))}
    </View>
  );
}

function LockIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={ll.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={5} y={11} width={14} height={10} rx={2} /><Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

// Web Navbar "Yönetim Paneli" rozeti: adminChip + navAdminPulse/navAdminDot nabzı (Hareketi Azalt açıkken durağan)
function AdminChip({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(0); return; }
    const half = adminChipPulse.periodMs / 2;
    const ease = Easing.bezier(0.42, 0, 0.58, 1);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: half, easing: ease, useNativeDriver: false }),
      Animated.timing(v, { toValue: 0, duration: half, easing: ease, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  const p = adminChipPulse;
  return (
    <Animated.View style={{ alignSelf: 'flex-start', borderRadius: 8, shadowColor: p.shadowColor, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: v.interpolate({ inputRange: [0, 1], outputRange: [...p.shadowOpacity] }), shadowRadius: v.interpolate({ inputRange: [0, 1], outputRange: [...p.shadowRadius] }) }}>
      <Btn variant="adminChip" accessibilityLabel={t('nav.adminPanel')} onPress={onPress}>
        <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [...p.dotOpacity] }) }} />
        <T w={700} style={{ fontSize: 11, color: '#93c5fd' }}>{t('nav.adminPanel')}</T>
      </Btn>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8, borderWidth: 1, borderColor: p.borderOn, opacity: v }} />
    </Animated.View>
  );
}

export function ProfilimTab({ user, cities, onLoggedOut, onAdmin, onOpenTest, onOpenRehber }: { user: UserData; cities: City[]; onLoggedOut: () => void; onAdmin: () => void; onOpenTest: () => void; onOpenRehber: () => void }) {
  const { t } = useTranslation();
  const [editingVenue, setEditingVenue] = useState(false);
  // Dil bazlı eşleşme (web TabProfilim ile aynı): kayıt dili ana dildir (kilitli, alanı hep true); "Başka konuştuğun diller"
  // satırlarından diğer diller işaretlenir (birden fazla seçilebilir) → speaksEnglish / speaksTurkish
  const nativeLang: Lang = user.nativeLanguage === 'en' ? 'en' : 'tr';
  const [spoken, setSpoken] = useState<Record<Lang, boolean>>({ tr: user.speaksTurkish !== false, en: !!user.speaksEnglish });
  async function toggleSpoken(l: Lang) {
    if (l === nativeLang) return;
    const v = !spoken[l];
    setSpoken((p) => ({ ...p, [l]: v }));
    try { await api.patch('/users/me/spoken-languages', l === 'en' ? { speaksEnglish: v } : { speaksTurkish: v }); } catch (e) { setSaveError((e as Error).message); }
  }
  // Dil / Language: cihazda saklanır ve hesaba kaydedilir
  const lang = currentLang();
  async function pickLanguage(l: Lang) {
    if (l === lang) return;
    await chooseLanguage(l);
    api.patch('/users/me/language', { language: l }).catch(() => undefined);
  }
  // Ana şehir üye tarafından değiştirilemez; yalnız admin panelinden düzeltilir
  const displayPrimary: City | null = user.profile?.primaryCity ?? null;
  const [venuePref, setVenuePref] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [displayVenue, setDisplayVenue] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [activeCity, setActiveCity] = useState(user.activeCity ?? '');
  const [activeConfirm, setActiveConfirm] = useState(false);
  // "Dikkat" penceresinde Kabul Ediyorum'a basılınca yapılacak kayıt
  const confirmAction = useRef<(() => void) | null>(null);
  const askConfirm = (fn: () => void) => { confirmAction.current = fn; setActiveConfirm(true); };
  // Aktif masa (Masa Kuruldu / Masa Oluşturuluyor) veya eşleşme süreci (Taramada / sonraki döngü bekleniyor) var mı
  const { statuses } = useMasaTabs();
  const inMatching = Object.values(statuses).some(st => st === 'TABLE' || st === 'FORMING' || st === 'SCANNING' || st === 'PENDING');
  const [savingActive, setSavingActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [phoneMode, setPhoneMode] = useState<'idle' | 'enter' | 'otp'>('idle');
  const [newPhone, setNewPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [currentPhone, setCurrentPhone] = useState(user.phone ?? '');
  // Ülke kodu: varsayılan kayıtlı telefonun ülkesi; gönderim E.164 (libphonenumber-js)
  const [phoneCountry, setPhoneCountry] = useState(() => splitE164(user.phone).country);
  const newPhoneE164 = toE164(phoneCountry, newPhone);
  const [emailMode, setEmailMode] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [currentEmail, setCurrentEmail] = useState(user.email);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletePending, setDeletePending] = useState(false);
  const [shake, setShake] = useState(true);

  useEffect(() => { getShakeEnabled().then(setShake); }, []);
  useEffect(() => {
    api.get<{ request: { id: string } | null }>('/users/me/deletion-request').then(r => setDeletePending(!!r?.request?.id)).catch(() => {});
  }, []);

  const badge = KYC_BADGE[user.kyc?.status ?? 'PENDING'] ?? KYC_BADGE.PENDING;

  async function logoutAll() {
    setLogoutAllBusy(true);
    try { await api.post('/auth/logout-all', {}); await api.logout(); onLoggedOut(); } catch (e) { setSaveError((e as Error).message); setLogoutAllBusy(false); }
  }
  // Çıkış: "Bu cihazda beni hatırla" (oturum kapanır, cihaz hatırlanır; açılışta Tekrar hoş geldin + Face ID / parmak izi)
  // ya da "Bu cihazda beni unut" (oturum kapanır, hatırlama bilgisi silinir)
  const [logoutOpen, setLogoutOpen] = useState(false);
  // ADMIN / SUPERADMIN: biyometrik ya da ekran kilidi olmayan cihazda "Bu cihazda beni hatırla" yok
  const rememberAllowed = useRememberAllowed(user.role);
  async function confirmDelete() {
    setDeleteBusy(true); setDeleteError('');
    try { await api.post('/users/me/deletion-request', {}); setDeletePending(true); setDeleteOpen(false); } catch (e) { setDeleteError((e as Error).message); } finally { setDeleteBusy(false); }
  }
  // Yeni kod isteme bekleme süresi backend'den gelir (ortak sayaç)
  const phoneCountdown = useOtpCountdown();
  async function sendPhoneOtp() {
    if (!newPhoneE164) { setPhoneError(t('phone.invalid')); return; }
    setPhoneSaving(true); setPhoneError('');
    try { const r = await api.post<{ resendSeconds?: number }>('/users/change-phone/request', { phone: newPhoneE164 }); setPhoneMode('otp'); setOtp(''); phoneCountdown.start(r?.resendSeconds); }
    // Bekleme süresi dolmadan istendi: sayaç sunucunun döndüğü kalan saniyeden başlar
    catch (e) { if (phoneCountdown.startFromError(e)) setPhoneMode('otp'); setPhoneError((e as Error).message); } finally { setPhoneSaving(false); }
  }
  async function verifyPhone(code = otp) {
    if (code.length !== 6) return;
    setPhoneSaving(true); setPhoneError('');
    try { await api.post('/users/change-phone/verify', { phone: newPhoneE164, code }); setCurrentPhone(newPhoneE164 ?? ''); setPhoneMode('idle'); setNewPhone(''); setOtp(''); }
    catch (e) { setPhoneError((e as Error).message); } finally { setPhoneSaving(false); }
  }
  async function saveEmail() {
    if (!newEmail.includes('@') || !newEmail.includes('.')) { setEmailError(t('reg.validEmail')); return; }
    if (!emailPw) { setEmailError(t('prof.enterCurrentPw')); return; }
    setEmailSaving(true); setEmailError('');
    try { await api.patch('/users/change-email', { email: newEmail, currentPassword: emailPw }); setCurrentEmail(newEmail); setEmailMode(false); setNewEmail(''); setEmailPw(''); }
    catch (e) { setEmailError((e as Error).message); } finally { setEmailSaving(false); }
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
      {/* Profil fotoğrafının hemen altında: Kişilik Ağacım ekranını açan küçük kart */}
      <Pressable onPress={onOpenTest} accessibilityRole="button" accessibilityLabel={t('prof.tree')}
        style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: llCard.padding, borderRadius: llCard.radius, borderWidth: llCard.borderWidth, borderColor: llCard.borderColor, backgroundColor: llCard.bg, opacity: pressed ? 0.7 : 1 })}>
        <T w={600} style={{ fontSize: 14, color: ll.text }}>{t('prof.tree')}</T>
        <T style={{ fontSize: 18, color: ll.label }}>›</T>
      </Pressable>
      <CardP title={t('prof.accountInfo')}>
        {/* Yönetim Paneli butonu: Hesap Bilgileri başlığının hemen altında */}
        {(user.role === 'ADMIN' || user.role === 'SUPERADMIN') && (
          <AdminChip onPress={onAdmin} />
        )}
        {user.noShowWarning && (
          <T w={500} style={{ fontSize: 14, lineHeight: 22.75, color: c.warnYellow }}>
            {t('prof.noShow', { ordinal: ORDINAL[user.noShowWarning.count - 1] ? t(ORDINAL[user.noShowWarning.count - 1]) : `${user.noShowWarning.count}.`, remaining: user.noShowWarning.remaining })}
          </T>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T style={{ fontSize: 13, color: ll.text2 }}>{t('prof.identity')}</T>
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: badge.approved ? c.ok2 : c.red, backgroundColor: badge.approved ? 'rgba(34,197,94,0.08)' : 'rgba(192,57,43,0.08)' }}>
            <T style={{ fontSize: 12, color: badge.approved ? c.ok : tw.accent }}>{t(badge.label)}</T>
          </View>
        </View>
        <Row label={t('prof.fullName')} value={`${user.firstName} ${user.lastName}`} />
        {emailMode ? (
          <View style={{ gap: 8, paddingTop: 4 }}>
            <T style={{ fontSize: 12, color: ll.label }}>{t('prof.newEmail')}</T>
            <Input keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" value={newEmail} onChangeText={v => { setNewEmail(v); setEmailError(''); }} placeholder={t('prof.emailPh')} />
            <Input secureTextEntry textContentType="password" value={emailPw} onChangeText={v => { setEmailPw(v); setEmailError(''); }} placeholder={t('prof.currentPw')} />
            {!!emailError && <T style={{ color: tw.accent, fontSize: 12 }}>{emailError}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label={t('prof.cancel')} style={{ flex: 1 }} onPress={() => { setEmailMode(false); setEmailError(''); }} />
              <BtnPrimary label={emailSaving ? '…' : t('prof.save')} style={{ flex: 1 }} disabled={emailSaving} onPress={saveEmail} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <T style={{ fontSize: 13, color: ll.text2 }}>{t('reg.email')}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <T numberOfLines={1} style={{ fontSize: 13, color: ll.text, flexShrink: 1 }}>{currentEmail}</T>
              <SmallBtn label={t('prof.change')} onPress={() => setEmailMode(true)} />
            </View>
          </View>
        )}
        {phoneMode === 'idle' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontSize: 13, color: ll.text2 }}>{t('prof.phone')}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T style={{ fontSize: 13, color: ll.text }}>{currentPhone || '—'}</T>
              <SmallBtn label={currentPhone ? t('prof.change') : t('prof.add')} onPress={() => setPhoneMode('enter')} />
            </View>
          </View>
        )}
        {phoneMode === 'enter' && (
          <View style={{ gap: 8, paddingTop: 4 }}>
            <T style={{ fontSize: 12, color: ll.label }}>{currentPhone ? t('prof.newPhone') : t('prof.addPhone')}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <CountryCodeButton country={phoneCountry} onChange={(c) => { setPhoneCountry(c); setPhoneError(''); }} />
              <Input style={{ flex: 1 }} keyboardType="number-pad" textContentType="telephoneNumber" value={newPhone} onChangeText={v => { setNewPhone(v.replace(/\D/g, '').slice(0, 15)); setPhoneError(''); }} placeholder={phoneCountry === 'TR' ? '5XX XXX XX XX' : ''} />
            </View>
            {!!phoneError && <T style={{ color: tw.accent, fontSize: 12 }}>{phoneError}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label={t('prof.cancel')} style={{ flex: 1 }} onPress={() => { setPhoneMode('idle'); setPhoneError(''); setNewPhone(''); }} />
              <BtnPrimary label={phoneSaving ? '…' : t('prof.sendCode')} style={{ flex: 1 }} disabled={phoneSaving} onPress={sendPhoneOtp} />
            </View>
          </View>
        )}
        {phoneMode === 'otp' && (
          <View style={{ gap: 8, paddingTop: 4 }}>
            <T style={{ fontSize: 12, color: ll.label }}>{t('prof.codeSent', { phone: newPhoneE164 ?? '' })}</T>
            <OtpInput value={otp} onChange={setOtp} onComplete={verifyPhone} />
            <OtpCountdown seconds={phoneCountdown.seconds} fontSize={12} />
            {!!phoneError && <T style={{ color: tw.accent, fontSize: 12, textAlign: 'center' }}>{phoneError}</T>}
            <Btn variant="textLink" disabled={phoneCountdown.waiting || phoneSaving} onPress={sendPhoneOtp} label={t('prof.resend')} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label={t('prof.back')} style={{ flex: 1 }} onPress={() => { setPhoneMode('enter'); setPhoneError(''); setOtp(''); phoneCountdown.start(0); }} />
              <BtnPrimary label={phoneSaving ? '…' : t('prof.verify')} style={{ flex: 1 }} disabled={phoneSaving || otp.length !== 6} onPress={() => verifyPhone()} />
            </View>
          </View>
        )}
        {!!user.occupationSector && <Row label={t('prof.occupation')} value={occupationLabel(user.occupationSector, t)} />}
        {age !== null && <Row label={t('prof.age')} value={`${age}`} />}
        {!!user.profile?.gender && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T style={{ fontSize: 13, color: ll.text2 }}>{t('prof.gender')}</T>
            <View style={{ paddingVertical: 6, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1.5, borderColor: gColor(user.profile.gender), shadowColor: gColor(user.profile.gender), shadowOpacity: 0.33, shadowRadius: 6 }}>
              <T style={{ fontSize: 13, color: gColor(user.profile.gender) }}>{user.profile.gender === 'MALE' ? t('reg.male') : t('reg.female')}</T>
            </View>
          </View>
        )}
        {/* Dil / Language (ENGLISH_ENABLED = false iken gizli): seçili tarafı kayan segment kontrol */}
        {ENGLISH_ENABLED && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <T style={{ fontSize: 13, color: ll.text2 }}>{t('common.language')}</T>
            <LangSegment value={lang} onChange={pickLanguage} labels={{ tr: t('common.turkish'), en: t('common.english') }} />
          </View>
        )}
        {/* Ana dil (kayıt dili): kilitli, değiştirilemez */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }} accessible accessibilityLabel={`${t('prof.nativeLanguage')}: ${nativeLang === 'tr' ? t('common.turkish') : t('common.english')}`}>
          <T style={{ fontSize: 13, color: ll.text2 }}>{t('prof.nativeLanguage')}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LockIcon />
            <T style={{ fontSize: 13, color: ll.text }}>{nativeLang === 'tr' ? t('common.turkish') : t('common.english')}</T>
          </View>
        </View>
        {/* Başka konuştuğun diller: seçilebilir satırlar, birden fazla dil işaretlenebilir */}
        <View style={{ gap: 4 }}>
          <T style={{ fontSize: 12, color: ll.label }}>{t('prof.otherLanguages')}</T>
          {LANGS.filter((l) => l !== nativeLang).map((l) => (
            <Pressable key={l} onPress={() => toggleSpoken(l)} accessibilityRole="checkbox" accessibilityState={{ checked: spoken[l] }}
              style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 8, backgroundColor: spoken[l] ? tabBar.activeBg : 'transparent', opacity: pressed ? 0.7 : 1 })}>
              <T style={{ fontSize: 14, color: spoken[l] ? ll.text : ll.text2 }}>{l === 'tr' ? t('common.turkish') : t('common.english')}</T>
              {spoken[l] && <T style={{ fontSize: 14, color: ll.red }}>✓</T>}
            </Pressable>
          ))}
        </View>
        <KankaSection />
      </CardP>

      <Sheet visible={activeConfirm} onClose={() => setActiveConfirm(false)}>
        <T w={700} style={{ fontSize: 16, marginBottom: 10 }}>{t('prof.attention')}</T>
        <T style={{ fontSize: 13, color: c.t888, lineHeight: 20.8, marginBottom: 20 }}>
          {t('prof.cityWarnPre')} <T style={{ fontSize: 13, color: tw.text }}>{displayPrimary?.name ?? t('prof.yourMainCity')}</T> {t('prof.cityWarnPost')}
        </T>
        <View style={{ gap: 8 }}>
          <BtnPrimary label="Kabul Ediyorum" full onPress={() => { setActiveConfirm(false); confirmAction.current?.(); confirmAction.current = null; }} />
          <BtnGhost label="Kabul Etmiyorum" full onPress={() => setActiveConfirm(false)} />
        </View>
      </Sheet>

      <CardP title={t('prof.activeCityTitle')}>
        <T style={{ fontSize: 12, color: ll.label, marginBottom: 12 }}>{t('prof.activeCityInfo')}</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CitySelect label="" value={activeCity} onChange={setActiveCity} cities={cities} optional placeholder={t('reg.pickCityShort')} title={t('prof.activeCityQuestion')} />
          <BtnPrimary label={savingActive ? '…' : t('prof.save')} disabled={savingActive} style={[{ alignSelf: 'stretch' }, savingActive && { opacity: 0.5 }]} onPress={() => { const v = activeCity || null; askConfirm(() => saveActiveCity(v)); }} />
        </View>
        {!!activeCity && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <T style={{ fontSize: 12, color: ll.label }}>{t('prof.activeLabel')} <T style={{ fontSize: 12, color: tw.text }}>{cities.find(x => x.id === activeCity)?.name ?? '—'}</T></T>
            <Btn variant="cardAction" disabled={savingActive} label={t('prof.clear')} onPress={() => (inMatching ? askConfirm(() => saveActiveCity(null)) : saveActiveCity(null))} />
          </View>
        )}
        {!!activeCity && <T style={{ fontSize: 12, color: ll.label, marginTop: 6 }}>{t('prof.untilCancel')}</T>}
        {!!saveError && <T style={{ fontSize: 14, color: tw.accent, marginTop: 4 }}>{saveError}</T>}
      </CardP>

      {/* Şehir: ana şehir yalnız gösterilir (düzenleme yok) */}
      <CardP title={t('prof.city')}>
        <Row label={t('prof.mainCity')} value={displayPrimary?.name ?? '—'} />
      </CardP>

      <CardP title={t('prof.venueTitle')} action={!editingVenue ? { label: t('prof.edit'), onPress: () => setEditingVenue(true) } : undefined}>
        {editingVenue ? (
          <View style={{ gap: 12 }}>
            {VENUE_OPTIONS.map(o => {
              const sel = venuePref === o.value;
              return (
                <Btn key={o.value} variant="venuePrefProfile" selected={sel} accessibilityLabel={t(o.label)} onPress={() => setVenuePref(o.value)}>
                  <T w={500} style={{ fontSize: 14, color: sel ? tw.accent : tw.text }}>{t(o.label)}</T>
                  <T style={{ fontSize: 12, color: ll.label, marginTop: 2 }}>{t(o.description)}</T>
                </Btn>
              );
            })}
            {!!saveError && <T style={{ fontSize: 14, color: tw.accent }}>{saveError}</T>}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <BtnGhost label={t('prof.cancel')} style={{ flex: 1 }} onPress={() => setEditingVenue(false)} />
              <BtnPrimary label={saving ? t('prof.saving') : t('prof.save')} style={{ flex: 1 }} disabled={saving} onPress={saveVenue} />
            </View>
          </View>
        ) : <Row label={t('prof.preference')} value={t(VENUE_LABELS[displayVenue])} />}
      </CardP>

      <CardP title={t('prof.shakeTitle')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <T style={{ flex: 1, fontSize: 13, color: ll.text2 }}>{t('prof.shakeInfo')}</T>
          <Switch value={shake} onChange={(v) => { setShake(v); setShakeEnabled(v); }} accessibilityLabel={t('prof.shakeTitle')} />
        </View>
      </CardP>

      {/* Yasal kartın hemen üstünde: Gizlilik ve Güvenlik (Numara Engelleme) */}
      <Card style={{ paddingVertical: 4 }}>
        <Head title={t('prof.privacySecurity')} style={{ marginTop: 12, marginBottom: 4 }} />
        <Pressable onPress={onOpenRehber} accessibilityRole="button" accessibilityLabel={t('prof.blocking')}
          style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: pressed ? 0.6 : 1 })}>
          <T style={{ fontSize: 14, color: ll.text }}>{t('prof.blocking')}</T>
          <T style={{ fontSize: 18, color: ll.label }}>›</T>
        </Pressable>
      </Card>

      <View style={{ alignItems: 'center', gap: 12, paddingBottom: 8 }}>
        {/* Yasal bağlantılar: web sitesindeki sayfalar uygulama içi tarayıcıda açılır. Satırlar en az 44 pt (HIG dokunma alanı) */}
        <Card style={{ alignSelf: 'stretch', paddingVertical: 4 }}>
          {LEGAL_LINKS.map((l, i) => (
            <Pressable key={l.path} onPress={() => { openLegal(l.path).catch(() => {}); }} accessibilityRole="link" accessibilityLabel={t(l.label)}
              style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.05)', opacity: pressed ? 0.6 : 1 })}>
              <T style={{ fontSize: 14, color: ll.text }}>{t(l.label)}</T>
              <T style={{ fontSize: 18, color: ll.label }}>›</T>
            </Pressable>
          ))}
        </Card>
        <BtnGhost label={t('nav.logout')} style={accountBtn.box} textStyle={accountBtn.text} onPress={() => setLogoutOpen(true)} />
        <BtnGhost label={logoutAllBusy ? t('prof.loggingOut') : t('prof.logoutAll')} style={accountBtn.box} textStyle={accountBtn.text} disabled={logoutAllBusy} onPress={logoutAll} />
        {/* Çıkış ile Hesabımı Sil arasında küçük uygulama logosu ve sürüm */}
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 4 }}>
          <Image source={require('@/assets/app-icon-small.webp')} style={{ width: 40, height: 40, borderRadius: 10 }} accessibilityLabel="Ahenk" />
          <T style={{ fontSize: 12, color: ll.label }}>{t('prof.version', { version: APP_VERSION })}</T>
        </View>
        {/* En alttaki öğe: Hesabımı Sil (ikonsuz, uygulamanın tehlike rengi #e74c3c — Kankalıktan Çıkar / iade butonlarıyla aynı) */}
        {deletePending
          ? <T style={{ fontSize: 12, color: ll.label, textAlign: 'center' }}>{t('prof.deletePending')}</T>
          : <BtnGhost label={t('prof.deleteMine')} redDot style={accountBtn.box} textStyle={[accountBtn.text, { color: tw.primaryHover }]} onPress={() => { setDeleteError(''); setDeleteOpen(true); }} />}
      </View>

      <LogoutChoice visible={logoutOpen} onClose={() => setLogoutOpen(false)} firstName={user.firstName} onLoggedOut={onLoggedOut} remember={rememberAllowed} />

      <ModalBox visible={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('prof.deleteMine')} opaque>
        <T style={{ fontSize: 14, color: ll.text2, lineHeight: 22.75 }}>
          {t('prof.deleteBody')}
        </T>
        {!!deleteError && <T style={{ color: tw.accent, fontSize: 14, marginTop: 12 }}>{deleteError}</T>}
        <View style={{ marginTop: 20, gap: 12 }}>
          <BtnTone tone="danger" label={deleteBusy ? t('del.sending') : t('prof.deleteConfirm')} style={{ width: '72%', alignSelf: 'center' }} disabled={deleteBusy} onPress={confirmDelete} />
          <BtnTone tone="safe" label={t('prof.keep')} style={{ width: '72%', alignSelf: 'center' }} onPress={() => setDeleteOpen(false)} />
        </View>
      </ModalBox>
    </View>
  );
}
