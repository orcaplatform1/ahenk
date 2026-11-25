// apps/web/app/kayit/page.tsx karşılığı: 6 adım (Temel Bilgiler + WhatsApp OTP → Dil → Şehir → OCEAN Testi → Mekan Tercihi → Numara Engelleme)
// S-14: push bildirim izni kayıt tamamlanınca istenir (token alma Firebase dosyaları gelene kadar raporlandı)
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { ensurePermission, PERM_REASON } from '@/lib/permissions';
import Svg, { Path } from 'react-native-svg';
import { API_PREFIX } from '@/lib/config';
import { api, langHeaders, storeLogin } from '@/lib/api';
import { gColor } from '@/lib/masa';
import { PasswordInput } from '@/components/AuthShell';
import { BackArrow, PillButton } from '@/components/AuthFlow';
import { WelcomeOverlay } from '@/components/WelcomeOverlay';
import { useKeyboardFieldScroll } from '@/lib/useKeyboardFieldScroll';
import { OtpInput } from '@/components/OtpInput';
import { DateField, FieldLabel, ListPicker } from '@/components/Pickers';
import { TestFlow, type Question } from '@/components/TestFlow';
import { ContactPicker } from '@/components/profil/RehberTab';
import { Btn, StdButton, ErrorText, Eyebrow, Input, Spinner, T, Glow, ScreenGlow } from '@/components/ui';
import { OtpCountdown, OtpNoticeAction, otpNoticeOf, useOtpCountdown, type OtpNoticeCode } from '@/components/OtpCountdown';
import { c, ll, tw, tw4 } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PHONE_COUNTRY, ENGLISH_ENABLED, occupationLabel, toE164, type CitySeasonFields } from '@ahenk/shared';
import { cityLabelWithExtras } from '@/components/SoonCityGroups';
import i18n, { currentLang } from '@/lib/i18n';
import { CountryCodeButton } from '@/components/PhoneCountry';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface City extends CitySeasonFields { id: string; name: string; isActive?: boolean; isComingSoon?: boolean; countryCode?: string }
type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE' | '';
const STEPS = ['reg.stepBasic', 'reg.stepLang', 'reg.stepCity', 'reg.stepTest', 'reg.stepVenue', 'reg.stepBlock'];
const OCCUPATIONS = ['Teknoloji & Yazılım', 'Finans & Bankacılık', 'Sağlık & Tıp', 'Hukuk', 'Eğitim & Akademi', 'Mühendislik', 'Pazarlama & Reklam', 'Medya & İletişim', 'Sanat & Tasarım', 'Girişimcilik & İş Dünyası', 'Kamu & Devlet', 'Turizm & Hizmet', 'Öğrenci', 'Diğer'];
const VENUE_OPTIONS: { value: VenuePreference; label: string; description: string }[] = [
  { value: 'ALCOHOLIC', label: 'venue.alcoholic', description: 'venue.alcoholicDesc' },
  { value: 'NON_ALCOHOLIC', label: 'venue.nonAlcoholic', description: 'venue.nonAlcoholicDesc' },
  { value: 'NO_PREFERENCE', label: 'venue.both', description: 'venue.bothDesc' },
];
// Kayıtta şimdilik yalnız bu 4 şehir seçilebilir; pasif bölgeler (Türkiye dışı) "Yakında" altında
const CITY_ORDER = ['İstanbul', 'Ankara', 'İzmir', 'Antalya'];
const cityLabel = (n: string) => (n === 'Balıkesir' ? 'Balıkesir (Ayvalık / Akçay)' : n);

