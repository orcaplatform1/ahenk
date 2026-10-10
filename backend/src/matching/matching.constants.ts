// Ağırlıklar (toplam 100)
export const WEIGHTS = {
  OCEAN: 50,
  VENUE: 25,
  CITY: 15,
  TOPIC: 10,
} as const;

// Şehir/İlçe puanları
export const CITY_SCORE = {
  SAME_CITY_AND_DISTRICT: 15,
  SAME_CITY_ONLY: 10,
  DIFFERENT: 0,
} as const;

// OCEAN maksimum Öklid mesafesi: sqrt(5 × 100²)
export const OCEAN_MAX_DISTANCE = Math.sqrt(5) * 100; // ≈ 223.61

// Masa boyutları
export const TABLE_SIZE_LARGE = 6;
export const TABLE_SIZE_SMALL = 4;

// Cinsiyet dengesi hedefleri
export const GENDER_TARGET = {
  [TABLE_SIZE_LARGE]: { MALE: 3, FEMALE: 3 },
  [TABLE_SIZE_SMALL]: { MALE: 2, FEMALE: 2 },
} as const;

// Kayıt kapanış: Cumartesi 10:00 (UTC+3 = 07:00 UTC)
export const REGISTRATION_DEADLINE_HOUR_UTC = 7;   // 10:00 TR saati

// Uzatma süresi
export const EXTENSION_HOURS = 12;

// Bull queue adı
export const MATCHING_QUEUE = "matching";

// Job adları
export const JOB_RUN_MATCHING = "run-weekly-matching";
export const JOB_CHECK_DEADLINE = "check-table-deadline";
