'use client';

import Link from 'next/link';

const LINKS = [
  { label: 'Kullanım Koşulları', href: '/kullanim-kosullari' },
  { label: 'Gizlilik', href: '/gizlilik-politikasi' },
  { label: 'KVKK', href: '/kvkk' },
  { label: 'Çerez', href: '/cerez-politikasi' },
  { label: 'Topluluk', href: '/topluluk-kurallari' },
  { label: 'İş Ortaklığı', href: '/is-ortakligi' },
  { label: 'Kariyer', href: '/kariyer' },
];

export default function SiteFooter() {
  return (
    <footer
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'rgba(8,8,8,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '0.45rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap' as const,
      }}
    >
      {/* Sol: copyright */}
      <p style={{ color: '#444', fontSize: '0.7rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
        © 2026{' '}
        <span style={{ color: '#666' }}>Ahenk</span>
        {' · '}
        <span style={{ color: '#f5f5f5', fontWeight: 600 }}>Traders</span>
        <span style={{ color: '#1e90ff', fontWeight: 700 }}>.TR</span>
        <span style={{ marginLeft: '2px' }}>🇹🇷</span>
      </p>

      {/* Sağ: linkler */}
      <nav style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.2rem 0.85rem', justifyContent: 'flex-end' }}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{ color: '#3a3a3a', fontSize: '0.68rem', textDecoration: 'none', transition: 'color 0.15s', whiteSpace: 'nowrap' as const }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#777'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#3a3a3a'; }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
