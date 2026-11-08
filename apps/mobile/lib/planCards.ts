// apps/web/lib/planCards.ts ile aynı mantık (S-05)
export type PlanKey = 'MASADA' | 'KARSIMDA' | 'ICERDE';

export interface OpenParts { group: boolean; oneOnOne: boolean }
export interface KankamlaState { hasKanka: boolean; pairPackageActive: boolean; role: 'BUYER' | 'KANKA' | null }

export function getKankamlaCardState(k: KankamlaState | null) {
  if (k?.pairPackageActive) {
    return { dimmed: true, badge: k.role === 'BUYER' ? 'Aktif Paketiniz' : 'Kankanda Aktif Paket', badgeRed: k.role === 'BUYER', showButton: false, needsKanka: false };
  }
  return { dimmed: false, badge: null as string | null, badgeRed: false, showButton: true, needsKanka: !k?.hasKanka };
}

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
