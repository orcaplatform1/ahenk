'use client';

import Link from 'next/link';

const YASAL = [
  { label: 'Kullanım Koşulları',  href: '/kullanim-kosullari' },
  { label: 'Gizlilik Politikası', href: '/gizlilik-politikasi' },
  { label: 'KVKK',                href: '/kvkk' },
  { label: 'Çerez Politikası',    href: '/cerez-politikasi' },
  { label: 'Topluluk Kuralları',  href: '/topluluk-kurallari' },
];

const SIRKET = [
  { label: 'İş Ortaklığı', href: '/is-ortakligi' },
  { label: 'Kariyer',       href: '/kariyer' },
];

const HARITA = [
  { label: 'Site Haritası',     href: '/site-haritasi' },
  { label: 'XML Site Haritası', href: '/sitemap.xml', external: true },
];

function NavGroup({ title, links }: { title: string; links: { label: string; href: string; external?: boolean }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem' }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: '#c0392b', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
        {title}
      </p>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          target={l.external ? '_blank' : undefined}
          rel={l.external ? 'noopener noreferrer' : undefined}
          style={{
            color: '#888',
            fontSize: '0.8rem',
            textDecoration: 'none',
            fontWeight: 500,
            letterSpacing: '0.01em',
            transition: 'color 0.18s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#f5f5f5'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#888'; }}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.5)', padding: '2.5rem 1.5rem 2rem' }}>
      <div style={{ maxWidth: '56rem', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center' }}>

        {/* Kategorili linkler */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2.5rem 4rem' }}>
          <NavGroup title="Yasal" links={YASAL} />
          <NavGroup title="Şirket" links={SIRKET} />
        </div>

        {/* Ayırıcı */}
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.10)' }} />

        {/* Copyright */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <p style={{ color: '#f5f5f5', fontSize: '0.78rem', lineHeight: '1.5' }}>
            © 2026{' '}Ahenk. Tüm hakları saklıdır.
          </p>
          <p style={{ color: '#f5f5f5', fontSize: '0.78rem', lineHeight: '1.5' }}>
            Ahenk bir{' '}
            <a href="https://traders.tr" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer', pointerEvents: 'auto' }}>
              <span style={{ color: '#e8e8e8', fontWeight: 700 }}>Traders</span>
              <span style={{ color: '#4a90d9', fontWeight: 800 }}>.TR</span>
              <span style={{ marginLeft: '3px' }}>🇹🇷</span>
            </a>
            {' '}ticari markasıdır.
          </p>
        </div>

        {/* Site haritası — en alt */}
        <nav style={{ display: 'flex', gap: '1.4rem' }}>
          {HARITA.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              target={l.external ? '_blank' : undefined}
              rel={l.external ? 'noopener noreferrer' : undefined}
              style={{ color: '#333', fontSize: '0.7rem', textDecoration: 'none' }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

      </div>
    </footer>
  );
}
