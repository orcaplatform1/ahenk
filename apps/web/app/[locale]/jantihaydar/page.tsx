'use client';

import { useTranslations } from 'next-intl';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import SiteSelect from '@/components/SiteSelect';
import { FormLabel, VerifiedPhoneField } from '@/components/PublicFormFields';
import { API_PREFIX, langHeaders } from '@/lib/api';
import { readError } from '@/lib/venueApi';
import { detectFileKind } from '@/lib/imageType';

// Renkler sitenin Canlı Katman paletinden (globals.css --ll-*)
const C = {
  text: '#f4f1ec', text2: '#c9c2b8', label: '#a39c93', time: '#8f887f',
  red: '#d6453a', red2: '#ff6b5e', copper: '#e8a27a',
  line: 'rgba(255,255,255,0.08)', field: 'rgba(255,255,255,0.025)',
};

const WHY: [string, string][] = [
  ['Reklam gibi değil, hikâye gibi', "Takipçiler Haydar'ı izlemek için durur. Ürünün bir skecin içinde doğal olarak yer alır; kaydırılıp geçilen bir reklam değil, sonuna kadar izlenen bir içerik olur."],
  ['Akılda kalan bir yüz', "Bir karakterle anılan marka unutulmaz. Haydar'ın tanıttığı ürün, izleyicinin zihninde onun esprisiyle birlikte kalır."],
  ['Paylaşılan içerik', 'Mizah paylaşılır. Videon arkadaşa gönderilir, hikâyede yeniden paylaşılır; erişimin satın aldığın kitlenin ötesine geçer.'],
  ['Sana özel üretim', 'Her animasyon markan için sıfırdan çizilir ve kurgulanır. Hazır şablon yok, kopya içerik yok.'],
  ['Her ölçeğe uygun', 'Mahalle kafesinden ulusal markaya, butik işletmeden bireysel girişimciye kadar herkes için ölçülü bir format.'],
];

const FORMATS: [string, string][] = [
  ['Post Animasyonu', 'Profilinde kalıcı, şık ve keşfette öne çıkan tanıtım.'],
  ['Story Animasyonu', 'Kısa, hızlı, doğrudan bağlantıya yönlendiren etki.'],
  ['Reels Animasyonu', 'En geniş erişim; yeni kitlelere ulaşan, izlenme odaklı içerik.'],
];

const STORY: [string, string][] = [
  ['Ekibe ait', 'Fikirden finale her şeyi biz üstleniriz.'],
  ['Bana ait', "Senaryon hazırsa Haydar'ın diliyle hayata geçiririz."],
  ['Ortak çalışma', 'Fikri birlikte şekillendiririz.'],
];

const STEPS = ['Teklif formunu doldur', "Ekibimiz WhatsApp'tan sana ulaşsın", 'Senaryo onayı', 'Üretim ve yayın.'];

// Görünen metinler: jh.x<n> anahtarları (gönderilen değerler Türkçe kalır; backend bunları doğrular)
const JH_KEYS: Record<string, string> = {"Reklam gibi değil, hikâye gibi": "jh.x0", "Takipçiler Haydar'ı izlemek için durur. Ürünün bir skecin içinde doğal olarak yer alır; kaydırılıp geçilen bir reklam değil, sonuna kadar izlenen bir içerik olur.": "jh.x1", "Akılda kalan bir yüz": "jh.x2", "Bir karakterle anılan marka unutulmaz. Haydar'ın tanıttığı ürün, izleyicinin zihninde onun esprisiyle birlikte kalır.": "jh.x3", "Paylaşılan içerik": "jh.x4", "Mizah paylaşılır. Videon arkadaşa gönderilir, hikâyede yeniden paylaşılır; erişimin satın aldığın kitlenin ötesine geçer.": "jh.x5", "Sana özel üretim": "jh.x6", "Her animasyon markan için sıfırdan çizilir ve kurgulanır. Hazır şablon yok, kopya içerik yok.": "jh.x7", "Her ölçeğe uygun": "jh.x8", "Mahalle kafesinden ulusal markaya, butik işletmeden bireysel girişimciye kadar herkes için ölçülü bir format.": "jh.x9", "Post Animasyonu": "jh.x10", "Profilinde kalıcı, şık ve keşfette öne çıkan tanıtım.": "jh.x11", "Story Animasyonu": "jh.x12", "Kısa, hızlı, doğrudan bağlantıya yönlendiren etki.": "jh.x13", "Reels Animasyonu": "jh.x14", "En geniş erişim; yeni kitlelere ulaşan, izlenme odaklı içerik.": "jh.x15", "Ekibe ait": "jh.x16", "Fikirden finale her şeyi biz üstleniriz.": "jh.x17", "Bana ait": "jh.x18", "Senaryon hazırsa Haydar'ın diliyle hayata geçiririz.": "jh.x19", "Ortak çalışma": "jh.x20", "Fikri birlikte şekillendiririz.": "jh.x21", "Teklif formunu doldur": "jh.x22", "Ekibimiz WhatsApp'tan sana ulaşsın": "jh.x23", "Senaryo onayı": "jh.x24", "Üretim ve yayın.": "jh.x25"};
const AD_TYPES = FORMATS.map(([t]) => t);
const STORY_OWNERS = STORY.map(([t]) => t);

