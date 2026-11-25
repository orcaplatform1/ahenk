'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';

// group / label / desc: çeviri anahtarı
const SITE_MAP = [
  {
    group: 'sitemap.k1',
    icon: '🏠',
    pages: [{ label: 'sitemap.k2', href: '/', desc: 'sitemap.k3' }],
  },
  {
    group: 'sitemap.k4',
    icon: '👤',
    pages: [
      { label: 'sitemap.k5', href: '/giris', desc: 'sitemap.k6' },
      { label: 'sitemap.k7', href: '/kayit', desc: 'sitemap.k8' },
      { label: 'sitemap.k9', href: '/sifremi-unuttum', desc: 'sitemap.k10' },
      { label: 'sitemap.k11', href: '/sifremi-sifirla', desc: 'sitemap.k12' },
    ],
  },
  {
    group: 'sitemap.k13',
    icon: '🎯',
    pages: [
      { label: 'sitemap.k14', href: '/dashboard', desc: 'sitemap.k15' },
      { label: 'sitemap.k16', href: '/profil', desc: 'sitemap.k17' },
      { label: 'sitemap.k18', href: '/test', desc: 'sitemap.k19' },
      { label: 'sitemap.k20', href: '/test/sonuc', desc: 'sitemap.k21' },
    ],
  },
  {
    group: 'sitemap.k22',
    icon: '🤝',
    pages: [
    ],
  },
  {
    group: 'sitemap.k23',
    icon: '💳',
    pages: [
      { label: 'sitemap.k24', href: '/odeme/basarili', desc: 'sitemap.k25' },
      { label: 'sitemap.k26', href: '/odeme/basarisiz', desc: 'sitemap.k27' },
    ],
  },
  {
    group: 'sitemap.k28',
    icon: '📄',
    pages: [
      { label: 'sitemap.k29', href: '/site-haritasi', desc: 'sitemap.k30' },
      { label: 'sitemap.k31', href: '/sitemap.xml', desc: 'sitemap.k32', external: true },
    ],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: 'easeOut' as const },
  }),
};

export default function SiteHaritasiPage() {
  const t = useTranslations();
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#121212',
        color: '#f5f5f5',
        fontFamily: 'var(--font-sans, system-ui)',
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          padding: '3rem 1.5rem 2rem',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            marginTop: '1.25rem',
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#f5f5f5',
          }}
        >
          {t('sitemap.title')}
        </h1>
        <p style={{ marginTop: '0.6rem', color: '#666', fontSize: '0.9rem' }}>
          {t('sitemap.intro')}
        </p>
      </div>

      {/* Grid */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '3rem 1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {SITE_MAP.map((section, si) => (
          <motion.div
            key={section.group}
            custom={si}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '1rem',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{section.icon}</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#666',
                  textTransform: 'uppercase',
                }}
              >
                {t(section.group)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {section.pages.map((page) => (
                <div key={page.href}>
                  {page.href.includes('[') ? (
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: '#888',
                        cursor: 'default',
                      }}
                    >
                      {t(page.label)}
                    </span>
                  ) : (page as { external?: boolean }).external ? (
                    <a
                      href={page.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: '#c5a572',
                        textDecoration: 'none',
                      }}
                    >
                      {t(page.label)} ↗
                    </a>
                  ) : (
                    <Link
                      href={page.href}
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        color: '#e0e0e0',
                        textDecoration: 'none',
                      }}
                    >
                      {t(page.label)}
                    </Link>
                  )}
                  <p style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#555' }}>
                    {t(page.desc)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
