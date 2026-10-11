'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const SITE_MAP = [
  {
    group: 'Ana Sayfa',
    icon: '🏠',
    pages: [{ label: 'Anasayfa', href: '/', desc: 'Platform tanıtım ve giriş sayfası' }],
  },
  {
    group: 'Hesap',
    icon: '👤',
    pages: [
      { label: 'Giriş Yap', href: '/giris', desc: 'WhatsApp OTP ile güvenli giriş' },
      { label: 'Kayıt Ol', href: '/kayit', desc: 'Yeni hesap oluştur' },
      { label: 'Şifremi Unuttum', href: '/sifremi-unuttum', desc: 'Şifre sıfırlama talebi' },
      { label: 'Şifre Sıfırla', href: '/sifremi-sifirla', desc: 'Yeni şifre belirleme' },
    ],
  },
  {
    group: 'Platform',
    icon: '🎯',
    pages: [
      { label: 'Dashboard', href: '/dashboard', desc: 'Aktif masanı ve bildirimlerini gör' },
      { label: 'Profilim', href: '/profil', desc: 'Profil düzenleme, KYC ve paket yönetimi' },
      { label: 'Kişilik Testi', href: '/test', desc: 'Big Five OCEAN kişilik testi' },
      { label: 'Test Sonucu', href: '/test/sonuc', desc: 'Kişilik analizi ve OCEAN skoru' },
    ],
  },
  {
    group: 'Buluşma',
    icon: '🤝',
    pages: [
      { label: 'Değerlendirme', href: '/degerlendirme/[id]', desc: 'Buluşma sonrası değerlendirme' },
    ],
  },
  {
    group: 'Ödeme',
    icon: '💳',
    pages: [
      { label: 'Ödeme Başarılı', href: '/odeme/basarili', desc: 'Satın alma onay sayfası' },
      { label: 'Ödeme Başarısız', href: '/odeme/basarisiz', desc: 'Ödeme hata sayfası' },
    ],
  },
  {
    group: 'Yasal',
    icon: '📄',
    pages: [
      { label: 'Site Haritası', href: '/site-haritasi', desc: 'Bu sayfa — tüm sayfalara bakış' },
      { label: 'XML Site Haritası', href: '/sitemap.xml', desc: 'Arama motoru XML site haritası', external: true },
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
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#f5f5f5',
        fontFamily: 'var(--font-sans, system-ui)',
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '3rem 1.5rem 2rem',
          textAlign: 'center',
        }}
      >
        <Link
          href="/"
          style={{ color: '#555', fontSize: '0.8rem', letterSpacing: '0.05em', textDecoration: 'none' }}
        >
          ← Anasayfa
        </Link>
        <h1
          style={{
            marginTop: '1.25rem',
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#f5f5f5',
          }}
        >
          Site Haritası
        </h1>
        <p style={{ marginTop: '0.6rem', color: '#666', fontSize: '0.9rem' }}>
          Ahenk platformundaki tüm sayfalara genel bakış
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
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
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
                {section.group}
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
                      {page.label}
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
                      {page.label} ↗
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
                      {page.label}
                    </Link>
                  )}
                  <p style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#555' }}>
                    {page.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <p style={{ color: '#e8e8e8', fontSize: '0.85rem', fontWeight: 500 }}>
          © 2026 Ahenk. Tüm hakları saklıdır.
        </p>
        <p style={{ color: '#888', fontSize: '0.8rem' }}>
          Ahenk bir{' '}
          <span style={{ color: '#f5f5f5', fontWeight: 600 }}>Traders</span>
          <span style={{ color: '#1e90ff', fontWeight: 700 }}>.TR</span>
          <span style={{ marginLeft: '3px' }}>🇹🇷</span>{' '}ticari markasıdır.
        </p>
        <p style={{ color: '#555', fontSize: '0.7rem', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
          Bu platformda yer alan tüm içerikler, tasarımlar, marka unsurları ve fikrî mülkiyet hakları ilgili yasal mevzuat kapsamında korunmaktadır.
        </p>
        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#555' }}>
          <Link href="/site-haritasi" style={{ color: '#555', textDecoration: 'none' }}>Site Haritası</Link>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" style={{ color: '#555', textDecoration: 'none' }}>XML Site Haritası</a>
        </div>
      </div>
    </main>
  );
}
