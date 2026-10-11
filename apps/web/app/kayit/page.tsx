'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { api } from '@/lib/api';

interface City { id: string; name: string; }

interface RegisterResponse {
  accessToken: string;
  user: { id: string; firstName: string; lastName: string };
}

interface Question {
  id: string;
  text: string;
  orderNum: number;
  section: number;
  sectionTitle: string;
}

interface QuestionsResponse {
  totalQuestions: number;
  sections: { section: number; title: string; questions: Question[] }[];
}

async function sha256(text: string): Promise<string | null> {
  if (!text || typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

function formatPhone(digits: string): string { return `+90${digits}`; }

const STEPS = ['Temel Bilgiler', 'Şehir Seçimi', 'OCEAN (Big Five) Testi', 'Mekan Tercihi', 'Numara Engelleme'];

const LIKERT = [
  { v: 1, label: 'Hiç katılmıyorum' },
  { v: 2, label: 'Katılmıyorum' },
  { v: 3, label: 'Kararsızım' },
  { v: 4, label: 'Katılıyorum' },
  { v: 5, label: 'Tamamen katılıyorum' },
];

type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE' | '';

interface FormState {
  firstName: string; lastName: string; email: string; password: string; confirmPassword: string;
  birthDate: string; gender: 'MALE' | 'FEMALE' | '';
  primaryCityId: string; secondaryCityId: string;
  venuePreference: VenuePreference;
  contactNumbers: string[]; contactInput: string;
}

const VENUE_OPTIONS: { value: VenuePreference; emoji: string; label: string; description: string }[] = [
  { value: 'ALCOHOLIC',     emoji: '🍷', label: 'Alkollü Mekan',  description: 'Alkollü içecek servisi olan restoran veya bar' },
  { value: 'NON_ALCOHOLIC', emoji: '☕', label: 'Alkolsüz Mekan', description: 'Kafe veya alkolsüz restoran' },
  { value: 'NO_PREFERENCE', emoji: '✨', label: 'Fark Etmez',     description: 'Her iki mekan türü de uygundur' },
];

export default function KayitPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [stepDir, setStepDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [confirmShake, setConfirmShake] = useState(0);

  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    birthDate: '', gender: '', primaryCityId: '', secondaryCityId: '',
    venuePreference: '',
    contactNumbers: [], contactInput: '',
  });

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

  useState(() => {
    api.get<City[]>('/auth/cities').then(setCities).catch(() => {});
  });

  function handleStep1() {
    if (!form.firstName || !form.lastName || !form.email || !form.password) { setError('Tüm alanları doldurun.'); return; }
    if (form.password.length < 6 || form.password.length > 20) { setError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (form.password !== form.confirmPassword) { setError('Şifreler eşleşmiyor.'); setConfirmShake(k => k + 1); return; }
    if (!form.birthDate) { setError('Doğum tarihinizi seçin.'); return; }
    if (!form.gender) { setError('Cinsiyet seçin.'); return; }
    setError(''); setStepDir(1); setStep(1);
  }

  async function handleStep2() {
    if (!form.primaryCityId) { setError('Ana şehir seçin.'); return; }
    setLoading(true); setError('');
    try {
      const data = await api.post<RegisterResponse>('/auth/register', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        acceptTerms: true,
        primaryCityId: form.primaryCityId || undefined,
        secondaryCityId: form.secondaryCityId || undefined,
      });
      api.setToken(data.accessToken);

      const res = await api.get<QuestionsResponse>('/test/questions');
      const flat = res.sections.flatMap(s => s.questions);
      setTestQuestions(flat);
      setTestCurrent(0);
      setTestAnswers({});
      setStepDir(1); setStep(2);
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
      setStepDir(1); setStep(3);
    } catch (e) { setError((e as Error).message); }
    finally { setTestSubmitting(false); }
  }

  async function handleStep3() {
    if (!form.venuePreference) { setError('Lütfen bir mekan tercihi seçin.'); return; }
    setLoading(true); setError('');
    try {
      await api.patch('/users/venue-preference', { venuePreference: form.venuePreference });
      setStepDir(1); setStep(4);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function addContact() {
    const digits = form.contactInput.replace(/\D/g, '');
    if (digits.length !== 10) { setError('10 haneli numara girin.'); return; }
    if (form.contactNumbers.length >= 50) { setError('En fazla 50 numara ekleyebilirsiniz.'); return; }
    const formatted = formatPhone(digits);
    if (form.contactNumbers.includes(formatted)) { setError('Bu numara zaten eklenmiş.'); return; }
    set('contactNumbers', [...form.contactNumbers, formatted]);
    set('contactInput', '');
  }

  async function handleFinish(skip: boolean) {
    setLoading(true); setError('');
    try {
      if (!skip && form.contactNumbers.length > 0) {
        const results = await Promise.all(form.contactNumbers.map(n => sha256(n)));
        const hashes = results.filter((h): h is string => h !== null);
        if (hashes.length > 0) {
          await api.post('/contact-blocks/sync', { hashedPhones: hashes }).catch(() => {});
        }
      }
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
    <div className="min-h-screen flex flex-col pt-[52px]" style={{ background: '#0a0a0a' }}>
      {/* Başarı overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 flex flex-col items-center justify-center"
            style={{ background: '#0a0a0a', zIndex: 100 }}
          >
            <div className="fixed inset-0 pointer-events-none">
              <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.12) 0%, transparent 60%)', filter: 'blur(60px)' }} />
            </div>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', times: [0, 0.7, 1] }}
              className="flex items-center justify-center mb-8"
              style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#c0392b,#ff6b6b)' }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <motion.path
                  d="M8 20 L17 29 L32 13"
                  stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
                />
              </svg>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
              className="font-serif text-4xl text-[#f5f5f5] mb-3"
            >
              Hoş geldin!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="text-[#777] text-sm"
            >
              Masanı bekliyoruz.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arka plan glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-5%', left: '50%', transform: 'translateX(-50%)', width: '80vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.08) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative flex flex-col flex-1 max-w-xl mx-auto w-full px-5 py-10" style={{ zIndex: 1 }}>

        {/* Adım göstergesi */}
        <div className="flex justify-center items-center gap-0 mb-10">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                style={
                  i < step
                    ? { background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', color: '#fff' }
                    : i === step
                    ? { border: '2px solid #c0392b', color: '#c0392b', background: 'transparent' }
                    : { border: '1px solid rgba(255,255,255,0.1)', color: '#444', background: 'transparent' }
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
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#555] uppercase mb-1">ADIM 1</p>
              <h1 className="font-serif text-3xl text-[#f5f5f5] mb-1">Temel Bilgiler</h1>
              <p className="text-[#555] text-sm">Hesabını oluştur.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ad" value={form.firstName} onChange={(v) => set('firstName', v)} />
              <Field label="Soyad" value={form.lastName} onChange={(v) => set('lastName', v)} />
            </div>
            <Field label="E-posta" type="email" value={form.email} onChange={(v) => set('email', v)} />
            <PasswordField label="Şifre" value={form.password} onChange={(v) => set('password', v)} placeholder="6-20 karakter" />
            <PasswordField label="Şifre Tekrar" value={form.confirmPassword} onChange={(v) => set('confirmPassword', v)} shakeKey={confirmShake} />
            <DateField label="Doğum tarihi" value={form.birthDate} onChange={(v) => set('birthDate', v)} />
            <div>
              <label className="block text-sm text-[#555] mb-2">Cinsiyet</label>
              <div className="flex gap-4">
                {(['MALE', 'FEMALE'] as const).map((g) => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => set('gender', g)} className="accent-[#c0392b]" />
                    <span className="text-sm text-[#888]">{g === 'MALE' ? 'Erkek' : 'Kadın'}</span>
                  </label>
                ))}
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
                  className="text-[#ff6b6b] text-sm"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <button type="button" onClick={handleStep1} disabled={loading} className="w-full py-3.5 text-sm btn-grad">
              Devam Et
            </button>
          </div>
        )}

        {/* ── Adım 2: Şehir Seçimi ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#555] uppercase mb-1">ADIM 2</p>
              <h1 className="font-serif text-3xl text-[#f5f5f5] mb-1">Şehir Seçimi</h1>
              <p className="text-[#555] text-sm">Hangi şehirde buluşmak istediğini seç. Yaşadığın şehir değil, katılmak istediğin şehir.</p>
            </div>
            <GlassSelect label="Ana Şehir *" value={form.primaryCityId} onChange={(v) => set('primaryCityId', v)} cities={cities} />
            <GlassSelect label="İkinci Şehir (opsiyonel)" value={form.secondaryCityId} onChange={(v) => set('secondaryCityId', v)} cities={cities.filter((c) => c.id !== form.primaryCityId)} optional />
            <p className="text-xs text-[#444] leading-relaxed">
              Farklı bir şehirde olduğun haftalarda profilindeki "Bu Hafta Hangi Şehirdesiniz?" kartından geçici şehir seçebilirsin.
            </p>
            {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => { setStepDir(-1); setStep(0); setError(''); }} className="px-5 py-3.5 text-sm text-[#555] hover:text-[#888] transition-colors" style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9999 }}>
                ← Geri
              </button>
              <button type="button" onClick={handleStep2} disabled={loading} className="flex-1 py-3.5 text-sm btn-grad">
                {loading ? 'Kaydediliyor…' : 'Devam Et'}
              </button>
            </div>
          </div>
        )}

        {/* ── Adım 3: OCEAN Testi ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            {testQuestions.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold tracking-[0.15em] text-[#555] uppercase">
                    BÖLÜM {String(tq?.section ?? 1).padStart(2, '0')} — {tq?.sectionTitle ?? ''}
                  </span>
                  <span className="text-xs font-mono text-[#555]">{testCurrent + 1} / {tTotal}</span>
                </div>

                {/* Progress bar */}
                <div className="h-[3px] rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#c0392b 0%,#ff6b6b 100%)', boxShadow: '0 0 6px rgba(192,57,43,0.5)' }}
                    animate={{ width: `${tProgress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
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
                        background: 'rgba(255,50,30,0.07)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.5)',
                      }}
                    >
                      <p className="text-xs text-[#444] mb-2 font-mono tracking-widest">SORU {testCurrent + 1}</p>
                      <p className="font-serif text-xl text-[#f5f5f5] leading-snug">{tq?.text}</p>
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
                            className="w-full px-5 py-3.5 rounded-xl text-left text-sm transition-all duration-200"
                            style={selected ? {
                              background: 'rgba(192,57,43,0.12)',
                              border: '1px solid rgba(192,57,43,0.55)',
                              color: '#ff6b6b',
                              boxShadow: '0 0 14px rgba(192,57,43,0.18)',
                            } : {
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.07)',
                              color: '#888',
                            }}
                          >
                            {label}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}

                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={testGoPrev}
                    disabled={testCurrent === 0}
                    className="px-5 py-3.5 text-sm text-[#555] hover:text-[#888] transition-colors disabled:opacity-30"
                    style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9999 }}
                  >
                    ← Geri
                  </button>
                  <button
                    type="button"
                    onClick={testGoNext}
                    disabled={!tHasAnswer || testSubmitting}
                    className="flex-1 py-3.5 text-sm font-medium text-white transition-all disabled:opacity-30"
                    style={{
                      background: tHasAnswer ? 'linear-gradient(135deg,#c0392b,#ff6b6b)' : 'rgba(255,255,255,0.05)',
                      borderRadius: 9999,
                      border: tHasAnswer ? 'none' : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: tHasAnswer ? '0 0 20px rgba(192,57,43,0.3)' : 'none',
                      color: tHasAnswer ? '#fff' : '#444',
                    }}
                  >
                    {testSubmitting ? '…' : tIsLast ? 'Testi Bitir' : 'İleri →'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Adım 4: Mekan Tercihi ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#555] uppercase mb-1">ADIM 4</p>
              <h1 className="font-serif text-3xl text-[#f5f5f5] mb-1 leading-tight">
                Eşleşmenizin yapılacağı mekan ortamı nasıl olsun istersiniz?
              </h1>
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
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl flex-shrink-0 mt-0.5">{opt.emoji}</span>
                      <div>
                        <p className="font-medium text-[#f5f5f5] text-[15px] mb-1"
                          style={{ color: selected ? '#ff6b6b' : '#f5f5f5' }}>
                          {opt.label}
                        </p>
                        <p className="text-sm text-[#666]">{opt.description}</p>
                      </div>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="ml-auto flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
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

            {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}

            <p className="text-xs text-[#444] leading-relaxed">
              Bu tercih, sizi doğru mekan ortamındaki kişilerle eşleştirmek için kullanılır. İstediğiniz zaman profilinizden değiştirebilirsiniz.
            </p>

            <button
              type="button"
              onClick={handleStep3}
              disabled={loading || !form.venuePreference}
              className="w-full py-3.5 text-sm btn-grad disabled:opacity-40"
            >
              {loading ? 'Kaydediliyor…' : 'Devam Et'}
            </button>
          </div>
        )}

        {/* ── Adım 5: Numara Engelleme ── */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#555] uppercase mb-1">ADIM 5</p>
              <h1 className="font-serif text-3xl text-[#f5f5f5] mb-1">Numara Engelleme</h1>
              <p className="text-[#555] text-sm">Tanıdıklarınla karşılaşmak istemiyorsan numara ekleyebilirsin.</p>
            </div>
            <div className="flex gap-2">
              <div
                className="flex items-center px-4 text-[#555] text-sm select-none flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}
              >
                +90
              </div>
              <input
                type="tel"
                value={form.contactInput}
                onChange={(e) => set('contactInput', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="5XX XXX XX XX"
                className="input-glass flex-1 px-4 py-3 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addContact()}
              />
              <button type="button" onClick={addContact} className="px-4 py-3 text-sm text-[#888] hover:text-[#f5f5f5] transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
                Ekle
              </button>
            </div>
            {form.contactNumbers.length > 0 && (
              <div className="flex flex-col gap-2">
                {form.contactNumbers.map((n) => (
                  <div key={n} className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-sm text-[#555]">{n}</span>
                    <button type="button" onClick={() => set('contactNumbers', form.contactNumbers.filter((x) => x !== n))} className="text-[#555] hover:text-[#ff6b6b] text-lg leading-none transition-colors">×</button>
                  </div>
                ))}
                <p className="text-xs text-[#444]">{form.contactNumbers.length}/50 numara eklendi</p>
              </div>
            )}
            {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => handleFinish(true)} disabled={loading} className="flex-1 py-3.5 text-sm text-[#555] hover:text-[#888] transition-colors disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9999 }}>
                Atla
              </button>
              <button type="button" onClick={() => handleFinish(false)} disabled={loading} className="flex-1 py-3.5 text-sm btn-grad">
                {loading ? 'Kaydediliyor…' : 'Tamamla →'}
              </button>
            </div>
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
      <label className="block text-xs text-[#555] mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        className="input-glass px-4 py-3 text-sm"
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder, shakeKey }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; shakeKey?: number;
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
      <label className="block text-xs text-[#555] mb-1.5">{label}</label>
      <motion.div className="relative" animate={controls}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={20}
          className="input-glass px-4 py-3 text-sm pr-12"
          style={shaking ? { borderColor: 'rgba(192,57,43,1)', transition: 'border-color 0.3s' } : { transition: 'border-color 0.3s' }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#c0392b] transition-colors"
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
    </div>
  );
}

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ pointerEvents: 'none' }}>
      <path d="M3 5L7 9L11 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DateSelect({ placeholder, value, onChange, children }: {
  placeholder: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${value ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 12,
          padding: '14px 36px 14px 14px',
          fontSize: 14,
          color: value ? '#f5f5f5' : '#555',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { (e.currentTarget as HTMLSelectElement).style.borderColor = 'rgba(192,57,43,0.5)'; }}
        onBlur={e => { (e.currentTarget as HTMLSelectElement).style.borderColor = value ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.07)'; }}
      >
        <option value="" disabled style={{ background: '#111', color: '#555' }}>{placeholder}</option>
        {children}
      </select>
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <ChevronDown />
      </span>
    </div>
  );
}

function DateField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const minYear = currentYear - 80;
  const maxYear = currentYear - 18;

  const parts = value ? value.split('-').map(Number) : [0, 0, 0];
  const [year, month, day] = parts;

  const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  function update(y: number, m: number, d: number) {
    if (!y || !m || !d) { onChange(''); return; }
    const safeDay = Math.min(d, new Date(y, m, 0).getDate());
    onChange(`${y}-${String(m).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`);
  }

  return (
    <div>
      <label className="block text-xs text-[#555] mb-1.5">{label}</label>
      <style>{`.date-opt{background:#111!important;color:#f5f5f5!important;}`}</style>
      <div style={{ display: 'flex', gap: 8 }}>
        <DateSelect placeholder="Gün" value={day || ''} onChange={v => update(year, month, Number(v))}>
          {days.map(d => <option key={d} value={d} className="date-opt">{d}</option>)}
        </DateSelect>
        <div style={{ flex: 2 }}>
          <DateSelect placeholder="Ay" value={month || ''} onChange={v => update(year, Number(v), day)}>
            {MONTHS_TR.map((m, i) => <option key={i+1} value={i+1} className="date-opt">{m}</option>)}
          </DateSelect>
        </div>
        <DateSelect placeholder="Yıl" value={year || ''} onChange={v => update(Number(v), month, day)}>
          {years.map(y => <option key={y} value={y} className="date-opt">{y}</option>)}
        </DateSelect>
      </div>
    </div>
  );
}

function GlassSelect({ label, value, onChange, cities, optional }: {
  label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-[#555] mb-1.5">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="input-glass px-3 py-3 text-sm"
        style={{ borderRadius: 12 }}
      >
        {optional && <option value="">Seçmek istemiyorum</option>}
        {!optional && <option value="">Şehir seç</option>}
        {cities.map((c) => <option key={c.id} value={c.id} style={{ background: '#0a0a0a' }}>{c.name}</option>)}
      </select>
    </div>
  );
}
