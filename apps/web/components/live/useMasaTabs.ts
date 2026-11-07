'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildInitials, isTableLocked, type DashboardItem, type MasaTuru } from '@ahenk/ui';
import { api } from '@/lib/api';
import { getNextTarget } from '@/components/HeroCountdown';
import type { TabStatus } from './LiveTabs';

const DASHBOARD_POLL_MS = 15_000;
const WEEK_MS = 7 * 86_400_000;
const TAB_STORAGE_KEY = 'ahenk_masa_tab';
const MASA_TURLERI: MasaTuru[] = ['GROUP', 'ONE_ON_ONE', 'KANKA'];

// Masa türüne göre kapanış günü (0=Pazar … 6=Cumartesi, 23:59); yeni tarama her Pazar 23:59'da başlar
export const CLOSING_DAY: Record<MasaTuru, number> = { GROUP: 4, ONE_ON_ONE: 5, KANKA: 6 };
export const SCAN_START_DAY = 0;

// Türün bu haftaki kapanışı geçti mi: bir sonraki tarama başlangıcı bir sonraki kapanıştan önce geliyorsa
export function isPastClosing(tab: MasaTuru) {
  return getNextTarget(SCAN_START_DAY).getTime() < getNextTarget(CLOSING_DAY[tab]).getTime();
}

// Türün bu haftaki kapanış anı; isPastClosing true iken bir sonraki kapanış gelecek haftadadır
function lastClosing(tab: MasaTuru) {
  return getNextTarget(CLOSING_DAY[tab]).getTime() - WEEK_MS;
}

// Havuza giriş zamanı için paketin türdeki açık kısmı (mevcut /payment/subscriptions yanıtı)
interface OwnSub {
  plan: string;
  createdAt: string;
  usedAt: string | null;
  groupRights: number;
  kankaRights: number;
}

const SUB_OPEN: Record<MasaTuru, (s: OwnSub) => boolean> = {
  GROUP: s => (s.plan === 'MASADA' || s.plan === 'ICERDE') && s.groupRights > 0,
  ONE_ON_ONE: s => (s.plan === 'KARSIMDA' || s.plan === 'ICERDE') && !s.usedAt,
  KANKA: s => s.plan === 'KANKAMLA' && s.kankaRights > 0,
};

export interface MeData {
  firstName: string;
  lastName: string;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
  openParts?: { group: boolean; oneOnOne: boolean };
  kankamla?: { open: boolean; hasKanka?: boolean; pairPackageActive?: boolean };
  profile?: { gender?: string | null };
  kyc?: { status: string; rejectReason?: string | null };
  maintenanceMode?: boolean;
}

function readTab(): MasaTuru | null {
  try {
    const v = localStorage.getItem(TAB_STORAGE_KEY) as MasaTuru | null;
    return v && MASA_TURLERI.includes(v) ? v : null;
  } catch { return null; }
}

