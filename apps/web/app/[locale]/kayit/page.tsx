'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { DEFAULT_PHONE_COUNTRY, occupationLabel, toE164 } from '@ahenk/shared';
import { CountryCodeButton } from '@/components/PhoneCountryField';
import Image from 'next/image';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { OCCUPATION_SECTORS } from '@/lib/occupations';
import { api } from '@/lib/api';
import { trackOceanTestComplete, trackSignUp } from '@/lib/analytics';
import OtpInput from '@/components/ui/OtpInput';
import { OtpCountdown, OtpNoticeAction, useOtpCountdown } from '@/lib/otpCountdown';
import { otpNoticeOf, type OtpNoticeCode } from '@/lib/otpResend';
import SiteSelect from '@/components/SiteSelect';
import { gColor } from '@ahenk/ui';
import { DateField } from '@/components/BirthDateField';

interface City { id: string; name: string; isActive?: boolean; isComingSoon?: boolean; countryCode?: string; }

// Token'lar HttpOnly çerezle gelir; yanıt gövdesinde sadece kullanıcı
interface RegisterResponse {
  user: { id: string; firstName: string; lastName: string };
}

interface Question {
  id: string;
  text: string;
  textEn?: string;
  orderNum: number;
  section: number;
  sectionTitle: string;
  sectionTitleEn?: string;
}

interface QuestionsResponse {
  totalQuestions: number;
  sections: { section: number; title: string; questions: Question[] }[];
}

function formatPhone(digits: string): string { return `+90${digits}`; }

// Adımlar (çeviri anahtarı): Temel Bilgiler → Dil → Şehir → Test → Mekan → Numara Engelleme
const STEPS = ['reg.stepBasic', 'reg.stepLang', 'reg.stepCity', 'reg.stepTest', 'reg.stepVenue', 'reg.stepBlock'];

const LIKERT = [
  { v: 1, label: 'test.likert1' },
  { v: 2, label: 'test.likert2' },
  { v: 3, label: 'test.likert3' },
  { v: 4, label: 'test.likert4' },
  { v: 5, label: 'test.likert5' },
];

type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE' | '';



interface FormState {
  firstName: string; lastName: string; email: string; password: string; confirmPassword: string;
  phoneNumber: string;
  birthDate: string; gender: 'MALE' | 'FEMALE' | '';
  occupationSector: string;
  primaryCityId: string;
  district: string;
  venuePreference: VenuePreference;
  contactNumbers: string[]; contactInput: string;
}

const VENUE_OPTIONS: { value: VenuePreference; label: string; description: string }[] = [
  { value: 'ALCOHOLIC',     label: 'venue.alcoholic',    description: 'venue.alcoholicDesc' },
  { value: 'NON_ALCOHOLIC', label: 'venue.nonAlcoholic', description: 'venue.nonAlcoholicDesc' },
  { value: 'NO_PREFERENCE', label: 'venue.both',         description: 'venue.bothDesc' },
];