// Dosya kuralları (sunucuyla aynı): en fazla 3 dosya, toplam en fazla 10 MB; tür dosyanın ilk baytlarına göre (lib/imageType).
// capture özniteliği yok: iPhone'da galeri, kamera ve dosyalar birlikte sunulur. Görseller sunucuda WebP'ye çevrilir.
const MAX_FILES = 3;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.avif,.bmp,.tif,.tiff,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,image/avif,image/bmp,image/tiff,application/pdf';

function fmtSize(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
function fmtNum(n: number) {
  return n.toLocaleString('tr-TR');
}

interface InstagramStats {
  username: string | null; followers: number | null; posts: number | null;
  reach: number | null; views: number | null; interactions: number | null; accountsEngaged: number | null;
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, delay, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <h2 className="ll-title" style={{ marginBottom: 14 }}>{children}</h2>;
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="ll-card" style={{ height: '100%' }}>
      <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: C.text }}>{title}</p>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: C.label }}>{text}</p>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="ll-metric" style={{ textAlign: 'center' }}>
      <p className="ll-mono" style={{ margin: 0, fontSize: 20, fontWeight: 600, color: C.text }}>{fmtNum(value)}</p>
      <p className="ll-note" style={{ margin: '4px 0 0', whiteSpace: 'normal' }}>{label}</p>
    </div>
  );
}

