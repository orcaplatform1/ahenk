'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
/* ─── Veri ───────────────────────────────────────────────────────────────── */


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
function AccordionGroup({ items }: { items: { title: string; body: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-col" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between py-5 text-left"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}
          >
            <span className="text-[15px] font-medium pr-4" style={{
              background: open === i ? 'linear-gradient(135deg,#c0392b,#ff6b6b)' : 'none',
              WebkitBackgroundClip: open === i ? 'text' : 'unset',
              WebkitTextFillColor: open === i ? 'transparent' : '#e8e8e8',
              backgroundClip: open === i ? 'text' : 'unset',
            }}>{item.title}</span>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}
              className="flex-shrink-0 w-4 h-4 transition-transform duration-200"
              style={{ color: '#555', transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open === i && (
            <p className="text-sm leading-relaxed pb-5" style={{ color: '#888' }}>{item.body}</p>
          )}
        </div>
      ))}
    </div>
  );
}

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

/* ─── Kart durum yardımcısı ──────────────────────────────────────────────── */

type ActivePlan = 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;

function getPlanCardState(cardKey: string, activePlan: ActivePlan) {
  if (!activePlan) return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
  if (activePlan === 'ICERDE') {
    return { dimmed: true, badge: 'Bu paketin tüm özelliklerine sahipsiniz.', badgeRed: false, showButton: false };
  }
  if (activePlan === 'MASADA') {
    if (cardKey === 'MASADA') return { dimmed: true, badge: 'Aktif Paketiniz', badgeRed: true, showButton: false };
    if (cardKey === 'KARSIMDA') return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
    return { dimmed: true, badge: 'Bu paketin özelliğinden birine zaten sahipsiniz.', badgeRed: false, showButton: false };
  }
  if (activePlan === 'KARSIMDA') {
    if (cardKey === 'KARSIMDA') return { dimmed: true, badge: 'Aktif Paketiniz', badgeRed: true, showButton: false };
    if (cardKey === 'MASADA') return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
    return { dimmed: true, badge: 'Bu paketin özelliğinden birine zaten sahipsiniz.', badgeRed: false, showButton: false };
  }
  return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
}

/* ─── Ana bileşen ────────────────────────────────────────────────────────── */

