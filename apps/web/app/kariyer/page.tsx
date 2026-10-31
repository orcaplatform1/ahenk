'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import SiteSelect from '@/components/SiteSelect';

/* ── Count-up ─────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1600, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0: number | null = null;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setCount(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [start, target, duration]);
  return count;
}

/* ── Shared styles ────────────────────────────────────────────── */
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
  borderRadius: '16px',
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

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.55, delay, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

const CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Diğer'];
const HEAR_FROM = ['Instagram', 'Arkadaş Tavsiyesi', 'Google', 'Diğer'];

/* ── Page ─────────────────────────────────────────────────────── */
export default function KariyerPage() {
  const formRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });

  const cities = useCountUp(5, 1400, heroInView);
  const meetings = useCountUp(50, 1800, heroInView);
  const target = useCountUp(20, 2000, heroInView);

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', city: '', linkedinOrCv: '', motivation: '', hearFrom: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function scrollToForm() { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co';
      const res = await fetch(`${API}/careers/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      setSuccess(true);
    } catch { setError('Bir hata oluştu. Lütfen tekrar deneyin.'); }
    finally { setSubmitting(false); }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#121212', color: '#f5f5f5', fontFamily: 'var(--font-sans, system-ui)', overflowX: 'hidden' }}>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: 'clamp(5rem,12vw,9rem) 1.5rem clamp(4rem,8vw,7rem)', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 900, height: 520, background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.3) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div ref={heroRef} style={{ position: 'relative', maxWidth: '780px', margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span style={{ display: 'inline-block', padding: '0.3rem 1rem', background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', color: '#ff6b6b', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
              Şimdi Başvur
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}
            style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(2rem, 5.5vw, 3.6rem)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
            Bir şehrin sosyal dokusunu
            <br />
            <span style={{ background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              sen şekillendir.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            style={{ color: '#888', fontSize: 'clamp(0.95rem, 2vw, 1.1rem)', lineHeight: 1.75, maxWidth: '540px', margin: '0 auto 2.5rem' }}>
            Ahenk, insanları anlamlı buluşmalarla bir araya getiriyor. Bu deneyimi sahada yönetecek, şehrin nabzını tutacak birisini arıyoruz.
          </motion.p>

          {/* İstatistikler */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
            {[
              { value: cities, suffix: '', label: 'Aktif Şehir' },
              { value: meetings, suffix: '+', label: 'Haftalık Buluşma' },
              { value: target, suffix: '', label: 'Hedef 2025 Şehir' },
            ].map((s) => (
              <div key={s.label} style={{ ...glass, padding: '1.25rem 1.75rem', minWidth: '120px' }}>
                <p style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 400, background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1, marginBottom: '0.35rem' }}>
                  {s.value}{s.suffix}
                </p>
                <p style={{ color: '#666', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</p>
              </div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
            <button onClick={scrollToForm} className="btn-primary">
              Başvuru Formuna Git ↓
            </button>
          </motion.div>
        </div>
      </section>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* ── Pozisyon ────────────────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(3.5rem,7vw,5.5rem)' }}>
            <div style={{ ...glass, padding: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
              <span style={{ display: 'inline-block', padding: '0.25rem 0.85rem', background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: '9999px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: '#ff6b6b', textTransform: 'uppercase' as const, marginBottom: '1rem' }}>
                Açık Pozisyon
              </span>
              <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 400, background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '0.6rem', lineHeight: 1.2 }}>
                Şehir Operasyon Yetkilisi
              </h2>
              <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1.5rem', letterSpacing: '0.02em' }}>
                Tam zamanlı · Uzaktan + Saha · İstanbul / Ankara / İzmir
              </p>
              <p style={{ color: '#ccc', fontSize: '0.92rem', lineHeight: 1.8, maxWidth: '660px' }}>
                Ahenk'in şehirdeki yüzü sensin. Kullanıcı deneyiminin sahada kusursuz işlemesini sağlar, mekan ortaklarıyla ilişkileri yönetir ve platformun büyümesine doğrudan katkı sunarsın. Binlerce insanın sosyal hayatını şekillendiren bir yapının içinde, sahada gerçek bir etki yaratırsın.
              </p>
            </div>
          </section>
        </FadeIn>

        {/* ── Ne Yapacaksın ───────────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(3.5rem,7vw,5.5rem)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, marginBottom: '1.5rem' }}>
              Ne Yapacaksın?
            </h2>
            <div style={{ ...glass, padding: '2rem' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
                {[
                  'Şehrindeki mekan ortaklarıyla düzenli iletişim kurarak buluşma lokasyonlarını koordine etmek.',
                  'Her hafta gerçekleşen masa buluşmalarının sorunsuz ilerlemesini sağlamak ve kalite kontrolünü yapmak.',
                  'kimlik doğrulama başvurularını incelemek, kullanıcı kimlik doğrulama süreçlerini yönetmek.',
                  'Kullanıcı şikâyet ve taleplerini çözüme kavuşturmak, platform deneyimini iyileştirici geri bildirimler toplamak.',
                  'Yeni mekan ortaklıkları için sahada keşif yapmak ve ilk görüşmeleri gerçekleştirmek.',
                  'Şehir bazlı haftalık rapor hazırlamak ve merkeze iletmek.',
                  'Sosyal medya içerik fikirleri üretmek, lokal topluluk büyümesine katkı sunmak.',
                ].map((item) => (
                  <li key={item} style={{ display: 'flex', gap: '0.75rem', color: '#ccc', fontSize: '0.88rem', lineHeight: 1.65 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', flexShrink: 0, marginTop: '0.45rem' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </FadeIn>

        {/* ── Ahenk Sana Ne Katar? ────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(3.5rem,7vw,5.5rem)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, marginBottom: '1.5rem' }}>
              Ahenk Sana Ne Katar?
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '⭐', title: 'Gerçek Sorumluluk', desc: 'İlk günden itibaren bir şehrin tüm operasyonunu yönetirsin. Staj değil, gerçek yetki.' },
                { icon: '📈', title: 'Büyüyen Bir Yapının İçinde', desc: 'Ahenk büyüdükçe sen büyürsün. İlk ekip üyesi olmak, ilerleyen dönemde bölge yöneticiliği kapısını açar.' },
                { icon: '📍', title: 'Esnek Çalışma', desc: 'Ofise bağlı değilsin. Şehrin her yerinden çalışabilir, kendi programını yönetebilirsin.' },
                { icon: '❤️', title: 'Anlamlı İş', desc: 'Her hafta onlarca insanın hayatına değer katıyorsun. Rakamların arkasında gerçek hikayeler var.' },
              ].map((card, i) => (
                <FadeIn key={card.title} delay={i * 0.07}>
                  <div style={{ ...glass, padding: '1.6rem', height: '100%' }}>
                    <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.85rem' }}>{card.icon}</span>
                    <h3 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '1rem', fontWeight: 400, color: '#f5f5f5', marginBottom: '0.5rem' }}>{card.title}</h3>
                    <p style={{ color: '#888', fontSize: '0.83rem', lineHeight: 1.65 }}>{card.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* ── Aradığımız Profil ───────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(3.5rem,7vw,5.5rem)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, marginBottom: '1.5rem' }}>
              Aradığımız Profil
            </h2>
            <div style={{ ...glass, padding: '2rem' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem' }}>
                {[
                  'İnsanlarla iletişim kurmaktan keyif alan, sosyal zekâsı yüksek biri.',
                  'Sahada aktif olmaktan çekinmeyen, inisiyatif alabilen biri.',
                  'Sorumluluk almaktan korkmayan, çözüm odaklı düşünen biri.',
                  'Dijital araçlara hâkim, raporlama yapabilen biri.',
                  'Ahenk\'in vizyonuna inanan, sosyal bağları güçlendirme misyonunu benimseyen biri.',
                  'Üniversite mezuniyeti veya aktif öğrencilik — ikisi de değerlendirmeye alınır.',
                ].map((item) => (
                  <li key={item} style={{ display: 'flex', gap: '0.75rem', color: '#ccc', fontSize: '0.88rem', lineHeight: 1.65 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', flexShrink: 0, marginTop: '0.45rem' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '1.25rem', padding: '0.85rem 1.1rem', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px' }}>
                <p style={{ color: '#f5f5f5', fontSize: '0.87rem' }}>
                  Deneyim zorunlu değil — <strong>doğru tutum her şeyin önünde.</strong>
                </p>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* ── Başvuru Formu ───────────────────────────────────── */}
        <FadeIn>
          <section ref={formRef} style={{ marginBottom: 'clamp(3.5rem,7vw,5.5rem)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 400, textAlign: 'center', marginBottom: '0.5rem' }}>
              Başvurunu Yap
            </h2>
            <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85rem', marginBottom: '2rem' }}>
              En kısa sürede geri döneceğiz.
            </p>

            <div style={{ ...glass, padding: 'clamp(1.5rem, 4vw, 2.5rem)', maxWidth: '640px', margin: '0 auto' }}>
              {success ? (
                <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.6, times: [0, 0.6, 1] }}
                    style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.75rem', color: '#fff' }}>
                    ✓
                  </motion.div>
                  <h3 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '1.4rem', fontWeight: 400, marginBottom: '0.75rem' }}>Başvurun alındı!</h3>
                  <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.7 }}>
                    Seni inceliyoruz, en kısa sürede <strong style={{ color: '#f5f5f5' }}>geri döneceğiz.</strong>
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <Field label="Ad Soyad *" value={form.fullName} onChange={(v) => setForm(f => ({ ...f, fullName: v }))} required />
                    <Field label="E-posta *" type="email" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <Field label="Telefon *" type="tel" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} required />
                    <SelectField label="Şehir *" value={form.city} options={CITIES} onChange={(v) => setForm(f => ({ ...f, city: v }))} required />
                  </div>
                  <Field label="LinkedIn veya özgeçmiş linki (opsiyonel)" value={form.linkedinOrCv} onChange={(v) => setForm(f => ({ ...f, linkedinOrCv: v }))} placeholder="https://linkedin.com/in/..." />
                  <TextareaField
                    label="Kendini Tanıt — Neden sen? Ahenk'e ne katabilirsin? *"
                    value={form.motivation}
                    onChange={(v) => setForm(f => ({ ...f, motivation: v }))}
                    maxLength={600}
                    required
                  />
                  <SelectField label="Bizi Nereden Duydun? (opsiyonel)" value={form.hearFrom} options={HEAR_FROM} onChange={(v) => setForm(f => ({ ...f, hearFrom: v }))} />

                  {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}

                  <button type="submit" disabled={submitting}
                    className="btn-primary w-full justify-center mt-2 disabled:opacity-70">
                    {submitting ? 'Gönderiliyor...' : 'Başvurumu Gönder →'}
                  </button>
                </form>
              )}
            </div>
          </section>
        </FadeIn>

        {/* ── Sorular ─────────────────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(4rem,8vw,6rem)', textAlign: 'center' }}>
            <div style={{ ...glass, padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
              <h3 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: '1.3rem', fontWeight: 400, marginBottom: '1rem' }}>
                Hâlâ aklında sorular mı var?
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
                <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b', fontSize: '0.95rem', textDecoration: 'none', fontWeight: 500 }}>
                  bilgi@ahenk.co
                </a>
                <a href="tel:+905403060080" style={{ color: '#888', fontSize: '0.9rem', textDecoration: 'none' }}>
                  0540 306 0080
                </a>
              </div>
            </div>
          </section>
        </FadeIn>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
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
              { label: 'İş Ortaklığı', href: '/is-ortakligi' },
              { label: 'Kullanım Koşulları', href: '/kullanim-kosullari' },
              { label: 'Gizlilik Politikası', href: '/gizlilik-politikasi' },
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

/* ── Form bileşenleri ─────────────────────────────────────────── */
function Field({ label, type = 'text', value, onChange, required, placeholder }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500 }}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder}
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.7rem 1rem', color: '#f5f5f5', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
    </label>
  );
}

function SelectField({ label, value, options, onChange, required }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500 }}>{label}</span>
      <SiteSelect value={value} onChange={onChange} options={options} required={required} ariaLabel={label} />
    </div>
  );
}

function TextareaField({ label, value, onChange, maxLength, required }: {
  label: string; value: string; onChange: (v: string) => void; maxLength?: number; required?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.78rem', color: '#888', fontWeight: 500 }}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} required={required} rows={4}
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.7rem 1rem', color: '#f5f5f5', fontSize: '0.9rem', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      {maxLength && <span style={{ fontSize: '0.72rem', color: '#555', alignSelf: 'flex-end' }}>{value.length}/{maxLength}</span>}
    </label>
  );
}
