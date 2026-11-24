'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getKankamlaCardState, getPlanCardState, type KankamlaState, type OpenParts, type PlanKey } from '@/lib/planCards';
import { HeroCountdown } from '@/components/HeroCountdown';
import { PlanPriceText } from '@/components/PlanPrice';
import { AMBER, BuyButton, CARDS, Check, PaketKarti } from '@/components/paket/PaketKarti';
import { StdButton } from '@ahenk/ui';
/* ─── Veri ───────────────────────────────────────────────────────────────── */






/* ─── Her Yerde Biz Varız carousel ──────────────────────────────────────── */
const MEDIA_LOGOS = [
  'Hürriyet', 'Milliyet', 'Sabah', 'NTV', 'CNN Türk',
  'Habertürk', 'TRT', 'Sözcü', 'Yeni Şafak', 'BirGün',
];

function MediaCarousel() {
  const t = useTranslations();
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
        {t('landing.everywhere')}
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
  const t = useTranslations();
  return (
    <section className="max-w-4xl mx-auto px-6 lg:px-16 py-20 lg:py-28">
      <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl italic text-[#f5f5f5] mb-16">
        {t('landing.voices')}
      </h2>
      <div className="flex flex-col gap-14">
        {[
          { quote: t('landing.q1'), name: 'Sümeyye K.', city: 'İstanbul' },
          { quote: t('landing.q2'), name: 'Nursena Y.', city: 'İstanbul' },
          { quote: t('landing.q3'), name: 'Çağrı Ş.', city: 'İstanbul' },
          { quote: t('landing.q4'), name: 'Bengü A.', city: 'İstanbul' },
          { quote: t('landing.q5'), name: 'Burak G.', city: 'İstanbul' },
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
                {item.name}, {item.city}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── FAQ + Şehirler + CTA ───────────────────────────────────────────────── */
// Acil Yardım anlatımı; rapordaki metinle birebir aynı tutulur

function SafetySection() {
  const t = useTranslations();
  const SAFETY_STEPS = [
    { title: t('landing.s1t'), body: t('landing.s1b') },
    { title: t('landing.s2t'), body: t('landing.s2b') },
    { title: t('landing.s3t'), body: t('landing.s3b') },
    { title: t('landing.s4t'), body: t('landing.s4b') },
  ];
  return (
    <section id="acil-yardim" className="max-w-3xl mx-auto px-6 py-24" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
      <div className="text-center mb-12">
        <p style={{ fontSize: 12, fontWeight: 250, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#e05c4c', marginBottom: 14 }}>
          {t('landing.sosLabel')}
        </p>
        <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-6"><RedLast text={t('landing.sosTitle')} /></h2>
        <p className="mx-auto" style={{ maxWidth: 560, fontSize: 15, fontWeight: 300, color: 'rgba(245,245,245,0.88)', lineHeight: 1.8 }}>
          {t('landing.sosP1')}
        </p>
      </div>
      <div className="flex flex-col gap-5 mb-12" style={{ fontSize: 15, fontWeight: 300, color: 'rgba(245,245,245,0.75)', lineHeight: 1.8 }}>
        <p>
          {t('landing.sosP2')}
        </p>
        <p>
          {t('landing.sosP3')}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
        {SAFETY_STEPS.map((step) => (
          <div
            key={step.title}
            style={{
              borderLeft: '2px solid #c0392b',
              paddingLeft: 20,
              background: 'linear-gradient(90deg, rgba(192,57,43,0.04) 0%, transparent 80%)',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 250, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#f5f5f5', marginBottom: 10 }}>
              {step.title}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(245,245,245,0.6)', lineHeight: 1.7 }}>{step.body}</p>
          </div>
        ))}
      </div>
      <p className="font-serif italic text-xl sm:text-2xl text-center text-[#f5f5f5]">
        {t('landing.sosHope')}
      </p>
    </section>
  );
}

function FAQSections({ cities, activeCity, setActiveCity }: { cities: {name:string;sub?:string}[]; activeCity: string; setActiveCity: (c:string)=>void }) {
  const t = useTranslations();
  return (
    <>
      {/* ── Şehirler */}
      <section id="cities" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl sm:text-4xl mb-3 text-[#f5f5f5]"><RedLast text={t('landing.citiesTitle')} /></h2>
          <p className="text-[#888] text-sm">{t('landing.citiesSub')}</p>
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
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 shrink-0">
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
          {t('landing.quote')}
        </p>
        <div className="mx-auto mt-5 rounded-full" style={{ width: 90, height: 2, background: 'linear-gradient(90deg,#c0392b,#ff6b6b)' }} />
      </section>

      {/* ── Ahenk Seni Nasıl Tanır? */}
      <section id="how-it-knows-you" className="max-w-3xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-3"><RedLast text={t('landing.knowsTitle')} /></h2>
        </div>
        <AccordionGroup items={[
          { title: t('landing.k1t'), body: t('landing.k1b') },
          { title: t('landing.k2t'), body: t('landing.k2b') },
          { title: t('landing.k3t'), body: t('landing.k3b') },
          { title: t('landing.k4t'), body: t('landing.k4b') },
          { title: t('landing.k5t'), body: t('landing.k5b') },
          { title: t('landing.k6t'), body: t('landing.k6b') },
          { title: t('landing.k7t'), body: t('landing.k7b') },
        ]} />
      </section>

      {/* ── Neden Rahat Hissedersin? */}
      <SafetySection />

      <section id="why-safe" className="max-w-3xl mx-auto px-6 py-24" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl sm:text-4xl text-[#f5f5f5] mb-3"><RedLast text={t('landing.comfortTitle')} /></h2>
        </div>
        <AccordionGroup items={[
          { title: t('landing.c1t'), body: t('landing.c1b') },
          { title: t('landing.c2t'), body: t('landing.c2b') },
          { title: t('landing.c3t'), body: t('landing.c3b') },
          { title: t('landing.c4t'), body: t('landing.c4b') },
          { title: t('landing.c5t'), body: t('landing.c5b') },
          { title: t('landing.c6t'), body: t('landing.c6b') },
        ]} />
      </section>

      {/* ── CTA */}
      <section className="relative overflow-hidden py-28 px-6">
        <div className="absolute inset-0" style={{ backgroundImage: 'url(/cta-bg.webp)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.62)' }} />
        <div className="relative z-10 flex flex-col items-start gap-5 max-w-5xl mx-auto">
          <h2 className="font-serif text-white font-light" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', lineHeight: 1.15 }}>
            {t('landing.ctaTitle')}
          </h2>
          <StdButton variant="primary" as={Link} href="/kayit">
            {t('landing.join')}
          </StdButton>
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

// Bu haftanın (Pazartesi başlangıçlı) verilen gün/saati geçti mi (TR)
function isTRDayPast(targetDay: number, targetHour: number, targetMin: number): boolean {
  const now = new Date();
  const trNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const mondayIdx = (d: number) => (d + 6) % 7; // Pzt=0 … Paz=6
  const day = trNow.getUTCDay(); // 0=Paz,6=Cmt
  if (day !== targetDay) return mondayIdx(day) > mondayIdx(targetDay);
  return trNow.getUTCHours() > targetHour || (trNow.getUTCHours() === targetHour && trNow.getUTCMinutes() >= targetMin);
}

function WeeklyTables() {
  const t = useTranslations();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const week = getWeekNumber(new Date());
  const grupDone = isTRDayPast(5, 23, 59);   // Cuma 23:59 (grup buluşma günü)
  const bbDone   = isTRDayPast(6, 23, 59);   // Cumartesi 23:59 (başbaşa buluşma günü)
  const kankaDone = isTRDayPast(6, 23, 59);  // Cumartesi 23:59 (Kankamla kilidi; buluşma Pazar)

  const cities = [
    {
      name: 'İstanbul',
      grup:   { min: 5, max: 8,  seed: week * 31 + 1 },
      bb:     { min: 4, max: 8,  seed: week * 31 + 2 },
      kanka:  { min: 2, max: 5,  seed: week * 31 + 7 },
    },
    {
      name: 'Ankara',
      grup:   { min: 4, max: 7,  seed: week * 31 + 3 },
      bb:     { min: 3, max: 6,  seed: week * 31 + 4 },
      kanka:  { min: 1, max: 4,  seed: week * 31 + 8 },
    },
    {
      name: 'İzmir',
      grup:   { min: 3, max: 6,  seed: week * 31 + 5 },
      bb:     { min: 2, max: 5,  seed: week * 31 + 6 },
      kanka:  { min: 1, max: 3,  seed: week * 31 + 9 },
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
        {t('landing.weeklyTitle')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
        {cities.map((city) => {
          const grupCount = seededRand(city.grup.seed, city.grup.min, city.grup.max);
          const bbCount   = seededRand(city.bb.seed,   city.bb.min,   city.bb.max);
          const kankaCount = seededRand(city.kanka.seed, city.kanka.min, city.kanka.max);
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
                      {t('landing.groupFull')}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'rgba(245,245,245,0.5)' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#c0392b', marginRight: 4 }}>{grupCount}</span>
                      {t('landing.tablesActive')}
                    </span>
                  )}
                </div>
                {/* Baş Başa */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="pulse-dot" />
                  {bbDone ? (
                    <span style={{ fontSize: 11, color: 'rgba(245,245,245,0.35)', fontStyle: 'italic' }}>
                      {t('landing.matchesDone')}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'rgba(245,245,245,0.5)' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#c0392b', marginRight: 4 }}>{bbCount}</span>
                      {t('landing.matchesLeft')}
                    </span>
                  )}
                </div>
                {/* Kankamla */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="pulse-dot" />
                  {kankaDone ? (
                    <span style={{ fontSize: 11, color: 'rgba(245,245,245,0.35)', fontStyle: 'italic' }}>
                      {t('landing.kankaFull')}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'rgba(245,245,245,0.5)' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#c0392b', marginRight: 4 }}>{kankaCount}</span>
                      {t('landing.kankaTables')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="font-serif italic text-center" style={{ color: '#f5f5f5', fontSize: 15 }}>
        {t('landing.hurry')}
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
              className="shrink-0 w-4 h-4 transition-transform duration-200"
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
  const t = useTranslations();
  const launchDate = new Date(process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-10-11T00:00:00Z');
  const now = new Date();
  const msElapsed = Math.max(0, now.getTime() - launchDate.getTime());
  const hoursElapsed = Math.floor(msElapsed / (1000 * 60 * 60));
  const weeksElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24 * 7));

  const targetMembers = 100 + hoursElapsed * 2;
  const targetTables = 27 + weeksElapsed * 4;
  // Aktif şehir sayısı sistemden gelir
  const [targetCities, setTargetCities] = useState(0);
  useEffect(() => {
    api.get<{ isActive?: boolean }[]>('/auth/cities').then((c) => setTargetCities(c.filter((x) => x.isActive !== false).length)).catch(() => undefined);
  }, []);

  const members = useCountUp(targetMembers);
  const tables = useCountUp(targetTables);
  const cities = useCountUp(targetCities);

  const stats = [
    { label: t('landing.statUsers'), value: members },
    { label: t('landing.statTables'), value: tables },
    { label: t('landing.statCities'), value: cities },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .stat-wrap{position:relative;border-radius:16px;padding:1px;overflow:hidden;}
        .stat-inner{position:relative;z-index:1;border-radius:14px;background:rgba(12,8,8,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 12px;}
      ` }} />
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

/* ─── Ana bileşen ────────────────────────────────────────────────────────── */

export default function Home() {
  const t = useTranslations();
  const router = useRouter();
  const [activeCity, setActiveCity] = useState('İstanbul');
  const [cities, setCities] = useState<{ name: string }[]>([]);

  useEffect(() => {
    // Sıra: İstanbul, Ankara, İzmir, Antalya; varsayılan seçili İstanbul
    const order = ['İstanbul', 'Ankara', 'İzmir', 'Antalya'];
    const rank = (n: string) => (order.indexOf(n) === -1 ? order.length : order.indexOf(n));
    api.get<{ name: string; isActive?: boolean }[]>('/auth/cities')
      .then((list) => setCities([...list.filter((x) => x.isActive !== false)].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'tr'))))
      .catch(() => undefined);
  }, []);

  const [ownedPlans, setOwnedPlans] = useState<Set<PlanKey>>(new Set());
  const [openParts, setOpenParts] = useState<OpenParts>({ group: false, oneOnOne: false });
  const [authState, setAuthState] = useState<{ loggedIn: boolean; kycApproved: boolean } | null>(null);
  const [kankamla, setKankamla] = useState<KankamlaState | null>(null);

  useEffect(() => {
    api.silentGet<{ ownedPlans?: PlanKey[]; openParts?: OpenParts; kankamla?: KankamlaState; isKycVerified?: boolean }>('/auth/me').then((d) => {
      if (d) {
        setOwnedPlans(new Set(d.ownedPlans ?? []));
        if (d.openParts) setOpenParts(d.openParts);
        setKankamla(d.kankamla ?? null);
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
    // Giriş yapmış kullanıcı (KYC onaylı ya da değil) → profil paket sekmesine
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
                <span className="text-[#f5f5f5]">{t('landing.heroLine1')}</span><br />
                <span className="text-[#c0392b] font-normal">{t('landing.heroLine2')}</span>
              </motion.p>
            </div>
            <motion.div
              className="flex flex-wrap items-center gap-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.15, duration: 0.45, ease: 'easeOut' }}
            >
              <StdButton variant="primary" as={Link} href="/kayit">
                {t('landing.join')}
              </StdButton>
              <StdButton variant="ghost" as="a" href="#how-it-knows-you">
                {t('landing.howItWorks')}
              </StdButton>
            </motion.div>
          </div>

          {/* ── Sayaç (masaüstü: hero'nun sağ altında) ─────────────────────── */}
          <div className="hidden md:block relative z-10 px-6 lg:px-16 py-8 md:absolute md:bottom-8 md:right-8 md:scale-90 md:origin-bottom-right">
            <HeroCountdown />
          </div>
        </section>

        {/* ── Sayaç (mobil genişlik: hero bittikten sonra, stats'tan önce) ── */}
        <div className="md:hidden relative z-10 px-6 py-8">
          <HeroCountdown />
        </div>

        <div><StatCards /></div>

        {/* ── Bunu daha önce denemedin ─────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 lg:px-16 py-20 lg:py-28">
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl italic text-[#f5f5f5] mb-14 lg:mb-18">
            {t('landing.neverTried')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">
            {[
              {
                title: t('landing.f1t'),
                body: t('landing.f1b'),
              },
              {
                title: t('landing.f2t'),
                body: t('landing.f2b'),
              },
              {
                title: t('landing.f3t'),
                body: t('landing.f3b'),
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
            <StdButton variant="primary" as={Link} href="/kayit">
              {t('landing.pickTable')}
            </StdButton>
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
              {t('landing.whyClick')}
            </h2>
            {/* Paragraf */}
            <p
              className="text-center mx-auto mb-16"
              style={{ maxWidth: 540, fontSize: 15, fontWeight: 300, color: 'rgba(245,245,245,0.88)', lineHeight: 1.8 }}
            >
              {t('landing.whyClickBody')}
            </p>
            {/* 5 kart */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5 mb-16">
              {[
                { letter: 'O', word: t('landing.oWord'),      desc: t('landing.oDesc') },
                { letter: 'C', word: t('landing.cWord'),         desc: t('landing.cDesc') },
                { letter: 'E', word: t('landing.eWord'), desc: t('landing.eDesc') },
                { letter: 'A', word: t('landing.aWord'),    desc: t('landing.aDesc') },
                { letter: 'N', word: t('landing.nWord'),        desc: t('landing.nDesc') },
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
                    {item.word}
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
              {t('landing.fillTest')}
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
              {t('landing.pricing')}
            </h2>
          </div>
          {/* Paket ekranıyla aynı Tinder tarzı kartlar; avantajlar ve buton her zaman açık (aç/kapa yok).
              2 sütunlu grid: Masada + Karşımda, Kankamla + İçerde, Premium Paket tam genişlik, Premium Paket Abonelik Detayları tam genişlik; dar ekranda tek sütun */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {CARDS.map((card) => {
              const cs = card.key === 'PRIME' ? null : card.key === 'KANKAMLA' ? getKankamlaCardState(kankamla) : getPlanCardState(card.key, ownedPlans, openParts);
              return (
                <div key={card.key} className={`flex flex-col gap-2${card.key === 'PRIME' ? ' sm:col-span-2' : ''}`}>
                  {/* Web'de aç/kapa yok: avantajlar ve buton her zaman açık */}
                  <PaketKarti card={card} blocked={!!cs && !cs.showButton} staticCard />
                  <div className="ll-card flex flex-col gap-3">
                      <h4 className="text-base font-semibold text-[#f5f5f5]">{t('landing.advantages')}</h4>
                      <ul className="flex flex-col gap-2.5">
                        {card.advantages.map((a) => (
                          <li key={a} className="flex items-center gap-2 text-sm text-[#c9c2b8]"><Check color={card.accent} />{t(a)}</li>
                        ))}
                      </ul>
                      {(!cs || cs.showButton) && (
                        // Premium "ABONE OL": tam genişlik değil, diğer paket butonlarıyla aynı boyda (geniş ekranda yarım genişlik), ortalı
                        <BuyButton card={card} onClick={() => handlePlanSelect(card.key)} className={card.key === 'PRIME' ? 'w-full sm:w-[calc(50%-6px)] self-center' : 'w-full'}
                          label={card.key === 'PRIME' ? t('pkg.subscribe') : t('pkg.buy')} />
                      )}
                  </div>
                </div>
              );
            })}

          {/* Premium Paket Abonelik Detayları: tam genişlik 4. satır; başlık ve çerçeve Premium kartıyla aynı altın / amber */}
          <div className="ll-card flex flex-col gap-4 sm:col-span-2" style={{ border: `1px solid ${AMBER}` }}>
            <h3 className="font-serif text-2xl" style={{ color: AMBER }}>{t('landing.primeDurations')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([['PRIME_1M', 'card.month1'], ['PRIME_3M', 'card.month3'], ['PRIME_6M', 'card.month6'], ['PRIME_12M', 'card.month12']] as const).map(([key, label]) => (
                <div key={key} className="rounded-xl px-3 py-3" style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-sm font-semibold text-[#f5f5f5]">{t(label)}</p>
                  <p className="text-xs text-[#c9c2b8] mt-1"><PlanPriceText plan={key} suffix=" ₺" /></p>
                </div>
              ))}
            </div>
            <ul className="flex flex-col gap-2 text-sm text-[#c9c2b8]" style={{ lineHeight: 1.5 }}>
              <li>{t('landing.primeRule1')}</li>
              <li>{t('landing.primeRule2')}</li>
              <li>{t('landing.primeRule3')}</li>
              <li>{t('landing.primeRule4')}</li>
            </ul>
          </div>
          </div>
        </section>

      </div>
    </main>
  );
}
