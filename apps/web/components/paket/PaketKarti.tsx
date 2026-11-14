'use client';

// Paket kartları: paket ekranı (profil/tabs/TabPaket) ve landing aynı veriyi ve aynı kart görünümünü kullanır
export type CardKey = 'MASADA' | 'KARSIMDA' | 'KANKAMLA' | 'ICERDE' | 'PRIME';
export const PRIME_PLANS = [
  { key: 'PRIME_1M', label: '1 Aylık' },
  { key: 'PRIME_3M', label: '3 Aylık' },
  { key: 'PRIME_6M', label: '6 Aylık' },
  { key: 'PRIME_12M', label: '12 Aylık' },
] as const;

// Paket kartları: tam genişlik, tek renk; Prime altın tonunda, diğerleri tema renklerinden
// badgeBg: Tinder GOLD tarzı hap rozetin dolgu rengi (kartın tonunun koyusu; Prime altın)
export const CARDS: { key: CardKey; name: string; badge: string; desc: string; color: string; badgeBg: string; advantages: string[] }[] = [
  { key: 'MASADA', name: 'Grup', badge: 'Tek Seferlik', desc: '1 Grup buluşması hakkı', color: '#d6453a', badgeBg: '#9e2f26', advantages: ['1 Grup buluşması hakkı', 'Hak kullanılana kadar geçerli'] },
  { key: 'KARSIMDA', name: 'Başbaşa', badge: 'Tek Seferlik', desc: '1 Başbaşa buluşması hakkı', color: '#c8743c', badgeBg: '#8f5228', advantages: ['1 Başbaşa buluşması hakkı', 'Hak kullanılana kadar geçerli'] },
  { key: 'KANKAMLA', name: 'Kankamla', badge: 'Tek Seferlik', desc: '1 Kankamla buluşması hakkı', color: '#8f887f', badgeBg: '#5f5a54', advantages: ['1 Kankamla buluşması hakkı', 'Arkadaşın ücretsiz katılır', 'Hak kullanılana kadar geçerli'] },
  { key: 'ICERDE', name: 'İçerde', badge: 'Tek Seferlik', desc: '1 Grup + 1 Başbaşa buluşması hakkı', color: '#c0392b', badgeBg: '#86281e', advantages: ['1 Grup buluşması hakkı', '1 Başbaşa buluşması hakkı', 'Haklar kullanılana kadar geçerli'] },
  { key: 'PRIME', name: 'Prime', badge: 'Abonelik', desc: 'Her 30 günde 1 Grup + 1 Başbaşa + 1 Kankamla', color: '#c9a227', badgeBg: 'linear-gradient(135deg, #f5d76e, #c9a227 55%, #a8861a)', advantages: ['Her 30 günde 1 Grup buluşması hakkı', 'Her 30 günde 1 Başbaşa buluşması hakkı', 'Her 30 günde 1 Kankamla buluşması hakkı', 'Otomatik yenilenir, istediğin zaman iptal edebilirsin'] },
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


// Tinder tarzı kart: tam genişlik, tek renk, solda kalın ad + GOLD tarzı rozet, altında tek satır açıklama, sağda ok
export function PaketKarti({ card, badge, blocked, onClick }: { card: (typeof CARDS)[number]; badge?: string | null; blocked?: boolean; onClick: () => void }) {
  const isPrimeCard = card.key === 'PRIME';
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 text-left transition-transform active:scale-[0.99]"
      style={{
        background: card.color,
        borderRadius: 18,
        padding: '18px 20px',
        minHeight: 76,
        color: isPrimeCard ? '#1a1406' : '#fff',
        opacity: blocked ? 0.55 : 1,
      }}
    >
      <span className="flex flex-col gap-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-extrabold" style={{ fontSize: '1.25rem', letterSpacing: '0.01em' }}>{card.name}</span>
          <span
            className="rounded-full font-extrabold"
            style={{ fontSize: '0.7rem', letterSpacing: '0.08em', padding: '3px 10px', background: card.badgeBg, color: isPrimeCard ? '#1a1406' : '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
          >
            {(badge ?? card.badge).toLocaleUpperCase('tr-TR')}
          </span>
        </span>
        <span className="text-sm truncate" style={{ opacity: 0.9 }}>{card.desc}</span>
      </span>
      <Arrow />
    </button>
  );
}
