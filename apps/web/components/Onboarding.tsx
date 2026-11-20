'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { gColor } from '@ahenk/ui';
import { api } from '@/lib/api';
import { usePlanPrices, type PlanKeyName } from '@/components/PlanPrice';
import { AMBER, AMBER_GRADIENT, CARDS } from '@/components/paket/PaketKarti';

// Paket renkleri (PaketKarti CARDS accent): Masada mavi, Karşımda kırmızı, Kankamla mor, İçerde yeşil
const PKG_COLOR = Object.fromEntries(CARDS.map((c) => [c.key, c.accent])) as Record<string, string>;
import { usePathname } from '@/i18n/navigation';

// Tanıtım akışı ("Nasıl Çalışır"): 8 adım, bilgilendirme amaçlı. Kayıttan sonra bir kez otomatik (OnboardingHost),
// Profilim'deki "Nasıl Çalışır?" butonuyla her zaman. Son adımda "Başla" ya da herhangi bir adımda "Atla" → onClose(true)
// (otomatik açılışta User.onboardingSeenAt doldurulur). Dar ekranda (760 px altı) tam ekran, geniş ekranda 1080×680 pencere.
const C = { bg: '#121212', card: '#1c1c1c', border: '#2e2e2e', primary: '#c0392b', accent: '#ff6b6b', muted: '#b3b3b3', rest: '#333333', text: '#f5f5f5' };
const SERIF = 'var(--font-serif), "DM Serif Display", Georgia, serif';
const SANS = 'var(--font-sans), Inter, sans-serif';
const TOTAL = 8;
const NAV_KEYS = ['onb.nav1', 'onb.s2Title', 'onb.s3Title', 'onb.s4Title', 'onb.s5Title', 'onb.s6Title', 'onb.s7Title', 'onb.s8Title'];

// İnce çizgili ikonlar (stroke 1.5)
function Icon({ d, size = 22, color = C.accent }: { d: React.ReactNode; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
const ICONS = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a16 16 0 0 1-3 3.6M6.4 7.6C4.3 9.1 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /></>,
  check: <><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  sos: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /><path d="M18 4l3 3M21 4l-3 3" /></>,
  wave: <><path d="M3 10c2 0 2-2 4.5-2S10 10 12 10s2-2 4.5-2S19 10 21 10" /><path d="M3 15c2 0 2-2 4.5-2S10 15 12 15s2-2 4.5-2S19 15 21 15" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};

// Üç iç içe halka logo
function RingLogo({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <circle cx="36" cy="36" r="33" stroke={C.primary} strokeWidth="2" />
      <circle cx="36" cy="36" r="23" stroke={C.accent} strokeWidth="2" opacity="0.85" />
      <circle cx="36" cy="36" r="13" stroke={C.primary} strokeWidth="2" />
    </svg>
  );
}

const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' };
const h2: React.CSSProperties = { fontFamily: SERIF, fontWeight: 400, fontSize: 30, lineHeight: 1.15, color: C.text, margin: 0 };
const sub: React.CSSProperties = { fontFamily: SANS, fontSize: 15, color: C.muted, margin: '8px 0 20px', lineHeight: 1.5 };
const small: React.CSSProperties = { fontFamily: SANS, fontSize: 13, color: C.muted, lineHeight: 1.5, margin: 0 };
const strong: React.CSSProperties = { fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.text, margin: 0 };

function Timeline({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ borderLeft: `2px solid ${C.primary}`, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 12, margin: '14px 0' }}>
      {rows.map(([a, b]) => (
        <div key={a} style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: -22, top: 5, width: 10, height: 10, borderRadius: '50%', background: C.bg, border: `2px solid ${C.primary}` }} />
          <p style={{ ...strong, fontSize: 14 }}>{a}</p>
          <p style={small}>{b}</p>
        </div>
      ))}
    </div>
  );
}

