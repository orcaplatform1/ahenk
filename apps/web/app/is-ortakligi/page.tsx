'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import SiteSelect from '@/components/SiteSelect';
import { FormLabel, PasswordInput, TextareaField, TextField, VerifiedPhoneField } from '@/components/PublicFormFields';
import { API_PREFIX, api } from '@/lib/api';
import { readError } from '@/lib/venueApi';

/* ── Count-up hook ────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1600, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const tick = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [start, target, duration]);
  return count;
}

/* ── Styles helpers ───────────────────────────────────────────── */
const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '20px',
};

const btnGrad: React.CSSProperties = {
  background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)',
  border: 'none',
  borderRadius: '9999px',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'filter 0.2s',
};

const btnOutline: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '9999px',
  color: '#aaa',
  cursor: 'pointer',
  transition: 'border-color 0.2s',
};

const VENUE_TYPES = ['Restoran', 'Kafe', 'Bistro', 'Bar', 'Diğer'];
const ALCOHOL_OPTIONS = [
  { value: 'ALCOHOLIC', label: 'Alkollü' },
  { value: 'NON_ALCOHOLIC', label: 'Alkolsüz' },
];
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAPS_URL = /^https:\/\/((www\.)?google\.(com|com\.tr)\/maps|maps\.google\.(com|com\.tr)|maps\.app\.goo\.gl|goo\.gl\/maps|share\.google)(\/|\?|$)/i;

