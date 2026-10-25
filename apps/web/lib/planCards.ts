export type PlanKey = 'MASADA' | 'KARSIMDA' | 'ICERDE';

export interface OpenParts { group: boolean; oneOnOne: boolean }

// Backend assertCanBuy ile aynı kural: grup kısmı açıksa (hak kalmış, 4 döngü dolmamış) Masada / İçerde,
// başbaşa kısmı açıksa Karşımda / İçerde alınamaz. Sahip olunan paketin kartında "Aktif Paketiniz" yazar.
export function getPlanCardState(cardKey: string, owned: Set<PlanKey>, open: OpenParts) {
  const ownsGroup = open.group;
  const ownsOne = open.oneOnOne;
  if (owned.has(cardKey as PlanKey)) return { dimmed: true, badge: 'Aktif Paketiniz', badgeRed: true, showButton: false };
  if (cardKey === 'MASADA' && ownsGroup) return { dimmed: true, badge: 'Grup Masasına Sahipsin', badgeRed: false, showButton: false };
  if (cardKey === 'KARSIMDA' && ownsOne) return { dimmed: true, badge: 'Baş Başa Masasına Sahipsin', badgeRed: false, showButton: false };
  if (cardKey === 'ICERDE' && (ownsGroup || ownsOne)) {
    return { dimmed: true, badge: ownsGroup ? 'Grup Masasına Sahipsin' : 'Baş Başa Masasına Sahipsin', badgeRed: false, showButton: false };
  }
  return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
}
