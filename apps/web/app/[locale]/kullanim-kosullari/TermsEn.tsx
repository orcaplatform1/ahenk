// İngilizce yasal metin (yapay zekâ çevirisi). En üstte: Türkçe metin esas alınır notu
'use client';

import { motion } from 'framer-motion';
import { PlanPriceText } from '@/components/PlanPrice';
import { COMPANY_ADDRESS, COMPANY_TITLE, JURISDICTION_EN } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Parties and Scope',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        These terms of use govern the rights and obligations between <strong style={{ color: '#f4f1ec' }}>{COMPANY_TITLE}</strong>, operating at {COMPANY_ADDRESS}, and the <strong style={{ color: '#f4f1ec' }}>User</strong> who signs up to the platform. By signing up to or using the platform, you are deemed to have accepted these terms.
      </p>
    ),
  },
  {
    n: '02',
    title: 'Description of the Service',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Ahenk is a digital social platform that uses an algorithmic matching system based on the <strong style={{ color: '#f4f1ec' }}>OCEAN Big Five</strong> personality model to bring users together for group or Duo meetups at restaurants and cafés in their cities. Ahenk organizes venue selection, table bookings and algorithmic matching, but cannot be held responsible for personal experiences during meetups.
      </p>
    ),
  },
  {
    n: '03',
    title: 'Membership Requirements',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'You must be at least 18 years old to become a member.',
          'You must register with your real identity details; registering with false information or someone else’s details is prohibited.',
          'Each user may open only one account. If multiple accounts are detected, all of them will be closed.',
          'Identity verification is mandatory; you cannot be included in table matching until verification is complete.',
          'Keeping the information you provide during membership up to date and accurate is your responsibility.',
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
    title: 'User Obligations',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Entering your real first name, last name, date of birth and gender accurately when registering.',
          'Uploading a genuine identity document and liveness video during identity verification.',
          'Answering the OCEAN personality test honestly, in a way that reflects your real personality.',
          'Treating other participants with respect and honesty at meetups.',
          'Complying with the platform rules and the laws of the Republic of Türkiye.',
          'Not sharing your account details or password with third parties.',
          'Using the platform only for its stated purposes.',
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
    title: 'Prohibited Conduct',
    content: (
      <>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            'Creating a fake or misleading profile.',
            'Impersonating another user.',
            'Harassing, threatening, insulting or discriminating against other users.',
            'Trying to sell commercial products or services during meetups or through the platform.',
            'Using the platform for spam, advertising or promotion.',
            'Trying to manipulate the algorithm or matching system.',
            'Sharing illegal content or encouraging illegal activity.',
            'Attempting to harm the platform’s infrastructure.',
            'Collecting or sharing other users’ personal information without permission.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <div style={{ padding: '0.85rem 1.1rem', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px' }}>
          <p style={{ color: '#f4f1ec', fontSize: 13 }}>
            If conduct contrary to these prohibitions is detected, your account <strong>may be closed without warning</strong>.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '06',
    title: 'Packages and Payment',
    content: (
      <>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.65rem', marginBottom: '1.25rem' }}>
          {[
            { name: 'Group', price: <PlanPriceText plan="MASADA" suffix="₺" />, desc: '1 group meetup credit' },
            { name: 'Duo', price: <PlanPriceText plan="KARSIMDA" suffix="₺" />, desc: '1 Duo meetup credit' },
            { name: 'Bring a Buddy', price: <PlanPriceText plan="KANKAMLA" suffix="₺" />, desc: '1 Bring a Buddy meetup credit; the buyer pays, their same-gender Kanka joins for free, table for 4' },
            { name: 'All-In', price: <PlanPriceText plan="ICERDE" suffix="₺" />, desc: '1 group + 1 Duo meetup credit' },
            { name: 'Prime', price: null, desc: '1-, 3-, 6- and 12-month plans; 1 group, 1 Duo and 1 Bring a Buddy credit every 30 days' },
          ].map((pkg) => (
            <div key={pkg.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
              <span style={{ fontWeight: 700, color: '#f4f1ec', minWidth: '90px', fontSize: 13 }}>{pkg.name}</span>
              <span style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 13, minWidth: '80px' }}>{pkg.price}</span>
              <span style={{ color: '#a39c93', fontSize: 13 }}>{pkg.desc}</span>
            </div>
          ))}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
          {[
            'Payments are collected by credit or debit card through the iyzico Ödeme Hizmetleri A.Ş. infrastructure.',
            'For one-time packages, credits remain valid until used.',
            'Prices include VAT.',
            'Ahenk reserves the right to update package prices, subject to reasonable prior notice.',
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
    n: '07',
    title: 'Cancellation Policy',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Prime membership is offered in 1-, 3-, 6- and 12-month plans; 1 Group, 1 Duo and 1 Bring a Buddy meetup credit is granted every 30 days.',
          'Unused Prime credits do not carry over to the next 30 days.',
          'Prime subscriptions renew automatically for the same period at the end of each term.',
          'When a Prime subscription is cancelled, automatic renewal stops; credits remaining at the moment of cancellation stay valid with no time limit until used; no refunds are given.',
          'Subscriptions purchased through a store (App Store / Google Play) are cancelled through that store; subscriptions purchased with iyzico are cancelled on the website or in the app.',
          'If either member of a pair cancels a Bring a Buddy booking, both are removed from the table and 1 table credit is deducted from the package; each package includes a single cancellation right.',
          'Kanka invites are sent by phone number and are valid for 48 hours; an invite can only be accepted by the account that has verified that number. A Kanka cannot be changed during the week they are chosen. A user being banned ends the Kanka link.',
          'Users who have not completed identity verification are not included in matching.',
          'If one or more participants do not attend after a table has been set, this does not mean the service was not performed.',
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
    title: 'Matching Algorithm and Service Guarantee',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Ahenk performs algorithmic matching based on the OCEAN Big Five model but does not guarantee a match with any specific person.',
          'Ahenk does not guarantee that all participants at a table formed by matching will attend the meetup. Attendance depends on each user’s own will and cannot be enforced by Ahenk.',
          'Ahenk reserves the right to make system adjustments to table composition so that tables can be formed and participant balance maintained.',
          'On the day of the meetup, Ahenk may analyze OCEAN compatibility scores with the help of artificial intelligence to create a table report for the group. This report is informational content summarizing group compatibility only and does not create any commitment or guarantee.',
          'Matching may not take place in cities or periods with an insufficient number of users.',
          'Ahenk does not guarantee the quality or service of the venue where the meetup takes place.',
          'Ahenk cannot be held responsible for personal disagreements that occur during meetups.',
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
    title: 'Account Suspension and Closure',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        If a breach of these terms, use of a false identity, conduct harmful to other users or actions contrary to legal regulations is detected, Ahenk may temporarily suspend or permanently close the user’s account without prior notice. The decision to close an account is at Ahenk’s discretion. Reopening a closed account may be requested; the request is evaluated by Ahenk.
      </p>
    ),
  },
  {
    n: '10',
    title: 'Intellectual Property',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        All designs, software, content, logos, brand names and algorithms on the Ahenk platform belong to or are licensed by Ahenk. Users <strong style={{ color: '#f4f1ec' }}>may not copy</strong>, distribute or use this content for commercial purposes without permission.
      </p>
    ),
  },
  {
    n: '11',
    title: 'Limitation of Liability',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Ahenk cannot be held responsible for personal disagreements or material or moral damages between users during or after meetups arranged through the platform.',
          "In all cases, Ahenk’s liability is limited to the fee paid for the relevant package.",
          'Ahenk cannot be held responsible for service disruptions caused by force majeure (natural disasters, pandemics, infrastructure outages, etc.).',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '12',
    title: 'Changes to the Terms',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Ahenk reserves the right to update these terms of use, subject to prior notice. Updates are announced by email or platform notification. Continuing to use the platform after an update means you accept the new terms.
      </p>
    ),
  },
  {
    n: '13',
    title: 'Contact',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.45rem' }}>
        <p>For any questions, complaints or requests:</p>
        <p><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
        <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo en />
        <p style={{ color: '#a39c93', fontSize: 13 }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
      </div>
    ),
  },
  {
    n: '14',
    title: 'Disputes and Jurisdiction',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        For any disputes arising from or related to these terms of use, <strong style={{ color: '#f4f1ec' }}>the laws of the Republic of Türkiye</strong> apply. {JURISDICTION_EN}
      </p>
    ),
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function TermsEn() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p role="note" style={{ margin: '0 0 1rem', padding: '10px 14px', borderRadius: 10, background: 'rgba(214,69,58,0.08)', border: '1px solid rgba(214,69,58,0.35)', color: '#f4f1ec', fontSize: 13, lineHeight: 1.5 }}>This is a translation for convenience. In case of any conflict, the Turkish version prevails.</p>
          <h1 className="ll-title">
            Terms of Use
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
            Last updated: October 2026
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
