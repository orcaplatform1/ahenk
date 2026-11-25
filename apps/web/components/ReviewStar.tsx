// Değerlendir ekranı yıldızı (kırmızı geçişli dolu / boş). Değerlendir ekranı ve Geçmiş Masalarım değerlendirme alanı kullanır
// (mobil components/Star.tsx karşılığı).
export function ReviewStar({ filled, size = 40 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden
      style={{ filter: filled ? 'drop-shadow(0 0 8px rgba(255,107,107,0.45))' : 'none', transition: 'filter 0.2s ease' }}>
      <defs>
        <linearGradient id="ahenk-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c0392b" />
          <stop offset="100%" stopColor="#ff6b6b" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95L12 2.6z"
        fill={filled ? 'url(#ahenk-star)' : 'rgba(255,255,255,0.04)'}
        stroke={filled ? 'none' : 'rgba(255,255,255,0.18)'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