// Eşleşme Paneli ve Masalarım'ın ortak sekme kaynağı: aynı veri, aynı durum hesabı, aynı seçili tür
export function useMasaTabs() {
  const [me, setMe] = useState<MeData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [weekTypes, setWeekTypes] = useState<MasaTuru[]>([]);
  const [cancelledTypes, setCancelledTypes] = useState<MasaTuru[]>([]);
  const [adminCancelledTypes, setAdminCancelledTypes] = useState<MasaTuru[]>([]);
  const [dashLoaded, setDashLoaded] = useState(false);
  const [chosenTab, setChosenTab] = useState<MasaTuru | null>(null);
  const [kanka, setKanka] = useState<{ initials: string; gender: string | null } | null>(null);
  const [subs, setSubs] = useState<OwnSub[]>([]);
  const [kycAt, setKycAt] = useState<string | null>(null);

  const pastList = () => MASA_TURLERI.filter(isPastClosing).join();
  const [pastClosed, setPastClosed] = useState(pastList);

  // Paket durumu: panele her girişte ve sekme değişiminde sunucudan
  const refreshPlan = useCallback(() => Promise.all([
    api.get<MeData>('/auth/me').then(u => { setMe(u); }).catch(() => {}),
    api.get<{ subscriptions: OwnSub[] }>('/payment/subscriptions').then(r => setSubs(r.subscriptions)).catch(() => {}),
  ]), []);

  useEffect(() => {
    setChosenTab(readTab());
    // apiFetch 401 alınca refresh token deniyor (oturum HttpOnly çerezde)
    Promise.all([
      refreshPlan(),
      api.get<{ reviewedAt?: string | null }>('/kyc/status').then(r => setKycAt(r.reviewedAt ?? null)).catch(() => {}),
    ]).finally(() => setMounted(true));
  }, [refreshPlan]);

  const reload = useCallback(() => {
    if (document.hidden) return Promise.resolve();
    api.get<{ kanka: { initials: string; gender: string | null } | null }>('/kanka/me').then(r => setKanka(r.kanka)).catch(() => {});
    return api.get<{ items: DashboardItem[]; weekTableTypes?: MasaTuru[]; weekCancelledTypes?: MasaTuru[]; weekAdminCancelledTypes?: MasaTuru[] }>('/meetings/dashboard')
      .then(r => { setItems(r.items); setWeekTypes(r.weekTableTypes ?? []); setCancelledTypes(r.weekCancelledTypes ?? []); setAdminCancelledTypes(r.weekAdminCancelledTypes ?? []); })
      .catch(() => {})
      .finally(() => setDashLoaded(true));
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, DASHBOARD_POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  // Tarama başlayınca/kapanınca sekme ve kart sayfa yenilenmeden değişsin
  useEffect(() => {
    const id = setInterval(() => setPastClosed(pastList()), 1000);
    return () => clearInterval(id);
  }, []);

  const selectTab = useCallback((t: MasaTuru) => {
    setChosenTab(t);
    try { localStorage.setItem(TAB_STORAGE_KEY, t); } catch { /* seçim yalnızca bu sayfada kalır */ }
    refreshPlan();
  }, [refreshPlan]);

  // Sekmeler: aktif paket hakkı ya da bu hafta masası olan türler seçilebilir; hiç yoksa sayaç Grup'ta kalır
  const hasTable = (t: MasaTuru) => weekTypes.includes(t) || items.some(i => i.meeting.type === t);
  // kankamla.open aktif kanka da ister; paketi olup kankası olmayan da Kankamla hakkına sahiptir
  const kankaWaiting = !!me?.kankamla?.pairPackageActive && !me?.kankamla?.hasKanka && !kanka;
  const rights: Record<MasaTuru, boolean> = {
    GROUP: !!me?.openParts?.group,
    ONE_ON_ONE: !!me?.openParts?.oneOnOne,
    KANKA: !!me?.kankamla?.open || !!me?.kankamla?.pairPackageActive,
  };
  const tables: Record<MasaTuru, boolean> = { GROUP: hasTable('GROUP'), ONE_ON_ONE: hasTable('ONE_ON_ONE'), KANKA: hasTable('KANKA') };
  const owned = MASA_TURLERI.filter(t => rights[t] || tables[t] || cancelledTypes.includes(t));
  const tab = chosenTab && owned.includes(chosenTab) ? chosenTab : owned[0] ?? 'GROUP';
  const tabItem = items.find(i => i.meeting.type === tab);
  // Kurulmuş masası admin tarafından iptal edilen tür (bu hafta)
  const tabAdminCancelled = !tabItem && adminCancelledTypes.includes(tab);
  const kycApproved = me?.kyc?.status === 'APPROVED';
  const tabPastClosing = pastClosed.split(',').includes(tab);
  const scanning = owned.includes(tab) && kycApproved && !tabPastClosing && !cancelledTypes.includes(tab);

  // Havuza giriş: paket ve KYC onayının ikisi de tamamlandığı an; biri bilinmiyorsa null
  const poolEntry = (t: MasaTuru) => {
    const bought = subs.filter(SUB_OPEN[t]).map(s => Date.parse(s.createdAt));
    return bought.length && kycAt ? Math.max(Math.min(...bought), Date.parse(kycAt)) : null;
  };
  const statusOf = (t: MasaTuru): TabStatus => {
    if (tables[t]) {
      const table = items.find(i => i.meeting.type === t);
      return table && !isTableLocked(table.meeting.scheduledAt) ? 'FORMING' : 'TABLE';
    }
    if (cancelledTypes.includes(t)) return 'CANCELLED';
    if (!rights[t]) return 'NONE';
    if (!kycApproved) return 'KYC';
    if (t === 'KANKA' && kankaWaiting) return 'KANKA';
    if (!pastClosed.split(',').includes(t)) return 'SCANNING';
    // Başarısız yalnızca kapanıştan önce havuzda olana; kapanıştan sonra gelen yeni taramayı bekler
    const since = poolEntry(t);
    return since !== null && since < lastClosing(t) ? 'FAILED' : 'PENDING';
  };
  const statuses: Record<MasaTuru, TabStatus> = { GROUP: statusOf('GROUP'), ONE_ON_ONE: statusOf('ONE_ON_ONE'), KANKA: statusOf('KANKA') };

  const selfParticipant = me
    ? { initials: buildInitials(me.firstName, me.lastName), gender: me.profile?.gender ?? null }
    : undefined;

  return {
    ready: mounted && dashLoaded, me, items, kanka, tab, tabItem, selectTab, statuses, kycApproved,
    tabPastClosing, scanning, selfParticipant, reload, tabAdminCancelled,
  };
}
