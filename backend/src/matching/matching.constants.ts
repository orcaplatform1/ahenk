// Ağırlık: OCEAN %100 (meslek puanı algoritmada kullanılmaz)
export const WEIGHTS = {
  OCEAN: 100,
} as const;

// OCEAN maksimum Öklid mesafesi: sqrt(5 × 100²)
export const OCEAN_MAX_DISTANCE = Math.sqrt(5) * 100; // ≈ 223.61

// Masa boyutları
export const TABLE_SIZE_LARGE = 6;
export const TABLE_SIZE_SMALL = 4;

// Buluşma saati 20:00 TR (17:00 UTC): grup Cuma, başbaşa Cumartesi
export const MEETING_HOUR_UTC = 17;

// Bull queue adı
export const MATCHING_QUEUE = "matching";
