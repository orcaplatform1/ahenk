// Web'den aynı mantıkla kopyalandı (S-05): packages/ui/src/components/tables/MasalarDashboard.tsx,
// apps/web/components/HeroCountdown.tsx, packages/ui/src/components/tables/RezervasyonIptal.tsx
import { gender as G } from '@/theme/theme';

export type MasaTuru = 'GROUP' | 'ONE_ON_ONE' | 'KANKA';

export interface Participant {
  id?: string;
  initials: string;
  gender: 'MALE' | 'FEMALE' | string | null;
  pair?: 'MINE' | 'OTHER';
  joinedAt?: string;
  cancelled?: boolean;
}

export interface DashboardItem {
  phase: 'WAITING' | 'REVEALED';
  meeting: {
    id: string;
    type?: MasaTuru;
    maxParticipants?: number;
    scheduledAt: string;
    participants: Participant[];
    sat10UTC?: string;
    sosEndsAt: string;
    venueName?: string;
    venueAddress?: string;
    venueMapsUrl?: string;
    venuePhotos?: Array<{ url: string; caption?: string }>;
    aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
    cancelRightUsed?: boolean;
  };
}

export function gColor(g?: string | null) {
  if (g === 'FEMALE') return G.female;
  return G.male;
}
export function gBg(g?: string | null) {
  if (g === 'FEMALE') return G.femaleBg;
  return G.maleBg;
}

// "Ayşe Yılmaz" → "A.Y."
export function buildInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName ?? '').trim()[0] ?? '?';
  const l = (lastName ?? '').trim()[0] ?? '?';
  return `${f.toUpperCase()}.${l.toUpperCase()}.`;
}

export function isMatchingClosed(type: MasaTuru): boolean {
  const dayTR = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCDay();
  if (type === 'KANKA') return dayTR === 0;
  return type === 'GROUP' ? (dayTR === 5 || dayTR === 6 || dayTR === 0) : (dayTR === 6 || dayTR === 0);
}

// Masa kilidi: masa gününden 1 gün önce 23:59 TR
export function isTableLocked(scheduledAt: string): boolean {
  const tr = new Date(new Date(scheduledAt).getTime() + 3 * 60 * 60 * 1000);
  return Date.now() >= Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - 1, 23 - 3, 59, 0, 0);
}

// Haftanın verilen gününün bir sonraki 23:59'u (TR)
export function getNextTarget(targetDay: number): Date {
  const trOffset = 3 * 60 * 60 * 1000;
  const now = new Date();
  const nowTR = new Date(now.getTime() + trOffset);
  const todayTR = nowTR.getUTCDay();
  const daysUntil = (targetDay - todayTR + 7) % 7;
  const targetTR = new Date(nowTR);
  targetTR.setUTCDate(nowTR.getUTCDate() + daysUntil);
  targetTR.setUTCHours(23, 59, 0, 0);
  const targetUTC = new Date(targetTR.getTime() - trOffset);
  if (targetUTC.getTime() <= now.getTime()) targetUTC.setUTCDate(targetUTC.getUTCDate() + 7);
  return targetUTC;
}

// Rezervasyon iptali son anı: masa gününden 1 gün önce 20:00 TR
export function cancelDeadline(scheduledAt: string): Date {
  const tr = new Date(new Date(scheduledAt).getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - 1, 20 - 3, 0, 0, 0));
}

export function formatMeetingTime(isoStr: string): string {
  try {
    const trDate = new Date(new Date(isoStr).getTime() + 3 * 3600 * 1000);
    const h = trDate.getUTCHours().toString().padStart(2, '0');
    const m = trDate.getUTCMinutes().toString().padStart(2, '0');
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return `${days[trDate.getUTCDay()]} · ${h}:${m}`;
  } catch { return ''; }
}

export function tableTitleOf(type?: MasaTuru): string {
  return type === 'ONE_ON_ONE' ? 'BAŞ BAŞA MASA' : type === 'KANKA' ? 'KANKAMLA MASASI' : 'GRUP MASASI';
}

export function formatMasaDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }); } catch { return iso; }
}

export function initialsLabel(raw0?: string | null): string {
  const raw = (raw0 ?? '').trim();
  if (!raw) return '?.';
  if (/^[A-ZÇĞİÖŞÜa-zçğışöşü]\.[A-ZÇĞİÖŞÜa-zçğışöşü]\.?$/.test(raw)) return raw.toUpperCase();
  if (raw.length === 2 && !raw.includes('.')) return `${raw[0].toUpperCase()}.${raw[1].toUpperCase()}.`;
  return raw.toUpperCase();
}

export const pad = (n: number) => String(n).padStart(2, '0');
export const num = (n: number) => n.toLocaleString('tr-TR');
export const fmtDate = (val?: string | null) => val ? new Date(val).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
