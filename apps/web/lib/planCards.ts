// badge: çeviri anahtarı (ekranda t(badge))
export type PlanKey = 'MASADA' | 'KARSIMDA' | 'ICERDE';

export interface OpenParts { group: boolean; oneOnOne: boolean }
// Kankamla: kanka şart; çiftte (kendisi ya da kankası) aktif paket varsa paket bitene kadar yenisi alınamaz
export interface KankamlaState { hasKanka: boolean; pairPackageActive: boolean; role: 'BUYER' | 'KANKA' | null }

export function getKankamlaCardState(k: KankamlaState | null) {
  if (k?.pairPackageActive) {
    return { dimmed: true, badge: k.role === 'BUYER' ? 'plan.badgeActive' : 'plan.badgeKankaActive', badgeRed: k.role === 'BUYER', showButton: false };
  }
  return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
}

// Backend assertCanBuy ile aynı kural: grup kısmı açıksa (hak kalmış, 4 döngü dolmamış) Masada / İçerde,
// başbaşa kısmı açıksa Karşımda / İçerde alınamaz. Sahip olunan paketin kartında "Aktif Paketiniz" yazar.
export function getPlanCardState(cardKey: string, owned: Set<PlanKey>, open: OpenParts) {
  const ownsGroup = open.group;
  const ownsOne = open.oneOnOne;
  if (owned.has(cardKey as PlanKey)) return { dimmed: true, badge: 'plan.badgeActive', badgeRed: true, showButton: false };
  if (cardKey === 'MASADA' && ownsGroup) return { dimmed: true, badge: 'plan.badgeOwnsGroup', badgeRed: false, showButton: false };
  if (cardKey === 'KARSIMDA' && ownsOne) return { dimmed: true, badge: 'plan.badgeOwnsOne', badgeRed: false, showButton: false };
  if (cardKey === 'ICERDE' && (ownsGroup || ownsOne)) {
    return { dimmed: true, badge: ownsGroup ? 'plan.badgeOwnsGroup' : 'plan.badgeOwnsOne', badgeRed: false, showButton: false };
  }
  return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
}
