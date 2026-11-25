// İngilizce yasal metin. En üstte: Türkçe metin esas alınır notu
'use client';


import { Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import { PlanPriceText } from '@/components/PlanPrice';
import { COMPANY_ADDRESS, COMPANY_TITLE, JURISDICTION_EN } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Seller Details',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' }}>
        <p style={{ color: '#f4f1ec', fontWeight: 600 }}>{COMPANY_TITLE}</p>
        <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo showTitle={false} en />
        <p style={{ fontSize: 13 }}><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
        <p style={{ fontSize: 13 }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
      </div>
    ),
  },
  {
    n: '02',
    title: 'Main Features of the Service',
    content: (
      <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Ahenk is a digital service that organizes group, Duo and Bring a Buddy table meetups with strangers through algorithmic matching based on the OCEAN personality test; there is no physical delivery.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Group Package: 1 Group Table meetup credit. Duo Package: 1 Duo Table meetup credit. Bring a Buddy Package: 1 Bring a Buddy Table meetup credit (the buyer pays, their same-gender Kanka joins for free). Double Pass Package: 1 Group Table + 1 Duo Table meetup credit. In one-time packages, credits stay valid until used.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Premium Package: 1-, 3-, 6- and 12-month subscription; 1 Group + 1 Duo + 1 Bring a Buddy Table every month. Credits renew every 30 days and unused credits do not carry over.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Identity verification must be completed to join tables.</span></li>
          </ul>
      </>
    ),
  },
  {
    n: '03',
    title: 'Total Price',
    content: (
      <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Group Package <PlanPriceText plan="MASADA" suffix="₺" />, Duo Package <PlanPriceText plan="KARSIMDA" suffix="₺" />, Bring a Buddy Package <PlanPriceText plan="KANKAMLA" suffix="₺" />, Double Pass Package <PlanPriceText plan="ICERDE" suffix="₺" />.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Premium Package: 1 month <PlanPriceText plan="PRIME_1M" suffix="₺" />, 3 months <PlanPriceText plan="PRIME_3M" suffix="₺" />, 6 months <PlanPriceText plan="PRIME_6M" suffix="₺" />, 12 months <PlanPriceText plan="PRIME_12M" suffix="₺" />.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Prices are the total website prices including VAT. If a discount applies to the payment, the total amount to pay is shown on the payment screen. In the mobile app the price differs because of the store (App Store / Google Play) commission and is shown on the purchase screen.</span></li>
          </ul>
      </>
    ),
  },
  {
    n: '04',
    title: 'Payment Method',
    content: (
      <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>On the website, payments are collected by credit or debit card through the iyzico Ödeme Hizmetleri A.Ş. infrastructure; card details are not stored by Ahenk.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>In the mobile app, payment is taken from your App Store or Google Play account as an in-app purchase.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>For the Premium subscription, the full amount for the chosen period is charged at once at the start of each period; unless cancelled, the subscription renews automatically for the same period at the end of each term.</span></li>
          </ul>
      </>
    ),
  },
  {
    n: '05',
    title: 'Right of Withdrawal and Exception',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
        <p>Under Article 49 of Consumer Protection Law No. 6502 and Article 15 of the Regulation on Distance Contracts, <strong style={{ color: '#f4f1ec' }}>the right of withdrawal cannot be used for digital content and services once performance has started with the consumer&apos;s approval.</strong></p>
        <p>When the payment is confirmed, the package is added to your account immediately and performance of the service begins. You approve this when completing the payment.</p>
      </div>
    ),
  },
  {
    n: '06',
    title: 'Complaint Channels',
    content: (
      <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>For complaints, you can first contact <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a> or <a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a>.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Within the monetary limits set each year by the Ministry of Trade you can apply to Consumer Arbitration Committees, and above these limits to Consumer Courts; you can also apply to the Consumer Arbitration Committee or Consumer Court where you live.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>{JURISDICTION_EN}</span></li>
          </ul>
      </>
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

export default function PreInfoEn() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p role="note" style={{ margin: '0 0 1rem', padding: '10px 14px', borderRadius: 10, background: 'rgba(214,69,58,0.08)', border: '1px solid rgba(214,69,58,0.35)', color: '#f4f1ec', fontSize: 13, lineHeight: 1.5 }}>This is a translation for convenience. In case of any conflict, the Turkish version prevails.</p>
          <h1 className="ll-title">
            Pre-Information Form
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
            Last updated: November 2026
          </p>
        </motion.div>

        <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' }}>
          {sections.map((sec, i) => (
            <motion.div key={sec.n} custom={i} initial="hidden" animate="show" variants={fadeUp} className="ll-card">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span className="ll-eyebrow">{sec.n}</span>
                <h2 className="ll-title">{sec.title}</h2>
              </div>
              <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75 }}>
                {sec.content}
              </div>
            </motion.div>
          ))}
        </div>

        <p style={{ marginTop: '2rem', color: '#a39c93', fontSize: 13 }}>
          Details: <Link href="/mesafeli-satis-sozlesmesi" style={{ color: '#c0392b' }}>Distance Sales Contract</Link>, <Link href="/kullanim-kosullari" style={{ color: '#c0392b' }}>Terms of Use</Link>.
        </p>
      </div>
    </main>
  );
}