export default function Home() {
  const router = useRouter();
  const [activeCity, setActiveCity] = useState('İstanbul');
  const [activePlan, setActivePlan] = useState<ActivePlan>(null);
  const [authState, setAuthState] = useState<{ loggedIn: boolean; kycApproved: boolean } | null>(null);

  useEffect(() => {
    api.silentGet<{ activePlan: ActivePlan; isKycVerified?: boolean }>('/auth/me').then((d) => {
      if (d) {
        if (d.activePlan) setActivePlan(d.activePlan);
        setAuthState({ loggedIn: true, kycApproved: !!d.isKycVerified });
      } else {
        setAuthState({ loggedIn: false, kycApproved: false });
      }
    });
  }, []);

  function handlePlanSelect(planKey: string) {
    if (!authState?.loggedIn) {
      router.push('/giris');
      return;
    }
    if (!authState.kycApproved) {
      router.push('/profil');
      return;
    }
    // Giriş yapmış + KYC onaylı → profil paket sekmesine
    router.push('/profil');
  }

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
                <a href="#how-it-knows-you" className="inline-flex items-center gap-2.5 px-6 py-4 rounded-full text-sm text-[#888] hover:text-[#f5f5f5] transition-colors" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
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
                  <span className="flex flex-col items-center leading-tight">
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

        {/* ── Ahenk Seni Nasıl Tanır? ────────────────────────────────────── */}
        <section id="how-it-knows-you" className="max-w-3xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-3">
              <RedLast text="Ahenk Seni Nasıl Tanır?" />
            </h2>
            <p className="text-sm text-[#555]">Bilimsel eşleştirmenin arkasındaki sistem.</p>
          </div>
          <AccordionGroup items={[
            {
              title: 'Bir test değil, bir profil.',
              body: 'Ahenk\'e katılmadan önce doldurduğun sorular sıradan bir anket değil. Her cevap, seni tanımlamak için tasarlanmış bir sinyal. Düşünce tarzın, sosyal enerjin, masada üstlendiğin rol, mekân tercihin hepsi birleşerek sana özgü bir profil oluşturuyor.',
            },
            {
              title: 'OCEAN modeli nedir?',
              body: 'Eşleştirme motorumuz, psikoloji araştırmalarının altın standardı olan OCEAN (Big Five) modelini kullanır. 1980\'lerden bu yana milyonlarca kişi üzerinde doğrulanmış bu model; kişiliğin beş temel boyutunu ölçer: Açıklık, Özdisiplin, Dışadönüklük, Uyumluluk ve Duygusal Denge. Bunlar bir kutup değil, birer spektrum ve senin yerinle başkasının yeri asla aynı değil.',
            },
            {
              title: 'Algoritma ne yapıyor?',
              body: 'Profilini oluşturduktan sonra algoritma devreye girer. Seni sadece sana benzer insanlarla değil, seninle gerçek bir ahenk kurabilecek insanlarla eşleştirir. Meslek alanın, yaşın ve mekan tercihin de hesaba katılır ama bunlar yardımcı faktörler. Asıl ağırlık kişilik uyumunda.',
            },
            {
              title: 'Masa nasıl kurulur?',
              body: 'Her hafta belirli bir gün eşleşmeler kapanır. Algoritma o ana kadar biriken profilleri değerlendirir, en yüksek uyum skoruna sahip grupları veya iki kişiyi bir araya getirir ve masayı kurar. Sen sadece onayı beklersin.',
            },
            {
              title: 'Buluşma sonrası ne olur?',
              body: 'Her buluşmanın ardından Ahenk, masa hakkında kısa bir yapay zeka raporu oluşturur. Grubun genel uyum skoru, öne çıkan kişilik dinamikleri ve masa enerjisi hakkında bir özet; sadece senin için, sadece o akşam için.',
            },
            {
              title: 'Başbaşa buluşmalar farklı mı?',
              body: 'Grup masalarında ahenk aranır, başbaşa buluşmalarda ise derinlik. İki kişilik eşleşmelerde algoritma çok daha hassas çalışır: yaş uyumu, kişilik dengesi ve beklenti örtüşmesi ön plana çıkar. Karşındaki kişi rastgele değil, seninle birebir örtüşen biri.',
            },
            {
              title: '180 günde bir yenilenir.',
              body: 'Kişilik sabit, ama bağlam değişir. Bu yüzden OCEAN profilin 180 günde bir güncellenir; o dönemki sen, o dönemki ahenginle buluşur.',
            },
          ]} />
        </section>

        {/* ── Neden Rahat Hissedersin? ────────────────────────────────────── */}
        <section id="why-safe" className="max-w-3xl mx-auto px-6 py-24" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-3">
              <RedLast text="Neden Rahat Hissedersin?" />
            </h2>
            <p className="text-sm text-[#555]">Güvenli, doğrulanmış, kontrollü.</p>
          </div>
          <AccordionGroup items={[
            {
              title: 'Yabancıyla tanışmak bu kadar zor mu olmalı?',
              body: 'Bir arkadaşının arkadaşıyla tanışırsın; sormadan, araştırmadan, sadece güvenirsin. Ahenk tam bunu yapıyor. Aramana gerek yok, seçmene gerek yok. Algoritma seçer, sen sadece gelirsin.',
            },
            {
              title: 'Kim olduğunu biliyoruz.',
              body: 'Platforma katılmak için telefon numaranı doğruluyor, kimliğin kontrol ediliyor ve kısa bir video doğrulaması yapılıyor. Masanda oturan herkes aynı süreçten geçti. Anonim hesap yok, sahte profil yok.',
            },
            {
              title: 'Nerede buluşuyorsunuz?',
              body: 'Her buluşma şehrindeki restoran ve kafelerden gerçekleşir. Kişilik profiline ve mekan tercihine göre o haftaki buluşma yeri belirlenir. Adres ve saat bilgisi buluşmadan önce sana iletilir. Özel bir anlaşma veya ekstra ücret yok; sadece kendi hesabını ödersin.',
            },
            {
              title: 'Yalnız değilsin.',
              body: 'Grup masaları 5-6 kişiden oluşuyor. Başbaşa buluşmalarda ise eşleşme çift yönlü onaylanmış; karşındaki kişi de aynı süreci tamamlamış, aynı şartları kabul etmiş biri.',
            },
            {
              title: 'Kimseyi tanımak zorunda değilsin.',
              body: 'Masadaki diğer kişilerin soyadını, mesleğini, yaşını önceden göremezsin; onlar da seninkini göremez. Buluşma anında tanışırsınız. Bu hem heyecan hem de eşitlik demek.',
            },
            {
              title: 'Bir sorun olursa?',
              body: 'Buluşma sonrası değerlendirme sistemi var. Bir daha eşleşmek istemediğin biri varsa belirtirsin; bir daha o kişiyle asla karşılaşmazsın. Ciddi bir durum bildirirsen kürasyon ekibimiz devreye girerek inceler ve o kişinin hesabı süresiz yasaklanır, tekrar kayıt yapmasına bir daha izin verilmez.',
            },
          ]} />
        </section>

        {/* ── Paketler ───────────────────────────────────────────────────── */}
        <section id="pricing" className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5]">
              <RedLast text="Paketler" />
            </h2>
          </div>
          <style>{`
            @keyframes _cardGoldBorder{to{transform:rotate(360deg)}}
            .lp-feat-wrap{position:relative;border-radius:18px;padding:2px;overflow:hidden;}
            .lp-feat-wrap::before{content:'';position:absolute;inset:-60%;background:conic-gradient(from 0deg,transparent 68%,#c9a227 78%,#e8c84a 84%,transparent 93%);animation:_cardGoldBorder 3s linear infinite;z-index:0;}
            .lp-feat-inner{position:relative;z-index:1;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;}
          `}</style>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const cardKey = plan.name === 'Masada' ? 'MASADA' : plan.name === 'Karşımda' ? 'KARSIMDA' : 'ICERDE';
              const cs = getPlanCardState(cardKey, activePlan);
              const inner = (
                <div
                  className={plan.featured ? 'lp-feat-inner flex-1' : 'relative rounded-2xl flex flex-col overflow-hidden flex-1'}
                  style={{
                    ...((!plan.featured) ? {
                      border: '1px solid rgba(255,255,255,0.12)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
                    } : {}),
                    ...(cs.dimmed ? { opacity: 0.45, pointerEvents: 'none' as const } : {}),
                  }}
                >
                  <div className="absolute inset-0" style={{ backgroundImage: `url(${plan.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  {plan.featured && (
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,5,5,0.92) 0%, rgba(10,5,5,0.55) 40%, rgba(10,5,5,0.08) 100%)' }} />
                  )}
                  {plan.featured && !cs.badge && (
                    <span className="absolute top-4 right-4 z-10 px-3 py-1 text-xs font-semibold rounded-full text-white"
                      style={{ background: 'rgba(10,5,5,0.7)', border: '1px solid rgba(255,255,255,0.18)' }}>
                      Tercih Edilen
                    </span>
                  )}
                  {cs.badge && (
                    <span className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap"
                      style={cs.badgeRed
                        ? { background: 'rgba(192,57,43,0.85)', color: '#fff', border: '1px solid rgba(192,57,43,0.6)' }
                        : { background: 'rgba(40,40,40,0.85)', color: '#aaa', border: '1px solid rgba(255,255,255,0.12)' }}>
                      {cs.badge}
                    </span>
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
                    {cs.showButton && (
                      <button
                        onClick={() => handlePlanSelect(cardKey)}
                        className="mt-2 w-full py-3 rounded-xl text-sm font-medium transition-all duration-200"
                        style={plan.featured ? {
                          background: 'linear-gradient(90deg, #b8960c 0%, #e8c84a 45%, #c9a227 100%)',
                          color: '#1a1100', fontWeight: 700,
                          boxShadow: '0 4px 18px rgba(200,160,30,0.35)',
                        } : {
                          background: 'linear-gradient(90deg, #c0392b 0%, #e74c3c 100%)',
                          color: '#fff', boxShadow: '0 4px 16px rgba(192,57,43,0.35)',
                        }}
                      >
                        Paketi Seç
                      </button>
                    )}
                  </div>
                </div>
              );

              return plan.featured ? (
                <div key={plan.name} className="lp-feat-wrap flex flex-col" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {inner}
                </div>
              ) : (
                <div key={plan.name} className="flex flex-col">{inner}</div>
              );
            })}
          </div>
        </section>

      </div>
    </main>
  );
}
