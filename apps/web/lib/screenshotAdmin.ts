// Ekran görüntüsü ihlalleri (admin, web): ortak tipler ve etiketler (backend admin/admin-screenshot.ts)
export interface ScreenshotPerson { id: string; name: string; phone: string | null; photoUrl: string | null }
export interface ScreenshotItem {
  id: string; platform: string; createdAt: string; nth: number; suggestedDays: 3 | 15 | 30 | null;
  user: ScreenshotPerson; target: ScreenshotPerson; adminAction: string | null; adminActionAt: string | null; admin: ScreenshotPerson | null;
}
export interface ScreenshotList { count: number; items: ScreenshotItem[] }

export const daysLabel = (d: number) => (d === 30 ? '30 gün' : `${d} gün`);
export const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' };
export function actionLabel(a: string | null): string {
  if (!a) return 'İşlem bekliyor';
  if (a === 'NONE') return 'İşlem yapılmadı';
  const d = Number(a.replace('SUSPEND_', ''));
  return `${daysLabel(d)} askıya alındı`;
}
export const fmtDate = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const initialsOf = (name: string) => name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr-TR') || '?';
