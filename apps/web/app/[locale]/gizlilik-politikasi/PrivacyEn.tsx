// İngilizce yasal metin (yapay zekâ çevirisi). En üstte: Türkçe metin esas alınır notu
'use client';

import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { COMPANY_ADDRESS, COMPANY_TITLE, JURISDICTION_EN } from '@/lib/companyInfo';
import { CareerDataNotice } from '@/components/CareerDataNotice';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Data Controller',
    content: (
      <>
        <p>
          The data controller of the Ahenk platform is {COMPANY_TITLE}. You can use the contact details below:
        </p>
        <div
          style={{
            marginTop: '1rem',
            padding: '1.25rem 1.5rem',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.5rem',
          }}
        >
          <p>
            <span style={{ color: '#a39c93' }}>Address:</span>{' '}
            {COMPANY_ADDRESS}
          </p>
          <TaxInfo en />
          <p>
            <span style={{ color: '#a39c93' }}>Email:</span>{' '}
            <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
          </p>
          <p>
            <span style={{ color: '#a39c93' }}>Phone:</span>{' '}
            <a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a>
          </p>
        </div>
      </>
    ),
  },
  {
    n: '02',
    title: 'Personal Data We Collect',
    content: (
      <>
        <SubTitle>At Registration</SubTitle>
        <List items={['First and last name', 'Email address', 'Date of birth', 'Gender', 'City preference']} />

        <SubTitle style={{ marginTop: '1.25rem' }}>During Identity Verification</SubTitle>
        <p style={{ color: '#a39c93', fontSize: 13, marginBottom: '0.6rem' }}>
          The following data is <strong style={{ color: '#f4f1ec' }}>special category personal data</strong> and is processed with your explicit consent.
        </p>
        <List
          items={[
            'Image of the front of your ID card',
            'Image of the back of your ID card',
            'Liveness video',
          ]}
        />

        <SubTitle style={{ marginTop: '1.25rem' }}>While Using the Platform</SubTitle>
        <List
          items={[
            'OCEAN personality test results and scores',
            'Table meetup history',
            'Review and comment data',
            'Contact block list: phone numbers you add',
          ]}
        />

        <SubTitle style={{ marginTop: '1.25rem' }}>Technical Data</SubTitle>
        <List items={['IP address', 'Browser type', 'Device information', 'Session data', 'Cookie data']} />
      </>
    ),
  },
  {
    n: '03',
    title: 'Purposes of Processing Personal Data',
    content: (
      <List
        items={[
          'Creating and managing user accounts',
          'Carrying out identity verification and keeping the platform safe',
          'Organizing compatible table meetups through algorithmic matching based on the OCEAN personality model',
          'Creating table compatibility reports: on the morning of the meetup, the OCEAN scores and gender of each participant at a confirmed table are sent, per person, to the AI service Anthropic; the resulting report is shown to table participants on the table card. No names, contact details or identity information are passed to the AI system',
          'Processing package purchases and payments',
          'Communicating with users via email and system notifications',
          'Fulfilling legal obligations and notifying authorized institutions',
          'Keeping the platform secure and preventing misuse',
        ]}
      />
    ),
  },
  {
    n: '04',
    title: 'Legal Basis for Processing Personal Data',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
        {[
          {
            basis: 'Explicit Consent: KVKK Article 5/1',
            desc: 'OCEAN test results, identity documents and liveness video',
          },
          {
            basis: 'Performance of a Contract: KVKK Article 5/2-c',
            desc: 'Registration, payment and service delivery',
          },
          {
            basis: 'Legitimate Interest: KVKK Article 5/2-f',
            desc: 'Platform security, technical data',
          },
          {
            basis: 'Legal Obligation: KVKK Article 5/2-ç',
            desc: 'Financial records, requests from authorized institutions',
          },
        ].map((row) => (
          <div
            key={row.basis}
            style={{
              padding: '1rem 1.25rem',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
            }}
          >
            <p style={{ fontWeight: 600, color: '#f4f1ec', marginBottom: '0.25rem' }}>{row.basis}</p>
            <p style={{ color: '#a39c93', fontSize: 13 }}>{row.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '05',
    title: 'Personal Data Retention Periods',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0' }}>
        {[
          ['User account data', 'Until the account is deleted + 2 years'],
          ['Identity documents (ID images and liveness video)', 'Kept until the account is deleted; once an account deletion request is approved, ID images, the liveness video and the KYC record are deleted'],
          ['OCEAN test results', 'As long as the account is active'],
          ['Payment records', '5 years, under the Tax Procedure Law'],
          ['Phone numbers added for contact blocking', 'Until the user deletes them'],
        ].map(([label, value], i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '0.85rem 0',
              borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.10)' : 'none',
            }}
          >
            <span style={{ color: '#c9c2b8', fontSize: 13, flex: 1 }}>{label}</span>
            <span style={{ color: '#a39c93', fontSize: 13, textAlign: 'right' as const, flexShrink: 0 }}>{value}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '06',
    title: 'Third Parties to Whom Personal Data Is Transferred',
    content: (
      <>
        <SubTitle>Domestic Transfers</SubTitle>
        <p>
          <strong style={{ color: '#f4f1ec' }}>iyzico Ödeme Hizmetleri A.Ş.</strong>
          : for payment collection and package management.
        </p>

        <p>
          <strong style={{ color: '#f4f1ec' }}>Identity documents and liveness video</strong>
          : stored encrypted with AES-256-GCM on Ahenk’s own servers, viewable only by authorized administrators and never shared with any third party.
        </p>

        <SubTitle style={{ marginTop: '1.25rem' }}>International Transfers</SubTitle>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Meta Platforms (WhatsApp Business API)</strong>
          : to deliver phone numbers, WhatsApp verification codes and critical notifications (identity verification result, table confirmation).
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Google (Firebase Cloud Messaging)</strong>
          : the notification device key and notification content, to deliver push notifications.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Anthropic (artificial intelligence)</strong>
          : the OCEAN scores and gender of table participants, to create the table compatibility report; no names, contact details or identity information are sent.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>OpenStreetMap (Nominatim)</strong>
          : to convert location coordinates in emergency requests into a street address.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Emergency contact</strong>
          : the name and phone number of the person you add in My Profile are used only when you make an Emergency Help request, to automatically notify that person via WhatsApp (Meta WhatsApp Business API); they are not used for any other purpose. You can delete the contact at any time, and it is also deleted when your account is deleted.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Apple (App Store) and Google (Google Play)</strong>
          : purchase transaction details, to verify and manage in-app purchases and subscriptions.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Google Analytics and Meta Pixel</strong>
          : cookie data is processed through these tools and may be transferred to servers abroad. The transfer is based on your explicit consent, and you can withdraw it at any time from your cookie preferences.
        </p>

        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            background: 'rgba(192,57,43,0.08)',
            border: '1px solid rgba(192,57,43,0.2)',
            borderRadius: '10px',
          }}
        >
          <p style={{ color: '#f4f1ec', fontSize: 13 }}>
            Your personal data is never sold. Cookie data is shared with Google and Meta for advertising and statistics only with your explicit consent.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '07',
    title: 'Rights of the Data Subject',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          Users may exercise the following rights by writing to{' '}
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
          {' '}:
        </p>
        <List
          items={[
            'Learning whether their personal data is processed',
            'Requesting information if it has been processed',
            'Learning the purpose of processing and whether it is used accordingly',
            'Learning the third parties to whom it is transferred in Türkiye or abroad',
            'Requesting correction if it is incomplete or inaccurate',
            'Requesting deletion or destruction under KVKK Article 7',
            'Requesting that corrections and deletions be notified to third parties',
            'Objecting to a result against them arising from analysis exclusively by automated systems',
            'Requesting compensation for damage caused by unlawful processing',
          ]}
        />
        <p style={{ marginTop: '1rem', color: '#a39c93', fontSize: 13 }}>
          Applications are answered within <strong style={{ color: '#f4f1ec' }}>30 days</strong> .
        </p>
      </>
    ),
  },
  {
    n: '08',
    title: 'Cookies',
    content: (
      <p>
        Ahenk uses essential cookies for platform functionality, for session management and security. If you consent, Google Analytics and Meta Pixel cookies also run. For details, see our{' '}
        <Link href="/cerez-politikasi" style={{ color: '#c0392b' }}>Cookie Policy</Link>
        {' '}inceleyiniz.
      </p>
    ),
  },
  {
    n: '09',
    title: 'Security',
    content: (
      <List
        items={[
          'SSL/TLS encryption: on all data transfers',
          'Identity documents and the liveness video are stored encrypted with AES-256-GCM on Ahenk servers; only authorized administrators can view them, decrypted in memory through an authorized endpoint',
          'Access controls and role-based authorization',
          'Rate limiting and DDoS protection',
        ]}
      />
    ),
  },
  {
    n: '10',
    title: 'Policy Changes',
    content: (
      <p>
        This policy may be updated when needed. Significant changes are sent to your registered email address. You can always find the current policy at{' '}
        <Link href="/gizlilik-politikasi" style={{ color: '#c0392b' }}>ahenk.co/en/gizlilik-politikasi</Link>
        {' '}.
      </p>
    ),
  },
  {
    n: '11',
    title: 'Contact and Disputes',
    content: (
      <>
        <p>
          For any questions, requests and complaints:{' '}
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
        </p>
        <p style={{ marginTop: '0.75rem', color: '#a39c93', fontSize: 13 }}>
          {JURISDICTION_EN}
        </p>
      </>
    ),
  },
  {
    n: '12',
    title: 'Career Applications',
    content: <CareerDataNotice en transferRef="Article 6 of this policy (Third Parties to Whom Personal Data Is Transferred)" rightsRef="Article 7 (Rights of the Data Subject)" />,
  },
];

function SubTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        color: '#8f887f',
        marginBottom: '0.6rem',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
      {items.map((item) => (
        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
          <span style={{ color: '#c0392b', marginTop: '0.15rem', flexShrink: 0 }}>›</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function PrivacyEn() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        {/* Başlık */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p role="note" style={{ margin: '0 0 1rem', padding: '10px 14px', borderRadius: 10, background: 'rgba(214,69,58,0.08)', border: '1px solid rgba(214,69,58,0.35)', color: '#f4f1ec', fontSize: 13, lineHeight: 1.5 }}>This is a translation for convenience. In case of any conflict, the Turkish version prevails.</p>
          <h1 className="ll-title">
            Privacy Policy
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13, letterSpacing: '0.03em' }}>
            Last updated: November 2026
          </p>
        </motion.div>

        {/* Bölümler */}
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