function KayitPageInner() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  // Ülke kodlu telefon (E.164); dil soruları; pasif bölge "Haber ver" (hesap açılınca kaydedilir)
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [speaksEnglish, setSpeaksEnglish] = useState<boolean | null>(null);
  const [speaksTurkish, setSpeaksTurkish] = useState<boolean | null>(locale === 'en' ? null : true);
  const [notifyRegions, setNotifyRegions] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref') ?? undefined;
  const [step, setStep] = useState(0);
  const [stepDir, setStepDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const [confirmShake, setConfirmShake] = useState(0);

  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    phoneNumber: '',
    birthDate: '', gender: '',
    occupationSector: '',
    primaryCityId: '',
    district: '',
    venuePreference: '',
    contactNumbers: [], contactInput: '',
  });

  const [pwError, setPwError] = useState('');
  const [pwConfirmError, setPwConfirmError] = useState('');

  const districtOptions = districts[cities.find((c) => c.id === form.primaryCityId)?.name ?? ''] ?? [];

  // Telefon doğrulama (WhatsApp OTP) — hesap oluşmadan önce
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

  function changePhone(v: string) {
    set('phoneNumber', v);
    // Numara değişirse doğrulama baştan yapılır
    setOtpSent(false); setOtpCode(''); setOtpError(''); setPhoneToken('');
    countdown.start(0);
  }

  const phoneE164 = toE164(country, form.phoneNumber);
  async function sendPhoneOtp() {
    if (!phoneE164) { setOtpError(t('phone.invalid')); return; }
    setOtpSending(true); setOtpError(''); setNotice(null);
    try {
      const r = await api.post<{ resendSeconds: number }>('/auth/register/send-otp', { phone: phoneE164, language: locale });
      setOtpSent(true); setOtpCode(''); countdown.start(r.resendSeconds);
    } catch (e) {
      // Bekleme süresi dolmadan istendi: sayaç sunucunun döndüğü kalan saniyeden başlar
      if (countdown.startFromError(e)) setOtpSent(true);
      setNotice(otpNoticeOf(e));
      const msg = (e as Error).message;
      setOtpError(msg === '__rate_limit__' ? t('reg.tooMany') : msg);
    } finally { setOtpSending(false); }
  }

  async function verifyPhoneOtp(code: string) {
    setOtpVerifying(true); setOtpError('');
    try {
      const r = await api.post<{ phoneToken: string }>('/auth/register/verify-otp', { phone: phoneE164, code });
      setPhoneToken(r.phoneToken);
    } catch (e) {
      const msg = (e as Error).message;
      setOtpError(msg === '__rate_limit__' ? t('reg.tooMany') : msg);
      setOtpCode('');
      setOtpShake(true); setTimeout(() => setOtpShake(false), 500);
    } finally { setOtpVerifying(false); }
  }

  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [testAnswers, setTestAnswers] = useState<Record<string, number>>({});
  const [testCurrent, setTestCurrent] = useState(0);
  const [testDirection, setTestDirection] = useState(1);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }, []);

  useEffect(() => {
    // Aktif bölgeler (kayıtta 4 şehir) + "Yakında" grubu (Türkiye dışı pasif bölgeler)
    api.get<City[]>('/auth/cities').then((list) => setCities(list.filter((c) => (c.isActive !== false && CITY_ORDER.includes(c.name)) || (c.isActive === false && c.isComingSoon === true)))).catch(() => setError(t('reg.citiesFailed')));
    api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => setError(t('reg.districtsFailed')));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [step]);

  function handleStep1() {
    setPwError(''); setPwConfirmError('');
    if (!form.firstName || !form.lastName || !form.email || !form.password) { setError(t('reg.fillAll')); return; }
    if (!form.email.includes('@')) { setError(t('reg.validEmail')); return; }
    if (form.password.length < 6 || form.password.length > 20) {
      setPwError(t('reg.pwLength'));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setPwConfirmError(t('reg.pwMismatch'));
      setConfirmShake(k => k + 1);
      return;
    }
    if (!phoneE164) {
      setError(t('phone.invalid'));
      return;
    }
    if (!phoneToken) { setError(t('reg.verifyPhone')); return; }
    if (!form.birthDate) { setError(t('reg.pickBirth')); return; }
    if (!form.gender) { setError(t('reg.pickGender')); return; }
    if (!form.occupationSector) { setError(t('reg.pickOccupation')); return; }
    setError(''); setStepDir(1); setStep(1);
  }
  // Dil soruları: herkese İngilizce; yalnız İngilizce arayüzle kayıtta Türkçe (Türkçe arayüzde Türkçe biliyor sayılır)
  function handleLangStep() {
    if (speaksEnglish === null || speaksTurkish === null) { setError(t('reg.answerBoth')); return; }
    setError(''); setStepDir(1); setStep(2);
  }

  async function handleStep2() {
    if (!form.primaryCityId) { setError(t('reg.pickCity')); return; }
    if (districtOptions.length > 0 && !form.district) { setError(t('reg.pickDistrict')); return; }
    setLoading(true); setError('');
    try {
      await api.post<RegisterResponse>('/auth/register', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phoneNumber: phoneE164,
        phoneToken,
        acceptTerms: true,
        gender: form.gender || undefined,
        birthDate: form.birthDate || undefined,
        occupationSector: form.occupationSector,
        primaryCityId: form.primaryCityId || undefined,
        district: form.district || undefined,
        referralCode,
        language: locale,
        speaksEnglish: !!speaksEnglish,
        speaksTurkish: locale === 'en' ? !!speaksTurkish : true,
      });
      api.onLogin();
      // Kayıtta "Haber ver" denen pasif bölgeler bekleme listesine yazılır
      for (const id of notifyRegions) await api.post(`/users/me/region-waitlist/${id}`, {}).catch(() => undefined);

      const res = await api.get<QuestionsResponse>('/test/questions');
      const flat = res.sections.flatMap(s => s.questions);
      setTestQuestions(flat);
      setTestCurrent(0);
      setTestAnswers({});
      setStepDir(1); setStep(3);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function pickAnswer(val: number) {
    const q = testQuestions[testCurrent];
    if (!q) return;
    setTestAnswers(prev => ({ ...prev, [q.id]: val }));
  }

  function testGoNext() {
    const q = testQuestions[testCurrent];
    if (!q || testAnswers[q.id] === undefined) return;
    if (testCurrent === testQuestions.length - 1) { submitTest(); return; }
    setTestDirection(1);
    setTestCurrent(c => c + 1);
  }

  function testGoPrev() {
    if (testCurrent === 0) return;
    setTestDirection(-1);
    setTestCurrent(c => c - 1);
  }

  async function submitTest() {
    setTestSubmitting(true); setError('');
    try {
      await api.post('/test/submit', {
        answers: testQuestions.map(q => ({ questionId: q.id, score: testAnswers[q.id] ?? 3 })),
      });
      trackOceanTestComplete();
      setStepDir(1); setStep(4);
    } catch (e) { setError((e as Error).message); }
    finally { setTestSubmitting(false); }
  }

  async function handleStep3() {
    if (!form.venuePreference) { setError(t('reg.pickVenue')); return; }
    setLoading(true); setError('');
    try {
      await api.patch('/users/venue-preference', { venuePreference: form.venuePreference });
      setStepDir(1); setStep(5);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function addContact() {
    const digits = form.contactInput.replace(/\D/g, '');
    if (digits.length !== 10) { setError(t('block.tenDigits')); return; }
    if (form.contactNumbers.length >= 50) { setError(t('block.max50')); return; }
    const formatted = formatPhone(digits);
    if (form.contactNumbers.includes(formatted)) { setError(t('block.already')); return; }
    set('contactNumbers', [...form.contactNumbers, formatted]);
    set('contactInput', '');
  }

  async function handleFinish(skip: boolean) {
    setLoading(true); setError('');
    try {
      if (!skip && form.contactNumbers.length > 0) {
        await api.post('/contact-blocks/sync', { hashedPhones: form.contactNumbers });
      }
      trackSignUp();
      setShowSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  const tq = testQuestions[testCurrent];
  const tTotal = testQuestions.length;
  const tProgress = tTotal > 0 ? (Object.keys(testAnswers).length / tTotal) * 100 : 0;
  const tHasAnswer = tq ? testAnswers[tq.id] !== undefined : false;
  const tIsLast = testCurrent === tTotal - 1;

  return (
    <div className="live-layer ll-form min-h-screen flex flex-col pt-[52px]">
      {/* Başarı overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 flex flex-col items-center justify-start pt-[18%]"
            style={{ background: '#000000', zIndex: 100 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center gap-2 mb-8"
            >
              <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
              <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4, ease: 'easeOut' }}
              className="font-serif text-4xl text-[#f5f5f5] mb-1"
            >
              {t('reg.welcome')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.35, ease: 'easeOut' }}
              className="font-serif text-4xl text-[#f5f5f5] mb-6"
            >
              {form.firstName} {form.lastName}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arka plan glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-5%', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.08) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative flex flex-col flex-1 max-w-xl mx-auto w-full px-5 py-10" style={{ zIndex: 1 }}>

        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
          <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
        </div>

        {/* Adım göstergesi */}
        <div className="flex justify-center items-center gap-0 mb-10">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0"
                style={
                  i < step
                    ? { background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', color: '#fff' }
                    : i === step
                    ? { border: '2px solid #c0392b', color: '#c0392b', background: 'transparent' }
                    : { border: '1px solid rgba(255,255,255,0.1)', color: '#8f887f', background: 'transparent' }
                }
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-10 h-px"
                  style={{ background: i < step ? 'linear-gradient(90deg,#c0392b,#ff6b6b)' : 'rgba(255,255,255,0.08)' }}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait" custom={stepDir}>
          <motion.div
            key={step}
            custom={stepDir}
            variants={{
              enter: (d: number) => ({ x: d * 40, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >

        {/* ── Adım 1: Temel Bilgiler ── */}
        {step === 0 && (
          <div className="ll-card flex flex-col gap-5">
            <div>
              <p className="ll-eyebrow" style={{ marginBottom: 4 }}>{t('reg.stepN', { n: 1 })}</p>
              <h1 className="ll-title" style={{ marginBottom: 4 }}>{t('reg.stepBasic')}</h1>
              <p className="text-[#a39c93] text-[13px]">{t('reg.createAccount')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('reg.firstName')} value={form.firstName} onChange={(v) => set('firstName', v)} />
              <Field label={t('reg.lastName')} value={form.lastName} onChange={(v) => set('lastName', v)} />
            </div>
            <Field label={t('reg.email')} type="email" value={form.email} onChange={(v) => set('email', v)} />
            {/* Telefon */}
            <div>
              <label className="block ll-mono text-[11px] text-[#a39c93] mb-1.5">{t('reg.phoneLabel')}</label>
              <p className="text-xs text-[#a39c93] mb-2">{t('reg.phoneHint')}</p>
              <div className="flex gap-2">
                <CountryCodeButton country={country} disabled={!!phoneToken} onChange={(c) => { setCountry(c); changePhone(form.phoneNumber); }} />
                <input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => changePhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  placeholder={country === 'TR' ? '5XX XXX XX XX' : ''}
                  disabled={!!phoneToken}
                  className="input-glass flex-1 min-w-0 px-4 py-3 text-[13px] disabled:opacity-60"
                />
                {!phoneToken && (
                  <button
                    type="button"
                    onClick={sendPhoneOtp}
                    disabled={otpSending || countdown.waiting || !phoneE164}
                    className="shrink-0 px-3 text-xs font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ border: '1px solid rgba(192,57,43,0.5)', color: '#e74c3c', background: 'rgba(192,57,43,0.06)' }}
                  >
                    {otpSending ? t('reg.sending') : otpSent ? t('reg.resend') : t('reg.sendCode')}
                  </button>
                )}
              </div>
              {phoneToken ? (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-green-400">{t('reg.phoneVerified')}</p>
                  <button type="button" onClick={() => changePhone(form.phoneNumber)} className="text-xs text-[#a39c93] hover:text-[#888]">{t('reg.changeNumber')}</button>
                </div>
              ) : otpSent && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs text-[#a39c93] text-center">{t('phone.codeSentTo', { phone: phoneE164 ?? form.phoneNumber })}</p>
                  <OtpInput
                    value={otpCode}
                    onChange={(c) => { setOtpCode(c); setOtpError(''); }}
                    onComplete={verifyPhoneOtp}
                    error={otpShake}
                  />
                  <OtpCountdown seconds={countdown.seconds} className="text-xs text-[#a39c93] text-center" />
                  {otpVerifying && <p className="text-xs text-[#a39c93] text-center">{t('reg.verifying')}</p>}
                </div>
              )}
              {otpError && <p className="text-xs text-[#ff6b6b] mt-2">{otpError}</p>}
              {otpError && notice && <div className="mt-2"><OtpNoticeAction code={notice} /></div>}
            </div>
            <PasswordField label={t('reg.password')} value={form.password} onChange={(v) => { set('password', v); setPwError(''); }} error={pwError} />
            <PasswordField label={t('reg.passwordRepeat')} value={form.confirmPassword} onChange={(v) => { set('confirmPassword', v); setPwConfirmError(''); }} shakeKey={confirmShake} error={pwConfirmError} />
            <DateField label={t('reg.birthDate')} value={form.birthDate} onChange={(v) => set('birthDate', v)} />
            <OccupationField label={t('reg.occupation')} value={form.occupationSector} onChange={(v) => set('occupationSector', v)} />
            <div>
              <label className="block ll-mono text-[11px] text-[#a39c93] mb-2">{t('reg.gender')}</label>
              <div className="flex gap-2">
                {(['MALE', 'FEMALE'] as const).map((g) => {
                  const on = form.gender === g;
                  const color = gColor(g);
                  return (
                    <label
                      key={g}
                      className="flex items-center cursor-pointer"
                      style={{
                        padding: '6px 16px', borderRadius: 9999, transition: 'border-color 0.2s, box-shadow 0.2s',
                        border: `1.5px solid ${on ? color : 'transparent'}`,
                        boxShadow: on ? `0 0 12px ${color}55` : 'none',
                      }}
                    >
                      <input type="radio" name="gender" value={g} checked={on} onChange={() => set('gender', g)} className="sr-only" />
                      <span className="text-[13px]" style={{ color: on ? color : '#8f887f' }}>{g === 'MALE' ? t('reg.male') : t('reg.female')}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key={error}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="text-[#ff6b6b] text-[13px]"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <button type="button" onClick={handleStep1} disabled={loading} className="w-full btn-primary">
              {t('reg.continueBtn')}
            </button>
          </div>
        )}

        {/* ── Adım 2: Dil soruları (tek ekran, iki soru alt alta, Evet / Hayır) ── */}
        {step === 1 && (
          <div className="ll-card flex flex-col gap-5">
            <div>
              <p className="ll-eyebrow" style={{ marginBottom: 4 }}>{t('reg.stepN', { n: 2 })}</p>
              <h1 className="ll-title" style={{ marginBottom: 4 }}>{t('reg.stepLang')}</h1>
            </div>
            <YesNo label={t('reg.speaksEnglish')} value={speaksEnglish} onChange={(v) => { setSpeaksEnglish(v); setError(''); }} />
            {locale === 'en' && <YesNo label={t('reg.speaksTurkish')} value={speaksTurkish} onChange={(v) => { setSpeaksTurkish(v); setError(''); }} />}
            {error && <p className="text-[#ff6b6b] text-[13px]">{error}</p>}
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => { setStepDir(-1); setStep(0); setError(''); }} className="btn-ghost">{t('common.back')}</button>
              <button type="button" onClick={handleLangStep} className="flex-1 btn-primary">{t('common.continue')}</button>
            </div>
          </div>
        )}

        {/* ── Adım 3: Şehir Seçimi ── */}
        {step === 2 && (
          <div className="ll-card flex flex-col gap-5">
            <div>
              <p className="ll-eyebrow" style={{ marginBottom: 4 }}>{t('reg.stepN', { n: 3 })}</p>
              <h1 className="ll-title" style={{ marginBottom: 4 }}>{t('reg.stepCityTitle')}</h1>
              <p className="text-[#a39c93] text-[13px]">{t('reg.cityHint')}</p>
            </div>
            <CityPickerField label={t('reg.primaryCity')} value={form.primaryCityId} onChange={(v) => { set('primaryCityId', v); set('district', ''); }} cities={cities} title={t('reg.pickPrimaryCity')}
              notified={notifyRegions} onNotify={(id) => setNotifyRegions((p) => (p.includes(id) ? p : [...p, id]))} />
            {districtOptions.length > 0 && (
              <div>
                <label className="block ll-mono text-[11px] text-[#a39c93] mb-2">{t('reg.district')}</label>
                <SiteSelect live key={form.primaryCityId} value={form.district} onChange={(v) => set('district', v)} options={districtOptions} placeholder={t('reg.pickDistrictPh')} ariaLabel={t('reg.districtAria')} searchable searchPlaceholder={t('reg.districtSearch')} required />
              </div>
            )}
            <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
                {t('reg.tempCity')}
              </p>
            </div>
            {error && <p className="text-[#ff6b6b] text-[13px]">{error}</p>}
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => { setStepDir(-1); setStep(1); setError(''); }} className="btn-ghost">
                {t('common.back')}
              </button>
              <button type="button" onClick={handleStep2} disabled={loading} className="flex-1 btn-primary">
                {loading ? t('reg.saving') : t('reg.continueBtn')}
              </button>
            </div>
          </div>
        )}

        {/* ── Adım 4: OCEAN Testi ── */}
        {step === 3 && (
          <div className="ll-card flex flex-col gap-4">
            {testQuestions.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="ll-eyebrow">
                    {t('test.section', { n: String(tq?.section ?? 1).padStart(2, '0') })}: {(locale === 'en' && tq?.sectionTitleEn) || tq?.sectionTitle || ''}
                  </span>
                  <span className="ll-mono text-[11px] text-[#a39c93]">{testCurrent + 1} / {tTotal}</span>
                </div>

                {/* Progress bar */}
                <div className="h-[3px] rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.10)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#c0392b 0%,#ff6b6b 100%)', boxShadow: '0 0 6px rgba(192,57,43,0.5)' }}
                    animate={{ width: `${tProgress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>

                {/* Test uyarısı */}
                <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
                    {t('reg.testNote')}
                  </p>
                </div>

                {/* Soru + yanıtlar */}
                <AnimatePresence mode="wait" custom={testDirection}>
                  <motion.div
                    key={testCurrent}
                    custom={testDirection}
                    variants={{
                      enter: (d: number) => ({ x: d * 40, opacity: 0, filter: 'blur(3px)' }),
                      center: { x: 0, opacity: 1, filter: 'blur(0px)' },
                      exit: (d: number) => ({ x: d * -40, opacity: 0, filter: 'blur(3px)' }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="flex flex-col gap-3"
                  >
                    {/* Soru kartı */}
                    <div
                      className="rounded-2xl p-5"
                      style={{
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <p className="ll-mono text-[11px] text-[#a39c93] mb-2">{t('test.question', { n: testCurrent + 1 })}</p>
                      <p className="font-serif text-xl text-[#f5f5f5] leading-snug">{(locale === 'en' && tq?.textEn) || tq?.text}</p>
                    </div>

                    {/* Yanıt butonları */}
                    <div className="flex flex-col gap-2">
                      {LIKERT.map(({ v, label }) => {
                        const selected = tq ? testAnswers[tq.id] === v : false;
                        return (
                          <motion.button
                            key={v}
                            type="button"
                            onClick={() => pickAnswer(v)}
                            whileTap={{ scale: 0.99 }}
                            className="w-full px-5 py-3.5 rounded-xl text-left text-[13px] transition-all duration-200"
                            style={selected ? {
                              background: 'rgba(192,57,43,0.12)',
                              border: '1px solid rgba(192,57,43,0.55)',
                              color: '#ff6b6b',
                              boxShadow: '0 0 14px rgba(192,57,43,0.18)',
                            } : {
                              background: 'rgba(255,255,255,0.025)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: '#a39c93',
                            }}
                          >
                            {t(label)}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {error && <p className="text-[#ff6b6b] text-[13px]">{error}</p>}

                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={testGoPrev}
                    disabled={testCurrent === 0}
                    className="btn-ghost disabled:opacity-30"
                  >
                    {t('reg.backArrow')}
                  </button>
                  <button
                    type="button"
                    onClick={testGoNext}
                    disabled={!tHasAnswer || testSubmitting}
                    className="flex-1 btn-primary justify-center disabled:opacity-30"
                  >
                    {testSubmitting ? '…' : tIsLast ? t('test.finish') : t('test.next')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Adım 5: Mekan Tercihi ── */}
        {step === 4 && (
          <div className="ll-card flex flex-col gap-5">
            <div>
              <p className="ll-eyebrow" style={{ marginBottom: 4 }}>{t('reg.stepN', { n: 5 })}</p>
              <h1 className="ll-title" style={{ marginBottom: 4 }}>
                {t('reg.venueQuestion')}
              </h1>
            </div>

            <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
                {t('reg.venueNote')}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {VENUE_OPTIONS.map((opt) => {
                const selected = form.venuePreference === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    type="button"
                    onClick={() => set('venuePreference', opt.value)}
                    whileTap={{ scale: 0.99 }}
                    className="w-full text-left rounded-2xl p-5 transition-all duration-200"
                    style={selected ? {
                      background: 'rgba(192,57,43,0.10)',
                      border: '1.5px solid rgba(192,57,43,0.6)',
                      boxShadow: '0 0 18px rgba(192,57,43,0.14)',
                    } : {
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div>
                        <p className="font-medium text-[#f5f5f5] text-[15px] mb-1"
                          style={{ color: selected ? '#ff6b6b' : '#f5f5f5' }}>
                          {t(opt.label)}
                        </p>
                        <p className="text-[13px] text-[#a39c93]">{t(opt.description)}</p>
                      </div>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="ml-auto shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)' }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5 L4 7 L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {error && <p className="text-[#ff6b6b] text-[13px]">{error}</p>}

            <button
              type="button"
              onClick={handleStep3}
              disabled={loading || !form.venuePreference}
              className="w-full btn-primary disabled:opacity-40"
            >
              {loading ? t('reg.saving') : t('reg.continueBtn')}
            </button>
          </div>
        )}

        {/* ── Adım 6: Numara Engelleme ── */}
        {step === 5 && (
          <div className="ll-card flex flex-col gap-5">
            <div>
              <p className="ll-eyebrow" style={{ marginBottom: 4 }}>{t('reg.stepN', { n: 6 })}</p>
              <h1 className="ll-title" style={{ marginBottom: 4 }}>{t('reg.stepBlock')}</h1>
              <p className="text-[#a39c93] text-[13px]">{t('reg.blockHint')}</p>
            </div>
            <div className="flex gap-2">
              <div
                className="flex items-center px-4 text-[#a39c93] text-[13px] select-none shrink-0"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
              >
                +90
              </div>
              <input
                type="tel"
                value={form.contactInput}
                onChange={(e) => set('contactInput', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="5XX XXX XX XX"
                className="input-glass flex-1 px-4 py-3 text-[13px]"
                onKeyDown={(e) => e.key === 'Enter' && addContact()}
              />
              <button type="button" onClick={addContact} className="px-4 py-3 text-[13px] text-[#c9c2b8] hover:text-[#f5f5f5] transition-colors" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
                {t('reg.add')}
              </button>
            </div>
            {form.contactNumbers.length > 0 && (
              <div className="flex flex-col gap-2">
                {form.contactNumbers.map((n) => (
                  <div key={n} className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-[13px] text-[#a39c93]">{n}</span>
                    <button type="button" onClick={() => set('contactNumbers', form.contactNumbers.filter((x) => x !== n))} className="text-[#a39c93] hover:text-[#ff6b6b] text-lg leading-none transition-colors">×</button>
                  </div>
                ))}
                <p className="text-xs text-[#a39c93]">{t('block.added', { count: form.contactNumbers.length })}</p>
              </div>
            )}
            {error && <p className="text-[#ff6b6b] text-[13px]">{error}</p>}
            <button type="button" onClick={() => handleFinish(false)} disabled={loading} className="w-full btn-primary mt-1">
              {loading ? t('reg.saving') : t('reg.finish')}
            </button>
          </div>
        )}

          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <div>
      <label className="block ll-mono text-[11px] text-[#a39c93] mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        className="input-glass px-4 py-3 text-[13px]"
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, shakeKey, error }: {
  label: string; value: string; onChange: (v: string) => void; shakeKey?: number; error?: string;
}) {
  const [show, setShow] = useState(false);
  const [shaking, setShaking] = useState(false);
  const controls = useAnimation();

  useEffect(() => {
    if (!shakeKey) return;
    setShaking(true);
    controls.start({
      x: [0, -8, 8, -8, 8, 0],
      transition: { duration: 0.4, ease: 'easeInOut' },
    });
    const t = setTimeout(() => setShaking(false), 400);
    return () => clearTimeout(t);
  }, [shakeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label className="block ll-mono text-[11px] text-[#a39c93] mb-1.5">{label}</label>
      <motion.div className="relative" animate={controls}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={20}
          className="input-glass px-4 py-3 text-[13px] pr-12"
          style={shaking || error ? { borderColor: 'rgba(192,57,43,0.7)', transition: 'border-color 0.3s' } : { transition: 'border-color 0.3s' }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a39c93] hover:text-[#c0392b] transition-colors"
          tabIndex={-1}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </motion.div>
      {error && <p className="text-[#ff6b6b] text-xs mt-1.5">{error}</p>}
    </div>
  );
}



/* ── DatePickerModal ─────────────────────────────────────────────────────── */

// Evet / Hayır sorusu (dil soruları)
function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  const t = useTranslations();
  return (
    <div>
      <p className="text-[15px] text-[#f5f5f5] mb-2">{label}</p>
      <div className="flex gap-2">
        {([true, false] as const).map((v) => {
          const on = value === v;
          return (
            <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={on}
              className="flex-1 rounded-xl text-[14px]" style={{ minHeight: 44, border: on ? '1.5px solid rgba(192,57,43,0.6)' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(192,57,43,0.10)' : 'rgba(255,255,255,0.025)', color: on ? '#ff6b6b' : '#c9c2b8' }}>
              {v ? t('common.yes') : t('common.no')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OccupationPickerModal({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const t = useTranslations();
  const [tmp, setTmp] = useState(value);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: '20px 16px 36px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: '#a39c93' }}>{t('reg.pickOccupationTitle')}</p>
          <button onClick={onClose} style={{ color: '#a39c93', fontSize: 20, lineHeight: 1, background: 'none', outline: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 300, scrollbarWidth: 'none' }}>
          {OCCUPATION_SECTORS.map(s => {
            const isSel = s === tmp;
            return (
              <div
                key={s}
                onClick={() => setTmp(s)}
                style={{
                  padding: '13px 14px',
                  fontSize: 15,
                  color: isSel ? '#ff6b6b' : '#c9c2b8',
                  fontWeight: isSel ? 600 : 400,
                  background: isSel ? 'rgba(192,57,43,0.12)' : 'transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'color 0.1s, background 0.1s',
                }}
              >
                {occupationLabel(s, t)}
              </div>
            );
          })}
        </div>
        <button
          onClick={() => { if (tmp) { onChange(tmp); onClose(); } }}
          disabled={!tmp}
          className="btn-primary w-full justify-center disabled:opacity-40"
          style={{ marginTop: 16 }}
        >
          {t('reg.select')}
        </button>
      </div>
    </div>
  );
}

function OccupationField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <label className="block ll-mono text-[11px] text-[#a39c93] mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '14px 16px',
          fontSize: 13,
          color: value ? '#f5f5f5' : '#a39c93',
          textAlign: 'left',
          cursor: 'pointer',
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {value ? occupationLabel(value, t) : t('reg.pickOccupationTitle')}
      </button>
      {open && <OccupationPickerModal value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

// Kayıtta şimdilik yalnız bu 4 şehir seçilebilir
const CITY_ORDER = ['İstanbul', 'Ankara', 'İzmir', 'Antalya'];

function cityLabel(name: string) {
  return name === 'Balıkesir' ? 'Balıkesir (Ayvalık / Akçay)' : name;
}

function sortCities(cities: City[]): City[] {
  return [...cities].sort((a, b) => {
    const ia = CITY_ORDER.indexOf(a.name);
    const ib = CITY_ORDER.indexOf(b.name);
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, 'tr');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function CityPickerModal({ cities, value, onChange, onClose, optional, title, notified, onNotify }: {
  cities: City[]; value: string; onChange: (v: string) => void; onClose: () => void;
  optional?: boolean; title: string; notified?: string[]; onNotify?: (id: string) => void;
}) {
  const t = useTranslations();
  const [tmp, setTmp] = useState(value);
  // Üst grup: seçilebilir bölgeler; alt grup ("Yakında"): pasif bölgeler, soluk, seçilemez, sağda "Haber ver"
  const sorted = sortCities(cities.filter((c) => c.isActive !== false));
  const soon = cities.filter((c) => c.isActive === false);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '20px 16px 36px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: '#a39c93' }}>{title}</p>
          <button onClick={onClose} style={{ color: '#a39c93', fontSize: 20, lineHeight: 1, background: 'none', outline: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 300, scrollbarWidth: 'none' }}>
          {optional && (
            <div
              onClick={() => setTmp('')}
              style={{ padding: '13px 14px', fontSize: 15, color: tmp === '' ? '#ff6b6b' : '#a39c93', fontWeight: tmp === '' ? 600 : 400, background: tmp === '' ? 'rgba(192,57,43,0.12)' : 'transparent', borderRadius: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transition: 'color 0.1s, background 0.1s' }}
            >
              {t('reg.noCity')}
            </div>
          )}
          {sorted.map(c => {
            const isSel = c.id === tmp;
            return (
              <div
                key={c.id}
                onClick={() => setTmp(c.id)}
                style={{ padding: '13px 14px', fontSize: 15, color: isSel ? '#ff6b6b' : '#c9c2b8', fontWeight: isSel ? 600 : 400, background: isSel ? 'rgba(192,57,43,0.12)' : 'transparent', borderRadius: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transition: 'color 0.1s, background 0.1s' }}
              >
                {cityLabel(c.name)}
              </div>
            );
          })}
          {soon.length > 0 && (
            <>
              <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 4px', color: '#8f887f', fontSize: 11 }}>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />{t('common.comingSoon')}<span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              </div>
              {soon.map((c) => {
                const done = notified?.includes(c.id);
                return (
                  <div key={c.id} aria-disabled="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 14px', fontSize: 15, color: 'rgba(201,194,184,0.4)' }}>
                    <span>{c.name}<span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 999, border: '1px solid rgba(143,136,127,0.4)', fontSize: 10, color: '#8f887f' }}>{t('common.comingSoon')}</span></span>
                    {onNotify && (
                      <button type="button" disabled={done} onClick={() => onNotify(c.id)}
                        style={{ minHeight: 32, padding: '0 10px', fontSize: 11, borderRadius: 999, border: '1px solid rgba(192,57,43,0.5)', background: done ? 'transparent' : 'rgba(192,57,43,0.10)', color: done ? '#8f887f' : '#ff6b6b', cursor: done ? 'default' : 'pointer' }}>
                        {done ? t('common.notified') : t('common.notifyMe')}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <button
          onClick={() => { onChange(tmp); onClose(); }}
          className="btn-primary w-full justify-center"
          style={{ marginTop: 16 }}
        >
          {t('reg.select')}
        </button>
      </div>
    </div>
  );
}

function CityPickerField({ label, value, onChange, cities, optional, title, notified, onNotify }: {
  label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean; title?: string; notified?: string[]; onNotify?: (id: string) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const found = cities.find(c => c.id === value);
  const display = found ? cityLabel(found.name) : (optional ? t('reg.noCity') : t('reg.pickCityShort'));
  return (
    <div>
      <label className="block ll-mono text-[11px] text-[#a39c93] mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', fontSize: 14, color: value ? '#f5f5f5' : '#a39c93', textAlign: 'left', cursor: 'pointer', outline: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        {display}
      </button>
      {open && <CityPickerModal cities={cities} value={value} onChange={onChange} onClose={() => setOpen(false)} optional={optional} title={title ?? t('reg.pickCityShort')} notified={notified} onNotify={onNotify} />}
    </div>
  );
}

export default function KayitPage() {
  return (
    <Suspense>
      <KayitPageInner />
    </Suspense>
  );
}
