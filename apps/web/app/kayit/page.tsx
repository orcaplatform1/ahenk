'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { api } from '@/lib/api';

interface City { id: string; name: string; }

interface RegisterResponse {
  accessToken: string;
  user: { id: string; firstName: string; lastName: string };
}

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function formatPhone(digits: string): string { return `+90${digits}`; }

const TOPICS = [
  'Teknoloji', 'Sanat', 'Spor', 'Seyahat', 'Müzik',
  'Sinema', 'Edebiyat', 'Gastronomi', 'Girişimcilik', 'Bilim',
];

const STEPS = ['Temel Bilgiler', 'Şehir Seçimi', 'Konu Tercihleri', 'Rehber Engelleme'];

interface FormState {
  firstName: string; lastName: string; email: string; password: string;
  birthDate: string; gender: 'MALE' | 'FEMALE' | '';
  primaryCityId: string; secondaryCityId: string;
  topics: string[]; contactNumbers: string[]; contactInput: string;
}

export default function KayitPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<City[]>([]);

  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', email: '', password: '',
    birthDate: '', gender: '', primaryCityId: '', secondaryCityId: '',
    topics: [], contactNumbers: [], contactInput: '',
  });

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }, []);

  async function handleRegister() {
    if (!form.firstName || !form.lastName || !form.email || !form.password) { setError('Tüm alanları doldurun.'); return; }
    if (form.password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }
    if (!form.gender) { setError('Cinsiyet seçin.'); return; }
    setLoading(true); setError('');
    try {
      const data = await api.post<RegisterResponse>('/auth/register', {
        firstName: form.firstName, lastName: form.lastName,
        email: form.email, password: form.password, acceptTerms: true,
      });
      api.setToken(data.accessToken);
      const cityData = await api.get<City[]>('/admin/cities');
      setCities(cityData);
      setStep(1);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function handleCities() {
    if (!form.primaryCityId) { setError('Ana şehir seçin.'); return; }
    setStep(2);
  }

  async function handleTopics() {
    if (form.topics.length === 0) { setError('En az bir konu seçin.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/users/topics', { topics: form.topics });
      setStep(3);
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
        const hashes = await Promise.all(form.contactNumbers.map(sha256));
        await api.post('/contact-blocks/sync', { phoneHashes: hashes });
      }
      router.push('/profil');
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <Navbar />
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(192,57,43,0.08) 0%, transparent 60%)' }}
      >
        <div className="w-full max-w-md">
          {/* Adım göstergesi */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={
                    i < step
                      ? { background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', color: '#fff' }
                      : i === step
                      ? { border: '2px solid #c0392b', color: '#c0392b', background: 'transparent' }
                      : { border: '1px solid rgba(255,255,255,0.08)', color: '#888', background: 'transparent' }
                  }
                >
                  {i < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="h-px flex-1"
                    style={{ background: i < step ? 'linear-gradient(90deg,#c0392b,#ff6b6b)' : 'rgba(255,255,255,0.08)' }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="glass-card p-8">
            <h1 className="font-serif text-3xl mb-2 text-[#f5f5f5]">{STEPS[step]}</h1>
            <p className="text-[#888] text-sm mb-8">
              {step === 0 && 'Hesabını oluştur.'}
              {step === 1 && 'Buluşmak istediğin şehri seç.'}
              {step === 2 && 'İlgi alanlarını seç (en az 1).'}
              {step === 3 && 'Tanıdıklarınla karşılaşmak istemiyorsan numara ekleyebilirsin.'}
            </p>

            {/* ── Adım 1 ── */}
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Ad" value={form.firstName} onChange={(v) => set('firstName', v)} placeholder="Ayşe" />
                  <Field label="Soyad" value={form.lastName} onChange={(v) => set('lastName', v)} placeholder="Yılmaz" />
                </div>
                <Field label="E-posta" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="ornek@eposta.com" />
                <Field label="Şifre" type="password" value={form.password} onChange={(v) => set('password', v)} placeholder="En az 6 karakter" maxLength={20} />
                <Field label="Doğum tarihi" type="date" value={form.birthDate} onChange={(v) => set('birthDate', v)} />
                <div>
                  <label className="block text-sm text-[#888] mb-2">Cinsiyet</label>
                  <div className="flex gap-4">
                    {(['MALE', 'FEMALE'] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => set('gender', g)} className="accent-[#c0392b]" />
                        <span className="text-sm text-[#f5f5f5]">{g === 'MALE' ? 'Erkek' : 'Kadın'}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
                <Btn label="Devam Et" loading={loading} onClick={handleRegister} />
              </div>
            )}

            {/* ── Adım 2 ── */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <GlassSelect label="Ana Şehir *" value={form.primaryCityId} onChange={(v) => set('primaryCityId', v)} cities={cities} />
                <GlassSelect label="İkinci Şehir (opsiyonel)" value={form.secondaryCityId} onChange={(v) => set('secondaryCityId', v)} cities={cities.filter((c) => c.id !== form.primaryCityId)} optional />
                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
                <Btn label="Devam Et" loading={loading} onClick={handleCities} />
              </div>
            )}

            {/* ── Adım 3 ── */}
            {step === 2 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('topics', form.topics.includes(t) ? form.topics.filter((x) => x !== t) : [...form.topics, t])}
                      className="px-4 py-2 rounded-full text-sm transition-all"
                      style={
                        form.topics.includes(t)
                          ? { background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', color: '#fff', border: 'none', boxShadow: '0 0 12px rgba(192,57,43,0.4)' }
                          : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
                <Btn label="Devam Et" loading={loading} onClick={handleTopics} />
              </div>
            )}

            {/* ── Adım 4 ── */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <div className="flex items-center input-glass px-3 text-[#888] text-sm w-auto" style={{ borderRadius: 12 }}>+90</div>
                  <input
                    type="tel"
                    value={form.contactInput}
                    onChange={(e) => set('contactInput', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="5XX XXX XX XX"
                    className="input-glass flex-1 px-4 py-3 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && addContact()}
                  />
                  <button type="button" onClick={addContact} className="px-4 py-3 text-sm text-[#f5f5f5] hover:text-white transition-colors glass-card" style={{ borderRadius: 12 }}>
                    Ekle
                  </button>
                </div>
                {form.contactNumbers.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {form.contactNumbers.map((n) => (
                      <div key={n} className="flex items-center justify-between glass-card px-4 py-2">
                        <span className="text-sm text-[#888]">{n}</span>
                        <button type="button" onClick={() => set('contactNumbers', form.contactNumbers.filter((x) => x !== n))} className="text-[#888] hover:text-[#ff6b6b] text-lg leading-none transition-colors">×</button>
                      </div>
                    ))}
                    <p className="text-xs text-[#888]">{form.contactNumbers.length}/50 numara eklendi</p>
                  </div>
                )}
                {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => handleFinish(true)} disabled={loading} className="flex-1 py-3 text-sm text-[#888] hover:text-[#f5f5f5] transition-colors disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>
                    Atla
                  </button>
                  <button type="button" onClick={() => handleFinish(false)} disabled={loading} className="flex-1 py-3 text-sm btn-grad">
                    {loading ? 'Kaydediliyor…' : 'Tamamla'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm text-[#888] mb-2">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        className="input-glass px-4 py-3 text-sm"
      />
    </div>
  );
}

function GlassSelect({ label, value, onChange, cities, optional }: {
  label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-[#888] mb-1">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="input-glass px-3 py-3 text-sm"
        style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
      >
        {optional && <option value="">Seçmek istemiyorum</option>}
        {!optional && <option value="">Şehir seç</option>}
        {cities.map((c) => <option key={c.id} value={c.id} style={{ background: '#0a0a0a' }}>{c.name}</option>)}
      </select>
    </div>
  );
}

function Btn({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="w-full py-3 text-sm btn-grad">
      {loading ? 'Yükleniyor…' : label}
    </button>
  );
}
