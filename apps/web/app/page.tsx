'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { HeroCountdown } from '@/components/HeroCountdown';
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
    features: ['Her Hafta Grup Masası', 'Doğrulanmış Profiller', 'OCEAN Kişilik Uyumu', 'Yapay Zeka Masa Raporu', 'Masa Garantili (Ücret İade)'],
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
    features: ['Tek Seferlik Baş Başa Masa', 'Doğrulanmış Profiller', 'OCEAN + Yaş Uyumu', 'Yapay Zeka Masa Raporu', 'Masa Garantili (Ücret İade)'],
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
    features: ['4 Grup Masası + 1 Baş Başa Masa', 'Tüm Özellikler Dahil'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];




/* ─── Her Yerde Biz Varız carousel ──────────────────────────────────────── */
const MEDIA_LOGOS = [
  'Hürriyet', 'Milliyet', 'Sabah', 'NTV', 'CNN Türk',
  'Habertürk', 'TRT', 'Sözcü', 'Yeni Şafak', 'BirGün',
];

function MediaCarousel() {
  const items = [...MEDIA_LOGOS, ...MEDIA_LOGOS];
  return (
    <section className="max-w-6xl mx-auto px-6 lg:px-16 py-16 lg:py-24">
      <style>{`
        @keyframes carousel-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .carousel-track {
          display: flex;
          gap: 56px;
          width: max-content;
          animation: carousel-scroll 28s linear infinite;
        }
        .carousel-track:hover { animation-play-state: paused; }
        .carousel-logo { opacity: 0.5; transition: opacity 0.25s; flex-shrink: 0; }
        .carousel-logo:hover { opacity: 1; }
      `}</style>

      <h2 className="font-serif italic text-4xl sm:text-5xl text-[#f5f5f5] mb-12">
        Her Yerde Biz Varız
      </h2>

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Sol fade */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 80, zIndex: 2,
          background: 'linear-gradient(to right, #121212, transparent)',
          pointerEvents: 'none',
        }} />
        {/* Sağ fade */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, zIndex: 2,
          background: 'linear-gradient(to left, #121212, transparent)',
          pointerEvents: 'none',
        }} />

        <div className="carousel-track" style={{ alignItems: 'center' }}>
          {items.map((name, i) => (
            <span
              key={i}
              className="carousel-logo"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 32,
                minWidth: 110,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 6,
                padding: '0 12px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── İlk Masalarımızdan Sesler ─────────────────────────────────────────── */
function Testimonials() {
  return (
    <section className="max-w-4xl mx-auto px-6 lg:px-16 py-20 lg:py-28">
      <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl italic text-[#f5f5f5] mb-16">
        İlk Masalarımızdan Sesler
      </h2>
      <div className="flex flex-col gap-14">
        {[
          { quote: 'İlk başta açıkçası buluşmaya gitmekten çekindim çünkü ne ile karşılaşacağımı bilmiyordum ama iyi ki gitmişim. Masadaki insanların birkaçıyla şuan iyi arkadaşlık kurduk.', name: 'Sümeyye K.', city: 'İstanbul' },
          { quote: 'Konsepti çok değişik buldum önce ama şimdi hafta sonları aktiviteleri için sürekli kullanıyorum.', name: 'Nursena Y.', city: 'İstanbul' },
          { quote: 'Tanımadığım bir kızla baş başa buluştuk. Çekingen olmama rağmen resmen benim aynadaki eşim gibiydi, yabancılık çekmedim.', name: 'Çağrı Ş.', city: 'İstanbul' },
          { quote: 'Grup masasında eşleştim, kaliteli ve düzgün insanlar geldi. Sohbet akıcı ve güzeldi, sanki daha önceden tanışıyormuşuz gibiydi.', name: 'Bengü A.', city: 'İstanbul' },
          { quote: 'Baş başa masa kurulsun, sohbet edecek biri bulalım derken tam dediğim gibi oldu. Efsane eğlenceliydi.', name: 'Burak G.', city: 'İstanbul' },
        ].map((item, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 72, lineHeight: 0.75, color: 'rgba(192,57,43,0.45)', flexShrink: 0, userSelect: 'none', marginTop: 4 }} aria-hidden>"</span>
              <p className="font-serif italic" style={{ fontSize: 'clamp(15px, 2.2vw, 20px)', fontWeight: 300, color: 'rgba(245,245,245,0.82)', lineHeight: 1.75 }}>
                {item.quote}
              </p>
            </div>
            <div style={{ borderTop: '1px solid rgba(192,57,43,0.2)', marginTop: 16, paddingTop: 12, textAlign: 'right' }}>
              <span style={{ fontSize: 11, fontWeight: 400, letterSpacing: '0.14em', color: '#c0392b', textTransform: 'uppercase' }}>
                — {item.name}, {item.city}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── FAQ + Şehirler + CTA ───────────────────────────────────────────────── */
function FAQSections({ cities, activeCity, setActiveCity }: { cities: {name:string;sub?:string}[]; activeCity: string; setActiveCity: (c:string)=>void }) {
  return (
    <>
      {/* ── Şehirler */}
      <section id="cities" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl sm:text-4xl mb-3 text-[#f5f5f5]"><RedLast text="Aktif Olduğumuz Şehirler" /></h2>
          <p className="text-[#888] text-sm">Aşağıdaki şehirlerde her hafta masalar kuruluyor.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {cities.map((city) => {
            const isActive = activeCity === city.name;
            return (
              <button key={city.name} type="button" onClick={() => setActiveCity(city.name)}
                className="px-5 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-1.5"
                style={isActive ? { border: '1px solid rgba(192,57,43,0.8)', background: 'rgba(192,57,43,0.12)', color: '#ff6b6b', boxShadow: '0 0 16px rgba(192,57,43,0.3)' } : { border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.07)', color: '#aaa' }}
              >
                {isActive && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-sm">{city.name}</span>
                  {city.sub && <span className="text-[10px] font-normal opacity-60 tracking-wide">{city.sub}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Alıntı */}
      <section className="py-16 px-6 text-center">
        <p className="font-serif italic text-white leading-snug" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
          "Her hafta, şehrinde, sana uygun bir masa."
        </p>
        <div className="mx-auto mt-5 rounded-full" style={{ width: 90, height: 2, background: 'linear-gradient(90deg,#c0392b,#ff6b6b)' }} />
      </section>

      {/* ── Ahenk Seni Nasıl Tanır? */}
      <section id="how-it-knows-you" className="max-w-3xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-3"><RedLast text="Ahenk Seni Nasıl Tanır?" /></h2>
        </div>
        <AccordionGroup items={[
          { title: 'Bir test değil, bir profil.', body: 'Ahenk\'e katılmadan önce doldurduğun sorular sıradan bir anket değil. Her cevap, seni tanımlamak için tasarlanmış bir sinyal. Düşünce tarzın, sosyal enerjin, masada üstlendiğin rol, mekân tercihin hepsi birleşerek sana özgü bir profil oluşturuyor.' },
          { title: 'OCEAN modeli nedir?', body: 'Eşleştirme motorumuz, psikoloji araştırmalarının altın standardı olan OCEAN (Big Five) modelini kullanır. 1980\'lerden bu yana milyonlarca kişi üzerinde doğrulanmış bu model; kişiliğin beş temel boyutunu ölçer: Açıklık, Özdisiplin, Dışadönüklük, Uyumluluk ve Duygusal Denge. Bunlar bir kutup değil, birer spektrum ve senin yerinle başkasının yeri asla aynı değil.' },
          { title: 'Algoritma ne yapıyor?', body: 'Profilini oluşturduktan sonra algoritma devreye girer. Seni sadece sana benzer insanlarla değil, seninle gerçek bir ahenk kurabilecek insanlarla eşleştirir. Meslek alanın, yaşın ve mekan tercihin de hesaba katılır ama bunlar yardımcı faktörler. Asıl ağırlık kişilik uyumunda.' },
          { title: 'Masa nasıl kurulur?', body: 'Her hafta belirli bir gün eşleşmeler kapanır. Algoritma o ana kadar biriken profilleri değerlendirir, en yüksek uyum skoruna sahip grupları veya iki kişiyi bir araya getirir ve masayı kurar. Sen sadece onayı beklersin.' },
          { title: 'Buluşma sonrası ne olur?', body: 'Her buluşmanın ardından Ahenk, masa hakkında kısa bir yapay zeka raporu oluşturur. Grubun genel uyum skoru, öne çıkan kişilik dinamikleri ve masa enerjisi hakkında bir özet; sadece senin için, sadece o akşam için.' },
          { title: 'Başbaşa buluşmalar farklı mı?', body: 'Grup masalarında ahenk aranır, başbaşa buluşmalarda ise derinlik. İki kişilik eşleşmelerde algoritma çok daha hassas çalışır: yaş uyumu, kişilik dengesi ve beklenti örtüşmesi ön plana çıkar. Karşındaki kişi rastgele değil, seninle birebir örtüşen biri.' },
          { title: '180 günde bir yenilenir.', body: 'Kişilik sabit, ama bağlam değişir. Bu yüzden OCEAN profilin 180 günde bir güncellenir; o dönemki sen, o dönemki ahenginle buluşur.' },
        ]} />
      </section>

      {/* ── Neden Rahat Hissedersin? */}
      <section id="why-safe" className="max-w-3xl mx-auto px-6 py-24" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-3"><RedLast text="Neden Rahat Hissedersin?" /></h2>
        </div>
        <AccordionGroup items={[
          { title: 'Yabancıyla tanışmak bu kadar zor mu olmalı?', body: 'Bir arkadaşının arkadaşıyla tanışırsın; sormadan, araştırmadan, sadece güvenirsin. Ahenk tam bunu yapıyor. Aramana gerek yok, seçmene gerek yok. Algoritma seçer, sen sadece gelirsin.' },
          { title: 'Kim olduğunu biliyoruz.', body: 'Platforma katılmak için telefon numaranı doğruluyor, kimliğin kontrol ediliyor ve kısa bir video doğrulaması yapılıyor. Masanda oturan herkes aynı süreçten geçti. Anonim hesap yok, sahte profil yok.' },
          { title: 'Nerede buluşuyorsunuz?', body: 'Her buluşma şehrindeki restoran ve kafelerden gerçekleşir. Kişilik profiline ve mekan tercihine göre o haftaki buluşma yeri belirlenir. Adres ve saat bilgisi buluşmadan önce sana iletilir. Özel bir anlaşma veya ekstra ücret yok; sadece kendi hesabını ödersin.' },
          { title: 'Yalnız değilsin.', body: 'Grup masaları 5-6 kişiden oluşuyor. Başbaşa buluşmalarda ise eşleşme çift yönlü onaylanmış; karşındaki kişi de aynı süreci tamamlamış, aynı şartları kabul etmiş biri.' },
          { title: 'Kimseyi tanımak zorunda değilsin.', body: 'Masadaki diğer kişilerin soyadını, mesleğini, yaşını önceden göremezsin; onlar da seninkini göremez. Buluşma anında tanışırsınız. Bu hem heyecan hem de eşitlik demek.' },
          { title: 'Bir sorun olursa?', body: 'Buluşma sonrası değerlendirme sistemi var. Bir daha eşleşmek istemediğin biri varsa belirtirsin; bir daha o kişiyle asla karşılaşmazsın. Ciddi bir durum bildirirsen kürasyon ekibimiz devreye girerek inceler ve o kişinin hesabı süresiz yasaklanır, tekrar kayıt yapmasına bir daha izin verilmez.' },
        ]} />
      </section>

      {/* ── CTA */}
      <section className="relative overflow-hidden py-28 px-6">
        <div className="absolute inset-0" style={{ backgroundImage: 'url(/cta-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.62)' }} />
        <div className="relative z-10 flex flex-col items-start gap-5 max-w-5xl mx-auto">
          <h2 className="font-serif text-white font-light" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', lineHeight: 1.15 }}>
            Senin masanı kuruyoruz.
          </h2>
          <Link href="/kayit" className="btn-primary">
            Hemen Katıl
          </Link>
        </div>
      </section>
    </>
  );
}

/* ─── Bu Hafta Kurulan Masalar ───────────────────────────────────────────── */
function getWeekNumber(date: Date): number {
  const trDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const jan1 = new Date(Date.UTC(trDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((trDate.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7);
}

function seededRand(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000;
  return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
}

function isTRDayPast(targetDay: number, targetHour: number, targetMin: number): boolean {
  const now = new Date();
  const trNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const day = trNow.getUTCDay(); // 0=Paz,6=Cmt
  if (day !== targetDay) return day > targetDay || (targetDay === 6 && day === 0);
  return trNow.getUTCHours() > targetHour || (trNow.getUTCHours() === targetHour && trNow.getUTCMinutes() >= targetMin);
}

function WeeklyTables() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const week = getWeekNumber(new Date());
  const grupDone = isTRDayPast(6, 23, 59);   // Cumartesi 23:59
  const bbDone   = isTRDayPast(0, 23, 59);   // Pazar 23:59

  const cities = [
    {
      name: 'İstanbul',
      grup:   { min: 5, max: 8,  seed: week * 31 + 1 },
      bb:     { min: 4, max: 8,  seed: week * 31 + 2 },
    },
    {
      name: 'Ankara',
      grup:   { min: 4, max: 7,  seed: week * 31 + 3 },
      bb:     { min: 3, max: 6,  seed: week * 31 + 4 },
    },
    {
      name: 'İzmir',
      grup:   { min: 3, max: 6,  seed: week * 31 + 5 },
      bb:     { min: 2, max: 5,  seed: week * 31 + 6 },
    },
  ];

  return (
    <section className="max-w-6xl mx-auto px-6 lg:px-16 py-20 lg:py-28">
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
        .pulse-dot { width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse-dot 1.8s ease-in-out infinite;flex-shrink:0; }
      `}</style>

      <h2
        style={{
          fontWeight: 300,
          fontSize: 'clamp(26px, 4vw, 44px)',
          letterSpacing: '0.12em',
          color: '#f5f5f5',
          marginBottom: 40,
          textTransform: 'uppercase',
        }}
      >
        Bu Hafta Kurulan Masalar
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
        {cities.map((city) => {
          const grupCount = seededRand(city.grup.seed, city.grup.min, city.grup.max);
          const bbCount   = seededRand(city.bb.seed,   city.bb.min,   city.bb.max);
          return (
            <div
              key={city.name}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '24px 20px',
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: '#f5f5f5',
                  marginBottom: 12,
                }}
              >
                {city.name}
              </p>
              <div style={{ borderTop: '1px solid rgba(192,57,43,0.25)', marginBottom: 16 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Grup */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="pulse-dot" />
                  {grupDone ? (
                    <span style={{ fontSize: 11, color: 'rgba(245,245,245,0.35)', fontStyle: 'italic' }}>
                      Bu haftanın grup masaları doldu.
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'rgba(245,245,245,0.5)' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#c0392b', marginRight: 4 }}>{grupCount}</span>
                      masa aktif
                    </span>
                  )}
                </div>
                {/* Baş Başa */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="pulse-dot" />
                  {bbDone ? (
                    <span style={{ fontSize: 11, color: 'rgba(245,245,245,0.35)', fontStyle: 'italic' }}>
                      Bu haftanın eşleşmeleri tamamlandı.
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'rgba(245,245,245,0.5)' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#c0392b', marginRight: 4 }}>{bbCount}</span>
                      eşleşme kaldı
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="font-serif italic text-center" style={{ color: '#f5f5f5', fontSize: 15 }}>
        Masalar dolmadan yerinizi alın.
      </p>
    </section>
  );
}

/* ─── Red last word helper ───────────────────────────────────────────────── */
function AccordionGroup({ items }: { items: { title: string; body: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-col" style={{ borderTop: '1px solid rgba(255,255,255,0.12)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)' }}>
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
            <p className="text-sm leading-relaxed pb-5" style={{ color: '#f5f5f5' }}>{item.body}</p>
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

/* ─── Count-up hook ──────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

/* ─── İstatistik kartları bileşeni ───────────────────────────────────────── */
function StatCards() {
  const launchDate = new Date(process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-10-11T00:00:00Z');
  const now = new Date();
  const msElapsed = Math.max(0, now.getTime() - launchDate.getTime());
  const hoursElapsed = Math.floor(msElapsed / (1000 * 60 * 60));
  const weeksElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24 * 7));

  const targetMembers = 100 + hoursElapsed * 2;
  const targetTables = 27 + weeksElapsed * 4;
  const targetCities = 7;

  const members = useCountUp(targetMembers);
  const tables = useCountUp(targetTables);
  const cities = useCountUp(targetCities);

  const stats = [
    { label: 'Kullanıcı', value: members },
    { label: 'Kurulan Masa', value: tables },
    { label: 'Aktif Şehir', value: cities },
  ];

  return (
    <>
      <style>{`
        @keyframes _statRedBorder{to{transform:rotate(360deg)}}
        .stat-wrap{position:relative;border-radius:16px;padding:1px;overflow:hidden;}
        .stat-wrap::before{content:'';position:absolute;inset:-80%;background:conic-gradient(from 0deg,transparent 62%,#c0392b 76%,#ff6b6b 83%,transparent 92%);animation:_statRedBorder 3s linear infinite;z-index:0;}
        .stat-inner{position:relative;z-index:1;border-radius:14px;background:rgba(12,8,8,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 12px;}
      `}</style>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-wrap">
              <div className="stat-inner">
                <span
                  className="font-serif text-3xl sm:text-4xl font-light"
                  style={{ background: 'linear-gradient(135deg,#f5f5f5,#bbb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                >
                  {stat.value.toLocaleString('tr-TR')}
                </span>
                <span className="text-xs sm:text-sm mt-1.5 whitespace-nowrap" style={{ color: '#f5f5f5' }}>{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

type ActivePlan = 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;

function getPlanCardState(cardKey: string, activePlan: ActivePlan) {
  const none = { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
  if (!activePlan) return none;

  if (activePlan === 'MASADA') {
    if (cardKey === 'MASADA')   return { dimmed: true,  badge: 'Aktif Paketiniz',        badgeRed: true,  showButton: false };
    if (cardKey === 'KARSIMDA') return { dimmed: false, badge: null,                      badgeRed: false, showButton: true  };
    /* ICERDE */                return { dimmed: true,  badge: 'Grup Masasına Sahipsin',  badgeRed: false, showButton: false };
  }
  if (activePlan === 'KARSIMDA') {
    if (cardKey === 'KARSIMDA') return { dimmed: true,  badge: 'Aktif Paketiniz',              badgeRed: true,  showButton: false };
    if (cardKey === 'MASADA')   return { dimmed: false, badge: null,                            badgeRed: false, showButton: true  };
    /* ICERDE */                return { dimmed: true,  badge: 'Baş Başa Masasına Sahipsin',   badgeRed: false, showButton: false };
  }
  if (activePlan === 'ICERDE') {
    if (cardKey === 'ICERDE')   return { dimmed: true,  badge: 'Aktif Paketiniz',              badgeRed: true,  showButton: false };
    if (cardKey === 'MASADA')   return { dimmed: true,  badge: 'Grup Masasına Sahipsin',       badgeRed: false, showButton: false };
    /* KARSIMDA */              return { dimmed: true,  badge: 'Baş Başa Masasına Sahipsin',   badgeRed: false, showButton: false };
  }
  return none;
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
    router.push('/profil?tab=paket');
  }

  return (
    <main className="min-h-screen bg-[#121212] text-[#f5f5f5] overflow-x-hidden">
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
        <section id="hero" className="hero-section relative pt-[52px]" style={{ display: 'flex', flexDirection: 'column', height: 'auto' }}>
          <div className="hero-bg absolute inset-0" />
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 100%)', zIndex: 1 }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 55% 65% at 78% 50%, rgba(192,57,43,0.28) 0%, transparent 65%)' }} />

          {/* Başlık + butonlar — üstte */}
          <div className="relative z-10 w-full pt-16 pb-10 px-6 lg:px-16 flex flex-col gap-6 flex-1">
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
            <motion.div
              className="flex flex-wrap items-center gap-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.15, duration: 0.45, ease: 'easeOut' }}
            >
              <Link href="/kayit" className="btn-primary">
                Hemen Katıl
              </Link>
              <a href="#how-it-knows-you" className="btn-ghost">
                Nasıl Çalışır?
              </a>
            </motion.div>
          </div>

          {/* Stats */}
          {/* ── Sayaç ─────────────────────────────────────────────────────── */}
          <div className="relative z-10 px-6 lg:px-16 py-8 md:absolute md:bottom-8 md:right-8 md:scale-90 md:origin-bottom-right">
            <HeroCountdown />
          </div>
        </section>

        <div style={{ background: 'linear-gradient(135deg, #5c1a1a 0%, #3d0f0f 100%)' }}><StatCards /></div>

        {/* ── Bunu daha önce denemedin ─────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 lg:px-16 py-20 lg:py-28">
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl italic text-[#f5f5f5] mb-14 lg:mb-18">
            Bunu daha önce denemedin.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">
            {[
              {
                title: 'Yalnız Değilsin',
                body: 'Grup masasında yeni yüzlerle, ya da baş başa masada tek bir insanla. İkisi de seni bekliyor.',
              },
              {
                title: 'Planın Hazır',
                body: 'Randevu, mekan ve rezervasyon hepsi ayarlandı. Sadece yola çıkman kaldı.',
              },
              {
                title: 'Şans Değil',
                body: 'Rastgele değil. Seninle gerçekten ahenk kuracak insanlarla aynı masada oturacaksın.',
              },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  borderLeft: '2px solid #c0392b',
                  paddingLeft: 20,
                  background: 'linear-gradient(90deg, rgba(192,57,43,0.04) 0%, transparent 80%)',
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 250,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: '#f5f5f5',
                    marginBottom: 10,
                  }}
                >
                  {card.title}
                </p>
                <p style={{ fontSize: 13, color: 'rgba(245,245,245,0.45)', lineHeight: 1.7 }}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-14">
            <Link href="/kayit" className="btn-primary">
              Masanı Seç
            </Link>
          </div>
        </section>

        {/* ── İlk Masalarımızdan Sesler ────────────────────────────────── */}
        <Testimonials />

        {/* ── OCEAN Big5 ───────────────────────────────────────────────── */}
        <section
          style={{
            background: 'linear-gradient(160deg, rgba(80,8,18,0.55) 0%, rgba(40,4,10,0.72) 50%, rgba(20,2,6,0.8) 100%)',
            borderTop: '1px solid rgba(192,57,43,0.12)',
            borderBottom: '1px solid rgba(192,57,43,0.12)',
          }}
          className="w-full py-24 lg:py-32 px-6"
        >
          <div className="max-w-6xl mx-auto">
            {/* Başlık */}
            <h2 className="font-serif italic text-4xl sm:text-5xl lg:text-6xl text-[#f5f5f5] text-center mb-8">
              Neden bazı insanlarla ilk dakikadan anlaşırsın?
            </h2>
            {/* Paragraf */}
            <p
              className="text-center mx-auto mb-16"
              style={{ maxWidth: 540, fontSize: 15, fontWeight: 300, color: 'rgba(245,245,245,0.88)', lineHeight: 1.8 }}
            >
              Bazı insanlarla saatlerce konuşursun, kahve soğur fark etmezsin. Bazılarıyla aynı masada oturmak bile yorar. Bu rastlantı değil. Biz bilimi masana taşıyoruz.
            </p>
            {/* 5 kart */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5 mb-16">
              {[
                { letter: 'O', word: 'Açıklık',      desc: 'Yeni fikirlere, yeni yüzlere, yeni akşamlara ne kadar açıksın?' },
                { letter: 'C', word: 'Özen',         desc: 'Hayatına ne kadar düzen ve anlam katıyorsun?' },
                { letter: 'E', word: 'Dışadönüklük', desc: 'Bir odaya girdiğinde enerji mi alırsın, yoksa verirmisin?' },
                { letter: 'A', word: 'Uyumluluk',    desc: 'İnsanlarla köprü mü kurarsın, yoksa mesafe mi?' },
                { letter: 'N', word: 'Denge',        desc: 'Duygularınla nasıl bir ilişkin var?' },
              ].map((item) => (
                <div
                  key={item.letter}
                  className="col-span-1 last:col-span-2 last:col-start-1 lg:last:col-span-1 lg:last:col-start-auto"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 12,
                    padding: '20px 16px',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: 40,
                      fontWeight: 700,
                      color: '#c0392b',
                      lineHeight: 1,
                      marginBottom: 10,
                    }}
                  >
                    {item.letter}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: '#f5f5f5',
                      marginBottom: 8,
                    }}
                  >
                    — {item.word}
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 300,
                      fontStyle: 'italic',
                      color: 'rgba(245,245,245,0.75)',
                      lineHeight: 1.65,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
            {/* Alt kapanış */}
            <p
              className="font-serif italic text-center"
              style={{ fontSize: 'clamp(15px, 2vw, 19px)', color: '#f5f5f5' }}
            >
              Ocean Big5 kişilik testini hemen şimdi doldur, gerisini Ahenk halleder.
            </p>
          </div>
        </section>

        {/* ── Bu Hafta Kurulan Masalar ─────────────────────────────────── */}
        <WeeklyTables />

        {/* ── Her Yerde Biz Varız ──────────────────────────────────────── */}
        <MediaCarousel />

        {/* ── FAQ + Şehirler + CTA ─────────────────────────────────────── */}
        <FAQSections cities={cities} activeCity={activeCity} setActiveCity={setActiveCity} />

        {/* ── Paketler ───────────────────────────────────────────────────── */}
        <section id="pricing" className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5]">
              Paketler
            </h2>
          </div>
          <style>{`
            @keyframes _cardGoldBorder{to{transform:rotate(360deg)}}
            .lp-feat-wrap{position:relative;border-radius:18px;padding:2px;overflow:hidden;}
            .lp-feat-wrap::before{content:'';position:absolute;width:300%;height:300%;top:-100%;left:-100%;background:conic-gradient(from 0deg,transparent 68%,#c9a227 78%,#e8c84a 84%,transparent 93%);animation:_cardGoldBorder 3s linear infinite;z-index:0;}
            .lp-feat-inner{position:relative;z-index:1;border-radius:16px;overflow:hidden;display:flex;flex-direction:row;flex:1;}
          `}</style>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const cardKey = plan.name === 'Masada' ? 'MASADA' : plan.name === 'Karşımda' ? 'KARSIMDA' : 'ICERDE';
              const cs = getPlanCardState(cardKey, activePlan);
              const inner = (
                <div
                  className={plan.featured ? 'lp-feat-inner' : 'relative rounded-2xl overflow-hidden flex-1'}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    minHeight: 260,
                    ...((!plan.featured) ? {
                      border: '1px solid rgba(255,255,255,0.12)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.5)',
                    } : {}),
                    ...(cs.dimmed ? { opacity: 0.45, pointerEvents: 'none' as const } : {}),
                  }}
                >
                  {/* Sol: metin */}
                  <div style={{ width: '55%', flexShrink: 0, background: '#0c0909', display: 'flex', flexDirection: 'column', padding: '18px 14px', gap: 10, position: 'relative' }}>
                    {cs.badge && (
                      <span className="absolute top-3 inset-x-2 z-10 px-2 py-0.5 text-center leading-tight rounded-full"
                        style={{
                          fontSize: '0.65rem', fontWeight: 600,
                          ...(cs.badgeRed
                            ? { background: 'rgba(192,57,43,0.85)', color: '#fff', border: '1px solid rgba(192,57,43,0.6)' }
                            : { background: 'rgba(40,40,40,0.85)', color: '#aaa', border: '1px solid rgba(255,255,255,0.12)' }),
                        }}>
                        {cs.badge}
                      </span>
                    )}
                    <div style={{ marginTop: cs.badge ? 22 : 0 }}>
                      <h3 className="font-serif text-[#f5f5f5]" style={{ fontSize: '1.1rem', marginBottom: 4 }}>{plan.name}</h3>
                      <div className="flex items-end gap-1" style={{ marginBottom: 2 }}>
                        <span className="font-bold text-[#f5f5f5]" style={{ fontSize: '1.7rem' }}>{plan.price}</span>
                        <span className="text-[#888]" style={{ fontSize: '0.9rem', marginBottom: 2 }}>₺</span>
                      </div>
                      <p style={{ color: '#f5f5f5', fontSize: '0.7rem' }}>{plan.desc}</p>
                    </div>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                      {plan.features.map((f) => (
                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#ccc', lineHeight: 1.3 }}>
                          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 12, height: 12, flexShrink: 0, color: '#c0392b' }}>
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {cs.showButton && (
                      <button
                        onClick={() => handlePlanSelect(cardKey)}
                        className="btn-primary w-full"
                        style={{ justifyContent: 'center' }}
                      >
                        Paket Seç
                      </button>
                    )}
                  </div>
                  {/* Sağ: görsel */}
                  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={plan.bgImage} alt={plan.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                    {plan.featured && !cs.badge && (
                      <span className="absolute top-3 right-3 z-10 px-2 py-0.5 text-xs font-semibold rounded-full text-white"
                        style={{ background: 'rgba(10,5,5,0.75)', border: '1px solid rgba(255,255,255,0.18)' }}>
                        Tercih Edilen
                      </span>
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
