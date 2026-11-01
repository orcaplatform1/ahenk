'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import SiteSelect from '@/components/SiteSelect';
import { DateField } from '@/components/BirthDateField';
import { FormLabel, TextareaField, TextField, VerifiedPhoneField } from '@/components/PublicFormFields';
import { LineIcon } from '@/components/LineIcon';
import { API_PREFIX, api } from '@/lib/api';
import { readError } from '@/lib/venueApi';

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

const EDUCATIONS = ['Lise', 'Önlisans', 'Lisans', 'Yüksek Lisans'];
const LANGUAGES = ['İngilizce', 'Almanca', 'Arapça', 'Rusça', 'Fransızca', 'İspanyolca', 'İtalyanca'];
const WORK_TYPES = ['Saha', 'Ofis', 'Uzaktan'];
const SALARIES = ['Belirtmek istemiyorum', '35.000 - 45.000', '45.000 - 60.000', '60.000 - 80.000', '80.000 - 100.000'];
const HEAR_FROM = ['Instagram', 'Google', 'Arkadaş tavsiyesi', 'Diğer'];
const CV_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
const CV_MAX_BYTES = 5 * 1024 * 1024;
const LINKEDIN_URL = /^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\//i;

/* ── Page ─────────────────────────────────────────────────────── */
export default function KariyerPage() {
  const formRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });


  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', education: '', workType: '', salaryExpectation: '', birthDate: '',
    city: '', district: '', linkedinOrCv: '', motivation: '', hearFrom: '', hearFromOther: '',
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const [phoneToken, setPhoneToken] = useState('');
  const [languages, setLanguages] = useState<Record<string, number>>({}); // Dil → seviye (0: seçilmedi)
  const [cv, setCv] = useState<File | null>(null);
  const [cityNames, setCityNames] = useState<string[]>([]);
  const cities = useCountUp(cityNames.length, 1400, heroInView);
  const [districts, setDistricts] = useState<Record<string, string[]>>({});

  useEffect(() => {
    api.get<Record<string, string[]>>('/auth/districts').then(setDistricts).catch(() => undefined);
    api.get<{ name: string }[]>('/auth/cities').then((c) => setCityNames(c.map((x) => x.name))).catch(() => undefined);
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  function scrollToForm() { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  function toggleLanguage(name: string) {
    setLanguages((l) => {
      const next = { ...l };
      if (name in next) delete next[name]; else next[name] = 0;
      return next;
    });
  }

  function pickCv(file?: File) {
    if (!file) return;
    if (file.size > CV_MAX_BYTES) { setError('CV en fazla 5 MB olabilir.'); return; }
    setError(''); setCv(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const picked = Object.entries(languages);
    if (!phoneToken) { setError('Telefon numaranızı WhatsApp koduyla doğrulayın.'); return; }
    if (picked.length === 0) { setError('En az bir yabancı dil seçin.'); return; }
    if (picked.some(([, level]) => !level)) { setError('Seçtiğiniz her dil için seviye seçin.'); return; }
    if (!form.birthDate) { setError('Doğum tarihinizi seçin.'); return; }
    if (!form.district) { setError('İlçe seçin.'); return; }
    if (form.linkedinOrCv.trim() && !LINKEDIN_URL.test(form.linkedinOrCv.trim())) { setError('Geçerli bir LinkedIn bağlantısı girin.'); return; }
    if (!cv) { setError('Özgeçmiş (CV) yükleyin.'); return; }
    setSubmitting(true); setError('');
    try {
      const body = new FormData();
      const { phone, hearFromOther, linkedinOrCv, hearFrom, ...rest } = form;
      Object.entries(rest).forEach(([k, v]) => body.append(k, v));
      body.append('phone', `+90${phone}`);
      body.append('phoneToken', phoneToken);
      body.append('languages', JSON.stringify(picked.map(([name, level]) => ({ name, level }))));
      if (linkedinOrCv.trim()) body.append('linkedinOrCv', linkedinOrCv.trim());
      if (hearFrom) body.append('hearFrom', hearFrom);
      if (hearFrom === 'Diğer' && hearFromOther.trim()) body.append('hearFromOther', hearFromOther.trim());
      body.append('cv', cv);
      const res = await fetch(`${API_PREFIX}/careers/apply`, { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res));
      setSuccess(true);
    } catch (err) { setError((err as Error).message || 'Bir hata oluştu. Lütfen tekrar deneyin.'); }
    finally { setSubmitting(false); }
  }

  return (
    <main className="live-layer ll-form" style={{ minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: 'clamp(5rem,12vw,9rem) 1.5rem clamp(4rem,8vw,7rem)', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 900, height: 520, background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.3) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div ref={heroRef} style={{ position: 'relative', maxWidth: '780px', margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span style={{ display: 'inline-block', padding: '0.3rem 1rem', background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '9999px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.1em', color: '#ff6b6b', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
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
            style={{ color: '#a39c93', fontSize: 'clamp(0.95rem, 2vw, 1.1rem)', lineHeight: 1.75, maxWidth: '540px', margin: '0 auto 2.5rem' }}>
            Ahenk, insanları anlamlı buluşmalarla bir araya getiriyor. Bu deneyimi sahada yönetecek, şehrin nabzını tutacak birisini arıyoruz.
          </motion.p>

          {/* İstatistikler */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
            <div className="ll-card" style={{ minWidth: '120px' }}>
              <p className="ll-mono" style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#f4f1ec' }}>{cities}</p>
              <p style={{ margin: '4px 0 0', color: '#a39c93', fontSize: 11 }}>Aktif Şehir</p>
            </div>
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
            <div className="ll-card">
              <span style={{ display: 'inline-block', padding: '0.25rem 0.85rem', background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: '9999px', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', color: '#ff6b6b', textTransform: 'uppercase' as const, marginBottom: '1rem' }}>
                Açık Pozisyon
              </span>
              <h2 className="ll-title" style={{ marginBottom: '0.6rem' }}>
                Şehir Operasyon Yetkilisi
              </h2>
              <p style={{ color: '#8f887f', fontSize: 13, marginBottom: '1.5rem', letterSpacing: '0.02em' }}>
                Tam zamanlı · Uzaktan + Saha · {cityNames.join(' / ')}
              </p>
              <p style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.8, maxWidth: '660px' }}>
                Ahenk'in şehirdeki yüzü sensin. Kullanıcı deneyiminin sahada kusursuz işlemesini sağlar, mekan ortaklarıyla ilişkileri yönetir ve platformun büyümesine doğrudan katkı sunarsın. Binlerce insanın sosyal hayatını şekillendiren bir yapının içinde, sahada gerçek bir etki yaratırsın.
              </p>
            </div>
          </section>
        </FadeIn>

        {/* ── Ne Yapacaksın ───────────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(3.5rem,7vw,5.5rem)' }}>
            <h2 className="ll-title" style={{ marginBottom: '1.5rem' }}>
              Ne Yapacaksın?
            </h2>
            <div className="ll-card">
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
                  <li key={item} style={{ display: 'flex', gap: '0.75rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
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
            <h2 className="ll-title" style={{ marginBottom: '1.5rem' }}>
              Ahenk Sana Ne Katar?
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { icon: 'star' as const, title: 'Gerçek Sorumluluk', desc: 'İlk günden itibaren bir şehrin tüm operasyonunu yönetirsin. Staj değil, gerçek yetki.' },
                { icon: 'chart' as const, title: 'Büyüyen Bir Yapının İçinde', desc: 'Ahenk büyüdükçe sen büyürsün. İlk ekip üyesi olmak, ilerleyen dönemde bölge yöneticiliği kapısını açar.' },
                { icon: 'pin' as const, title: 'Esnek Çalışma', desc: 'Ofise bağlı değilsin. Şehrin her yerinden çalışabilir, kendi programını yönetebilirsin.' },
                { icon: 'heart' as const, title: 'Anlamlı İş', desc: 'Her hafta onlarca insanın hayatına değer katıyorsun. Rakamların arkasında gerçek hikayeler var.' },
              ].map((card, i) => (
                <FadeIn key={card.title} delay={i * 0.07}>
                  <div className="ll-card" style={{ height: '100%' }}>
                    <span style={{ display: 'block', marginBottom: '0.85rem' }}><LineIcon name={card.icon} /></span>
                    <h3 className="ll-title" style={{ marginBottom: '0.5rem' }}>{card.title}</h3>
                    <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.65 }}>{card.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* ── Aradığımız Profil ───────────────────────────────── */}
        <FadeIn>
          <section style={{ marginBottom: 'clamp(3.5rem,7vw,5.5rem)' }}>
            <h2 className="ll-title" style={{ marginBottom: '1.5rem' }}>
              Aradığımız Profil
            </h2>
            <div className="ll-card">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem' }}>
                {[
                  'İnsanlarla iletişim kurmaktan keyif alan, sosyal zekâsı yüksek biri.',
                  'Sahada aktif olmaktan çekinmeyen, inisiyatif alabilen biri.',
                  'Sorumluluk almaktan korkmayan, çözüm odaklı düşünen biri.',
                  'Dijital araçlara hâkim, raporlama yapabilen biri.',
                  'Ahenk\'in vizyonuna inanan, sosyal bağları güçlendirme misyonunu benimseyen biri.',
                  'Üniversite mezuniyeti veya aktif öğrencilik. İkisi de değerlendirmeye alınır.',
                ].map((item) => (
                  <li key={item} style={{ display: 'flex', gap: '0.75rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', flexShrink: 0, marginTop: '0.45rem' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '1.25rem', padding: '0.85rem 1.1rem', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px' }}>
                <p style={{ color: '#f4f1ec', fontSize: 13 }}>
                  Deneyim zorunlu değil. <strong>Doğru tutum her şeyin önünde.</strong>
                </p>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* ── Başvuru Formu ───────────────────────────────────── */}
        <FadeIn>
          <section ref={formRef} style={{ marginBottom: 'clamp(3.5rem,7vw,5.5rem)' }}>
            <h2 className="ll-title" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              Başvurunu Yap
            </h2>
            <p style={{ textAlign: 'center', color: '#a39c93', fontSize: 13, marginBottom: '2rem' }}>
              Formu doldurun, 3 iş günü içinde ekibimiz sizi arasın.
            </p>

            <div className="ll-card" style={{ maxWidth: '640px', margin: '0 auto' }}>
              {success ? (
                <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.6, times: [0, 0.6, 1] }}
                    style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.75rem', color: '#fff' }}>
                    ✓
                  </motion.div>
                  <h3 className="ll-title" style={{ marginBottom: '0.75rem' }}>Başvurun alındı!</h3>
                  <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.7 }}>
                    Seni inceliyoruz, en kısa sürede <strong style={{ color: '#f4f1ec' }}>geri döneceğiz.</strong>
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <TextField label="Ad Soyad *" value={form.fullName} onChange={(v) => set('fullName', v)} maxLength={120} required />
                  <TextField label="E-posta *" type="email" value={form.email} onChange={(v) => set('email', v)} required />
                  <VerifiedPhoneField base="/careers" phone={form.phone} onPhone={(v) => set('phone', v)} phoneToken={phoneToken} onToken={setPhoneToken} />
                  <SelectField label="Öğrenim Durumu *" value={form.education} options={EDUCATIONS} onChange={(v) => set('education', v)} required />

                  <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
                    <legend style={{ padding: 0 }}><FormLabel>Yabancı Dil *</FormLabel></legend>
                    <p className="ll-mono text-[11px] text-[#8f887f]" style={{ margin: '0 0 8px' }}>★ A1–A2 · ★★ B1–B2 · ★★★ C1–C2</p>
                    {LANGUAGES.map((name) => {
                      const on = name in languages;
                      return (
                        <div key={name} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-[13px] text-[#f4f1ec]">{name}</span>
                            <input type="checkbox" checked={on} onChange={() => toggleLanguage(name)} style={{ width: 18, height: 18, accentColor: '#c0392b' }} />
                          </label>
                          {on && (
                            <div className="flex gap-1" style={{ marginTop: 6 }} role="radiogroup" aria-label={`${name} seviyesi`}>
                              {[1, 2, 3].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  role="radio"
                                  aria-checked={languages[name] === n}
                                  aria-label={`${n} yıldız`}
                                  onClick={() => setLanguages((l) => ({ ...l, [name]: n }))}
                                  style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: languages[name] >= n ? '#ff3b30' : 'rgba(255,255,255,0.2)' }}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </fieldset>

                  <SelectField label="Çalışma Türü *" value={form.workType} options={WORK_TYPES} onChange={(v) => set('workType', v)} required />
                  <SelectField label="Ücret Beklentisi *" value={form.salaryExpectation} options={SALARIES} onChange={(v) => set('salaryExpectation', v)} required />
                  <DateField label="Doğum tarihi *" value={form.birthDate} onChange={(v) => set('birthDate', v)} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <SelectField label="Şehir *" value={form.city} options={cityNames} onChange={(v) => setForm((f) => ({ ...f, city: v, district: '' }))} required />
                    <div>
                      <FormLabel>İlçe *</FormLabel>
                      <SiteSelect live key={form.city} value={form.district} onChange={(v) => set('district', v)} options={districts[form.city] ?? []} placeholder={form.city ? 'İlçe seçin' : 'Önce şehir seçin'} required ariaLabel="İlçe" searchable searchPlaceholder="İlçe ara" />
                    </div>
                  </div>
                  <TextField label="LinkedIn (opsiyonel)" type="url" value={form.linkedinOrCv} onChange={(v) => set('linkedinOrCv', v)} placeholder="https://www.linkedin.com/in/…" maxLength={300} />

                  <div>
                    <FormLabel>Özgeçmiş (CV) * (PDF, DOC, DOCX, JPEG, PNG; en fazla 5 MB)</FormLabel>
                    <label className="input-glass px-4 py-3 text-[13px]" style={{ position: 'relative', display: 'block', cursor: 'pointer', color: cv ? '#f4f1ec' : '#ff6b6b', textAlign: 'center' }}>
                      {cv ? cv.name : '+ Dosya seç'}
                      <input type="file" accept={CV_ACCEPT} onChange={(e) => { pickCv(e.target.files?.[0]); e.target.value = ''; }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                    </label>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ff6b6b' }}>Resimsiz CV&apos;ler dikkate alınmamaktadır.</p>
                  </div>

                  <TextareaField label="Ben Ahenk'e şunları katabilirim: *" value={form.motivation} onChange={(v) => set('motivation', v)} maxLength={600} required rows={4} />
                  <SelectField label="Bizi nereden duydun (opsiyonel)" value={form.hearFrom} options={HEAR_FROM} onChange={(v) => set('hearFrom', v)} />
                  {form.hearFrom === 'Diğer' && (
                    <TextField label="Açıklama (opsiyonel)" value={form.hearFromOther} onChange={(v) => set('hearFromOther', v)} maxLength={200} />
                  )}

                  {error && <p style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</p>}

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
            <div className="ll-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
              <h3 className="ll-title" style={{ marginBottom: '1rem' }}>
                Hâlâ aklında sorular mı var?
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
                <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
                  bilgi@ahenk.co
                </a>
                <a href="tel:+905403060080" style={{ color: '#a39c93', fontSize: 13, textDecoration: 'none' }}>
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
          <p style={{ color: '#f4f1ec', fontSize: 13, fontWeight: 500 }}>© 2026 Ahenk. Tüm hakları saklıdır.</p>
          <p style={{ color: '#a39c93', fontSize: 13 }}>
            Ahenk bir{' '}
            <a href="https://ahenk.co" style={{ textDecoration: 'none' }}>
              <span style={{ color: '#f4f1ec', fontWeight: 600 }}>Traders</span>
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
              <Link key={link.href} href={link.href} style={{ color: '#8f887f', fontSize: 11, textDecoration: 'none' }}>{link.label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ── Form bileşenleri ─────────────────────────────────────────── */
function SelectField({ label, value, options, onChange, required }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div>
      <FormLabel>{label}</FormLabel>
      <SiteSelect live value={value} onChange={onChange} options={options} required={required} ariaLabel={label} />
    </div>
  );
}
