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
