// İngilizce yasal metin. En üstte: Türkçe metin esas alınır notu
'use client';
import { motion } from 'framer-motion';
import { COMPANY_ADDRESS, COMPANY_TITLE } from '@/lib/companyInfo';

const sections: { n: string; title: string; body: string[] }[] = [
  {
    n: '01',
    title: "Data Controller",
    body: [
      "Under Turkish Personal Data Protection Law No. 6698 (KVKK), the data controller is " + COMPANY_TITLE + ". This notice is prepared to obtain your explicit consent for the biometric data processed during identity verification.",
    ],
  },
  {
    n: '02',
    title: "Data Covered by This Consent",
    body: [
      "The liveness video you record during identity verification (your face and the sentence you say in the video) and the comparison of your face in this video with the photo on your ID document (face matching).",
      "Under KVKK article 6, this is biometric data, which is a special category of personal data.",
    ],
  },
  {
    n: '03',
    title: "Purpose",
    body: [
      "To verify that the account holder is a real person and the same person shown on the ID document, to keep fake profiles off the platform and to make sure everyone at the table is verified.",
      "Face matching is done by our verification team, who compare the liveness video with the photo on your ID document.",
    ],
  },
  {
    n: '04',
    title: "Legal Basis",
    body: [
      "Under KVKK article 6, biometric data is processed only on the basis of your explicit consent. Explicit consent is collected with a separate checkbox in the identity verification step, before the liveness video; you cannot continue without ticking it.",
      "Your consent is recorded with the document type, document version, date and time, IP address and platform (web / iOS / Android).",
    ],
  },
  {
    n: '05',
    title: "Other Special Category Data on ID Documents",
    body: [
      "ID documents may contain special category data (for example, blood type on a driving licence). This data is not read, not recorded separately and not processed for any purpose.",
    ],
  },
  {
    n: '06',
    title: "Storage and Security",
    body: [
      "ID document images and the liveness video are stored encrypted with AES-256-GCM on the Ahenk server, are not transferred abroad and can be viewed only by authorized administrators.",
      "They are deleted within 48 hours after your account deletion request is approved. Exception: the identity of a user involved in an emergency help, complaint or ban record is kept locked for 2 years and only SUPERADMIN can access it (KVKK art. 5/2-e).",
    ],
  },
  {
    n: '07',
    title: "Withdrawing Consent",
    body: [
      "You can withdraw your explicit consent at any time by writing to bilgi@ahenk.co. If you withdraw it, your identity cannot be verified, and users without verified identity cannot join tables. Withdrawal does not affect processing carried out before that date.",
      "For your other rights under KVKK article 11, see the KVKK Privacy Notice.",
    ],
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

export default function ConsentEn() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p role="note" style={{ margin: '0 0 1rem', padding: '10px 14px', borderRadius: 10, background: 'rgba(214,69,58,0.08)', border: '1px solid rgba(214,69,58,0.35)', color: '#f4f1ec', fontSize: 13, lineHeight: 1.5 }}>This is a translation for convenience. In case of any conflict, the Turkish version prevails.</p>
          <h1 className="ll-title">
            Explicit Consent Notice
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
              <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75, display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
                {sec.body.map((p, j) => <p key={j}>{p}</p>)}
              </div>
            </motion.div>
          ))}
        </div>

        <p style={{ marginTop: '2rem', color: '#a39c93', fontSize: 13 }}>
          For questions and to withdraw your consent: <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a> · {COMPANY_ADDRESS}
        </p>
      </div>
    </main>
  );
}