function Step({ n, t, wide }: { n: number; t: ReturnType<typeof useTranslations>; wide: boolean }) {
  const prices = usePlanPrices();
  const locale = useLocale();
  const price = (p: PlanKeyName) => (prices?.[p] ? `${prices[p]!.webTL}₺` : '—');
  const [tab, setTab] = useState<'tomorrow' | 'weekend'>('tomorrow');

  if (n === 1) return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', paddingTop: 12 }}>
      <RingLogo size={88} />
      <p style={{ fontFamily: SANS, fontWeight: 600, letterSpacing: '0.18em', color: C.text, margin: '16px 0 4px', fontSize: 16 }}>{t('onb.brand')}</p>
      <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.16em', color: C.muted, margin: '0 0 28px' }}>{t('onb.taglineUpper')}</p>
      <h2 style={{ ...h2, fontSize: 36 }}>{t('onb.s1Title')}</h2>
      <p style={{ fontFamily: SANS, fontSize: 16, color: C.text, lineHeight: 1.6, margin: '14px 0 10px', maxWidth: 440 }}>{t('onb.s1Body')}</p>
      <p style={{ ...small, fontSize: 14 }}>{t('onb.s1Sub')}</p>
    </div>
  );

  if (n === 2) return (
    <div>
      <h2 style={h2}>{t('onb.s2Title')}</h2>
      <p style={sub}>{t('onb.s2Sub')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ ...card, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${C.primary}`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 17 }}>{i}</span>
            <div><p style={strong}>{t(`onb.s2c${i}t`)}</p><p style={{ ...small, marginTop: 4 }}>{t(`onb.s2c${i}b`)}</p></div>
          </div>
        ))}
      </div>
    </div>
  );

  if (n === 3) {
    const oneOff: [string, string, PlanKeyName][] = [['onb.pkGroup', 'onb.pGroupD', 'MASADA'], ['onb.pkOne', 'onb.pOneD', 'KARSIMDA'], ['onb.pKanka', 'onb.pKankaD', 'KANKAMLA'], ['onb.pIcerde', 'onb.pIcerdeD', 'ICERDE']];
    const prime: [string, PlanKeyName][] = [['onb.m1', 'PRIME_1M'], ['onb.m3', 'PRIME_3M'], ['onb.m6', 'PRIME_6M'], ['onb.m12', 'PRIME_12M']];
    return (
      <div>
        <h2 style={h2}>{t('onb.s3Title')}</h2>
        <p style={sub}>{t('onb.s3Sub')}</p>
        <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '0.14em', color: C.muted, margin: '0 0 8px' }}>{t('onb.s3OneOff')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {oneOff.map(([name, desc, plan]) => (
            <div key={plan} style={{ ...card, border: `1px solid ${PKG_COLOR[plan]}` }}>
              {/* Rozet: "TEK SEFERLİK" / "ONE-TIME", paket renginde */}
              <span style={{ display: 'inline-block', fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#ffffff', background: PKG_COLOR[plan], borderRadius: 9999, padding: '2px 8px', marginBottom: 6 }}>{t('card.oneTime').toLocaleUpperCase(locale === 'en' ? 'en' : 'tr-TR')}</span>
              <p style={strong}>{t(name)}</p>
              <p style={{ ...small, fontSize: 12, margin: '2px 0 6px' }}>{t(desc)}</p>
              <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.accent, margin: 0 }}>{price(plan)}</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, border: `1.5px solid ${AMBER}`, marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ ...strong, fontFamily: SERIF, fontWeight: 400, fontSize: 20 }}>{t('onb.prime')}</p>
            <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#1a1406', background: AMBER_GRADIENT, borderRadius: 9999, padding: '2px 8px' }}>{t('onb.primeTag')}</span>
          </div>
          <p style={{ ...small, margin: '6px 0 10px' }}>{t('onb.primeBody')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {prime.map(([m, plan]) => (
              <div key={plan} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                <p style={{ ...small, fontSize: 12 }}>{t(m)}</p>
                <p style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text, margin: '2px 0 0' }}>{price(plan)}</p>
              </div>
            ))}
          </div>
          <p style={{ ...small, fontSize: 12, marginTop: 8 }}>{t('onb.primeCancel')}</p>
        </div>
        <p style={{ ...small, marginTop: 12 }}>{t('onb.s3Foot')}</p>
      </div>
    );
  }

  if (n === 4) return (
    <div>
      <h2 style={h2}>{t('onb.s4Title')}</h2>
      <p style={sub}>{t('onb.s4Sub')}</p>
      <div role="tablist" style={{ display: 'flex', background: C.card, border: `1px solid ${C.border}`, borderRadius: 9999, padding: 4, gap: 4 }}>
        {(['tomorrow', 'weekend'] as const).map(k => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            style={{ flex: 1, minHeight: 44, borderRadius: 9999, border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: 600, background: tab === k ? C.primary : 'transparent', color: tab === k ? '#fff' : C.muted }}>
            {t(k === 'tomorrow' ? 'onb.tabTomorrow' : 'onb.tabWeekend')}
          </button>
        ))}
      </div>
      {tab === 'tomorrow' ? (
        <div style={{ marginTop: 14 }}>
          <p style={{ ...small, fontSize: 14, color: C.text }}>{t('onb.tmIntro')}</p>
          <Timeline rows={[[t('onb.tm1t'), t('onb.tm1b')], [t('onb.tm2t'), t('onb.tm2b')], [t('onb.tm3t'), t('onb.tm3b')], [t('onb.tm4t'), t('onb.tm4b')]]} />
          <div style={card}><p style={small}>{t('onb.tmNote')}</p></div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[['onb.pGroup', 'onb.wkFri'], ['onb.pOne', 'onb.wkSat'], ['onb.pKanka', 'onb.wkSun']].map(([a, b]) => (
              <div key={a} style={{ ...card, padding: '10px 8px', textAlign: 'center' }}>
                <p style={{ ...strong, fontSize: 14 }}>{t(a)}</p>
                <p style={{ ...small, fontSize: 12 }}>{t(b)}</p>
              </div>
            ))}
          </div>
          <Timeline rows={[[t('onb.wk1t'), t('onb.wk1b')], [t('onb.wk2t'), t('onb.tm2b')], [t('onb.wk3t'), t('onb.tm3b')], [t('onb.wk4t'), t('onb.tm4b')]]} />
        </div>
      )}
      <p style={{ ...small, marginTop: 4 }}>{t('onb.s4Foot')}</p>
    </div>
  );

  if (n === 5) return (
    <div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, border: `1px solid ${C.border}`, background: C.card, fontFamily: SANS, fontSize: 12, color: C.accent, marginBottom: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent }} />{t('onb.s5Tag')}
      </span>
      <h2 style={h2}>{t('onb.s5Title')}</h2>
      <p style={sub}>{t('onb.s5Sub')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([['clock', 1], ['pin', 2], ['eyeOff', 3], ['lock', 4]] as const).map(([ic, i]) => (
          <div key={i} style={{ ...card, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><Icon d={ICONS[ic]} /></span>
            <div><p style={strong}>{t(`onb.s5r${i}t`)}</p><p style={{ ...small, marginTop: 4 }}>{t(`onb.s5r${i}b`)}</p></div>
          </div>
        ))}
      </div>
    </div>
  );

  if (n === 6) {
    const people: [string, string][] = [['A.K.', 'MALE'], ['E.Y.', 'FEMALE'], ['M.D.', 'MALE'], ['S.T.', 'FEMALE'], ['C.A.', 'MALE'], ['D.Ö.', 'FEMALE']];
    const D = 52, SW = 5, R = (D - SW) / 2, CIRC = 2 * Math.PI * R;
    return (
      <div>
        <h2 style={h2}>{t('onb.s6Title')}</h2>
        <p style={sub}>{t('onb.s6Sub')}</p>
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', maxWidth: wide ? 440 : undefined }}>
          <div style={{ position: 'relative', height: 120, background: 'linear-gradient(135deg, #2a2a2a 0%, #1c1c1c 100%)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(18,18,18,0) 40%, rgba(18,18,18,0.92) 100%)' }} />
            <span style={{ position: 'absolute', top: 10, left: 10, padding: '3px 9px', borderRadius: 9999, background: 'rgba(192,57,43,0.85)', border: '1px solid rgba(255,107,107,0.5)', color: '#fff', fontFamily: SANS, fontSize: 10, fontWeight: 700 }}>{t('onb.s6Type')}</span>
            <span style={{ position: 'absolute', top: 10, right: 10, padding: '3px 9px', borderRadius: 9999, background: 'rgba(18,18,18,0.6)', border: `1px solid ${C.border}`, color: C.muted, fontFamily: SANS, fontSize: 10, fontWeight: 600 }}>{t('onb.s6Sample')}</span>
            <div style={{ position: 'absolute', left: 12, bottom: 10 }}>
              <p style={{ fontFamily: SERIF, fontSize: 20, color: C.text, margin: 0 }}>{t('onb.s6Venue')}</p>
              <p style={{ display: 'flex', alignItems: 'center', gap: 4, ...small, fontSize: 12 }}><Icon d={ICONS.pin} size={12} />{t('onb.s6District')}</p>
            </div>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...card, padding: '8px 10px', borderRadius: 10 }}>
              <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text }}>{t('onb.s6Time')}</span>
              <span style={{ fontFamily: SANS, fontSize: 12, color: C.muted }}>{t('onb.s6People')}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {people.map(([ini, g]) => (
                <span key={ini} style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${gColor(g)}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 9, fontWeight: 700, color: '#f0f0f0' }}>{ini}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...card, padding: '10px 12px', borderRadius: 10 }}>
              <div style={{ position: 'relative', width: D, height: D, flexShrink: 0 }}>
                <svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={SW} />
                  <circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke="#27ae60" strokeWidth={SW} strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * 0.13} />
                </svg>
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.text }}>%87</span>
              </div>
              <div><p style={{ ...strong, fontSize: 13 }}>{t('onb.s6AiTitle')}</p><p style={{ ...small, fontSize: 12 }}>{t('onb.s6AiSub')}</p></div>
            </div>
          </div>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map(i => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: C.accent, marginTop: 8 }} />
              <span style={{ ...small, fontSize: 14, color: C.text }}>{t(`onb.s6b${i}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (n === 7) return (
    <div>
      <Icon d={ICONS.shield} size={40} />
      <h2 style={{ ...h2, marginTop: 12 }}>{t('onb.s7Title')}</h2>
      <p style={sub}>{t('onb.s7Sub')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([['check', 1], ['sos', 2], ['user', 3]] as const).map(([ic, i]) => (
          <div key={i} style={{ ...card, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 2 }}><Icon d={ICONS[ic]} /></span>
            <div><p style={strong}>{t(`onb.s7c${i}t`)}</p><p style={{ ...small, marginTop: 4 }}>{t(`onb.s7c${i}b`)}</p></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999, border: `1px solid ${C.primary}`, fontFamily: SANS, fontSize: 12, color: C.accent, marginBottom: 12 }}>
        <Icon d={ICONS.sun} size={14} />{t('onb.s8Tag')}
      </span>
      <h2 style={h2}>{t('onb.s8Title')}</h2>
      <p style={{ ...sub, color: C.text }}>{t('onb.s8Body')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon d={ICONS.wave} />
            <span style={strong}>{t(`onb.s8c${i}`)}</span>
          </div>
        ))}
      </div>
      <p style={{ ...small, marginTop: 14 }}>{t('onb.s8Foot')}</p>
    </div>
  );
}

