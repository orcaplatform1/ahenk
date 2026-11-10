// apps/web/app/kayit/page.tsx karşılığı: 5 adım (Temel Bilgiler + WhatsApp OTP → Şehir → OCEAN Testi → Mekan Tercihi → Numara Engelleme)
// S-14: push bildirim izni kayıt tamamlanınca istenir (token alma Firebase dosyaları gelene kadar raporlandı)
import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import Svg, { Path } from 'react-native-svg';
import { API_PREFIX } from '@/lib/config';
import { api, storeLogin } from '@/lib/api';
import { gColor } from '@/lib/masa';
import { PasswordInput } from '@/components/AuthShell';
import { WelcomeOverlay } from '@/components/WelcomeOverlay';
import { useKeyboardFieldScroll } from '@/lib/useKeyboardFieldScroll';
import { OtpInput } from '@/components/OtpInput';
import { DateField, FieldLabel, ListPicker } from '@/components/Pickers';
import { TestFlow, type Question } from '@/components/TestFlow';
import { ContactPicker, normalizeTrPhone } from '@/components/profil/RehberTab';
import { Btn, BtnGhost, BtnPrimary, Card, ErrorText, Eyebrow, Input, Serif, Spinner, T, Title, Glow, ScreenGlow } from '@/components/ui';
import { c, ll, tw, tw4 } from '@/theme/theme';

interface City { id: string; name: string }
type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE' | '';
const STEPS = ['Temel Bilgiler', 'Şehir Seçimi', 'OCEAN (Big Five) Testi', 'Mekan Tercihi', 'Numara Engelleme'];
const OCCUPATIONS = ['Teknoloji & Yazılım', 'Finans & Bankacılık', 'Sağlık & Tıp', 'Hukuk', 'Eğitim & Akademi', 'Mühendislik', 'Pazarlama & Reklam', 'Medya & İletişim', 'Sanat & Tasarım', 'Girişimcilik & İş Dünyası', 'Kamu & Devlet', 'Turizm & Hizmet', 'Öğrenci', 'Diğer'];
const VENUE_OPTIONS: { value: VenuePreference; label: string; description: string }[] = [
  { value: 'ALCOHOLIC', label: 'Alkollü Mekan', description: 'Alkollü içecek servisi olan restoran veya bar' },
  { value: 'NON_ALCOHOLIC', label: 'Alkolsüz Mekan', description: 'Kafe veya alkolsüz restoran' },
  { value: 'NO_PREFERENCE', label: 'Her ikisi de uygun', description: 'Her iki mekan türü de uygundur' },
];
// Kayıtta şimdilik yalnız bu 4 şehir seçilebilir
const CITY_ORDER = ['İstanbul', 'Ankara', 'İzmir', 'Antalya'];
const cityLabel = (n: string) => (n === 'Balıkesir' ? 'Balıkesir (Ayvalık / Akçay)' : n);

