import { OCEAN_MAX_DISTANCE, WEIGHTS } from "./matching.constants";

export type MatchOcean = {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
};

export type MatchPerson = { oceanScore: MatchOcean | null; occupationSector: string | null };

// Eşleşme puanı (0-100): OCEAN benzerliği + meslek alanı. Eşleşme ve canlı katman bunu kullanır.
export function matchScore(a: MatchPerson, b: MatchPerson): number {
  return calcOcean(a.oceanScore, b.oceanScore) + calcOccupation(a.occupationSector, b.occupationSector);
}

// Yarın Buluşma sıralama puanı (0-100): yaş yakınlığı 50 + mekân kategori tercihi (SADE / ORTA / PREMIUM) 50.
// Yalnız sıralama içindir, kimseyi masadan dışlamaz. OCEAN ve meslek kullanılmaz.
// Yaş: fark 0 → 50, fark TOMORROW_AGE_SPAN_YEARS ve üstü → 0 (doğrusal). Mekân: ortak kategori / toplam kategori (Jaccard);
// iki kişiden birinde tercih yoksa (ya da yaş bilinmiyorsa) o kısım yarım puan.
export type TomorrowPerson = { profile: { birthDate: string | Date | null; venueCategories: string[] } | null };
const TOMORROW_AGE_SPAN_YEARS = 30;
const TOMORROW_HALF = 50;

export function tomorrowScore(a: TomorrowPerson, b: TomorrowPerson): number {
  return calcAge(a.profile?.birthDate ?? null, b.profile?.birthDate ?? null) + calcVenue(a.profile?.venueCategories ?? [], b.profile?.venueCategories ?? []);
}

function yearsOf(birthDate: string | Date): number {
  return (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000);
}

function calcAge(a: string | Date | null, b: string | Date | null): number {
  if (!a || !b) return TOMORROW_HALF / 2;
  const diff = Math.abs(yearsOf(a) - yearsOf(b));
  return (1 - Math.min(diff, TOMORROW_AGE_SPAN_YEARS) / TOMORROW_AGE_SPAN_YEARS) * TOMORROW_HALF;
}

function calcVenue(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return TOMORROW_HALF / 2;
  const union = new Set([...a, ...b]);
  const common = a.filter((c) => b.includes(c)).length;
  return (common / union.size) * TOMORROW_HALF;
}

function calcOccupation(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  if (a === 'Öğrenci' || a === 'Diğer' || b === 'Öğrenci' || b === 'Diğer') return 0;
  return a === b ? WEIGHTS.OCCUPATION : 0;
}

function calcOcean(a: MatchOcean | null, b: MatchOcean | null): number {
  if (!a || !b) return WEIGHTS.OCEAN / 2;
  const d = Math.sqrt(
    (a.openness - b.openness) ** 2 +
    (a.conscientiousness - b.conscientiousness) ** 2 +
    (a.extraversion - b.extraversion) ** 2 +
    (a.agreeableness - b.agreeableness) ** 2 +
    (a.neuroticism - b.neuroticism) ** 2,
  );
  return (1 - d / OCEAN_MAX_DISTANCE) * WEIGHTS.OCEAN;
}
