'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
/* ─── Veri ───────────────────────────────────────────────────────────────── */

const steps = [
  {
    n: '01',
    title: 'Profilini Oluştur',
    desc: 'Birkaç dakika ayır, kendini anlat. Şehrini seç, kim olduğunu ve ne aradığını bizimle paylaş. Kayıt tamamen ücretsiz, hiçbir şeyi senden saklamıyoruz.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Kişilik Testini Tamamla',
    desc: 'Psikoloji araştırmalarının altın standardı olan Big Five modeline dayalı 19 soruluk testimizi doldur. Doğru cevap yok — sadece sen varsın. Algoritma bu profili kullanarak seni gerçekten uyumlu insanlarla buluşturuyor.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Algoritma Senin İçin Çalışır',
    desc: 'Her Perşembe gece algoritmamız devreye girer. Kişilik uyumu, şehir, semt ve buluşma tercihlerin bir araya gelir. Rastgele değil, tam olarak sana göre.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    n: '04',
    title: 'Buluşma Zamanı',
    desc: 'Cumartesi sabahı masanı ve mekanını öğrenirsin. Akşam 20:00\'de kapıdan içeri girdiğinde, masandaki herkes seninle bir şekilde örtüşüyor. Gerisi sana kalmış.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
];

const cities = [
  { name: 'İstanbul' },
  { name: 'Ankara' },
  { name: 'İzmir' },
  { name: 'Antalya' },
  { name: 'Muğla' },
  { name: 'Aydın' },
  { name: 'Balıkesir', sub: 'Ayvalık / Akçay' },
];

const plans = [
  {
    name: 'Masada',
    price: '349',
    desc: 'Aylık grup buluşma hakkı',
    featured: false,
    bgImage: '/plan-masada.webp',
    features: ['1 masa buluşması', 'Kişilik eşleşmesi', 'Şehir içi etkinlikler'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    name: 'Karşımda',
    price: '449',
    desc: 'Tek kullanımlık başbaşa buluşma',
    featured: false,
    bgImage: '/plan-karsimda.webp',
    features: ['1 özel buluşma', 'Kişilik ve ilgi uyumu', 'Premium mekanlar'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    name: 'İçerde',
    price: '679',
    desc: '1 ay Masada + 1 Karşımda hakkı',
    featured: true,
    bgImage: '/plan-icerde.webp',
    features: ['1 grup + 1 özel buluşma', 'Kişilik ve ilgi uyumu', 'Öncelikli masa seçimi', 'Premium mekanlar'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

const faqs: { q: string; a: string }[] = [
  { q: 'Kim kimle eşleşiyor?', a: 'OCEAN kişilik testine göre uyumlu, aynı şehirde buluşmak isteyen kişiler.' },
  { q: 'Buluşmalar nerede yapılıyor?', a: 'Şehrinizde önceden seçilmiş kaliteli mekanlarda gerçekleşir.' },
  { q: 'Kayıt ücretli mi?', a: 'Kayıt ve kişilik testi tamamen ücretsizdir. Ödeme sadece buluşma paketleri için gereklidir.' },
  { q: 'İstediğim şehirde hizmet var mı?', a: 'İstanbul, Ankara, İzmir, Antalya, Muğla, Aydın, Balıkesir ve Konya\'da aktifiz.' },
  { q: 'Güvenlik nasıl sağlanıyor?', a: 'Tüm kullanıcılar kimlik doğrulamasından geçer.' },
];

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.607L5 14.5m14.8.5l.34 1.36a2.25 2.25 0 01-2.18 2.79H6.04a2.25 2.25 0 01-2.18-2.79L4.2 15" />
      </svg>
    ),
    title: 'Bilimsel Eşleştirme',
    desc: 'OCEAN kişilik testi ile uyumlu insanlarla tanış.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: 'Haftalık Buluşmalar',
    desc: 'Özenle planlanan grup ve başbaşa etkinlikler.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    title: 'Türkiye Odaklı',
    desc: 'Kendi şehrinde, gerçek insanlarla.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Güvenli ve Özenli',
    desc: 'Doğrulanmış profiller ve kontrollü katılım.',
  },
];

/* ─── Çift halka ─────────────────────────────────────────────────────────── */

function DualRings() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Kırmızı glow arka plan */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.18) 0%, transparent 65%)' }} />
      {/* Dönen logo */}
      <motion.div
        className="absolute"
        style={{ width: '32%', height: '32%', zIndex: 10 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0, rotate: 360 }}
        transition={{
          opacity: { delay: 0.4, duration: 0.6, ease: 'easeOut' },
          y: { delay: 0.4, duration: 0.6, ease: 'easeOut' },
          rotate: { duration: 8, repeat: Infinity, ease: 'linear', delay: 0 },
        }}
      >
        <Image src="/logo.webp" alt="Ahenk" fill className="object-contain" style={{ filter: 'drop-shadow(0 0 24px rgba(192,57,43,0.65))' }} />
      </motion.div>
    </div>
  );
}

