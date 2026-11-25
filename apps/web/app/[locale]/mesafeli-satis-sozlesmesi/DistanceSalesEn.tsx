// İngilizce yasal metin (yapay zekâ çevirisi). En üstte: Türkçe metin esas alınır notu
'use client';

import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { PlanPriceText } from '@/components/PlanPrice';
import { COMPANY_ADDRESS, COMPANY_TITLE, JURISDICTION_EN } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Parties',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
        <div style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Seller</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' }}>
            <p style={{ color: '#f4f1ec', fontWeight: 600 }}>{COMPANY_TITLE}</p>
            <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo showTitle={false} en />
            <p style={{ fontSize: 13 }}><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
            <p style={{ fontSize: 13 }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
          </div>
        </div>
        <div style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Buyer</p>
          <p style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
            The user registered on the platform who purchases a package. The Buyer’s name, surname, email and address are taken from the information entered during registration.
          </p>
        </div>
      </div>
    ),
  },
  {
    n: '02',
    title: 'Subject of the Agreement',
    content: (
      <>
        <p style={{ marginBottom: '1.25rem', lineHeight: 1.75 }}>
          This agreement governs the mutual obligations arising from the Buyer’s purchase of one of the one-time digital service packages or the Premium subscription below, and the Seller’s provision of that service. The services are <strong style={{ color: '#f4f1ec' }}>entirely digital</strong>; there is no physical delivery.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
          {[
            {
              name: 'Group Package',
              price: <PlanPriceText plan="MASADA" suffix="₺" />,
              items: [
                '1 group meetup credit with algorithmic matching based on the OCEAN Big Five model',
                'Valid until used',
                'Group tables seat 4–6 people',
                'Venue selection and booking are handled by Ahenk',
              ],
            },
            {
              name: 'Duo Package',
              price: <PlanPriceText plan="KARSIMDA" suffix="₺" />,
              items: [
                '1 Duo meetup credit with algorithmic matching based on the OCEAN Big Five model',
                'Valid until used',
                'Duo for 2 people',
                'Venue selection and booking are handled by Ahenk',
              ],
            },
            {
              name: 'Double Pass Package',
              price: <PlanPriceText plan="ICERDE" suffix="₺" />,
              items: [
                '1 group + 1 Duo meetup credit',
                'Valid until used',
              ],
            },
            {
              name: 'Bring a Buddy Package',
              price: <PlanPriceText plan="KANKAMLA" suffix="₺" />,
              items: [
                '1 Bring a Buddy meetup credit: the Buyer and their same-gender Kanka meet a pair of friends of the opposite gender at a table for 4',
                'Only the Buyer purchases the package; their Kanka joins for free. The package cannot be purchased before a Kanka is chosen',
                'Valid until used',
                'Venue selection and booking are handled by Ahenk',
              ],
            },
            {
              name: 'Premium Package',
              price: null,
              items: [
                '1-, 3-, 6- and 12-month plans',
                '1 group, 1 Duo and 1 Bring a Buddy meetup credit every 30 days',
              ],
            },
          ].map((pkg) => (
            <div key={pkg.name} style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.7rem' }}>
                <span style={{ fontWeight: 700, color: '#f4f1ec', fontSize: 13 }}>{pkg.name}</span>
                <span style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 13 }}>{pkg.price}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' }}>
                {pkg.items.map((item) => (
                  <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#a39c93', fontSize: 13, lineHeight: 1.55 }}>
                    <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '0.85rem', color: '#8f887f', fontSize: 13 }}>All prices include VAT. For one-time packages, credits remain valid until used.</p>
      </>
    ),
  },
  {
    n: '03',
    title: 'Payment Terms',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Payments are collected securely by credit or debit card through the iyzico Ödeme Hizmetleri A.Ş. infrastructure.',
          'Card details are not stored by Ahenk; they are processed in iyzico’s PCI-DSS compliant system.',
          'Packages are purchased with a one-time payment; no subscription, automatic renewal or repeat charge to a saved card applies.',
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
    title: 'Service Performance and Delivery',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Once payment is confirmed, the package is activated instantly and added to the user’s account.',
          'The service is entirely digital; there is no physical product or delivery.',
          'To use the service during the package period, the user must have completed identity verification.',
          'One-time package credits remain valid until used; Premium credits are renewed every 30 days.',
          'You cannot be included in matching until identity verification is complete.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '05',
    title: 'Right of Withdrawal',
    content: (
      <>
        <p style={{ lineHeight: 1.75, marginBottom: '1rem' }}>
          Under Article 49 of Consumer Protection Law No. 6502 and Article 15 of the Distance Contracts Regulation, <strong style={{ color: '#f4f1ec' }}>the right of withdrawal cannot be exercised for digital content and services once performance has started with the consumer’s approval.</strong>
        </p>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: '10px' }}>
          <p style={{ color: '#f4f1ec', fontSize: 13, lineHeight: 1.65 }}>
            When completing payment, the user expressly confirms that the digital service will start immediately and therefore waives the right of withdrawal. This confirmation is obtained clearly and understandably on the payment page.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '06',
    title: 'Cancellation Policy',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
          {[
            'Premium membership is offered in 1-, 3-, 6- and 12-month plans; 1 Group, 1 Duo and 1 Bring a Buddy meetup credit is granted every 30 days.',
            'Unused Premium credits do not carry over to the next 30 days.',
            'Premium subscriptions renew automatically for the same period at the end of each term.',
            'When a Premium subscription is cancelled, automatic renewal stops; credits remaining at the moment of cancellation stay valid with no time limit until used; no refunds are given.',
            'Subscriptions purchased through a store (App Store / Google Play) are cancelled through that store; subscriptions purchased with iyzico are cancelled on the website or in the app.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    n: '07',
    title: 'Warranty and Liability',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Ahenk provides algorithmic matching based on the OCEAN model; it does not guarantee a match with a specific person or that a meetup will take place.',
          'Ahenk does not guarantee that all participants at a table formed by matching will attend the meetup. Attendance depends on each user’s own will and cannot be enforced by Ahenk.',
          'Ahenk reserves the right to make system adjustments to table composition so that tables can be formed and participant balance maintained.',
          'Matching may not take place in cities or periods with an insufficient number of users. In that case, Ahenk agrees to offer the user an alternative service for the relevant period.',
          "Ahenk cannot be held responsible for the service quality of the venue where meetups take place.",
          'Ahenk cannot be held responsible for personal disagreements or material or moral damages between users during meetups.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '08',
    title: 'Protection of Personal Data',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Personal data processed during the purchase is protected under KVKK No. 6698. For details, see our{' '}
        <Link href="/gizlilik-politikasi" style={{ color: '#c0392b' }}>Privacy Policy</Link>
        {' '}and{' '}
        <Link href="/kvkk" style={{ color: '#c0392b' }}>KVKK Information Notice</Link>
        {' '}pages.
      </p>
    ),
  },
  {
    n: '09',
    title: 'Dispute Resolution',
    content: (
      <>
        <p style={{ marginBottom: '1rem', lineHeight: 1.75 }}>
          Your legal rights as a consumer are reserved. For complaints, you can first contact{' '}
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
          {' '}.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
          {[
            'You have the right to apply to Consumer Arbitration Committees within the current monetary limits set each year by the Ministry of Trade.',
            JURISDICTION_EN,
            'Under Law No. 6502, the consumer may also apply to the Consumer Arbitration Committee or Consumer Court where they reside.',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    n: '10',
    title: 'Entry Into Force',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        This agreement enters into force when the user confirms the payment and remains valid until the rights of the purchased package end. The agreement and the pre-information form are kept permanently in your account and you can access them at any time.
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

export default function DistanceSalesEn() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p role="note" style={{ margin: '0 0 1rem', padding: '10px 14px', borderRadius: 10, background: 'rgba(214,69,58,0.08)', border: '1px solid rgba(214,69,58,0.35)', color: '#f4f1ec', fontSize: 13, lineHeight: 1.5 }}>This is a translation for convenience. In case of any conflict, the Turkish version prevails.</p>
          <h1 className="ll-title">
            Distance Sales Agreement
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#8f887f', fontSize: 13, lineHeight: 1.5 }}>
            Under Consumer Protection Law No. 6502 and the Distance Contracts Regulation
          </p>
          <p style={{ marginTop: '0.25rem', color: '#8f887f', fontSize: 11 }}>
            Last updated: November 2026
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
