// İngilizce yasal metin (yapay zekâ çevirisi). En üstte: Türkçe metin esas alınır notu
'use client';

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
        <p style={{ marginBottom: '1rem' }}>
          Under Personal Data Protection Law No. 6698 (KVKK), {COMPANY_TITLE}, acting as <strong style={{ color: '#f4f1ec' }}>data controller</strong>, has prepared this information notice.
        </p>
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.5rem',
          }}
        >
          <p><span style={{ color: '#a39c93' }}>Address:</span>{' '}{COMPANY_ADDRESS}</p>
        <TaxInfo en />
          <p><span style={{ color: '#a39c93' }}>Email:</span>{' '}<a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
          <p><span style={{ color: '#a39c93' }}>Phone:</span>{' '}<a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
        </div>
      </>
    ),
  },
  {
    n: '02',
    title: 'Personal Data Processed and Categories',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1.1rem' }}>
        {[
          {
            cat: 'Identity Data',
            items: ['First name, last name, date of birth, gender', 'Identity document type (ID Card, Driver\'s License, Passport, Residence Permit) and document images (front and back; for a passport, the photo page)', 'The Turkish ID, foreign resident ID (YKN) or passport number entered for a web payment: not stored by Ahenk, only passed to iyzico'],
          },
          {
            cat: 'Biometric Data',
            items: ['Liveness video: because it contains facial images, it is considered special category personal data and is processed with explicit consent'],
            special: true,
          },
          {
            cat: 'Contact Data',
            items: ['Phone number (for the WhatsApp verification code and notifications)', 'Email address', 'The phone number of the person invited in a Bring a Buddy (Kanka) invite'],
          },
          {
            cat: 'Location Data',
            items: [
              'City preference',
              'Emergency location: collected only from the person making an emergency request, at the time of the request and until it is resolved. If the person allows it, location continues to be collected, to the extent the device permits, even when the app is in the background or closed. Other participants’ locations are not collected. The location is shared with the police and monitored by our team. When the request is resolved, coordinates and location history are deleted; the street address of the last location and the request record are kept for legal obligations, possible legal disputes and requests from authorities.',
              'Emergency contacts (up to 2): the names and phone numbers of the people you add in My Profile are used only when you make an Emergency Help request, to automatically notify them via WhatsApp (your first and last name and a Google Maps link to your location at the time of the request); they are not used for any other purpose. You can delete the contacts at any time, and they are also deleted when your account is deleted.',
            ],
          },
          {
            cat: 'Financial Data',
            items: ['Purchased package and payment dates. Card numbers are not stored by Ahenk; they are processed by iyzico'],
          },
          {
            cat: 'Psychological / Personality Data',
            items: ['OCEAN Big Five personality test results and scores (Openness, Conscientiousness, Extraversion, Agreeableness, Emotional Balance)'],
          },
          {
            cat: 'Profile and Preference Data',
            items: ['Field of work', 'Language preferences (interface language, native language, preference for sitting with foreigners)', 'Venue category and alcohol preference', 'Profile photo: shown to table participants after admin approval'],
          },
          {
            cat: 'Communication Content and Complaint Data',
            items: ['Table chat messages (hidden on the user side when the chat closes, kept on the admin side)', 'Chat complaints and automatic block records', 'Problem reports and attached images'],
          },
          {
            cat: 'Behavioral Data',
            items: ['Table meetup history', 'Review scores and comments', 'No-show reports', 'Sanction records (warning, suspension, ban)'],
          },
          {
            cat: 'Security Data',
            items: ['Phone numbers added for contact blocking', 'IP address, session information'],
          },
          {
            cat: 'Technical Data',
            items: ['Browser type, device information, cookie data', 'Mobile notification device key (FCM token) and notification content', 'Session information kept on the device in the mobile app ("remember me" info, language and permission preferences)'],
          },
        ].map((row) => (
          <div key={row.cat}>
            <span
              style={{
                fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: row.special ? '#c0392b' : '#8f887f',
                display: 'block',
                marginBottom: '0.4rem',
              }}
            >
              {row.cat}
              {row.special && ' ⚠'}
            </span>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.3rem' }}>
              {row.items.map((item) => (
                <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
                  <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '03',
    title: 'Purposes of Processing Personal Data',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
        {[
          'Establishing and performing the membership agreement',
          'Carrying out identity verification and keeping the platform secure',
          'Organizing suitable table meetups through algorithmic matching based on the OCEAN personality model',
          'Processing package purchases and payments through the iyzico infrastructure',
          'Communicating with users via push notifications and WhatsApp',
          'Using age, venue category and language preferences in matching',
          'Creating the table compatibility report with artificial intelligence',
          'Automatically moderating table chat with artificial intelligence and enforcing the community guidelines (warning, suspension, ban)',
          'Handling Emergency Help requests: following the location, notifying emergency contacts and sharing with the police',
          'Matching and chat moderation are carried out by automated systems; your right to object to their results is set out in section 8',
          'Fulfilling legal obligations and providing information/documents to authorized institutions',
          'Handling complaints and requests',
          'Improving service quality and carrying out platform development',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '04',
    title: 'Legal Bases for Processing Personal Data',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
        {[
          {
            basis: 'Explicit Consent: Articles 5/1 and 6/2',
            desc: 'OCEAN personality test results, ID document images and liveness video. Users give explicit consent during registration and identity verification.',
          },
          {
            basis: 'Establishment or Performance of a Contract: Article 5/2-c',
            desc: 'First name, last name, phone number, email, city, field of work, language and venue preferences, package and payment data, table chat messages. For Bring a Buddy, the phone number entered in a Kanka invite (to deliver the invite and match it with a verified account) and the Kanka link.',
          },
          {
            basis: 'Legitimate Interest of the Data Controller: Article 5/2-f',
            desc: 'Technical data, IP address, security logs, phone numbers added for contact blocking, automatic table chat moderation, complaint, sanction and no-show records, profile photo approval.',
          },
          {
            basis: 'Compliance with a Legal Obligation: Article 5/2-ç',
            desc: 'Payment records, invoice details, login and traffic records (Law No. 5651), distance sales and commercial message consent records, requests from authorized institutions.',
          },
          {
            basis: 'Explicit Consent and Vital Interest: Articles 5/1 and 5/2-b',
            desc: 'Location data in an Emergency Help request (with the device location permission) and notifying emergency contacts: to protect the life or physical integrity of the person or someone else.',
          },
          {
            basis: 'International Transfer: Article 9',
            desc: 'For each recipient, the data transferred, the purpose and the legal basis for the transfer are set out separately in section 6.',
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
            <p style={{ fontWeight: 600, color: '#f4f1ec', marginBottom: '0.25rem', fontSize: 13 }}>{row.basis}</p>
            <p style={{ color: '#a39c93', fontSize: 13 }}>{row.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '05',
    title: 'Processing of Special Category Personal Data',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          ID document images (because they contain a photo) and the liveness video (biometric data) are special category personal data. This data is:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
          {[
            'Processed only for identity verification',
            'Collected with the user’s explicit consent',
            'Stored encrypted with AES-256-GCM on Ahenk’s own servers',
            'Viewable only by authorized admin staff, decrypted in memory through an authorized endpoint',
            'Not shared with third parties',
            'Kept until the account is deleted; once an account deletion request is approved, ID images, the liveness video and the KYC record are deleted',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    n: '06',
    title: 'Transfer of Personal Data',
    content: (
      <>
        <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Domestic Transfers</p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>iyzico Ödeme Hizmetleri A.Ş.</strong>
          : financial data required for payment and package transactions and the Turkish ID, YKN or passport number entered for a web payment are transferred (the number is not stored by Ahenk); iyzico fulfills its own KVKK obligations.
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Identity documents and liveness video</strong>
          : not transferred abroad; stored encrypted with AES-256-GCM on Ahenk’s own servers.
        </p>
        <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>International Transfers</p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Google Analytics and Meta Pixel</strong>
          : cookie data is processed through these tools and may be transferred to servers abroad. The transfer is based on your explicit consent (KVKK art. 9/6-a), and you can withdraw it at any time from your cookie preferences.
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Anthropic (artificial intelligence, USA)</strong>
          : Data transferred: for the table compatibility report, for each participant the five OCEAN scores and field of work (if any) under a label such as P1, P2 instead of a name, the table type, number of participants and the table&apos;s overall compatibility score; for table chat moderation, only the text of a chat message containing a suspicious word (up to 1,000 characters). No names, gender, age, contact details or identity information are transferred. Purpose: the AI table compatibility report and chat moderation. Legal basis: KVKK art. 9/6-b (necessary for the performance of a contract).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Google Firebase Cloud Messaging (push notifications, USA)</strong>
          : Data transferred: the notification device key (FCM token) and notification content. Purpose: delivering push notifications. Legal basis: KVKK art. 9/6-b (necessary for the performance of a contract).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Meta WhatsApp Business API (USA)</strong>
          : Data transferred: phone number, WhatsApp verification code (OTP), notification content (identity verification result, table confirmation), the invited person&apos;s phone number and invite link in a Bring a Buddy invite; in an Emergency Help request, the emergency contacts&apos; phone numbers, the requester&apos;s first and last name and a location link. Purpose: delivering verification codes and notifications. Legal basis: KVKK art. 9/6-b (necessary for the performance of a contract); for notifying emergency contacts, KVKK art. 9/6-e (protecting life or physical integrity).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>OpenStreetMap Nominatim (address lookup, United Kingdom)</strong>
          : Data transferred: the location coordinates in an Emergency Help request (the OpenStreetMap map service is also used on the admin emergency help map). Purpose: converting coordinates into a street address. Legal basis: KVKK art. 9/6-e (protecting life or physical integrity).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Google Maps (Emergency Help map, USA)</strong>
          : Data transferred: the location coordinates in an Emergency Help request (admin emergency help map and street address lookup; the location link sent to emergency contacts is also a Google Maps link). Purpose: showing the requester&apos;s location on a map and finding the street address. Legal basis: KVKK art. 9/6-e (protecting life or physical integrity).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Apple (App Store) and Google (Google Play), USA</strong>
          : Data transferred: in-app purchase and subscription transaction details. Purpose: verifying and managing purchases and subscriptions. Legal basis: KVKK art. 9/6-b (necessary for the performance of a contract).
        </p>
        <div
          style={{
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
    title: 'Personal Data Retention Periods',
    content: (
      <div>
        {[
          ['Payment, invoice and transaction records (iyzico, App Store, Google Play)', '10 years from the start of the calendar year following the transaction (Turkish Commercial Code art. 82, Tax Procedure Law art. 253). Kept even if the account is deleted; at the end of the period personal fields are anonymized, while the amount, date and transaction number are kept'],
          ['Distance sales and subscription consent records (contract acceptance, pre-information consent, timestamp, IP)', '3 years from the transaction date (Regulation on Distance Contracts)'],
          ['Commercial message consent and opt-out records', '3 years from the date the consent ended (Regulation on Commercial Communication and Commercial Electronic Messages)'],
          ['Login, IP and traffic records', '2 years from the record date (Law No. 5651 art. 5)'],
          ['KVKK notice and explicit consent records', '10 years from the deletion of the account (general limitation period, Turkish Code of Obligations)'],
          ['Identity details of a person involved in an emergency request, complaint or ban (name, surname, email, phone; locked, visible only to authorized admins)', '2 years from the closure of the incident (no fixed legal period, company policy)'],
          ['Unreadable summary (hash) of a banned account\'s phone number', 'Indefinitely (to prevent signing up again)'],
          ['Identity documents (ID images and liveness video)', 'Kept until the account is deleted; once an account deletion request is approved, ID images, the liveness video and the KYC record are deleted'],
          ['Other data: profile, OCEAN test results, profile photos, chat messages, problem reports, contact and user blocks', 'Deleted when the account deletion request is approved; contact blocks are also deleted when the user removes them'],
          ['Emergency location coordinates and location history', 'Deleted when the request is resolved'],
        ].map(([label, value], i, arr) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '0.85rem 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.10)' : 'none',
            }}
          >
            <span style={{ color: '#c9c2b8', fontSize: 13, flex: 1 }}>{label}</span>
            <span style={{ color: '#a39c93', fontSize: 13, textAlign: 'right' as const, flexShrink: 0, maxWidth: '200px' }}>{value}</span>
          </div>
        ))}
        <p style={{ marginTop: '1rem', color: '#8f887f', fontSize: 13 }}>
          When retention periods expire, personal data is deleted, destroyed or anonymized.
        </p>
      </div>
    ),
  },
  {
    n: '08',
    title: 'Rights of the Data Subject Under KVKK Article 11',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
        {[
          'Learning whether your personal data is processed',
          'Requesting information if it has been processed',
          'Learning the purpose of processing and whether it is used accordingly',
          'Learning the third parties to whom it is transferred in Türkiye or abroad',
          'Requesting correction of incomplete or inaccurate data and notification of this to third parties',
          'Requesting deletion or destruction of personal data under Article 7 of KVKK and notification of this to third parties',
          'Objecting to a result against you arising from analysis exclusively by automated systems',
          'Requesting compensation if you suffer damage due to unlawful processing of personal data',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '09',
    title: 'How to Apply',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          To exercise your rights, send an email to{' '}
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
          {' '}.
        </p>
        <p style={{ marginBottom: '0.6rem', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
          Your application should include
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem', marginBottom: '1rem' }}>
          {['Your first and last name', 'Your Turkish ID number; if you are a foreign national, your nationality and passport number or ID number if you have one (to verify your identity)', 'The subject of your request', 'Your contact details'].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13 }}>
              <span style={{ color: '#c0392b' }}>›</span>{item}
            </li>
          ))}
        </ul>
        <p style={{ color: '#a39c93', fontSize: 13 }}>
          Applications are answered free of charge within <strong style={{ color: '#f4f1ec' }}>30 days</strong> . If the application requires an additional cost, a fee may be charged according to the tariff set by the Personal Data Protection Board.
        </p>
      </>
    ),
  },
  {
    n: '10',
    title: 'Right to Complain to the Personal Data Protection Board',
    content: (
      <p>
        If your application is rejected, the response is found insufficient or no response is given in time, you can file a complaint with the{' '}
        <strong style={{ color: '#f4f1ec' }}>Personal Data Protection Board</strong>.
        {' '}Board website:{' '}
        <a href="https://www.kvkk.gov.tr" target="_blank" rel="noopener noreferrer" style={{ color: '#c0392b' }}>kvkk.gov.tr</a>
      </p>
    ),
  },
  {
    n: '11',
    title: 'Disputes',
    content: (
      <p>
        {JURISDICTION_EN}
      </p>
    ),
  },
  {
    n: '12',
    title: 'Career Applications',
    content: <CareerDataNotice en transferRef="Article 6 of this notice (Transfer of Personal Data)" rightsRef="Article 8 (Rights of the Data Subject Under KVKK Article 11)" />,
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

export default function KvkkEn() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        {/* Başlık */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p role="note" style={{ margin: '0 0 1rem', padding: '10px 14px', borderRadius: 10, background: 'rgba(214,69,58,0.08)', border: '1px solid rgba(214,69,58,0.35)', color: '#f4f1ec', fontSize: 13, lineHeight: 1.5 }}>This is a translation for convenience. In case of any conflict, the Turkish version prevails.</p>
          <h1 className="ll-title">
            Personal Data Protection
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#8f887f', fontSize: 13, letterSpacing: '0.02em' }}>
            Information Notice Under KVKK No. 6698
          </p>
          <p style={{ marginTop: '0.25rem', color: '#8f887f', fontSize: 11 }}>
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
