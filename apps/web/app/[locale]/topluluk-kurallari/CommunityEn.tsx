// İngilizce yasal metin (yapay zekâ çevirisi). En üstte: Türkçe metin esas alınır notu
'use client';

import { motion } from 'framer-motion';
import { COMPANY_ADDRESS, JURISDICTION_EN } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'The Spirit of the Ahenk Community',
    content: (
      <p style={{ lineHeight: 1.8 }}>
        Ahenk brings strangers together through meaningful meetups. The quality of this experience depends not only on our algorithm, but on the attitude of every member of our community. These guidelines aren’t a list of restrictions. They’re the foundation of a safe and meaningful space we build together.
        <br /><br />
        <span style={{ color: '#a39c93', fontSize: 13 }}>By joining the platform, you confirm that you have read, understood and accepted these guidelines.</span>
      </p>
    ),
  },
  {
    n: '02',
    title: 'Before the Meetup',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem' }}>
        {[
          'Register with your real identity. Using a fake name, photo or details is prohibited and will get your account closed permanently.',
          'Answer the OCEAN personality test honestly. Manipulated results lower matching quality and harm the whole community.',
          'Complete identity verification fully. It’s for your safety and everyone else’s.',
          'When you get a meetup invite, decide in time whether you’ll attend. Last-minute cancellations affect the other participants. If you can’t make it, let us know through the platform at least 24 hours in advance.',
          'Note the meetup location and time in advance. Ahenk sends system notifications, but keeping track is your responsibility.',
          'Before heading to the meetup, try to set aside any expectations or prejudices. Everyone can surprise you.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '03',
    title: 'At the Meetup',
    content: (
      <>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem', marginBottom: '1.25rem' }}>
          {[
            'Be on time. If you realize you’ll be more than 15 minutes late, send a notification through the platform.',
            'Show equal attention and respect to everyone at the table. Excluding, ignoring or isolating anyone is unacceptable.',
            'Introduce yourself with your real identity. Don’t give your tablemates misleading information.',
            'Don’t monopolize the conversation. Make sure everyone gets a chance to talk.',
            'Don’t pressure others to drink alcohol. Everyone makes their own choice freely.',
            'Get explicit consent from the others before taking photos or videos at the table. Don’t reveal identities when sharing on social media.',
            'Don’t bring commercial products, services or investment offers to the meetup. Ahenk tables aren’t a place for business.',
            'Don’t openly ask your tablemates for personal details (phone, address, workplace). If you want to stay in touch, do it through the platform.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Topics to avoid at the table</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
            {[
              'Political party propaganda or election campaigning',
              'Arguing about or judging religious beliefs',
              'Discriminatory remarks about race, ethnicity, gender or sexual orientation',
              'Pressuring questions about personal income or wealth',
              'Questions that intrude on other users’ private lives',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#a39c93', fontSize: 13, lineHeight: 1.55 }}>
                <span style={{ color: '#8f887f', flexShrink: 0 }}>•</span>{item}
              </li>
            ))}
          </ul>
        </div>
      </>
    ),
  },
  {
    n: '04',
    title: 'After the Meetup',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem' }}>
        {[
          'Leave an honest review. Your scores and comments directly help improve the algorithm and the quality of the community.',
          'If someone’s behavior made you uncomfortable, report it on the review screen or write to bilgi@ahenk.co. Every report is handled confidentially.',
          'Don’t share your tablemates’ contact details with third parties without their consent.',
          'Don’t misuse personal information you learned at the meetup. It was shared with you in trust.',
          'If you don’t want to be matched with someone again, use Contact Blocking or the block feature on the review screen. Harassment or retaliation is grounds for account closure.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '05',
    title: 'Always Prohibited',
    content: (
      <>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            'Harassing, threatening, insulting or intimidating any user.',
            'Sexual messages, propositions or physical advances. Meetups are social, not romantic.',
            'Discriminatory attitudes or language based on race, ethnicity, religion, gender, sexual orientation, disability or age.',
            'Political party propaganda, election campaigning or ideological pressure.',
            'Religious pressure, imposing beliefs or calls to worship.',
            'Using or encouraging illegal substances.',
            'Attempting to defraud, deceive or manipulate other users.',
            'Collecting, recording or sharing platform data or other users’ information without permission.',
            'Joining with a fake identity or impersonating another user.',
            'Attempting unauthorized access to Ahenk systems.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <div style={{ padding: '0.85rem 1.1rem', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px' }}>
          <p style={{ color: '#f4f1ec', fontSize: 13 }}>
            If conduct contrary to these guidelines is detected, your account <strong>may be closed permanently without warning</strong>.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '06',
    title: 'Table Chat and Profile Photo Rules',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Insults, threats, harassment, sharing phone numbers or social media, offers to change the meeting place and drug-related messages are prohibited in the table chat.',
          'Automatic blocking: messages containing 7 or more digits or a link are not delivered. Messages containing phrases about social media or contact details are checked by AI; a message found to break the rules is not delivered and is reported to the admins.',
          'Reporting: you can report a tablemate\'s message by pressing and holding it (right-click or the message menu on the web) and choosing a reason. You can report the same message only once, and the reported person is not notified. Reports and automatic blocks are reviewed by our team.',
          'Profile photo: inappropriate photos that violate our community guidelines are removed by our team. The first violation is recorded as a warning; if repeated, your account is suspended for 3, 15 or 30 days.',
          'Sanctions: a first violation results in a warning. If a warned user repeats a violation, they are removed from the table or their account is suspended for 3, 15 or 30 days. A user removed from a table forfeits their credit and no refund is given. You can\'t join new tables while suspended.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '07',
    title: 'Protecting Minors',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Ahenk is only for people <strong style={{ color: '#f4f1ec' }}>aged 18 and over</strong>. Bringing minors onto the platform or to meetups is strictly prohibited. Such violations are reported to the authorities immediately.
      </p>
    ),
  },
  {
    n: '08',
    title: 'Sanctions',
    content: (
      <>
        <p style={{ marginBottom: '1rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.7 }}>
          If the community guidelines are violated, Ahenk may apply the following sanctions:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.65rem', marginBottom: '1rem' }}>
          {[
            { level: 'Warning', desc: 'A notification: the first step for minor violations.' },
            { level: 'Suspension', desc: 'Temporarily closing the account: between 1 and 30 days.' },
            { level: 'Permanent Closure', desc: 'Permanently closing the account and blocking access to the platform. A banned person cannot sign up again.' },
          ].map((row) => (
            <div key={row.level} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.06em', color: '#c0392b', minWidth: '100px', paddingTop: '0.1rem' }}>{row.level.toUpperCase()}</span>
              <span style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.55 }}>{row.desc}</span>
            </div>
          ))}
        </div>
        <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.65 }}>
          Conduct involving physical threats or sexual harassment leads directly to permanent closure and is reported to the authorities.
        </p>
      </>
    ),
  },
  {
    n: '09',
    title: 'Reporting and Complaints',
    content: (
      <>
        <p style={{ marginBottom: '1rem', lineHeight: 1.75 }}>
          If you think a user has broken these guidelines:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem', marginBottom: '1rem' }}>
          {[
            'You can report it from the review screen.',
            <span key="email">You can email <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>.</span>,
          ].map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.65 }}>
          All reports are handled confidentially, and the reporter’s identity is never shared. Malicious false reports also count as a violation.
        </p>
      </>
    ),
  },
  {
    n: '10',
    title: 'Updates to the Guidelines',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        These guidelines may be updated based on community feedback and platform development. Significant changes are announced by push notification and WhatsApp. Continuing to use the platform means you accept the current guidelines.
      </p>
    ),
  },
  {
    n: '11',
    title: 'Contact',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
        <p>For questions:</p>
        <p><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
        <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo en />
        <p><a href="tel:+905403060080" style={{ color: '#c0392b', fontSize: 13 }}>0540 306 0080</a></p>
        <p style={{ marginTop: '0.5rem', color: '#8f887f', fontSize: 13 }}>{JURISDICTION_EN}</p>
      </div>
    ),
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function CommunityEn() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p role="note" style={{ margin: '0 0 1rem', padding: '10px 14px', borderRadius: 10, background: 'rgba(214,69,58,0.08)', border: '1px solid rgba(214,69,58,0.35)', color: '#f4f1ec', fontSize: 13, lineHeight: 1.5 }}>This is a translation for convenience. In case of any conflict, the Turkish version prevails.</p>
          <h1 className="ll-title">
            Community Guidelines
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#a39c93', fontSize: 13 }}>
            So everyone at Ahenk feels safe and at ease.
          </p>
          <p style={{ marginTop: '0.2rem', color: '#8f887f', fontSize: 11 }}>
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
                <h2 className="ll-title">{sec.title}</h2>
              </div>
              <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75 }}>{sec.content}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
