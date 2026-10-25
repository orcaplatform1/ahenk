// Türkiye saatiyle (UTC+3, yaz saati yok) hafta hesapları. Sunucu saat dilimi farklı olabilir (Europe/Berlin);
// bu yüzden yerel getDay/setHours yerine sabit +3 kayması kullanılır.
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Verilen anın içinde bulunduğu haftanın Pazartesi 00:00 (TR)
export function trWeekStart(now = new Date()): Date {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  const mondayIdx = (tr.getUTCDay() + 6) % 7; // Pzt=0 … Paz=6
  const startTR = Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - mondayIdx);
  return new Date(startTR - TR_OFFSET_MS);
}

// ISO hafta numarasının Pazartesi 00:00 (TR) başlangıcı (yıl TR saatine göre)
export function trIsoWeekStart(week: number, now = new Date()): Date {
  const year = new Date(now.getTime() + TR_OFFSET_MS).getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4) - TR_OFFSET_MS); // 4 Ocak her zaman 1. ISO haftadadır
  return new Date(trWeekStart(jan4).getTime() + (week - 1) * 7 * DAY_MS);
}

export const WEEK_MS = 7 * DAY_MS;
