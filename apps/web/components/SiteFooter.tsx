'use client';

import Link from 'next/link';

const LINKS = [
  { label: 'Kullanım Koşulları', href: '/kullanim-kosullari' },
  { label: 'Gizlilik Politikası', href: '/gizlilik-politikasi' },
  { label: 'KVKK', href: '/kvkk' },
  { label: 'Çerez Politikası', href: '/cerez-politikasi' },
  { label: 'Topluluk Kuralları', href: '/topluluk-kurallari' },
  { label: 'İş Ortaklığı', href: '/is-ortakligi' },
  { label: 'Kariyer', href: '/kariyer' },
  { label: 'Site Haritası', href: '/site-haritasi' },
  { label: 'XML Site Haritası', href: '/sitemap.xml' },
];

export default function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.5)', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: '56rem', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>

        {/* Copyright */}
        <p style={{ color: '#555', fontSize: '0.8rem' }}>
          © 2026 <span style={{ color: '#888' }}>Ahenk</span>. Tüm hakları saklıdır.{' '}
          Ahenk bir{' '}
          <span style={{ color: '#f5f5f5', fontWeight: 600 }}>Traders</span>
          <span style={{ color: '#1e90ff', fontWeight: 700 }}>.TR</span>
          <span style={{ marginLeft: '2px' }}>🇹🇷</span>{' '}
          ticari markasıdır.
        </p>

        {/* Fikri mülkiyet */}
        <p style={{ color: '#3a3a3a', fontSize: '0.72rem', maxWidth: '36rem', lineHeight: 1.6 }}>
          Bu platformda yer alan tüm içerikler, tasarımlar, marka unsurları ve fikrî mülkiyet hakları ilgili yasal mevzuat kapsamında korunmaktadır.
        </p>

        {/* Linkler */}
        <nav style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4rem 1.2rem' }}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{ color: '#444', fontSize: '0.75rem', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#888'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#444'; }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

      </div>
    </footer>
  );
}