/* ── InView wrapper ───────────────────────────────────────────── */
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function IsOrtakligiPage() {
  const formRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });

  const citiesCount = useCountUp(5, 1400, heroInView);
  const meetingsCount = useCountUp(50, 1800, heroInView);

  const [form, setForm] = useState({
    businessName: '', contactName: '', email: '', phone: '',
    city: '', venueType: '', venueTypeOther: '', capacity: '', description: '', websiteOrSocial: '',
    password: '', passwordConfirm: '', district: '', address: '', locationUrl: '', alcoholStatus: '', referenceCode: '',
  });
  const [districts, setDistricts] = useState<Record<string, string[]>>({});
  const [cities, setCities] = useState<string[]>([]);
  const districtOptions = districts[form.city] ?? [];
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Telefon doğrulama (WhatsApp OTP) — üye kaydıyla aynı akış
  const [phoneToken, setPhoneToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  useEffect(() => {
    api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => undefined);
    api.get<{ name: string }[]>('/auth/cities').then((c) => setCities(c.map((x) => x.name))).catch(() => undefined);
  }, []);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    if (picked.some((f) => f.size > MAX_PHOTO_BYTES)) { setError('Her fotoğraf en fazla 5 MB olabilir.'); return; }
    if (picked.some((f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))) { setError('Fotoğraflar JPEG, PNG veya WebP olmalı.'); return; }
    if (photos.length + picked.length > MAX_PHOTOS) { setError(`En fazla ${MAX_PHOTOS} fotoğraf yükleyebilirsiniz.`); return; }
    setError('');
    setPhotos((p) => [...p, ...picked]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6 || form.password.length > 20) { setError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (form.password !== form.passwordConfirm) { setError('Şifreler eşleşmiyor.'); return; }
    if (!phoneToken) { setError('Telefon numaranızı WhatsApp koduyla doğrulayın.'); return; }
    if (form.venueType === 'Diğer' && !form.venueTypeOther.trim()) { setError('Mekân türünüzü yazın.'); return; }
    if (!form.district) { setError('İlçe seçin.'); return; }
    if (!MAPS_URL.test(form.locationUrl.trim())) { setError('Geçerli bir Google Maps linki girin.'); return; }
    if (photos.length === 0) { setError('En az 1 mekân fotoğrafı yükleyin.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const body = new FormData();
      const { passwordConfirm: _confirm, phone, description, websiteOrSocial, referenceCode, locationUrl, venueTypeOther, ...rest } = form;
      Object.entries(rest).forEach(([k, v]) => body.append(k, v));
      body.append('phone', `+90${phone}`);
      body.append('phoneToken', phoneToken);
      body.append('locationUrl', locationUrl.trim());
      if (rest.venueType === 'Diğer') body.append('venueTypeOther', venueTypeOther.trim());
      if (description) body.append('description', description);
      if (websiteOrSocial) body.append('websiteOrSocial', websiteOrSocial);
      if (referenceCode.trim()) body.append('referenceCode', referenceCode.trim());
      photos.forEach((f) => body.append('photos', f));
      const res = await fetch(`${API_PREFIX}/partnerships/apply`, { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res));
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="live-layer ll-form" style={{ minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: 'clamp(5rem,12vw,9rem) 1.5rem clamp(4rem,8vw,7rem)', textAlign: 'center' }}>
        {/* glow */}
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.3) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div ref={heroRef} style={{ position: 'relative', maxWidth: '720px', margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <span style={{ display: 'inline-block', padding: '0.3rem 1rem', background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: '#ff6b6b', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
              Mekan Ortaklığı
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: '1.25rem' }}
          >
            Masanızı doldurun.
            <br />
            <span style={{ background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Her hafta, garantili.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            style={{ color: '#888', fontSize: 'clamp(1rem, 2vw, 1.15rem)', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '520px', margin: '0 auto 2.5rem' }}
          >
            Ahenk kullanıcıları şehrin en seçkin mekânlarında buluşur. Sizin mekânınız bu deneyimin parçası olabilir.
          </motion.p>

          {/* İstatistikler */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.34 }}
            style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}
          >
            {[
              { value: citiesCount, suffix: '', label: 'Aktif Şehir' },
              { value: meetingsCount, suffix: '+', label: 'Haftalık Buluşma' },
            ].map((stat) => (
              <div key={stat.label} style={{ ...glassCard, padding: '1.5rem 2.5rem', minWidth: '140px' }}>
                <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(2.2rem, 5vw, 3rem)', fontWeight: 400, background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1, marginBottom: '0.4rem' }}>
                  {stat.value}{stat.suffix}
                </p>
                <p style={{ color: '#666', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <button onClick={scrollToForm} className="btn-primary">
              Ortaklık Teklifini İncele ↓
            </button>
          </motion.div>
        </div>
      </section>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ── Neden Ahenk Ortağı? ───────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(4rem,8vw,6rem)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 400, textAlign: 'center', marginBottom: '2.5rem' }}>
              Neden Ahenk Ortağı?
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {[
                { icon: '📅', title: 'Garantili Doluluk', desc: 'Her hafta önceden planlanmış, kesinleşmiş rezervasyonlar. Boş masa bırakmayın.' },
                { icon: '🛡️', title: 'Seçkin Müşteri Kitlesi', desc: 'OCEAN kişilik testinden geçmiş, kimlik doğrulamalı, sosyal deneyime değer veren kullanıcılar. Kaliteli müşteri, kaliteli deneyim.' },
                { icon: '⭐', title: 'Sıfır Pazarlama Maliyeti', desc: 'Reklam vermenize gerek yok. Ahenk kullanıcıları mekânınıza gelir, siz sadece en iyi deneyimi sunarsınız.' },
                { icon: '🪑', title: 'Özel Masa Düzeni', desc: 'Grup masaları 4-8 kişi, başbaşa masalar 2 kişi. Önceden bilirsiniz, hazırlıklı olursunuz.' },
              ].map((card, i) => (
                <FadeIn key={card.title} delay={i * 0.08}>
                  <div style={{ ...glassCard, padding: '1.75rem', height: '100%' }}>
                    <span style={{ fontSize: '1.6rem', display: 'block', marginBottom: '0.9rem' }}>{card.icon}</span>
                    <h3 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '1.05rem', fontWeight: 400, color: '#f5f5f5', marginBottom: '0.6rem' }}>{card.title}</h3>
                    <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.65 }}>{card.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* ── Nasıl Çalışır? ────────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(4rem,8vw,6rem)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 400, textAlign: 'center', marginBottom: '2.5rem' }}>
              Nasıl Çalışır?
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0', position: 'relative' }}>
              {[
                { n: '1', title: 'Başvuru', desc: 'Formu doldurun, mekânınızı ve kapasitenizi bize bildirin.' },
                { n: '2', title: 'Değerlendirme', desc: 'Ekibimiz mekânınızı inceler, 3 iş günü içinde geri dönüş yapar.' },
                { n: '3', title: 'Ortaklık', desc: 'Anlaşma imzalanır, ilk rezervasyonlar başlar.' },
              ].map((step, i) => (
                <div key={step.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 1rem', position: 'relative' }}>
                  {i < 2 && (
                    <div style={{ position: 'absolute', top: '1.6rem', left: 'calc(50% + 2rem)', right: 'calc(-50% + 2rem)', height: '2px', background: 'linear-gradient(90deg, #c0392b, rgba(192,57,43,0.2))', display: 'block' }} className="step-line" />
                  )}
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '1.3rem', color: '#fff', marginBottom: '1rem', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                    {step.n}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '1.1rem', fontWeight: 400, color: '#f5f5f5', marginBottom: '0.5rem' }}>{step.title}</h3>
                  <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: '200px' }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* ── Kimler Ortak Olabilir? ────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(4rem,8vw,6rem)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              <div style={{ ...glassCard, padding: '2rem' }}>
                <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 400, color: '#f5f5f5', marginBottom: '1.25rem' }}>
                  Kimler Ortak Olabilir?
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {[
                    'Restoranlar, kafeler ve bistro işletmeleri',
                    'İstanbul, Ankara, İzmir, Antalya, Aydın, Muğla veya Balıkesir (Ayvalık/Akçay) illerinde faaliyet gösterenler',
                    'En az 2 ayrı masa veya özel alan tahsis edebilecek kapasitede olanlar',
                    'Müşteri deneyimine önem veren, kaliteli hizmet sunan işletmeler',
                    'Alkollü içecek servisi yapabilen veya yapmayan mekânlar başvurabilir — her ikisi de değerlendirmeye alınır',
                  ].map((item) => (
                    <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
                      <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ortaklık Modeli */}
              <div style={{ ...glassCard, padding: '2rem' }}>
                <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 400, color: '#f5f5f5', marginBottom: '1.25rem' }}>
                  Ortaklık Modeli
                </h2>
                <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: 1.75, marginBottom: '1rem' }}>
                  Ahenk, mekan ortaklarıyla <strong style={{ color: '#f5f5f5' }}>gelir paylaşımı</strong> veya <strong style={{ color: '#f5f5f5' }}>sabit rezervasyon ücreti</strong> modeliyle çalışır. Detaylar mekânın kapasitesine, şehrine ve haftalık rezervasyon yoğunluğuna göre belirlenir. Tüm koşullar ortaklık görüşmesinde şeffaf biçimde paylaşılır.
                </p>
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px' }}>
                  <p style={{ color: '#888', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Ahenk kullanıcıları yemek ve içecek bedelini doğrudan mekâna öder — Ahenk sadece organizasyon ve eşleştirme hizmeti sunar.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* ── Erken Ortaklık ────────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(4rem,8vw,6rem)' }}>
            <div style={{ ...glassCard, padding: '2.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <span style={{ display: 'inline-block', padding: '0.3rem 0.9rem', background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: '#ff6b6b', textTransform: 'uppercase' as const, marginBottom: '1rem' }}>
                Erken Ortak Avantajları
              </span>
              <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, marginBottom: '1.5rem' }}>
                İlk ortaklarımızdan olmak ister misiniz?
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
                {[
                  '🗺️  Öncelikli bölge hakları',
                  '📉  Düşük komisyon oranı',
                  '🔥  Platform içi öne çıkarılma',
                ].map((item) => (
                  <div key={item} style={{ padding: '0.65rem 1.2rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9999px', color: '#ccc', fontSize: '0.85rem' }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </FadeIn>

        {/* ── Başvuru Formu ─────────────────────────────────── */}
        <FadeIn>
          <section ref={formRef} style={{ marginBottom: 'clamp(4rem,8vw,6rem)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 400, textAlign: 'center', marginBottom: '0.5rem' }}>
              Ortaklık Başvurusu
            </h2>
            <p style={{ textAlign: 'center', color: '#a39c93', fontSize: 13, marginBottom: '2.5rem' }}>
              Formu doldurun, 24 saat içinde ekibimiz sizi arasın.
            </p>

            <div className="ll-card" style={{ maxWidth: '680px', margin: '0 auto' }}>
              {success ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ textAlign: 'center', padding: '2rem 0' }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.6, times: [0, 0.6, 1] }}
                    style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.75rem' }}
                  >
                    ✓
                  </motion.div>
                  <h3 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '1.4rem', fontWeight: 400, marginBottom: '0.75rem' }}>Başvurunuz alındı!</h3>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.65 }}>
                    Ekibimiz <strong style={{ color: '#f5f5f5' }}>3 iş günü</strong> içinde başvurunuzu inceleyecek. Onaylandığında WhatsApp ile bilgilendirileceksiniz; ardından mekân paneline giriş yapabilirsiniz.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* 2 col */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <TextField label="İşletme Adı *" value={form.businessName} onChange={(v) => setForm(f => ({ ...f, businessName: v }))} required />
                    <TextField label="Yetkili Ad Soyad *" value={form.contactName} onChange={(v) => setForm(f => ({ ...f, contactName: v }))} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <TextField label="E-posta *" type="email" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} required />
                  </div>

                  <VerifiedPhoneField
                    base="/partnerships"
                    phone={form.phone}
                    onPhone={(v) => setForm((f) => ({ ...f, phone: v }))}
                    phoneToken={phoneToken}
                    onToken={setPhoneToken}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <PasswordInput label="Şifre * (6-20 karakter)" value={form.password} onChange={(v) => setForm(f => ({ ...f, password: v }))} required />
                    <PasswordInput label="Şifre Tekrar *" value={form.passwordConfirm} onChange={(v) => setForm(f => ({ ...f, passwordConfirm: v }))} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <SelectField label="Şehir *" value={form.city} options={cities} onChange={(v) => setForm(f => ({ ...f, city: v, district: '' }))} required />
                    <div>
                      <FormLabel>İlçe *</FormLabel>
                      <SiteSelect live key={form.city} value={form.district} onChange={(v) => setForm(f => ({ ...f, district: v }))} options={districtOptions} placeholder={form.city ? 'İlçe seçin' : 'Önce şehir seçin'} required ariaLabel="İlçe" searchable searchPlaceholder="İlçe ara" />
                    </div>
                  </div>
                  <SelectField label="Mekân Türü *" value={form.venueType} options={VENUE_TYPES} onChange={(v) => setForm(f => ({ ...f, venueType: v }))} required />
                  {form.venueType === 'Diğer' && (
                    <TextField label="Mekân türünüzü yazın *" value={form.venueTypeOther} onChange={(v) => setForm(f => ({ ...f, venueTypeOther: v }))} maxLength={60} required />
                  )}
                  <TextField label="Tahsis Edilebilir Kapasite (kişi) *" type="number" value={form.capacity} onChange={(v) => setForm(f => ({ ...f, capacity: v }))} required />
                  <SelectField label="Alkol Durumu *" value={form.alcoholStatus} options={ALCOHOL_OPTIONS} onChange={(v) => setForm(f => ({ ...f, alcoholStatus: v }))} required />
                  <TextareaField label="Açık Adres *" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} maxLength={300} required />
                  <TextField label="Google Maps Konum Linki *" type="url" value={form.locationUrl} onChange={(v) => setForm(f => ({ ...f, locationUrl: v }))} required placeholder="https://maps.app.goo.gl/..." />
                  <a
                    href={form.locationUrl.trim() || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!form.locationUrl.trim()}
                    className="btn-ghost"
                    style={{ alignSelf: 'flex-start', opacity: form.locationUrl.trim() ? 1 : 0.4, pointerEvents: form.locationUrl.trim() ? 'auto' : 'none' }}
                  >
                    Kontrol Et
                  </a>

                  {/* Mekân fotoğrafları */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <FormLabel>Mekân Fotoğrafları * (en az 1, en fazla {MAX_PHOTOS}; her biri en fazla 5 MB)</FormLabel>
                    {previews.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '0.5rem' }}>
                        {previews.map((src, i) => (
                          <div key={src} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`Fotoğraf ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button type="button" aria-label={`Fotoğraf ${i + 1} kaldır`} onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))} style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', cursor: 'pointer' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {photos.length < MAX_PHOTOS && (
                      <label style={{ ...fieldStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, cursor: 'pointer', color: '#ff6b6b', borderStyle: 'dashed' }}>
                        + Fotoğraf ekle
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                      </label>
                    )}
                  </div>

                  <TextareaField label="Mekânınızı Tanıtın (opsiyonel, maks. 500 karakter)" value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} maxLength={500} />
                  <TextField label="Website veya Instagram linki (opsiyonel)" value={form.websiteOrSocial} onChange={(v) => setForm(f => ({ ...f, websiteOrSocial: v }))} placeholder="https://" />
                  <TextField label="Personel Referans Kodu (opsiyonel)" value={form.referenceCode} onChange={(v) => setForm(f => ({ ...f, referenceCode: v }))} />

                  {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full justify-center mt-2 disabled:opacity-70"
                  >
                    {submitting ? 'Gönderiliyor...' : 'Ortaklık Teklifini Gönder →'}
                  </button>
                </form>
              )}
            </div>
          </section>
        </FadeIn>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.10)', padding: '2.5rem 1.5rem' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <p style={{ color: '#e8e8e8', fontSize: '0.85rem', fontWeight: 500 }}>© 2026 Ahenk. Tüm hakları saklıdır.</p>
          <p style={{ color: '#888', fontSize: '0.8rem' }}>
            Ahenk bir{' '}
            <a href="https://ahenk.co" style={{ textDecoration: 'none' }}>
              <span style={{ color: '#f5f5f5', fontWeight: 600 }}>Traders</span>
              <span style={{ color: '#1e90ff', fontWeight: 700 }}>.TR</span>
            </a>
            <span style={{ marginLeft: '3px' }}>🇹🇷</span>{' '}ticari markasıdır.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4rem 1.2rem', marginTop: '0.5rem' }}>
            {[
              { label: 'Ana Sayfa', href: '/' },
              { label: 'Kullanım Koşulları', href: '/kullanim-kosullari' },
              { label: 'Gizlilik Politikası', href: '/gizlilik-politikasi' },
              { label: 'KVKK', href: '/kvkk' },
              { label: 'Site Haritası', href: '/site-haritasi' },
            ].map((link) => (
              <Link key={link.href} href={link.href} style={{ color: '#555', fontSize: '0.78rem', textDecoration: 'none' }}>{link.label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ── Form field bileşenleri ───────────────────────────────────── */
const fieldStyle: React.CSSProperties = { position: 'relative', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '0.7rem 1rem', color: '#f5f5f5', fontSize: 13, width: '100%', boxSizing: 'border-box' };

function SelectField({ label, value, options, onChange, required }: {
  label: string; value: string; options: (string | { value: string; label: string })[]; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <SiteSelect live value={value} onChange={onChange} options={options} required={required} ariaLabel={label} />
    </div>
  );
}