export default function Kayit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardFieldScroll();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phoneNumber: '', birthDate: '', gender: '' as '' | 'MALE' | 'FEMALE', occupationSector: '', primaryCityId: '', district: '', venuePreference: '' as VenuePreference, contactNumbers: [] as string[], contactInput: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }));
  const [pwError, setPwError] = useState('');
  const [pwConfirmError, setPwConfirmError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpShake, setOtpShake] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneToken, setPhoneToken] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tCurrent, setTCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [tSubmitting, setTSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [picker, setPicker] = useState(false);

  useEffect(() => { if (resendIn <= 0) return; const t = setTimeout(() => setResendIn(n => n - 1), 1000); return () => clearTimeout(t); }, [resendIn]);
  useEffect(() => {
    api.get<City[]>('/auth/cities').then((list) => setCities(list.filter((c) => CITY_ORDER.includes(c.name)))).catch(() => setError('Şehir listesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.'));
    api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => setError('İlçe listesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.'));
  }, []);

  const districtOptions = districts[cities.find(x => x.id === f.primaryCityId)?.name ?? ''] ?? [];
  const sortedCities = [...cities].sort((a, b) => { const ia = CITY_ORDER.indexOf(a.name), ib = CITY_ORDER.indexOf(b.name); if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, 'tr'); if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib; });

  function changePhone(v: string) { set('phoneNumber', v); setOtpSent(false); setOtpCode(''); setOtpError(''); setPhoneToken(''); }
  async function sendPhoneOtp() {
    const d = f.phoneNumber;
    if (d.length !== 10 || !d.startsWith('5')) { setOtpError('WhatsApp numaranızı girin (5 ile başlayan 10 hane).'); return; }
    setOtpSending(true); setOtpError('');
    try { const r = await api.post<{ resendSeconds: number }>('/auth/register/send-otp', { phone: `+90${d}` }); setOtpSent(true); setResendIn(r?.resendSeconds ?? 60); }
    catch (e) { setOtpError((e as Error).message); } finally { setOtpSending(false); }
  }
  async function verifyPhoneOtp(code: string) {
    setOtpVerifying(true); setOtpError('');
    try { const r = await api.post<{ phoneToken: string }>('/auth/register/verify-otp', { phone: `+90${f.phoneNumber}`, code }); setPhoneToken(r.phoneToken); }
    catch (e) { setOtpError((e as Error).message); setOtpShake(true); setTimeout(() => setOtpShake(false), 500); setOtpCode(''); }
    finally { setOtpVerifying(false); }
  }

  function step1() {
    setPwError(''); setPwConfirmError('');
    if (!f.firstName || !f.lastName || !f.email || !f.password) { setError('Tüm alanları doldurun.'); return; }
    if (!f.email.includes('@')) { setError('Geçerli bir e-posta girin.'); return; }
    if (f.password.length < 6 || f.password.length > 20) { setPwError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (f.password !== f.confirmPassword) { setPwConfirmError('Şifreler eşleşmiyor.'); return; }
    if (f.phoneNumber.length !== 10 || !f.phoneNumber.startsWith('5')) { setError('WhatsApp numaranızı girin (5 ile başlayan 10 hane).'); return; }
    if (!phoneToken) { setError('Telefon numaranı WhatsApp koduyla doğrula.'); return; }
    if (!f.birthDate) { setError('Doğum tarihinizi seçin.'); return; }
    if (!f.gender) { setError('Cinsiyet seçin.'); return; }
    if (!f.occupationSector) { setError('Meslek alanı seçin.'); return; }
    setError(''); setStep(1);
  }
  async function step2() {
    if (!f.primaryCityId) { setError('Ana şehir seçin.'); return; }
    if (districtOptions.length > 0 && !f.district) { setError('İlçe seçin.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_PREFIX}/auth/register`, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password, phoneNumber: `+90${f.phoneNumber}`, phoneToken, acceptTerms: true,
          gender: f.gender || undefined, birthDate: f.birthDate || undefined, occupationSector: f.occupationSector, primaryCityId: f.primaryCityId || undefined, district: f.district || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const m = (data as { message?: string | string[] }).message; throw new Error(Array.isArray(m) ? m[0] : m ?? 'Bir hata oluştu'); }
      await storeLogin(data as { accessToken?: string; refreshToken?: string });
      const q = await api.get<{ sections: { questions: Question[] }[] }>('/test/questions');
      setQuestions(q.sections.flatMap(s => s.questions)); setTCurrent(0); setAnswers({}); setStep(2);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  async function submitTest() {
    setTSubmitting(true); setError('');
    try { await api.post('/test/submit', { answers: questions.map(q => ({ questionId: q.id, score: answers[q.id] ?? 3 })) }); setStep(3); }
    catch (e) { setError((e as Error).message); } finally { setTSubmitting(false); }
  }
  async function step3() {
    if (!f.venuePreference) { setError('Lütfen bir mekan tercihi seçin.'); return; }
    setLoading(true); setError('');
    try { await api.patch('/users/venue-preference', { venuePreference: f.venuePreference }); setStep(4); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  function addContact() {
    const d = f.contactInput.replace(/\D/g, '');
    if (d.length !== 10) { setError('10 haneli numara girin.'); return; }
    if (f.contactNumbers.length >= 50) { setError('En fazla 50 numara ekleyebilirsiniz.'); return; }
    const n = `+90${d}`;
    if (f.contactNumbers.includes(n)) { setError('Bu numara zaten eklenmiş.'); return; }
    setError(''); setF(p => ({ ...p, contactNumbers: [...p.contactNumbers, n], contactInput: '' }));
  }
  async function finish() {
    setLoading(true); setError('');
    try {
      if (f.contactNumbers.length > 0) await api.post('/contact-blocks/sync', { hashedPhones: f.contactNumbers });
      setSuccess(true);
      Notifications.requestPermissionsAsync().catch(() => {});
      setTimeout(() => router.replace('/(tabs)'), 2000);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }

  const header = (n: number, title: string, sub?: string) => (
    <View>
      <Eyebrow style={{ marginBottom: 4 }}>ADIM {n}</Eyebrow>
      <Title style={{ marginBottom: 4 }}>{title}</Title>
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
      <ScrollView {...kb} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40, paddingHorizontal: 20, maxWidth: 576, width: '100%', alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Image source={require('@/assets/start_logo.jpg')} style={{ width: 120, height: 120, borderRadius: 60 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 40 }}>
          {STEPS.map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {i < step ? (
                <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><T w={600} style={{ fontSize: 13, color: '#fff' }}>✓</T></LinearGradient>
              ) : (
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: i === step ? 2 : 1, borderColor: i === step ? c.red : 'rgba(255,255,255,0.1)' }}>
                  <T w={600} style={{ fontSize: 13, color: i === step ? c.red : ll.time }}>{i + 1}</T>
                </View>
              )}
              {i < STEPS.length - 1 && (i < step ? <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 40, height: 1 }} /> : <View style={{ width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />)}
            </View>
          ))}
        </View>

        {step === 0 && (
          <Card style={{ gap: 20 }}>
            {header(1, 'Temel Bilgiler', 'Hesabını oluştur.')}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>{field('Ad', <Input form textContentType="givenName" value={f.firstName} onChangeText={v => set('firstName', v)} style={{ fontSize: 13 }} />)}</View>
              <View style={{ flex: 1 }}>{field('Soyad', <Input form textContentType="familyName" value={f.lastName} onChangeText={v => set('lastName', v)} style={{ fontSize: 13 }} />)}</View>
            </View>
            {field('E-posta', <Input form keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" value={f.email} onChangeText={v => set('email', v)} style={{ fontSize: 13 }} />)}
            <View>
              <FieldLabel>Telefon Numarası</FieldLabel>
              <T style={{ fontSize: 12, color: ll.label, marginBottom: 8 }}>WhatsApp&apos;a kayıtlı numaranızı yazın</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}><T style={{ color: ll.label, fontSize: 13 }}>+90</T></View>
                <Input form editable={!phoneToken} keyboardType="number-pad" textContentType="telephoneNumber" value={f.phoneNumber} onChangeText={t => changePhone(t.replace(/\D/g, '').slice(0, 10))} placeholder="5XX XXX XX XX" style={{ flex: 1, minWidth: 0, fontSize: 13, opacity: phoneToken ? 0.6 : 1 }} />
                {!phoneToken && (
                  <Btn variant="otpSend" onPress={sendPhoneOtp} disabled={otpSending || resendIn > 0 || f.phoneNumber.length !== 10} label={otpSending ? 'Gönderiliyor…' : resendIn > 0 ? `Tekrar (${resendIn} sn)` : otpSent ? 'Tekrar gönder' : 'Kod gönder'} />
                )}
              </View>
              {phoneToken ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <T style={{ fontSize: 12, color: tw4.green400 }}>✓ Telefon numaran doğrulandı</T>
                  <Btn variant="textSmall" style={{ minHeight: 0 }} hitSlop={14} onPress={() => changePhone(f.phoneNumber)} label="Numarayı değiştir" />
                </View>
              ) : otpSent && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <T style={{ fontSize: 12, color: ll.label, textAlign: 'center' }}>+90{f.phoneNumber} numarasına WhatsApp ile gönderilen 6 haneli kodu gir.</T>
                  <OtpInput value={otpCode} onChange={v => { setOtpCode(v); setOtpError(''); }} onComplete={verifyPhoneOtp} error={otpShake} />
                  {otpVerifying && <T style={{ fontSize: 12, color: ll.label, textAlign: 'center' }}>Doğrulanıyor…</T>}
                </View>
              )}
              {!!otpError && <T style={{ fontSize: 12, color: tw.accent, marginTop: 8 }}>{otpError}</T>}
            </View>
            <View><FieldLabel>Şifre</FieldLabel><PasswordInput value={f.password} onChangeText={v => { set('password', v); setPwError(''); }} placeholder="" />{!!pwError && <T style={{ fontSize: 12, color: tw.accent, marginTop: 4 }}>{pwError}</T>}</View>
            <View><FieldLabel>Şifre Tekrar</FieldLabel><PasswordInput value={f.confirmPassword} onChangeText={v => { set('confirmPassword', v); setPwConfirmError(''); }} placeholder="" />{!!pwConfirmError && <T style={{ fontSize: 12, color: tw.accent, marginTop: 4 }}>{pwConfirmError}</T>}</View>
            <DateField label="Doğum tarihi" value={f.birthDate} onChange={v => set('birthDate', v)} />
            <ListPicker label="Meslek Alanı" value={f.occupationSector} onChange={v => set('occupationSector', v)} options={OCCUPATIONS.map(o => ({ value: o, label: o }))} placeholder="Meslek alanı seç" title="Meslek alanı seç" />
            <View>
              <FieldLabel>Cinsiyet</FieldLabel>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['MALE', 'FEMALE'] as const).map(g => {
                  const on = f.gender === g, col = gColor(g);
                  return (
                    <Btn key={g} variant="genderChip" selected={on} onPress={() => set('gender', g)} style={on ? { borderColor: col, shadowColor: col, shadowOpacity: 0.33, shadowRadius: 6 } : undefined} textStyle={on ? { color: col } : undefined} label={g === 'MALE' ? 'Erkek' : 'Kadın'} />
                  );
                })}
              </View>
            </View>
            {!!error && <T style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
            <BtnPrimary label="Devam Et" full disabled={loading} onPress={step1} />
          </Card>
        )}

        {step === 1 && (
          <Card style={{ gap: 20 }}>
            {header(2, 'Şehir Seçimi', 'Hangi şehirde buluşmak istediğini seç. Yaşadığın şehir değil, katılmak istediğin şehir.')}
            <ListPicker label="Ana Şehir *" value={f.primaryCityId} onChange={v => setF(p => ({ ...p, primaryCityId: v, district: '' }))} options={sortedCities.map(x => ({ value: x.id, label: cityLabel(x.name) }))} placeholder="Şehir seç" title="Ana şehir seç" />
            {districtOptions.length > 0 && <ListPicker key={f.primaryCityId} label="İlçe *" value={f.district} onChange={v => set('district', v)} options={districtOptions.map(d => ({ value: d, label: d }))} placeholder="İlçe seç" title="İlçe" searchable searchPlaceholder="İlçe ara" />}
            <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
              <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>Farklı bir şehirde olduğun haftalarda profilindeki &quot;Bu Hafta Hangi Şehirdesiniz?&quot; kartından geçici şehir seçebilirsin.</T>
            </View>
            {!!error && <T style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <BtnGhost label="Geri" onPress={() => { setStep(0); setError(''); }} />
              <BtnPrimary label={loading ? 'Kaydediliyor…' : 'Devam Et'} style={{ flex: 1 }} disabled={loading} onPress={step2} />
            </View>
          </Card>
        )}

        {step === 2 && (
          <Card style={{ gap: 16 }}>
            {questions.length === 0 ? <View style={{ paddingVertical: 64, alignItems: 'center' }}><Spinner /></View> : (
              <TestFlow questions={questions} current={tCurrent} answers={answers} submitting={tSubmitting}
                onPick={v => { const q = questions[tCurrent]; if (q) setAnswers(p => ({ ...p, [q.id]: v })); }}
                onPrev={() => setTCurrent(x => Math.max(0, x - 1))}
                onNext={() => { const q = questions[tCurrent]; if (!q || answers[q.id] === undefined) return; if (tCurrent === questions.length - 1) submitTest(); else setTCurrent(x => x + 1); }} />
            )}
            <ErrorText>{error}</ErrorText>
          </Card>
        )}

        {step === 3 && (
          <Card style={{ gap: 20 }}>
            {header(4, 'Eşleşmenizin yapılacağı mekan ortamı nasıl olsun istersiniz?')}
            <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
              <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>Bu tercih, sizi doğru mekan ortamındaki kişilerle eşleştirmek için kullanılır. İstediğiniz zaman profilinizden değiştirebilirsiniz.</T>
            </View>
            <View style={{ gap: 12 }}>
              {VENUE_OPTIONS.map(o => {
                const sel = f.venuePreference === o.value;
                return (
                  <Btn key={o.value} variant="venuePrefForm" selected={sel} accessibilityLabel={o.label} onPress={() => set('venuePreference', o.value)} style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ flex: 1 }}>
                      <T w={500} style={{ fontSize: 15, marginBottom: 4, color: sel ? tw.accent : tw.text }}>{o.label}</T>
                      <T style={{ fontSize: 13, color: ll.label }}>{o.description}</T>
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
            <BtnPrimary label={loading ? 'Kaydediliyor…' : 'Devam Et'} full disabled={loading || !f.venuePreference} onPress={step3} />
          </Card>
        )}

        {step === 4 && (
          <Card style={{ gap: 20 }}>
            {header(5, 'Numara Engelleme', 'Tanıdıklarınla karşılaşmak istemiyorsan numara ekleyebilirsin.')}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}><T style={{ color: ll.label, fontSize: 13 }}>+90</T></View>
              <Input form keyboardType="number-pad" value={f.contactInput} onChangeText={t => set('contactInput', t.replace(/\D/g, '').slice(0, 10))} placeholder="5XX XXX XX XX" onSubmitEditing={addContact} style={{ flex: 1, fontSize: 13 }} />
              <Btn variant="addSquare" onPress={addContact} label="Ekle" />
            </View>
            <BtnGhost label="Rehberden Seç" full disabled={f.contactNumbers.length >= 50} onPress={() => setPicker(true)} />
            {f.contactNumbers.length > 0 && (
              <View style={{ gap: 8 }}>
                {f.contactNumbers.map(n => (
                  <View key={n} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <T style={{ fontSize: 13, color: ll.label }}>{n}</T>
                    <Btn variant="closeX" hitSlop={14} accessibilityLabel="Kaldır" onPress={() => set('contactNumbers', f.contactNumbers.filter(x => x !== n))} label="×" textStyle={{ fontSize: 18, lineHeight: 18, color: ll.label }} />
                  </View>
                ))}
                <T style={{ fontSize: 12, color: ll.label }}>{f.contactNumbers.length}/50 numara eklendi</T>
              </View>
            )}
            {!!error && <T style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
            <BtnPrimary label={loading ? 'Kaydediliyor…' : 'Tamamla →'} full disabled={loading} style={{ marginTop: 4 }} onPress={finish} />
            <ContactPicker visible={picker} onClose={() => setPicker(false)} existing={f.contactNumbers} remaining={50 - f.contactNumbers.length}
              onPick={(ps) => setF(p => ({ ...p, contactNumbers: [...p.contactNumbers, ...ps.filter(x => normalizeTrPhone(x) && !p.contactNumbers.includes(x))].slice(0, 50) }))} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