export default function Onboarding({ open, onClose }: { open: boolean; onClose: (completed: boolean) => void }) {
  const t = useTranslations();
  const [step, setStep] = useState(1);
  const [wide, setWide] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 760px)');
    const u = () => setWide(mq.matches);
    u(); mq.addEventListener('change', u);
    return () => mq.removeEventListener('change', u);
  }, []);
  useEffect(() => { if (open) setStep(1); }, [open]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [step]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const go = (n: number) => setStep(Math.min(TOTAL, Math.max(1, n)));
  const primaryLabel = step === 1 ? t('onb.letsStart') : step === TOTAL ? t('onb.finish') : t('onb.next');
  const primary = () => (step === TOTAL ? onClose(true) : go(step + 1));

  const progress = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step} aria-label={t('onb.stepOf', { n: step })} style={{ flex: 1, display: 'flex', gap: 4 }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? C.primary : C.rest, transition: 'background 0.2s' }} />
        ))}
      </div>
      <button type="button" onClick={() => onClose(true)} style={{ minHeight: 44, minWidth: 44, padding: '0 6px', background: 'none', border: 'none', color: C.muted, fontFamily: SANS, fontSize: 14, cursor: 'pointer' }}>{t('onb.skip')}</button>
    </div>
  );

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      {step > 1 ? (
        <button type="button" onClick={() => go(step - 1)} style={{ minHeight: 44, padding: '0 12px', background: 'none', border: 'none', color: C.muted, fontFamily: SANS, fontSize: 15, cursor: 'pointer' }}>{t('onb.back')}</button>
      ) : <span />}
      <button type="button" onClick={primary} style={{ minHeight: 48, padding: '0 28px', borderRadius: 9999, background: C.primary, border: 'none', color: '#fff', fontFamily: SANS, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 20px rgba(192,57,43,0.35)' }}>{primaryLabel}</button>
    </div>
  );

  const content = (
    <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: wide ? '8px 36px 16px' : '8px 20px 16px' }}>
      <Step key={step} n={step} t={t} wide={wide} />
    </div>
  );

  const node = wide ? (
    <div role="dialog" aria-modal="true" aria-label={t('onb.howItWorks')} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 1080, maxWidth: '100%', height: 680, maxHeight: '100%', display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 24, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <aside style={{ width: 340, flexShrink: 0, background: C.card, borderRight: `1px solid ${C.border}`, padding: '36px 28px', display: 'flex', flexDirection: 'column' }}>
          <RingLogo size={56} />
          <p style={{ fontFamily: SANS, fontWeight: 600, letterSpacing: '0.18em', color: C.text, margin: '14px 0 2px', fontSize: 15 }}>{t('onb.brand')}</p>
          <p style={{ ...small, marginBottom: 28 }}>{t('onb.tagline')}</p>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_KEYS.map((k, i) => {
              const active = step === i + 1;
              return (
                <li key={k}>
                  <button type="button" onClick={() => go(i + 1)} aria-current={active ? 'step' : undefined}
                    style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', background: active ? 'rgba(192,57,43,0.14)' : 'transparent' }}>
                    <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${active || i + 1 < step ? C.primary : C.border}`, background: active ? C.primary : 'transparent', color: active ? '#fff' : C.muted, fontFamily: SANS, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ fontFamily: SANS, fontSize: 14, color: active ? C.text : C.muted, fontWeight: active ? 600 : 400 }}>{t(k)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
        <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '20px 0 24px' }}>
          <div style={{ padding: '0 36px 12px' }}>{progress}</div>
          {content}
          <div style={{ padding: '12px 36px 0' }}>{footer}</div>
        </section>
      </div>
    </div>
  ) : (
    <div role="dialog" aria-modal="true" aria-label={t('onb.howItWorks')} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: C.bg, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div style={{ padding: '12px 20px 8px' }}>{progress}</div>
      {content}
      <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${C.border}` }}>{footer}</div>
    </div>
  );
  return createPortal(node, document.body);
}

// Kayıttan sonra bir kez otomatik açılış: oturum varsa ve User.onboardingSeenAt boşsa; kayıt / test / mekân sayfalarında açılmaz
export function OnboardingHost() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const checked = useRef(false);
  const blocked = /^\/(kayit|test|mekan|giris)(\/|$)/.test(pathname);
  useEffect(() => {
    if (blocked || checked.current || !api.hasSession()) return;
    checked.current = true;
    api.get<{ onboardingSeenAt?: string | null }>('/auth/me')
      .then((u) => { if (u && u.onboardingSeenAt === null) setOpen(true); })
      .catch(() => { checked.current = false; });
  }, [blocked]);
  const close = (completed: boolean) => {
    setOpen(false);
    if (completed) api.post('/users/me/onboarding-seen', {}).catch(() => undefined);
  };
  return <Onboarding open={open} onClose={close} />;
}
