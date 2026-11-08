// apps/web/components/live/useMasaTabs.ts ile aynı hesap (S-05). localStorage → AsyncStorage.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { buildInitials, getNextTarget, isTableLocked, type DashboardItem, type MasaTuru } from './masa';
import { isForeground, useAppRefresh } from './useAppRefresh';

export type TabStatus = 'TABLE' | 'FORMING' | 'CANCELLED' | 'SCANNING' | 'KYC' | 'KANKA' | 'PENDING' | 'FAILED' | 'NONE';

const DASHBOARD_POLL_MS = 15_000;
const WEEK_MS = 7 * 86_400_000;
const TAB_STORAGE_KEY = 'ahenk_masa_tab';
const MASA_TURLERI: MasaTuru[] = ['GROUP', 'ONE_ON_ONE', 'KANKA'];

export const CLOSING_DAY: Record<MasaTuru, number> = { GROUP: 4, ONE_ON_ONE: 5, KANKA: 6 };
export const SCAN_START_DAY = 0;

export function isPastClosing(tab: MasaTuru) {
  return getNextTarget(SCAN_START_DAY).getTime() < getNextTarget(CLOSING_DAY[tab]).getTime();
}
function lastClosing(tab: MasaTuru) {
  return getNextTarget(CLOSING_DAY[tab]).getTime() - WEEK_MS;
}

interface OwnSub { plan: string; createdAt: string; usedAt: string | null; groupRights: number; kankaRights: number }

const SUB_OPEN: Record<MasaTuru, (s: OwnSub) => boolean> = {
  GROUP: s => (s.plan === 'MASADA' || s.plan === 'ICERDE') && s.groupRights > 0,
  ONE_ON_ONE: s => (s.plan === 'KARSIMDA' || s.plan === 'ICERDE') && !s.usedAt,
  KANKA: s => s.plan === 'KANKAMLA' && s.kankaRights > 0,
};

export interface MeData {
  id?: string;
  firstName: string;
  lastName: string;
  role?: string;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
  openParts?: { group: boolean; oneOnOne: boolean };
  kankamla?: { open: boolean; hasKanka?: boolean; pairPackageActive?: boolean };
  profile?: { gender?: string | null };
  kyc?: { status: string; rejectReason?: string | null };
  maintenanceMode?: boolean;
}

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

  const refreshPlan = useCallback(() => Promise.all([
    api.get<MeData>('/auth/me').then(u => { if (u) setMe(u); }).catch(() => {}),
    api.get<{ subscriptions: OwnSub[] }>('/payment/subscriptions').then(r => { if (Array.isArray(r?.subscriptions)) setSubs(r.subscriptions); }).catch(() => {}),
  ]), []);

  useEffect(() => {
    AsyncStorage.getItem(TAB_STORAGE_KEY).then(v => { if (v && MASA_TURLERI.includes(v as MasaTuru)) setChosenTab(v as MasaTuru); }).catch(() => {});
    Promise.all([
      refreshPlan(),
      api.get<{ reviewedAt?: string | null }>('/kyc/status').then(r => setKycAt(r.reviewedAt ?? null)).catch(() => {}),
    ]).finally(() => setMounted(true));
  }, [refreshPlan]);

  const reload = useCallback(() => {
    if (!isForeground()) return Promise.resolve();
    api.get<{ kanka: { initials: string; gender: string | null } | null }>('/kanka/me').then(r => { if (r && 'kanka' in r) setKanka(r.kanka); }).catch(() => {});
    return api.get<{ items: DashboardItem[]; weekTableTypes?: MasaTuru[]; weekCancelledTypes?: MasaTuru[]; weekAdminCancelledTypes?: MasaTuru[] }>('/meetings/dashboard')
      .then(r => {
        if (!r || !Array.isArray(r.items)) return;
        setItems(r.items); setWeekTypes(r.weekTableTypes ?? []); setCancelledTypes(r.weekCancelledTypes ?? []); setAdminCancelledTypes(r.weekAdminCancelledTypes ?? []);
      })
      .catch(() => {})
      .finally(() => setDashLoaded(true));
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, DASHBOARD_POLL_MS);
    return () => clearInterval(id);
  }, [reload]);
  useAppRefresh(useCallback(() => { reload(); refreshPlan(); }, [reload, refreshPlan]));

  useEffect(() => {
    const id = setInterval(() => setPastClosed(pastList()), 1000);
    return () => clearInterval(id);
  }, []);

  const selectTab = useCallback((t: MasaTuru) => {
    setChosenTab(t);
    AsyncStorage.setItem(TAB_STORAGE_KEY, t).catch(() => {});
    refreshPlan();
  }, [refreshPlan]);

  const hasTable = (t: MasaTuru) => weekTypes.includes(t) || items.some(i => i.meeting.type === t);
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
  const tabAdminCancelled = !tabItem && adminCancelledTypes.includes(tab);
  const kycApproved = me?.kyc?.status === 'APPROVED';
  const tabPastClosing = pastClosed.split(',').includes(tab);
  const scanning = owned.includes(tab) && kycApproved && !tabPastClosing && !cancelledTypes.includes(tab);

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
    const since = poolEntry(t);
    return since !== null && since < lastClosing(t) ? 'FAILED' : 'PENDING';
  };
  const statuses: Record<MasaTuru, TabStatus> = { GROUP: statusOf('GROUP'), ONE_ON_ONE: statusOf('ONE_ON_ONE'), KANKA: statusOf('KANKA') };

  const selfParticipant = me ? { initials: buildInitials(me.firstName, me.lastName), gender: me.profile?.gender ?? null } : undefined;

  return { ready: mounted && dashLoaded, me, items, kanka, tab, tabItem, selectTab, statuses, kycApproved, tabPastClosing, scanning, selfParticipant, reload, tabAdminCancelled };
}
