// Kullanıcının aktif paketlerindeki kalan toplam masa hakkı (Paketim sekme rozeti).
// GET /payment/subscriptions verisi; Paketim ekranındaki "kaldı / Süresi doldu / Kullanıldı" kurallarıyla aynı.
export interface RightsSub { plan: string; usedAt?: string | null; groupRights: number; groupCycles: number; oneOnOneCycles: number; kankaRights?: number; kankaCycles?: number }

export function remainingRights(subs: RightsSub[], packageCycles: number): number {
  let total = 0;
  for (const s of subs) {
    const g = s.plan === 'MASADA' || s.plan === 'ICERDE', o = s.plan === 'KARSIMDA' || s.plan === 'ICERDE', k = s.plan === 'KANKAMLA';
    if (g && s.groupCycles < packageCycles) total += Math.max(0, s.groupRights);
    if (o && !s.usedAt && s.oneOnOneCycles < packageCycles) total += 1;
    if (k && (s.kankaCycles ?? 0) < packageCycles) total += Math.max(0, s.kankaRights ?? 0);
  }
  return total;
}
