'use client';

// Paket kartları: paket ekranı (profil/tabs/TabPaket) ve landing aynı veriyi ve aynı kart görünümünü kullanır
export type CardKey = 'MASADA' | 'KARSIMDA' | 'KANKAMLA' | 'ICERDE' | 'PRIME';
export const PRIME_PLANS = [
  { key: 'PRIME_1M', label: '1 Aylık' },
  { key: 'PRIME_3M', label: '3 Aylık' },
  { key: 'PRIME_6M', label: '6 Aylık' },
  { key: 'PRIME_12M', label: '12 Aylık' },
] as const;

// Paket kartları: tam genişlik, premium görünüm — aynı renk ailesinde koyudan ortaya geçişli (gradient) arka plan; açık / soluk ton yok.
// Grup yeşil, Baş Başa kırmızı, Kankamla mavi, İçerde altın; Prime siyahtan koyu antrasite, kırmızı (palet) çerçeve; rozet, ad ve ok şarap kırmızısı (#7A1F2B).
// badgeBg / badgeFg: Tinder GOLD tarzı hap rozet (kartın renk tonuna uyumlu; İçerde ve Prime altın)
export const CARDS: { key: CardKey; name: string; badge: string; desc: string; gradient: [string, string]; fg: string; nameColor: string; border?: string; badgeBg: string; badgeFg: string; arrowColor?: string; advantages: string[] }[] = [
  { key: 'MASADA', name: 'Grup Paketi', badge: 'Tek Seferlik', desc: "1 Grup Masası'nda buluşma hakkı", gradient: ['#06301c', '#1c7a49'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: '#2e9e62', badgeFg: '#ffffff',
    advantages: ['Kişilik testi ile sana uyumlu insanlarla eşleşme', "1 Grup Masası'nda buluşma hakkı", 'Masada erkek ve kadın eşit sayı', 'Bu hak masada sen buluşana kadar geçerli'] },
  { key: 'KARSIMDA', name: 'Baş Başa Paketi', badge: 'Tek Seferlik', desc: "1 Baş Başa Masası'nda buluşma hakkı", gradient: ['#3d0907', '#a3231b'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: '#d6453a', badgeFg: '#ffffff',
    advantages: ['Kişilik testi ile sana uyumlu insanlarla eşleşme', 'Daha derin çalışan algoritma ile yaş uyumu', "1 Baş Başa Masası'nda buluşma hakkı", 'Bu hak masada sen buluşana kadar geçerli'] },
  { key: 'KANKAMLA', name: 'Kankamla Paketi', badge: 'Tek Seferlik', desc: "1 Kankamla Masası'nda buluşma hakkı", gradient: ['#071a3a', '#1d4f9c'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: '#3b7dd8', badgeFg: '#ffffff',
    advantages: ['Kişilik testi ile sana uyumlu insanlarla eşleşme', 'Daha derin çalışan algoritma ile yaş uyumu', "1 Kankamla Masası'nda buluşma hakkı", 'Kankanı davet ederek ücretsiz çağırma', 'Bu hak masada sen buluşana kadar geçerli'] },
  { key: 'ICERDE', name: 'İçerde Paketi', badge: 'Tek Seferlik', desc: "1 Grup Masası + 1 Baş Başa Masası'nda buluşma hakkı", gradient: ['#3a2804', '#9c7412'], fg: '#ffffff', nameColor: '#ffffff', badgeBg: 'linear-gradient(135deg, #f5d76e, #c9a227 55%, #a8861a)', badgeFg: '#1a1406',
    advantages: ['Kişilik testi ile sana uyumlu insanlarla eşleşme', 'Daha derin çalışan algoritma ile yaş uyumu', "1 Grup Masası + 1 Baş Başa Masası'nda buluşma hakkı", 'Bu haklar masada sen buluşana kadar geçerli'] },
  { key: 'PRIME', name: 'Prime Paket', badge: 'Abonelik', desc: 'Her ay 1 Grup + 1 Baş Başa + 1 Kankamla Masası', gradient: ['#000000', '#2b2d31'], fg: '#f4f1ec', nameColor: '#7A1F2B', border: '#d6453a', badgeBg: '#7A1F2B', badgeFg: '#f4f1ec', arrowColor: '#7A1F2B',
    advantages: ['Her masada öncelikli eşleşme hakkı', 'Kişilik testi ile sana uyumlu insanlarla eşleşme', 'Daha derin çalışan algoritma ile yaş uyumu', "Her ay 1 Grup Masası + 1 Baş Başa Masası + 1 Kankamla Masası'nda buluşma hakkı", 'Aboneliği iptal etsen dahi, bu haklar masada sen buluşana kadar geçerli', 'Otomatik yenilenir, istediğin zaman iptal edebilirsin'] },
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
export function PaketKarti({ card, badge, blocked, onClick }: { card: (typeof CARDS)[number]; badge?: string | null; blocked?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 text-left transition-transform active:scale-[0.99]"
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
          <span className="font-serif text-2xl" style={{ color: card.nameColor }}>{card.name}</span>
          <span
            className="rounded-full font-extrabold"
            style={{ fontSize: '0.62rem', letterSpacing: '0.08em', padding: '2px 8px', background: card.badgeBg, color: card.badgeFg, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
          >
            {(badge ?? card.badge).toLocaleUpperCase('tr-TR')}
          </span>
        </span>
        <span className="text-sm truncate" style={{ opacity: 0.9 }}>{card.desc}</span>
      </span>
      <span style={{ color: card.arrowColor ?? card.border ?? card.fg }}><Arrow /></span>
    </button>
  );
}