// Evet / Hayır seçimi (dil soruları; web YesNo ile aynı)
function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <View>
      <T style={{ fontSize: 15, color: '#f5f5f5', marginBottom: 8 }}>{label}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([true, false] as const).map((v) => {
          const on = value === v;
          return (
            <Pressable key={String(v)} onPress={() => onChange(v)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 1.5 : 1, borderColor: on ? 'rgba(192,57,43,0.6)' : 'rgba(255,255,255,0.08)', backgroundColor: on ? 'rgba(192,57,43,0.10)' : 'rgba(255,255,255,0.025)' }}>
              <T style={{ fontSize: 14, color: on ? '#ff6b6b' : '#c9c2b8' }}>{v ? t('common.yes') : t('common.no')}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function Kayit() {
  const { t } = useTranslation();
  const lang = currentLang();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardFieldScroll();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phoneNumber: '', birthDate: '', gender: '' as '' | 'MALE' | 'FEMALE', occupationSector: '', primaryCityId: '', district: '', venuePreference: '' as VenuePreference, contactNumbers: [] as string[], contactInput: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const phoneE164 = toE164(country, f.phoneNumber);
  // Dil soruları: Türkçe arayüzde "Yabancılarla masaya oturmak ister misin?" (speaksEnglish, Profilim ile aynı alan, zorunlu);
  // İngilizce arayüzde yalnız Türkçe sorusu (İngilizce ana dil, speaksEnglish = true)
  const [speaksEnglish, setSpeaksEnglish] = useState<boolean | null>(lang === 'en' ? true : null);
  const [speaksTurkish, setSpeaksTurkish] = useState<boolean | null>(lang === 'en' ? null : true);
  // Davet kodu (isteğe bağlı): davet linkinden ?ref= ile gelirse otomatik dolar
  // Yalnız rakam; eski telefon davet linkindeki harfli kod alanda gösterilmez, kayıtta aynen gönderilir
  const refParam = typeof params.ref === 'string' ? params.ref : '';
  const legacyRef = /^\d+$/.test(refParam) ? '' : refParam;
  const [inviteCode, setInviteCode] = useState(/^\d+$/.test(refParam) ? refParam.slice(0, 9) : '');
  const [pwError, setPwError] = useState('');
  const [pwConfirmError, setPwConfirmError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpShake, setOtpShake] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneToken, setPhoneToken] = useState('');
  // Yeni kod isteme bekleme süresi backend'den gelir (ortak sayaç)
  const countdown = useOtpCountdown();
  // Numara zaten kayıtlıysa uyarının altında "Giriş yap" butonu
  const [notice, setNotice] = useState<OtpNoticeCode | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tCurrent, setTCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [tSubmitting, setTSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    api.get<City[]>('/auth/cities').then((list) => setCities(list.filter((c) => (c.isActive !== false && CITY_ORDER.includes(c.name)) || (c.isActive === false && c.isComingSoon === true)))).catch(() => setError(i18n.t('reg.citiesFailed')));
    api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => setError(i18n.t('reg.districtsFailed')));
  }, []);

  const districtOptions = districts[cities.find(x => x.id === f.primaryCityId)?.name ?? ''] ?? [];
  const soonCities = cities.filter((x) => x.isActive === false);
  const sortedCities = cities.filter((x) => x.isActive !== false).sort((a, b) => { const ia = CITY_ORDER.indexOf(a.name), ib = CITY_ORDER.indexOf(b.name); if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, 'tr'); if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib; });

  function changePhone(v: string) { set('phoneNumber', v); setOtpSent(false); setOtpCode(''); setOtpError(''); setPhoneToken(''); countdown.start(0); }
  async function sendPhoneOtp() {
    if (!phoneE164) { setOtpError(t('phone.invalid')); return; }
    setOtpSending(true); setOtpError(''); setNotice(null);
    try { const r = await api.post<{ resendSeconds: number }>('/auth/register/send-otp', { phone: phoneE164, language: lang }); setOtpSent(true); countdown.start(r?.resendSeconds); }
    // Bekleme süresi dolmadan istendi: sayaç sunucunun döndüğü kalan saniyeden başlar
    catch (e) { if (countdown.startFromError(e)) setOtpSent(true); setNotice(otpNoticeOf(e)); setOtpError((e as Error).message); } finally { setOtpSending(false); }
  }
  async function verifyPhoneOtp(code: string) {
    setOtpVerifying(true); setOtpError('');
    try { const r = await api.post<{ phoneToken: string }>('/auth/register/verify-otp', { phone: phoneE164, code }); setPhoneToken(r.phoneToken); }
    catch (e) { setOtpError((e as Error).message); setOtpShake(true); setTimeout(() => setOtpShake(false), 500); setOtpCode(''); }
    finally { setOtpVerifying(false); }
  }

  function step1() {
    setPwError(''); setPwConfirmError('');
    if (!f.firstName || !f.lastName || !f.email || !f.password) { setError(t('reg.fillAll')); return; }
    if (!f.email.includes('@')) { setError(t('reg.validEmail')); return; }
    if (f.password.length < 6 || f.password.length > 20) { setPwError(t('reg.pwLength')); return; }
    if (f.password !== f.confirmPassword) { setPwConfirmError(t('reg.pwMismatch')); return; }
    if (!phoneE164) { setError(t('phone.invalid')); return; }
    if (!phoneToken) { setError(t('reg.verifyPhone')); return; }
    if (!f.birthDate) { setError(t('reg.pickBirth')); return; }
    if (!f.gender) { setError(t('reg.pickGender')); return; }
    if (!f.occupationSector) { setError(t('reg.pickOccupation')); return; }
    setError(''); setStep(1);
  }
  function langStep() {
    if (speaksEnglish === null || speaksTurkish === null) { setError(t('reg.answerBoth')); return; }
    setError(''); setStep(2);
  }
  async function step2() {
    if (!f.primaryCityId) { setError(t('reg.pickCity')); return; }
    if (districtOptions.length > 0 && !f.district) { setError(t('reg.pickDistrict')); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_PREFIX}/auth/register`, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', ...langHeaders() },
        body: JSON.stringify({ firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password, phoneNumber: phoneE164, phoneToken, acceptTerms: true, language: lang, speaksEnglish: !!speaksEnglish, speaksTurkish: lang === 'en' ? !!speaksTurkish : true,
          gender: f.gender || undefined, birthDate: f.birthDate || undefined, occupationSector: f.occupationSector, primaryCityId: f.primaryCityId || undefined, district: f.district || undefined, referralCode: inviteCode || legacyRef || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const m = (data as { message?: string | string[] }).message; throw new Error(Array.isArray(m) ? m[0] : m ?? t('common.genericError')); }
      await storeLogin(data as { accessToken?: string; refreshToken?: string });
      const q = await api.get<{ sections: { questions: Question[] }[] }>('/test/questions');
      setQuestions(q.sections.flatMap(s => s.questions)); setTCurrent(0); setAnswers({}); setStep(3);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  async function submitTest() {
    setTSubmitting(true); setError('');
    try { await api.post('/test/submit', { answers: questions.map(q => ({ questionId: q.id, score: answers[q.id] ?? 3 })) }); setStep(4); }
    catch (e) { setError((e as Error).message); } finally { setTSubmitting(false); }
  }
  async function step3() {
    if (!f.venuePreference) { setError(t('reg.pickVenue')); return; }
    setLoading(true); setError('');
    try { await api.patch('/users/venue-preference', { venuePreference: f.venuePreference }); setStep(5); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  function addContact() {
    const d = f.contactInput.replace(/\D/g, '');
    if (d.length !== 10) { setError(t('block.tenDigits')); return; }
    if (f.contactNumbers.length >= 50) { setError(t('block.max50')); return; }
    const n = `+90${d}`;
    if (f.contactNumbers.includes(n)) { setError(t('block.already')); return; }
    setError(''); setF(p => ({ ...p, contactNumbers: [...p.contactNumbers, n], contactInput: '' }));
  }
  async function finish() {
    setLoading(true); setError('');
    try {
      if (f.contactNumbers.length > 0) await api.post('/contact-blocks/sync', { hashedPhones: f.contactNumbers });
      setSuccess(true);
      ensurePermission(() => Notifications.getPermissionsAsync(), () => Notifications.requestPermissionsAsync(), PERM_REASON.notifications).catch(() => {});
      setTimeout(() => router.replace('/(tabs)'), 2000);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  const header = (n: number, title: string, sub?: string) => (
    <View>
      <Eyebrow style={{ marginBottom: 4 }}>{t('reg.stepN', { n })}</Eyebrow>
      {/* Giriş akışındaki ekranlarla aynı: sola hizalı kalın başlık (StepScreen başlık stili) */}
      <T w={700} style={{ fontSize: 26, lineHeight: 32, color: ll.text, marginBottom: 4 }}>{title}</T>
      {!!sub && <T style={{ color: ll.label, fontSize: 13 }}>{sub}</T>}
    </View>
  );
  const field = (label: string, el: React.ReactNode) => <View><FieldLabel>{label}</FieldLabel>{el}</View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }} behavior="padding">
      <ScreenGlow />
      <WelcomeOverlay visible={success} name={`${f.firstName} ${f.lastName}`} />
      {/* Arka plan: M. şifremi unuttum ekranındaki sağ üst kırmızımsı ışıma (Glow) */}
      <Glow />
      {/* Sol üstte geri ok (giriş ekranına döner); logo ve kart yok — giriş akışındaki diğer ekranlarla aynı sade görünüm */}
      <BackArrow onPress={() => router.back()} />
      {/* Dil seçici: sağdan 20 pt, görünen ikon (24×24) güvenli alanın 24 pt altında (top: 44 pt dokunma alanının üst kenarı); adım göstergesi bu sırada sağdan 72 pt'de biter */}
      <LanguageSwitcher top={insets.top + 24 - (44 - 24) / 2} />
      {/* Adım göstergesi geri okunun sağında, aynı satırda (ok: top insets.top + 6, 44 pt yükseklik) */}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 6, left: 62, right: ENGLISH_ENABLED ? 84 : 16, height: 44, flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
        {STEPS.map((_, i) => (
          <React.Fragment key={i}>
            {i < step ? (
              <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><T w={600} style={{ fontSize: 13, color: '#fff' }}>✓</T></LinearGradient>
            ) : (
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: i === step ? 2 : 1, borderColor: i === step ? c.red : 'rgba(255,255,255,0.1)' }}>
                <T w={600} style={{ fontSize: 13, color: i === step ? c.red : ll.time }}>{i + 1}</T>
              </View>
            )}
            {i < STEPS.length - 1 && (i < step ? <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, maxWidth: 40, height: 1 }} /> : <View style={{ flex: 1, maxWidth: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />)}
          </React.Fragment>
        ))}
      </View>
      <ScrollView {...kb} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24, paddingHorizontal: 24, maxWidth: 576, width: '100%', alignSelf: 'center' }}>
        {step === 0 && (
          <View style={{ gap: 20 }}>
            {header(1, t('reg.stepBasic'), t('reg.createAccount'))}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>{field(t('reg.firstName'), <Input form textContentType="givenName" value={f.firstName} onChangeText={v => set('firstName', v)} style={{ fontSize: 13 }} />)}</View>
              <View style={{ flex: 1 }}>{field(t('reg.lastName'), <Input form textContentType="familyName" value={f.lastName} onChangeText={v => set('lastName', v)} style={{ fontSize: 13 }} />)}</View>
            </View>
            {field(t('reg.email'), <Input form keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" value={f.email} onChangeText={v => set('email', v)} style={{ fontSize: 13 }} />)}
            <View>
              <FieldLabel>{t('reg.phoneLabel')}</FieldLabel>
              <T style={{ fontSize: 12, color: ll.label, marginBottom: 8 }}>{t('reg.phoneHint')}</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <CountryCodeButton country={country} disabled={!!phoneToken} onChange={(code) => { setCountry(code); changePhone(f.phoneNumber); }} />
                <Input form editable={!phoneToken} keyboardType="number-pad" textContentType="telephoneNumber" value={f.phoneNumber} onChangeText={v => changePhone(v.replace(/\D/g, '').slice(0, 15))} placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} style={{ flex: 1, minWidth: 0, fontSize: 13, opacity: phoneToken ? 0.6 : 1 }} />
                {!phoneToken && (
                  <Btn variant="otpSend" onPress={sendPhoneOtp} disabled={otpSending || countdown.waiting || !phoneE164} label={otpSending ? t('reg.sending') : otpSent ? t('reg.resend') : t('reg.sendCode')} />
                )}
              </View>
              {phoneToken ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <T style={{ fontSize: 12, color: tw4.green400 }}>{t('reg.phoneVerified')}</T>
                  <Btn variant="textSmall" style={{ minHeight: 0 }} hitSlop={14} onPress={() => changePhone(f.phoneNumber)} label={t('reg.changeNumber')} />
                </View>
              ) : otpSent && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <T style={{ fontSize: 12, color: ll.label, textAlign: 'center' }}>{t('otp.codeSentToM', { phone: phoneE164 ?? f.phoneNumber })}</T>
                  <OtpInput value={otpCode} onChange={v => { setOtpCode(v); setOtpError(''); }} onComplete={verifyPhoneOtp} error={otpShake} />
                  <OtpCountdown seconds={countdown.seconds} fontSize={12} />
                  {otpVerifying && <T style={{ fontSize: 12, color: ll.label, textAlign: 'center' }}>{t('reg.verifying')}</T>}
                </View>
              )}
              {!!otpError && <T style={{ fontSize: 12, color: tw.accent, marginTop: 8 }}>{otpError}</T>}
              {!!otpError && !!notice && <View style={{ marginTop: 8 }}><OtpNoticeAction code={notice} /></View>}
            </View>
            <View><FieldLabel>{t('reg.password')}</FieldLabel><PasswordInput value={f.password} onChangeText={v => { set('password', v); setPwError(''); }} placeholder="" />{!!pwError && <T style={{ fontSize: 12, color: tw.accent, marginTop: 4 }}>{pwError}</T>}</View>
            <View><FieldLabel>{t('reg.passwordRepeat')}</FieldLabel><PasswordInput value={f.confirmPassword} onChangeText={v => { set('confirmPassword', v); setPwConfirmError(''); }} placeholder="" />{!!pwConfirmError && <T style={{ fontSize: 12, color: tw.accent, marginTop: 4 }}>{pwConfirmError}</T>}</View>
            <DateField label={t('reg.birthDate')} value={f.birthDate} onChange={v => set('birthDate', v)} />
            <ListPicker label={t('reg.occupation')} value={f.occupationSector} onChange={v => set('occupationSector', v)} options={OCCUPATIONS.map(o => ({ value: o, label: occupationLabel(o, t) }))} placeholder={t('reg.pickOccupationTitle')} title={t('reg.pickOccupationTitle')} />
            <View>
              <FieldLabel>{t('reg.gender')}</FieldLabel>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['MALE', 'FEMALE'] as const).map(g => {
                  const on = f.gender === g, col = gColor(g);
                  return (
                    <Btn key={g} variant="genderChip" selected={on} onPress={() => set('gender', g)} style={on ? { borderColor: col, shadowColor: col, shadowOpacity: 0.33, shadowRadius: 6 } : undefined} textStyle={on ? { color: col } : undefined} label={g === 'MALE' ? t('reg.male') : t('reg.female')} />
                  );
                })}
              </View>
            </View>
            {field(t('reg.inviteCode'), <Input form keyboardType="number-pad" inputMode="numeric" autoCorrect={false} maxLength={9} value={inviteCode} onChangeText={(v) => setInviteCode(v.replace(/\D/g, ''))} style={{ fontSize: 13 }} />)}
            {!!error && <T style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
            <PillButton label={t('reg.continueBtn')} primary disabled={loading} onPress={step1} />
          </View>
        )}

        {/* Adım 2: dil soruları (tek ekran, Evet / Hayır); yabancılar sorusu yalnız Türkçe, Türkçe sorusu yalnız İngilizce arayüzde */}
        {step === 1 && (
          <View style={{ gap: 20 }}>
            {header(2, t('reg.stepLang'))}
            {lang !== 'en' && (
              <View style={{ gap: 8 }}>
                <YesNo label={t('prof.foreignersQ')} value={speaksEnglish} onChange={(v) => { setSpeaksEnglish(v); setError(''); }} />
                <T style={{ fontSize: 12, color: ll.label, lineHeight: 18 }}>{t('prof.foreignersNote')}</T>
              </View>
            )}
            {lang === 'en' && <YesNo label={t('reg.speaksTurkish')} value={speaksTurkish} onChange={(v) => { setSpeaksTurkish(v); setError(''); }} />}
            {!!error && <T style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
            <View style={{ gap: 12, marginTop: 4 }}>
              <PillButton label={t('common.continue')} primary onPress={langStep} />
              <PillButton label={t('common.back')} onPress={() => { setStep(0); setError(''); }} />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 20 }}>
            {header(3, t('reg.stepCityTitle'), t('reg.cityHint'))}
            <ListPicker label={t('reg.primaryCity')} value={f.primaryCityId} onChange={v => setF(p => ({ ...p, primaryCityId: v, district: '' }))} options={sortedCities.map(x => ({ value: x.id, label: cityLabel(x.name), extra: cityLabelWithExtras('', x) }))} placeholder={t('reg.pickCityShort')} title={t('reg.pickPrimaryCity')}
              soon={soonCities} />
            {districtOptions.length > 0 && <ListPicker key={f.primaryCityId} label={t('reg.district')} value={f.district} onChange={v => set('district', v)} options={districtOptions.map(d => ({ value: d, label: d }))} placeholder={t('reg.pickDistrictPh')} title={t('reg.districtAria')} searchable searchPlaceholder={t('reg.districtSearch')} />}
            <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
              <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>{t('reg.tempCity')}</T>
            </View>
            {!!error && <T style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
            <View style={{ gap: 12, marginTop: 4 }}>
              <PillButton label={loading ? t('reg.saving') : t('reg.continueBtn')} primary disabled={loading} onPress={step2} />
              <PillButton label={t('common.back')} onPress={() => { setStep(1); setError(''); }} />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 16 }}>
            {questions.length === 0 ? <View style={{ paddingVertical: 64, alignItems: 'center' }}><Spinner /></View> : (
              <TestFlow questions={questions} current={tCurrent} answers={answers} submitting={tSubmitting}
                onPick={v => { const q = questions[tCurrent]; if (q) setAnswers(p => ({ ...p, [q.id]: v })); }}
                onPrev={() => setTCurrent(x => Math.max(0, x - 1))}
                onNext={() => { const q = questions[tCurrent]; if (!q || answers[q.id] === undefined) return; if (tCurrent === questions.length - 1) submitTest(); else setTCurrent(x => x + 1); }} />
            )}
            <ErrorText>{error}</ErrorText>
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: 20 }}>
            {header(5, t('reg.venueQuestion'))}
            <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
              <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>{t('reg.venueNote')}</T>
            </View>
            <View style={{ gap: 12 }}>
              {VENUE_OPTIONS.map(o => {
                const sel = f.venuePreference === o.value;
                return (
                  <Btn key={o.value} variant="venuePrefForm" selected={sel} accessibilityLabel={t(o.label)} onPress={() => set('venuePreference', o.value)} style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ flex: 1 }}>
                      <T w={500} style={{ fontSize: 15, marginBottom: 4, color: sel ? tw.accent : tw.text }}>{t(o.label)}</T>
                      <T style={{ fontSize: 13, color: ll.label }}>{t(o.description)}</T>
                    </View>
                    {sel && (
                      <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <Svg width={10} height={10} viewBox="0 0 10 10" fill="none"><Path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                      </LinearGradient>
                    )}
                  </Btn>
                );
              })}
            </View>
            {!!error && <T style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
            <PillButton label={loading ? t('reg.saving') : t('reg.continueBtn')} primary disabled={loading || !f.venuePreference} onPress={step3} />
          </View>
        )}

        {step === 5 && (
          <View style={{ gap: 20 }}>
            {header(6, t('reg.stepBlock'), t('reg.blockHint'))}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}><T style={{ color: ll.label, fontSize: 13 }}>+90</T></View>
              <Input form keyboardType="number-pad" value={f.contactInput} onChangeText={v => set('contactInput', v.replace(/\D/g, '').slice(0, 10))} placeholder="5XX XXX XX XX" onSubmitEditing={addContact} style={{ flex: 1, fontSize: 13 }} />
              <Btn variant="addSquare" onPress={addContact} label={t('reg.add')} />
            </View>
            <StdButton variant="ghost" label={t('block.fromContacts')} full disabled={f.contactNumbers.length >= 50} onPress={() => setPicker(true)} />
            {f.contactNumbers.length > 0 && (
              <View style={{ gap: 8 }}>
                {f.contactNumbers.map(n => (
                  <View key={n} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <T style={{ fontSize: 13, color: ll.label }}>{n}</T>
                    <Btn variant="closeX" hitSlop={14} accessibilityLabel={t('block.remove')} onPress={() => set('contactNumbers', f.contactNumbers.filter(x => x !== n))} label="×" textStyle={{ fontSize: 18, lineHeight: 18, color: ll.label }} />
                  </View>
                ))}
                <T style={{ fontSize: 12, color: ll.label }}>{t('block.added', { count: f.contactNumbers.length })}</T>
              </View>
            )}
            {!!error && <T style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
            <View style={{ marginTop: 4 }}><PillButton label={loading ? t('reg.saving') : t('reg.finish')} primary disabled={loading} onPress={finish} /></View>
            <ContactPicker visible={picker} onClose={() => setPicker(false)} existing={f.contactNumbers} remaining={50 - f.contactNumbers.length} country={country}
              onPick={(ps) => setF(p => ({ ...p, contactNumbers: [...p.contactNumbers, ...ps.filter(x => !p.contactNumbers.includes(x))].slice(0, 50) }))} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
