// apps/web/lib/planCards.ts ile aynı mantık (S-05); badge çeviri anahtarıdır (ekranda t(badge))
export type PlanKey = 'MASADA' | 'KARSIMDA' | 'ICERDE';

export interface OpenParts { group: boolean; oneOnOne: boolean }
export interface KankamlaState { hasKanka: boolean; pairPackageActive: boolean; role: 'BUYER' | 'KANKA' | null }

export function getKankamlaCardState(k: KankamlaState | null) {
  if (k?.pairPackageActive) {
    return { dimmed: true, badge: k.role === 'BUYER' ? 'plan.badgeActive' : 'plan.badgeKankaActive', badgeRed: k.role === 'BUYER', showButton: false };
  }
  return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true };
}

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
