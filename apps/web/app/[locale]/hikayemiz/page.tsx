'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { usePlanPrices } from '@/components/PlanPrice';
import { api } from '@/lib/api';

/* ─── Fade-in wrapper ────────────────────────────────────────────────────── */
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Sol başlık / sağ metin düzeni ─────────────────────────────────────── */
function TwoCol({ title, body }: { title: string; body: string }) {
  return (
    <FadeIn>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8 md:gap-16 max-w-5xl mx-auto px-6 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <h2
          className="font-serif text-2xl sm:text-3xl md:text-4xl leading-tight"
          style={{ background: 'linear-gradient(135deg,#c0392b,#e8925a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        >
          {title}
        </h2>
        <p className="text-[#ccc] text-base sm:text-lg leading-relaxed">{body}</p>
      </div>
    </FadeIn>
  );
}

/* ─── Tam genişlik tek cümle ─────────────────────────────────────────────── */
function FullQuote({ text }: { text: string }) {
  return (
    <FadeIn>
      <div className="py-20 px-6 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <p
          className="font-serif italic text-white mx-auto"
          style={{ fontSize: 'clamp(1.3rem, 3.5vw, 2rem)', maxWidth: 720, lineHeight: 1.4 }}
        >
          "{text}"
        </p>
        <div
          className="mx-auto mt-6 rounded-full"
          style={{ width: 80, height: 2, background: 'linear-gradient(90deg,#c0392b,#e8925a)' }}
        />
      </div>
    </FadeIn>
  );
}

/* ─── Sayfa ──────────────────────────────────────────────────────────────── */
export default function HikayemizPage() {
  const t = useTranslations();
  const prices = usePlanPrices();
  const tl = (v?: number) => (v === undefined ? '—' : v);
  const [activeCities, setActiveCities] = useState<string[]>([]);
  useEffect(() => {
    api.get<{ name: string; isActive?: boolean }[]>('/auth/cities').then((c) => setActiveCities(c.filter((x) => x.isActive !== false).map((x) => x.name))).catch(() => undefined);
  }, []);
  return (
    <main className="min-h-screen bg-[#121212] text-[#f5f5f5] overflow-x-hidden pt-[52px]">

      {/* Tam ekran açılış */}
      <FadeIn>
        <section className="flex flex-col items-center justify-center text-center py-32 px-6" style={{ minHeight: '60vh' }}>
          <h1
            className="font-serif font-bold text-white leading-none"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)' }}
          >
            {t('story.h1a')}
          </h1>
          <h1
            className="font-serif font-bold leading-none mt-2"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', background: 'linear-gradient(135deg,#c0392b,#e8925a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            {t('story.h1b')}
          </h1>
          <div
            className="mt-8 rounded-full"
            style={{ width: 80, height: 2, background: 'linear-gradient(90deg,#c0392b,#e8925a)' }}
          />
        </section>
      </FadeIn>

      {/* Bölüm 1 */}
      <TwoCol
        title={t('story.t1')}
        body={t('story.b1')}
      />

      {/* Tam genişlik alıntı 1 */}
      <FullQuote text={t('story.q1')} />

      {/* Bölüm 2 */}
      <TwoCol
        title={t('story.t2')}
        body={t('story.b2')}
      />

      {/* Bölüm 3 */}
      <TwoCol
        title={t('story.t3')}
        body={t('story.b3')}
      />

      {/* Tam genişlik alıntı 2 */}
      <FullQuote text={t('story.q2')} />

      {/* Bölüm 4 */}
      <TwoCol
        title={t('story.t4')}
        body={t('story.b4')}
      />

      {/* Bölüm 5 */}
      <TwoCol
        title={t('story.t5')}
        body={t('story.priceBody', { group: tl(prices?.MASADA?.webTL), one: tl(prices?.KARSIMDA?.webTL), kanka: tl(prices?.KANKAMLA?.webTL), icerde: tl(prices?.ICERDE?.webTL) })}
      />

      {/* Bölüm 6 */}
      <TwoCol
        title={t('story.t6')}
        body={t('story.whereBody', { cities: activeCities.join(', ') })}
      />

      {/* Kapanış */}
      <FadeIn>
        <section className="flex flex-col items-center justify-center text-center py-32 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <h2
            className="font-serif font-bold text-white"
            style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}
          >
            {t('story.come')}
          </h2>
          <Link
            href="/kayit"
            className="inline-flex items-center gap-2 rounded-full font-medium text-white mt-8 transition-all"
            style={{
              background: 'linear-gradient(135deg,#c0392b,#ff6b6b)',
              boxShadow: '0 0 28px rgba(192,57,43,0.4)',
              padding: '14px 40px',
              fontSize: '1rem',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 44px rgba(192,57,43,0.75)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(192,57,43,0.4)'; }}
          >
            {t('story.join')}
          </Link>
        </section>
      </FadeIn>

    </main>
  );
}
