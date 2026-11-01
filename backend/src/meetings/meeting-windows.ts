// Masa saatine bağlı zaman pencereleri (TR saati, UTC+3)

import { MEETING_HOUR_UTC } from "../matching/matching.constants";

// Buluşma: Grup Cuma 20:00 (kilit Perşembe 23:59), Başbaşa Cumartesi 20:00 (kilit Cuma 23:59)

// TR saatiyle haftanın verilen günü (0=Pazar … 6=Cumartesi) 20:00; TR'de o gün çağrılırsa bir sonraki hafta
function nextWeekdayAt(weekday: number, now: Date): Date {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const days = (weekday - tr.getUTCDay() + 7) % 7 || 7;
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + days, MEETING_HOUR_UTC, 0, 0, 0));
}
export const groupMeetingAt = (now = new Date()) => nextWeekdayAt(5, now);
export const oneOnOneMeetingAt = (now = new Date()) => nextWeekdayAt(6, now);
// Kankamla buluşma: Pazar 20:00 (kilit Cumartesi 23:59)
export const kankaMeetingAt = (now = new Date()) => nextWeekdayAt(0, now);

// Rezervasyon iptalinin son anı: masa gününden 1 gün önce (kilit günü) 20:00 TR
export function cancelDeadline(scheduledAt: Date): Date {
  const tr = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - 1, 20 - 3, 0, 0, 0));
}

// Masa gününün ertesi, TR saatiyle verilen saat
function nextDayAt(scheduledAt: Date, hourTR: number): Date {
  const tr = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + 1, hourTR - 3, 0, 0, 0));
}

// Acil yardım süresi (tek kaynak; web süreyi dashboard yanıtındaki sosEndsAt'ten alır): masa saatinden ertesi gün 08:00'e kadar
export const sosWindowEnd = (scheduledAt: Date): Date => nextDayAt(scheduledAt, 8);

// Masa kartı ertesi gün 10:00'a kadar ekranda kalır (değerlendirme açılışı); kanka kilidi de bu ana kadar sürer
export const meetingCardEnd = (scheduledAt: Date): Date => nextDayAt(scheduledAt, 10);

// Masa kartında "gelmeyeni işaretle": masa saatinden 2 saat sonra (22:00) açılır, değerlendirme açılınca
// (ertesi gün 10:00) karttan kalkar; sonrasında işaretleme değerlendirme formunda yapılır.
export function noShowCardWindow(scheduledAt: Date): { opensAt: Date; closesAt: Date } {
  return { opensAt: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000), closesAt: meetingCardEnd(scheduledAt) };
}