/* ─── Red last word helper ───────────────────────────────────────────────── */
function RedLast({ text }: { text: string }) {
  const parts = text.trim().split(' ');
  const last = parts.pop();
  return (
    <>
      {parts.join(' ')}{parts.length > 0 ? ' ' : ''}
      <span style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{last}</span>
    </>
  );
}

/* ─── Ana bileşen ────────────────────────────────────────────────────────── */

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeCity, setActiveCity] = useState('İstanbul');

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] overflow-x-hidden">
      {/* Sayfa geneli kırmızı glow'lar */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div style={{ position: 'absolute', top: '10%', right: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.12) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '30%', left: '-10%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.08) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', top: '60%', right: '10%', width: '35vw', height: '35vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.07) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      </motion.div>

      <div className="relative" style={{ zIndex: 1 }}>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section id="hero" className="relative overflow-hidden pt-[52px]" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
          <div className="hero-bg absolute inset-0" />
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 55% 65% at 78% 50%, rgba(192,57,43,0.28) 0%, transparent 65%)' }} />

          <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-16 w-full py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="flex flex-col gap-5 lg:max-w-lg">
              <motion.span
                className="text-xs font-semibold tracking-[0.22em] text-[#888] uppercase"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.4, ease: 'easeOut' }}
              >
                Daha Anlamlı Buluşmalar İçin
              </motion.span>
              <div>
                <motion.h1
                  className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[0.9] tracking-tight text-[#f5f5f5] mb-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.45, ease: 'easeOut' }}
                >
                  Ahenk
                </motion.h1>
                <motion.p
                  className="font-sans text-lg sm:text-xl font-light leading-snug"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.45, ease: 'easeOut' }}
                >
                  <span className="text-[#f5f5f5]">Sana Uygun İnsanlarla,</span><br />
                  <span className="text-[#c0392b] font-normal">Gerçek Buluşmalar.</span>
                </motion.p>
              </div>
              <motion.p
                className="text-[#888] text-sm sm:text-base leading-relaxed"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.45, ease: 'easeOut' }}
              >
                OCEAN kişilik testine dayalı eşleştirme ile Türkiye'de her hafta özenle planlanan sosyal buluşmalara katıl.
              </motion.p>
              <motion.div
                className="flex flex-wrap items-center gap-4 pt-1"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.15, duration: 0.45, ease: 'easeOut' }}
              >
                <Link href="/kayit" className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-medium text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', boxShadow: '0 0 24px rgba(192,57,43,0.45)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = '')}>
                  Hemen Katıl
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>
                </Link>
                <a href="#how-it-works" className="inline-flex items-center gap-2.5 px-6 py-4 rounded-full text-sm text-[#888] hover:text-[#f5f5f5] transition-colors" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                  </span>
                  Nasıl Çalışır?
                </a>
              </motion.div>
            </div>

            <div className="flex items-center justify-center" style={{ height: '440px' }}>
              <DualRings />
            </div>
          </div>
        </section>

        {/* ── Özellikler şeridi ──────────────────────────────────────────── */}
        <section style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)', boxShadow: '0 0 18px rgba(192,57,43,0.45)' }}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#f5f5f5] mb-0.5">{f.title}</h3>
                  <p className="text-xs text-[#888] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Nasıl Çalışır ──────────────────────────────────────────────── */}
        <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-3">
              <RedLast text="Nasıl Çalışır?" />
            </h2>
            <p className="text-[#888] text-sm sm:text-base">Dört adımda, sana özel bir akşam.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {steps.map((s) => (
              <div
                key={s.n}
                className="relative rounded-2xl p-6 flex flex-col overflow-hidden"
                style={{
                  background: 'rgba(255,60,40,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
                  minHeight: 220,
                }}
              >
                {/* Sağ üst smoke efekti */}
                <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(192,57,43,0.25) 0%, transparent 65%)' }} />

                {/* Sağ üst ikon dairesi */}
                <div className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-[#c0392b]" style={{ border: '1px solid rgba(192,57,43,0.4)', background: 'rgba(192,57,43,0.08)' }}>
                  {s.icon}
                </div>

                {/* Numara */}
                <span className="font-serif text-5xl leading-none block mb-4 relative z-10" style={{ background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', filter: 'drop-shadow(0 0 12px rgba(192,57,43,0.6))' }}>
                  {s.n}
                </span>

                <h3 className="font-medium text-base text-[#f5f5f5] mb-2 relative z-10 pr-12">{s.title}</h3>
                <p className="text-[#888] text-sm leading-relaxed flex-1 relative z-10">{s.desc}</p>

                {/* Sağ alt ok butonu */}
                <div className="flex justify-end mt-5 relative z-10">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)' }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#888]">
                      <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Şehirler ───────────────────────────────────────────────────── */}
        <section id="cities" className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl sm:text-4xl mb-3 text-[#f5f5f5]">
              <RedLast text="Aktif Olduğumuz Şehirler" />
            </h2>
            <p className="text-[#888] text-sm">Aşağıdaki şehirlerde her hafta masalar kuruluyor.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {cities.map((city) => {
              const isActive = activeCity === city.name;
              return (
                <button
                  key={city.name}
                  type="button"
                  onClick={() => setActiveCity(city.name)}
                  className="px-5 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-1.5"
                  style={isActive ? {
                    border: '1px solid rgba(192,57,43,0.8)',
                    background: 'rgba(192,57,43,0.12)',
                    color: '#ff6b6b',
                    boxShadow: '0 0 16px rgba(192,57,43,0.3)',
                  } : {
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#aaa',
                  }}
                >
                  {isActive && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                      <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-sm">{city.name}</span>
                    {city.sub && (
                      <span className="text-[10px] font-normal opacity-60 tracking-wide">{city.sub}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Paketler ───────────────────────────────────────────────────── */}
        <section id="pricing" className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5]">
              <RedLast text="Paketler" />
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-2xl flex flex-col overflow-hidden"
                style={plan.featured ? {
                  border: '1px solid rgba(192,57,43,0.5)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5), 0 0 32px rgba(192,57,43,0.2)',
                } : {
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                {/* Arka plan görseli */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${plan.bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                {/* Karartma katmanı */}
                <div className="absolute inset-0" style={{
                  background: plan.featured
                    ? 'linear-gradient(160deg, rgba(120,20,10,0.45) 0%, rgba(10,5,5,0.85) 55%)'
                    : 'linear-gradient(160deg, rgba(80,15,10,0.35) 0%, rgba(10,5,5,0.85) 55%)',
                }} />
                {/* Sağ üst smoke */}
                {plan.featured ? (
                  <motion.div
                    className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at top right, rgba(192,57,43,0.45) 0%, transparent 65%)' }}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : (
                  <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(192,57,43,0.3) 0%, transparent 65%)' }} />
                )}

                {plan.featured && (
                  <>
                    <style>{`
                      @keyframes _rotGrad{to{transform:rotate(360deg)}}
                      .tercih-badge::before{content:'';position:absolute;inset:-1.5px;border-radius:9999px;background:conic-gradient(#c0392b,#ff6b6b,#e74c3c,#c0392b);animation:_rotGrad 3s linear infinite;z-index:-1;}
                    `}</style>
                    <span
                      className="tercih-badge absolute top-4 right-4 z-10 px-3 py-1 text-xs font-semibold rounded-full text-white"
                      style={{ background: '#0a0a0a' }}
                    >
                      Tercih Edilen
                    </span>
                  </>
                )}

                <div className="relative z-10 p-7 flex flex-col gap-4 flex-1">

                  <div>
                    <h3 className="font-serif text-2xl text-[#f5f5f5] mb-2">{plan.name}</h3>
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-4xl font-bold text-[#f5f5f5]">{plan.price}</span>
                      <span className="text-lg text-[#888] mb-1">₺</span>
                    </div>
                    <p className="text-[#888] text-sm">{plan.desc}</p>
                  </div>

                  {/* Feature list */}
                  <ul className="flex flex-col gap-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#ccc]">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color: '#c0392b' }}>
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    className="mt-2 w-full py-3 rounded-xl text-sm font-medium transition-all duration-200"
                    style={plan.featured ? {
                      background: 'linear-gradient(90deg, #c0392b 0%, #e74c3c 100%)',
                      color: '#fff',
                      boxShadow: '0 4px 16px rgba(192,57,43,0.4)',
                    } : {
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#aaa',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                    onMouseEnter={e => { if (!plan.featured) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(192,57,43,0.5)'; (e.currentTarget as HTMLElement).style.color = '#ff6b6b'; } }}
                    onMouseLeave={e => { if (!plan.featured) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.color = '#aaa'; } }}
                  >
                    Paketi Seç
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SSS ────────────────────────────────────────────────────────── */}
        <section id="faq" className="max-w-2xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5]">
              <RedLast text="Sık Sorulan Sorular" />
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: openFaq === i ? 'rgba(255,60,40,0.08)' : 'rgba(255,60,40,0.06)',
                  border: openFaq === i ? '1px solid rgba(192,57,43,0.35)' : '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <button className="w-full text-left px-6 py-5 flex items-center justify-between gap-4" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="font-medium text-sm sm:text-base text-[#f5f5f5]">{faq.q}</span>
                  <span className="text-xl flex-shrink-0 transition-transform duration-200" style={{ color: openFaq === i ? '#c0392b' : '#888', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm leading-relaxed" style={{ color: '#aaa', borderTop: '1px solid rgba(192,57,43,0.15)' }}>
                    <p className="pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
