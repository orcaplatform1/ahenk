export type PlanKey = 'MASADA' | 'KARSIMDA' | 'ICERDE';

// Sahip olunan tüm aktif paketlere göre (backend assertCanBuy ile aynı kural):
// Masada → Masada/İçerde alınamaz; Karşımda → Karşımda/İçerde; İçerde → hiçbiri
export function getPlanCardState(cardKey: string, owned: Set<PlanKey>) {
  const ownsGroup = owned.has('MASADA') || owned.has('ICERDE');
  const ownsOne = owned.has('KARSIMDA') || owned.has('ICERDE');
  if (owned.has(cardKey as PlanKey)) return { dimmed: true, badge: 'Aktif Paketiniz', badgeRed: true, showButton: false };
  if (cardKey === 'MASADA' && ownsGroup) return { dimmed: true, badge: 'Grup Masasına Sahipsin', badgeRed: false, showButton: false };
  if (cardKey === 'KARSIMDA' && ownsOne) return { dimmed: true, badge: 'Baş Başa Masasına Sahipsin', badgeRed: false, showButton: false };
  if (cardKey === 'ICERDE' && (ownsGroup || ownsOne)) {
    return { dimmed: true, badge: ownsGroup ? 'Grup Masasına Sahipsin' : 'Baş Başa Masasına Sahipsin', badgeRed: false, showButton: false };
  }
  return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
}
