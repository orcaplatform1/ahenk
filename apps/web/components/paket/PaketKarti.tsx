'use client';

import { useLocale, useTranslations } from 'next-intl';

// Paket kartları: paket ekranı (profil/tabs/TabPaket) ve landing aynı veriyi ve aynı kart görünümünü kullanır
export type CardKey = 'MASADA' | 'KARSIMDA' | 'KANKAMLA' | 'ICERDE' | 'PRIME';
export const PRIME_PLANS = [
  { key: 'PRIME_1M', label: 'card.month1' },
  { key: 'PRIME_3M', label: 'card.month3' },
  { key: 'PRIME_6M', label: 'card.month6' },
  { key: 'PRIME_12M', label: 'card.month12' },
] as const;

// Paket kartları: tam genişlik, premium görünüm — aynı renk ailesinde koyudan ortaya geçişli (gradient) arka plan; açık / soluk ton yok.
// Grup yeşil, Baş Başa kırmızı, Kankamla mavi, İçerde altın; Prime siyahtan koyu antrasite, kırmızı (palet) çerçeve ve ad (#d6453a); rozet ve ok şarap kırmızısı (#7A1F2B).
// name, badge, desc, advantages, PRIME_PLANS.label: çeviri anahtarı (ekranda t(...))
// badgeBg / badgeFg: Tinder GOLD tarzı hap rozet (kartın renk tonuna uyumlu; İçerde ve Prime altın)
export const CARDS: { key: CardKey; name: string; badge: string; desc: string; gradient: [string, string]; fg: string; nameColor: string; border?: string; badgeBg: string; badgeFg: string; arrowColor?: string; advantages: string[] }[] = [
  { key: 'MASADA', name: 'plans.MASADA', badge: 'card.oneTime', desc: 'card.descMASADA', gradient: ['#06301c', '#1c7a49'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: '#2e9e62', badgeFg: '#ffffff',
    advantages: ['card.advMatch', 'card.descMASADA', 'card.advEqual', 'card.advValid'] },
  { key: 'KARSIMDA', name: 'plans.KARSIMDA', badge: 'card.oneTime', desc: 'card.descKARSIMDA', gradient: ['#3d0907', '#a3231b'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: '#d6453a', badgeFg: '#ffffff',
    advantages: ['card.advMatch', 'card.advAge', 'card.descKARSIMDA', 'card.advValid'] },
  { key: 'KANKAMLA', name: 'plans.KANKAMLA', badge: 'card.oneTime', desc: 'card.descKANKAMLA', gradient: ['#071a3a', '#1d4f9c'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: '#3b7dd8', badgeFg: '#ffffff',
    advantages: ['card.advMatch', 'card.advAge', 'card.descKANKAMLA', 'card.advKankaFree', 'card.advValid'] },
  { key: 'ICERDE', name: 'plans.ICERDE', badge: 'card.oneTime', desc: 'card.descICERDE', gradient: ['#3a2804', '#9c7412'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: 'linear-gradient(135deg, #f5d76e, #c9a227 55%, #a8861a)', badgeFg: '#1a1406',
    advantages: ['card.advMatch', 'card.advAge', 'card.descICERDE', 'card.advValidPlural'] },
  { key: 'PRIME', name: 'plans.PRIME', badge: 'card.subscription', desc: 'card.descPRIME', gradient: ['#000000', '#2b2d31'], fg: '#f4f1ec', nameColor: '#d6453a', border: '#d6453a', badgeBg: '#7A1F2B', badgeFg: '#f4f1ec', arrowColor: '#7A1F2B',
    advantages: ['card.advPriority', 'card.advMatch', 'card.advAge', 'card.advPrimeMonthly', 'card.advPrimeKeep', 'card.advPrimeRenew'] },
];

export function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0, color: '#c0392b' }}>
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}


// Tinder tarzı kart: bulunduğu hücrenin tam genişliği (paket listeleri 2 sütunlu grid), koyudan ortaya geçişli arka plan, solda kalın ad + GOLD tarzı rozet, altında tek satır açıklama, sağda ok
// staticCard: tıklanamaz kart (landing — avantajlar her zaman açık, aç/kapa yok): button yerine div, sağdaki ok yok
export function PaketKarti({ card, badge, blocked, onClick, staticCard }: { card: (typeof CARDS)[number]; badge?: string | null; blocked?: boolean; onClick?: () => void; staticCard?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const Tag = staticCard ? 'div' : 'button';
  return (
    <Tag
      onClick={staticCard ? undefined : onClick}
      className={`w-full flex items-center justify-between gap-3 text-left${staticCard ? '' : ' transition-transform active:scale-[0.99]'}`}
      style={{
        background: `linear-gradient(135deg, ${card.gradient[0]} 0%, ${card.gradient[1]} 100%)`,
        border: card.border ? `1px solid ${card.border}` : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: '18px 20px',
        minHeight: 76,
        color: card.fg,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        opacity: blocked ? 0.55 : 1,
      }}
    >
      <span className="flex flex-col gap-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          {/* Tipografi: landing "Prime Abonelik" kartı başlığıyla aynı (font-serif, normal ağırlık, text-2xl); açıklama text-sm sans */}
          <span className="font-serif text-2xl" style={{ color: card.nameColor }}>{t(card.name)}</span>
          <span
            className="rounded-full font-extrabold"
            style={{ fontSize: '0.62rem', letterSpacing: '0.08em', padding: '2px 8px', background: card.badgeBg, color: card.badgeFg, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
          >
            {t(badge ?? card.badge).toLocaleUpperCase(locale === 'en' ? 'en' : 'tr-TR')}
          </span>
        </span>
        <span className="text-sm truncate" style={{ opacity: 0.9 }}>{t(card.desc)}</span>
      </span>
      {!staticCard && <span style={{ color: card.arrowColor ?? card.border ?? card.fg }}><Arrow /></span>}
    </Tag>
  );
}
