// Web'den aynı mantıkla kopyalandı (S-05): packages/ui/src/components/tables/MasalarDashboard.tsx,
// apps/web/components/HeroCountdown.tsx, packages/ui/src/components/tables/RezervasyonIptal.tsx
import { gender as G } from '@/theme/theme';

import { formatNamed, weekdayName } from '@ahenk/shared';
import i18n, { currentLang } from './i18n';
export type MasaTuru = 'GROUP' | 'ONE_ON_ONE' | 'KANKA';

export interface Participant {
  id?: string;
  initials: string;
  gender: 'MALE' | 'FEMALE' | string | null;
  pair?: 'MINE' | 'OTHER';
  joinedAt?: string;
  cancelled?: boolean;
  isSelf?: boolean;
  photoUrl?: string | null;
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
    venueDistrict?: string | null;
    venueMapsUrl?: string;
    venuePhotos?: Array<{ url: string; caption?: string }>;
    occupations?: string[];
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

// Gün adı arayüz dilinde, saat 24 saat (bölgenin saat dilimi)
export function formatMeetingTime(isoStr: string): string {
  try {
    const trDate = new Date(new Date(isoStr).getTime() + 3 * 3600 * 1000);
    const h = trDate.getUTCHours().toString().padStart(2, '0');
    const m = trDate.getUTCMinutes().toString().padStart(2, '0');
    return `${weekdayName(trDate.getUTCDay(), currentLang())} · ${h}:${m}`;
  } catch { return ''; }
}

export function tableTitleOf(type?: MasaTuru): string {
  return i18n.t(type === 'ONE_ON_ONE' ? 'radar.titleOne' : type === 'KANKA' ? 'radar.titleKanka' : 'radar.titleGroup');
}

export function formatMasaDate(iso: string): string {
  try { return formatNamed(iso, currentLang(), { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
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
export const fmtDate = (val?: string | null) => val ? formatNamed(val, currentLang(), { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
