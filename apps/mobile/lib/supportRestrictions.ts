// Kullanıcı / mekân detayı "Canlı destek kısıtlamaları" ortak tipleri ve etiketleri (web + mobil aynı; yönetim paneli yalnız Türkçe)
export interface SupportRestrictionRow {
  id: string; days: number; createdAt: string; expiresAt: string; status: 'ACTIVE' | 'EXPIRED' | 'LIFTED';
  agentNo: string | null; reason: string; liftedAt: string | null;
  liftedBy: { name: string; role: string; agentNo: string | null } | null;
  liftReason: string | null; // kaldırılmışsa kaldırma sebebi (eski kayıtlarda "Sebep girilmemiş")
}
export const RESTRICTION_STATUS: Record<SupportRestrictionRow['status'], string> = { ACTIVE: 'Aktif', EXPIRED: 'Süresi doldu', LIFTED: 'Kaldırıldı' };
export const restrictionPath = (p: { userId: string } | { venueId: string }) =>
  'userId' in p ? `/admin/live-support/manage/restrictions/user/${p.userId}` : `/admin/live-support/manage/restrictions/venue/${p.venueId}`;
export const lifterLabel = (r: SupportRestrictionRow) =>
  r.liftedBy ? `${r.liftedBy.name} (${r.liftedBy.role}${r.liftedBy.agentNo ? ` · Temsilci No ${r.liftedBy.agentNo}` : ''})` : '—';