export default function JantiHaydarPage() {
  const t = useTranslations();
  const [stats, setStats] = useState<InstagramStats | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [adTypes, setAdTypes] = useState<string[]>([]);
  const [storyOwner, setStoryOwner] = useState('');
  const [websiteOrSocial, setWebsiteOrSocial] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [company, setCompany] = useState(''); // bal küpü
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_PREFIX}/janti-haydar/instagram`, { headers: langHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { stats: InstagramStats | null } | null) => setStats(d?.stats ?? null))
      .catch(() => setStats(null));
  }, []);

  function toggleAdType(t: string) {
    setAdTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    if (files.length + picked.length > MAX_FILES) { setError(t('jh.max3')); return; }
    const total = [...files, ...picked].reduce((s, f) => s + f.size, 0);
    if (total > MAX_TOTAL_BYTES) { setError(t('jh.tooBig')); return; }
    for (const f of picked) {
      if (!(await detectFileKind(f))) { setError(t('jh.badType')); return; }
    }
    setError('');
    setFiles((p) => [...p, ...picked]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Ad soyad girin.'); return; }
    if (!phoneToken) { setError(t('jh.verifyPhone')); return; }
    if (adTypes.length === 0) { setError(t('jh.pickAd')); return; }
    if (!storyOwner) { setError(t('jh.pickStory')); return; }
    if (files.length > MAX_FILES || files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) { setError(t('jh.tooBig')); return; }
    setSubmitting(true); setError('');
    try {
      const body = new FormData();
      body.append('fullName', fullName.trim());
      body.append('phone', `+90${phone}`);
      body.append('phoneToken', phoneToken);
      adTypes.forEach((t) => body.append('adTypes', t));
      body.append('storyOwner', storyOwner);
      if (websiteOrSocial.trim()) body.append('websiteOrSocial', websiteOrSocial.trim());
      body.append('message', message.trim());
      if (company) body.append('company', company);
      files.forEach((f) => body.append('files', f));
      const res = await fetch(`${API_PREFIX}/janti-haydar/apply`, { method: 'POST', body, headers: langHeaders() });
      if (!res.ok) throw new Error(await readError(res));
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || t('jh.error'));
    } finally {
      setSubmitting(false);
    }
  }

  const statTiles: [string, number | null][] = stats ? [
    [t('jh.followers'), stats.followers],
    [t('jh.posts'), stats.posts],
    [t('jh.reach'), stats.reach],
    [t('jh.views'), stats.views],
    [t('jh.interactions'), stats.interactions],
    [t('jh.engaged'), stats.accountsEngaged],
  ] : [];
  const visibleTiles = statTiles.filter(([, v]) => typeof v === 'number') as [string, number][];

  return (
    <main className="live-layer ll-form" style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        .jh-wrap { max-width: 980px; margin: 0 auto; padding: 0 16px; }
        .jh-hero { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 32px; align-items: center; padding: clamp(4.5rem, 10vw, 7rem) 0 clamp(2.5rem, 6vw, 4rem); }
        .jh-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
        .jh-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .jh-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .jh-section { padding: clamp(1.5rem, 4vw, 2.5rem) 0; }
        .jh-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .jh-step { padding: 8px 14px; border-radius: 9999px; border: 1px solid rgba(232,162,122,0.3); background: rgba(232,162,122,0.06); color: ${C.text}; font-size: 13px; }
        .jh-arrow { color: ${C.copper}; font-size: 14px; }
        .jh-choice { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 12px 14px; border-radius: 12px; cursor: pointer;
          background: ${C.field}; border: 1px solid ${C.line}; color: ${C.text2}; font-size: 13px; transition: border-color .2s, background .2s, box-shadow .2s; }
        .jh-choice:hover { border-color: rgba(255,107,94,0.35); }
        .jh-choice[aria-pressed="true"] { border-color: ${C.red2}; background: rgba(214,69,58,0.10); color: ${C.text}; box-shadow: 0 0 14px rgba(255,107,94,0.18); }
        .jh-check { flex-shrink: 0; width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,0.25); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; transition: all .2s; }
        .jh-choice[aria-pressed="true"] .jh-check { border-color: ${C.red2}; background: linear-gradient(135deg, ${C.red} 0%, ${C.red2} 100%); }
        .jh-textarea { width: 100%; box-sizing: border-box; display: block; resize: vertical; }
        .jh-drop { position: relative; display: flex; align-items: center; justify-content: center; min-height: 48px; cursor: pointer; border-radius: 12px;
          border: 1px dashed rgba(255,107,94,0.4); background: ${C.field}; color: ${C.red2}; font-size: 13px; }
        .jh-drop:focus-within { border-color: ${C.red2}; box-shadow: 0 0 0 3px rgba(255,107,94,0.15); }
        .jh-file { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid ${C.line}; background: ${C.field}; font-size: 12.5px; min-width: 0; }
        .jh-btn { position: relative; overflow: hidden; width: 100%; padding: 15px 0; border: 1px solid rgba(110,231,160,0.45); border-radius: 9999px; cursor: pointer;
          background: linear-gradient(135deg, #0f6b3a 0%, #1f9d55 45%, #2fbf71 100%); color: #f4fff8; font-size: 15px; font-weight: 700; letter-spacing: .02em;
          box-shadow: 0 8px 28px rgba(31,157,85,0.35), inset 0 1px 0 rgba(255,255,255,0.25); transition: transform .2s, box-shadow .2s, filter .2s; }
        .jh-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 34px rgba(31,157,85,0.5), inset 0 1px 0 rgba(255,255,255,0.3); filter: brightness(1.05); }
        .jh-btn:active:not(:disabled) { transform: translateY(0); }
        .jh-btn:disabled { opacity: .7; cursor: not-allowed; }
        .jh-btn::after { content: ''; position: absolute; top: 0; left: -60%; width: 45%; height: 100%; pointer-events: none;
          background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%); transform: skewX(-20deg); animation: jh-shine 2.8s ease-in-out infinite; }
        @keyframes jh-shine { 0% { left: -60%; } 55%, 100% { left: 130%; } }
        .jh-honey { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
        @media (max-width: 760px) {
          .jh-hero { grid-template-columns: 1fr; gap: 20px; text-align: center; }
          .jh-hero-img { width: 100%; max-width: min(260px, 100%); margin: 0 auto; }
          .jh-grid-3 { grid-template-columns: 1fr; }
          .jh-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (prefers-reduced-motion: reduce) { .jh-btn::after { animation: none; display: none; } }
      `}</style>

      <div className="jh-wrap">
        {/* Hero */}
        <section className="jh-hero">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(2.1rem, 5.5vw, 3.4rem)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 1rem' }}
            >
              {t('jh.hero1')}
              <br />
              {t('jh.hero2')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
              style={{ color: C.label, fontSize: 'clamp(1rem, 2vw, 1.12rem)', lineHeight: 1.7, margin: 0 }}
            >
              {t('jh.intro')}
            </motion.p>
          </div>
          <motion.div className="jh-hero-img" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
            {/* Transparan görsel: optimizasyon kapalı (dosya olduğu gibi sunulur, görsel önbelleğine girmez); kırpma yok, oran korunur */}
            <Image src="/maskot/jantihaydar_ads_v2.webp" alt="Janti Haydar" width={960} height={1639} priority unoptimized
              style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%', objectFit: 'contain', background: 'transparent', border: 'none', boxShadow: 'none', borderRadius: 0 }} />
          </motion.div>
        </section>

        {/* Instagram istatistikleri: yalnızca veri varsa */}
        {visibleTiles.length > 0 && (
          <FadeIn>
            <section className="jh-section">
              <div className="ll-card">
                <div className="ll-head">
                  <h2 className="ll-title">Instagram</h2>
                  {stats?.username && <span className="ll-note">@{stats.username}</span>}
                </div>
                <div className="jh-stats">
                  {visibleTiles.map(([label, value]) => <StatTile key={label} label={label} value={value} />)}
                </div>
              </div>
            </section>
          </FadeIn>
        )}

        {/* Neden Janti Haydar? */}
        <section className="jh-section">
          <FadeIn><SectionHead>{t('jh.why')}</SectionHead></FadeIn>
          <div className="jh-grid">
            {WHY.map(([a, d], i) => <FadeIn key={a} delay={i * 0.05}><InfoCard title={t(JH_KEYS[a])} text={t(JH_KEYS[d])} /></FadeIn>)}
          </div>
        </section>

        {/* Formatlar */}
        <section className="jh-section">
          <FadeIn><SectionHead>{t('jh.formats')}</SectionHead></FadeIn>
          <div className="jh-grid-3">
            {FORMATS.map(([a, d], i) => <FadeIn key={a} delay={i * 0.05}><InfoCard title={t(JH_KEYS[a])} text={t(JH_KEYS[d])} /></FadeIn>)}
          </div>
        </section>

        {/* Kurgu Seçenekleri */}
        <section className="jh-section">
          <FadeIn><SectionHead>{t('jh.storyOptions')}</SectionHead></FadeIn>
          <div className="jh-grid-3">
            {STORY.map(([a, d], i) => <FadeIn key={a} delay={i * 0.05}><InfoCard title={t(JH_KEYS[a])} text={t(JH_KEYS[d])} /></FadeIn>)}
          </div>
        </section>

        {/* Süreç */}
        <section className="jh-section">
          <FadeIn>
            <SectionHead>{t('jh.process')}</SectionHead>
            <div className="ll-card">
              <div className="jh-steps">
                {STEPS.map((s, i) => (
                  <span key={s} style={{ display: 'contents' }}>
                    <span className="jh-step">{t(JH_KEYS[s])}</span>
                    {i < STEPS.length - 1 && <span className="jh-arrow" aria-hidden>→</span>}
                  </span>
                ))}
              </div>
            </div>
          </FadeIn>
        </section>

        {/* Teklif formu */}
        <section className="jh-section" style={{ paddingBottom: 'clamp(3rem, 8vw, 5rem)' }}>
          <FadeIn>
            <h2 className="ll-title" style={{ textAlign: 'center', marginBottom: 6 }}>{t('jh.formTitle')}</h2>
            <p style={{ textAlign: 'center', color: C.label, fontSize: 13, margin: '0 0 1.75rem' }}>
              {t('jh.formSub')}
            </p>
            <div className="ll-card" style={{ maxWidth: 680, margin: '0 auto' }}>
              {success ? (
                <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.6, times: [0, 0.6, 1] }}
                    style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #0f6b3a 0%, #2fbf71 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.75rem', color: '#fff' }}
                  >
                    ✓
                  </motion.div>
                  <p style={{ color: C.text, fontSize: 15, lineHeight: 1.65, margin: 0 }}>
                    {t('jh.received')}
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', position: 'relative' }}>
                  {/* Bal küpü (gizli) */}
                  <div className="jh-honey" aria-hidden>
                    <label>{t('jh.company')}<input type="text" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} /></label>
                  </div>

                  <label className="block">
                    <FormLabel>{t('jh.name')}</FormLabel>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} className="input-glass px-4 py-3 text-[13px]" />
                  </label>

                  <VerifiedPhoneField base="/janti-haydar" phone={phone} onPhone={setPhone} phoneToken={phoneToken} onToken={setPhoneToken} />

                  <div>
                    <FormLabel>{t('jh.adType')}</FormLabel>
                    <div className="jh-grid-3" role="group" aria-label={t('jh.adTypeAria')}>
                      {AD_TYPES.map((ad) => {
                        const on = adTypes.includes(ad);
                        return (
                          <button key={ad} type="button" className="jh-choice" aria-pressed={on} onClick={() => toggleAdType(ad)}>
                            <span className="jh-check">{on ? '✓' : ''}</span>
                            <span>{t(JH_KEYS[ad])}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <FormLabel>{t('jh.story')}</FormLabel>
                    <SiteSelect live value={storyOwner} onChange={setStoryOwner} options={STORY_OWNERS.map((o) => ({ value: o, label: t(JH_KEYS[o]) }))} placeholder={t('select.placeholder')} required ariaLabel={t('jh.storyLabelPlain')} />
                  </div>

                  <label className="block">
                    <FormLabel>{t('jh.site')}</FormLabel>
                    <input type="text" value={websiteOrSocial} onChange={(e) => setWebsiteOrSocial(e.target.value)} maxLength={300} className="input-glass px-4 py-3 text-[13px]" />
                  </label>

                  <label className="block">
                    <FormLabel>{t('jh.message')}</FormLabel>
                    <span className="block text-xs text-[#a39c93] mb-2">{t('jh.messageHint')}</span>
                    <textarea
                      value={message} onChange={(e) => setMessage(e.target.value)} required minLength={20} maxLength={300} rows={4}
                      className="input-glass px-4 py-3 text-[13px] jh-textarea"
                    />
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <FormLabel>{t('jh.upload')}</FormLabel>
                    <span className="text-xs text-[#a39c93]" style={{ marginTop: -4 }}>{t('jh.fileHint')}</span>
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="jh-file">
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text2 }}>{f.name}</span>
                        <span className="ll-mono" style={{ fontSize: 11, color: C.time, flexShrink: 0 }}>{fmtSize(f.size)}</span>
                        <button type="button" aria-label={t('jh.removeFile', { name: f.name })} onClick={() => setFiles((p) => p.filter((_, k) => k !== i))}
                          style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: `1px solid ${C.line}`, background: 'rgba(0,0,0,0.4)', color: C.text, cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                    {files.length < MAX_FILES && (
                      <label className="jh-drop">
                        + Dosya ekle
                        <input type="file" accept={ACCEPT} multiple onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }}
                          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                      </label>
                    )}
                  </div>

                  {error && <p style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', margin: 0 }}>{error}</p>}

                  <button type="submit" disabled={submitting} className="jh-btn">
                    {submitting ? t('jh.sending') : t('jh.getQuote')}
                  </button>
                </form>
              )}
            </div>
          </FadeIn>
        </section>
      </div>
    </main>
  );
}
