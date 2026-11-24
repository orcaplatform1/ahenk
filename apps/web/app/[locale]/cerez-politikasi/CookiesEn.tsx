// İngilizce yasal metin (yapay zekâ çevirisi). En üstte: Türkçe metin esas alınır notu
'use client';

import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { COMPANY_ADDRESS, JURISDICTION_EN } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';
import { StdButton } from '@ahenk/ui';

const sections = [
  {
    n: '01',
    title: 'What Is a Cookie?',
    content: (
      <p>
        Cookies are small text files that the websites you visit place in your browser. They let a site recognize you, remember your preferences and offer a better experience. Cookies contain no malware and cannot directly access your personal data.
      </p>
    ),
  },
  {
    n: '02',
    title: 'Cookie Types Ahenk Uses',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' }}>
        {/* Zorunlu */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Essential Cookies
            </span>
            <span style={{ fontSize: 11, padding: '0.15rem 0.6rem', background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '999px', color: '#c0392b', fontWeight: 600 }}>
              Cannot be turned off
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              { name: 'access_token', desc: 'Authenticates the logged-in user’s API requests. Duration: 15 minutes. HttpOnly: Yes.' },
              { name: 'refresh_token', desc: 'Renews the session when access expires. Duration: 7 days. HttpOnly: Yes.' },
              { name: 'ahenk_session', desc: 'A marker that only shows whether a session is open; it contains no personal data. Duration: 7 days. HttpOnly: No.' },
              { name: 'venue_token', desc: 'Authenticates the venue panel session; used only for venue accounts. Duration: 7 days. HttpOnly: Yes.' },
            ].map((c) => (
              <div key={c.name} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#ff6b6b', display: 'block', marginBottom: '0.2rem' }}>{c.name}</span>
                <span style={{ color: '#a39c93', fontSize: 13 }}>{c.desc}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '0.75rem', color: '#8f887f', fontSize: 13, lineHeight: 1.6 }}>
            These cookies are technically required for the platform to work. If they are turned off, logging in and using the platform is not possible. If the ahenk_token cookie from a previous version is in your browser, it is deleted automatically.
          </p>
        </div>

        {/* Yerel depolama */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Browser Local Storage (localStorage)
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              { name: 'cookie-consent', desc: 'Stores your cookie consent. It is not a cookie; it is kept in your browser’s local storage until you delete it.' },
              { name: 'ahenk_masa_tab', desc: 'Remembers the tab you last chose on the tables screen. It is not a cookie; it is kept in your browser’s local storage.' },
            ].map((c) => (
              <div key={c.name} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>{c.name}</span>
                <span style={{ color: '#a39c93', fontSize: 13 }}>{c.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Analitik */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Analytics Cookies
            </span>
            <span style={{ fontSize: 11, padding: '0.15rem 0.6rem', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', color: '#a39c93', fontWeight: 600 }}>
              Requires consent
            </span>
          </div>
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Google Analytics 4: cookies starting with _ga and _ga_</span>
            <span style={{ color: '#a39c93', fontSize: 13 }}>Provider: Google LLC. Purpose: visit and traffic source statistics. Duration: 2 years.</span>
          </div>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
            Without consent, anonymous signals without cookies are sent to Google; these signals do not identify you.
          </p>
        </div>

        {/* Pazarlama */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Marketing Cookies
            </span>
            <span style={{ fontSize: 11, padding: '0.15rem 0.6rem', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', color: '#a39c93', fontWeight: 600 }}>
              Requires consent
            </span>
          </div>
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Meta Pixel: _fbp</span>
            <span style={{ color: '#a39c93', fontSize: 13 }}>Provider: Meta Platforms. Purpose: ad measurement and retargeting. Duration: 3 months. Runs only with consent.</span>
          </div>
        </div>

        <p style={{ color: '#8f887f', fontSize: 13 }}>
          You can change your consent at any time from the Preferences section of the banner. When you withdraw consent, the related cookies are deleted from your browser. To reopen the banner, use the Update My Cookie Preferences button at the bottom of this page.
        </p>
      </div>
    ),
  },
  {
    n: '03',
    title: 'Third-Party Cookies',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
          <p style={{ fontWeight: 600, color: '#f4f1ec', marginBottom: '0.4rem', fontSize: 13 }}>iyzico Payment System</p>
          <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.6 }}>
            On the package purchase page, iyzico uses its own security and fraud-prevention cookies. These cookies are covered by iyzico’s privacy policy and are not controlled by Ahenk.
          </p>
        </div>
      </div>
    ),
  },
  {
    n: '04',
    title: 'Managing Cookies',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>All modern browsers let you manage cookies:</p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            ['Chrome', 'Settings → Privacy and Security → Cookies'],
            ['Firefox', 'Settings → Privacy and Security → Cookies'],
            ['Safari', 'Preferences → Privacy → Cookies'],
          ].map(([browser, path]) => (
            <div key={browser} style={{ display: 'flex', gap: '1rem', padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
              <span style={{ color: '#f4f1ec', fontWeight: 600, fontSize: 13, minWidth: '70px' }}>{browser}</span>
              <span style={{ color: '#a39c93', fontSize: 13 }}>{path}</span>
            </div>
          ))}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
          <li style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b' }}>›</span>
            If essential cookies are turned off, you cannot log in or use the services.
          </li>
          <li style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b' }}>›</span>
            Turning off analytics and marketing cookies does not affect platform functionality.
          </li>
        </ul>
      </>
    ),
  },
  {
    n: '05',
    title: 'Cookie Consent Banner',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        On your first visit, a notice asks you to set your cookie preferences. Your consent is stored not as a cookie but in your browser’s local storage (localStorage), and the notice is not shown again. You can update your preferences on this page at any time.
      </p>
    ),
  },
  {
    n: '06',
    title: 'Data Security',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
        {[
          'Data processed through cookies is protected with SSL/TLS encryption.',
          'The access_token, refresh_token and venue_token cookies are marked HttpOnly and Secure and cannot be accessed by JavaScript.',
          'The ahenk_session cookie is marked Secure but is not HttpOnly. It only shows whether a session is open and contains no personal data.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '07',
    title: 'Cookies Under KVKK',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Essential cookies are processed on the legal basis of <strong style={{ color: '#f4f1ec' }}>legitimate interest</strong>, while analytics and marketing cookies are processed on the legal basis of <strong style={{ color: '#f4f1ec' }}>explicit consent</strong>. For details, see our{' '}
        <Link href="/kvkk" style={{ color: '#c0392b' }}>KVKK Information Notice</Link>.
      </p>
    ),
  },
  {
    n: '08',
    title: 'Contact',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
        <p>For questions about our cookie policy:</p>
        <p><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
        <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo en />
        <p style={{ color: '#a39c93', fontSize: 13 }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
      </div>
    ),
  },
  {
    n: '09',
    title: 'Disputes',
    content: (
      <p>
        {JURISDICTION_EN}
      </p>
    ),
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' as const },
  }),
};

function resetConsent() {
  try {
    localStorage.removeItem('cookie-consent');
    window.location.reload();
  } catch {
    // ignore
  }
}

export default function CookiesEn() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p role="note" style={{ margin: '0 0 1rem', padding: '10px 14px', borderRadius: 10, background: 'rgba(214,69,58,0.08)', border: '1px solid rgba(214,69,58,0.35)', color: '#f4f1ec', fontSize: 13, lineHeight: 1.5 }}>This is a translation for convenience. In case of any conflict, the Turkish version prevails.</p>
          <h1 className="ll-title">
            Cookie Policy
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
            Last updated: November 2026
          </p>
        </motion.div>

        {/* Tercih güncelle butonu */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ marginTop: '2rem', textAlign: 'center' as const }}
        >
          <StdButton variant="ghost"
            onClick={resetConsent}
          >
            Update My Cookie Preferences
          </StdButton>
          <p style={{ marginTop: '0.6rem', color: '#444', fontSize: 11 }}>
            Clicking resets your preferences and shows the banner again.
          </p>
        </motion.div>

        <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' }}>
          {sections.map((sec, i) => (
            <motion.div
              key={sec.n}
              custom={i}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="ll-card"
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span className="ll-eyebrow">{sec.n}</span>
                <h2 className="ll-title">
                  {sec.title}
                </h2>
              </div>
              <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75 }}>
                {sec.content}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
