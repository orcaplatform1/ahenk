'use client';

import { useEffect, useState } from 'react';
import { buildInitials, type DashboardItem, type MasaTuru } from '@ahenk/ui';
import { api } from '@/lib/api';
import { AccountTabBar } from '@/components/AccountTabBar';
import MaintenanceNotice from '@/components/MaintenanceNotice';
import LiveLayer, { isPastClosing } from '@/components/live/LiveLayer';
import LiveParticipation from '@/components/live/LiveParticipation';

const DASHBOARD_POLL_MS = 15_000;

interface MeData {
  firstName: string;
  lastName: string;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
  openParts?: { group: boolean; oneOnOne: boolean };
  kankamla?: { open: boolean };
  profile?: { gender?: string | null };
  kyc?: { status: string; rejectReason?: string | null };
  maintenanceMode?: boolean;
}

export default function DashboardPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [weekTypes, setWeekTypes] = useState<MasaTuru[]>([]);
  const [dashLoaded, setDashLoaded] = useState(false);
  const [chosenTab, setChosenTab] = useState<MasaTuru | null>(null);
  const [kanka, setKanka] = useState<{ initials: string; gender: string | null } | null>(null);

  useEffect(() => {
    // apiFetch 401 alınca refresh token deniyor (oturum HttpOnly çerezde)
    api.get<MeData>('/auth/me')
      .then(u => { setMe(u); })
      .catch(() => {})
      .finally(() => setMounted(true));
    api.get<{ kanka: { initials: string; gender: string | null } | null }>('/kanka/me').then(r => setKanka(r.kanka)).catch(() => {});
  }, []);

  // Katılım alanı için kullanıcının kendi masaları
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      api.get<{ items: DashboardItem[]; weekTableTypes?: MasaTuru[] }>('/meetings/dashboard')
        .then(r => { if (alive) { setItems(r.items); setWeekTypes(r.weekTableTypes ?? []); } })
        .catch(() => {})
        .finally(() => { if (alive) setDashLoaded(true); });
    };
    load();
    const id = setInterval(load, DASHBOARD_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!mounted || !dashLoaded) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  const selfParticipant = me
    ? { initials: buildInitials(me.firstName, me.lastName), gender: me.profile?.gender ?? null }
    : undefined;

  // Sekmeler: aktif paket hakkı ya da bu hafta masası olan türler seçilebilir; hiç yoksa sayaç Grup'ta kalır
  const hasTable = (t: MasaTuru) => weekTypes.includes(t) || items.some(i => i.meeting.type === t);
  const rights = { GROUP: !!me?.openParts?.group, ONE_ON_ONE: !!me?.openParts?.oneOnOne, KANKA: !!me?.kankamla?.open };
  const tables = { GROUP: hasTable('GROUP'), ONE_ON_ONE: hasTable('ONE_ON_ONE'), KANKA: hasTable('KANKA') };
  const owned = (['GROUP', 'ONE_ON_ONE', 'KANKA'] as const).filter(t => rights[t] || tables[t]) as MasaTuru[];
  const tab = chosenTab && owned.includes(chosenTab) ? chosenTab : owned[0] ?? 'GROUP';
  const tabItem = items.find(i => i.meeting.type === tab);
  const kycApproved = me?.kyc?.status === 'APPROVED';
  const scanning = owned.includes(tab) && kycApproved && !isPastClosing(tab);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] pt-[52px]">
      <AccountTabBar kycApproved={me?.kyc?.status === 'APPROVED'} />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 70% 30%, rgba(192,57,43,0.1) 0%, transparent 70%)' }}
      />
      <div className="relative z-10 max-w-5xl mx-auto px-4">
        {me?.kyc?.status === 'REJECTED' && (
          <div className="mb-4 rounded-2xl px-4 py-4" style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.35)' }}>
            <p className="text-sm font-semibold text-[#ff6b6b] mb-1">Kimlik doğrulamanız reddedildi</p>
            {me.kyc.rejectReason && (
              <p className="text-sm text-[#ccc]">Red nedeni: {me.kyc.rejectReason}</p>
            )}
            <p className="text-xs text-[#888] mt-2">Profilim → Kimlik Doğrulama sekmesinden yeniden başvurabilirsiniz.</p>
          </div>
        )}
        {me?.maintenanceMode && <MaintenanceNotice />}
      </div>
      <LiveLayer
        activePlan={me?.activePlan ?? null}
        hasTabTable={!!tabItem}
        tab={tab}
        rights={rights}
        tables={tables}
        onTab={setChosenTab}
        notice={me && !kycApproved ? (
          <section className="ll-card" style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lock-icon.png" width={64} height={64} alt="" style={{ display: 'block', margin: '0 auto 14px' }} />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, margin: '0 0 22px' }}>
              Eşleşme taramasına katılabilmek için kimlik doğrulamanızı (KYC) tamamlamalısınız.
            </p>
            <a href="/profil?tab=kyc" className="btn-primary">Kimliğimi Doğrula</a>
          </section>
        ) : undefined}
        participation={<LiveParticipation tab={tab} item={tabItem} self={selfParticipant} kanka={kanka} scanning={scanning} />}
      />
    </div>
  );
}
