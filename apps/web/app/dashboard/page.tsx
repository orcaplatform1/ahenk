'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { MasalarDashboard, buildInitials, isMatchingClosed, type DashboardItem, type MasaTuru } from '@ahenk/ui';
import { api } from '@/lib/api';
import { AccountTabBar } from '@/components/AccountTabBar';
import MaintenanceNotice from '@/components/MaintenanceNotice';
import LiveLayer from '@/components/live/LiveLayer';
import LiveParticipation from '@/components/live/LiveParticipation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co';

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

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  const selfParticipant = me
    ? { initials: buildInitials(me.firstName, me.lastName), gender: me.profile?.gender ?? null }
    : undefined;

  // Sekmeler: aktif paket hakkı ya da bu hafta masası olan türler; hiç yoksa üçü de (paket seçme ekranı için)
  const hasItem = (t: MasaTuru) => items.some(i => i.meeting.type === t);
  const owned: MasaTuru[] = [
    ...(me?.openParts?.group || hasItem('GROUP') ? ['GROUP' as const] : []),
    ...(me?.openParts?.oneOnOne || hasItem('ONE_ON_ONE') ? ['ONE_ON_ONE' as const] : []),
    ...(me?.kankamla?.open || hasItem('KANKA') ? ['KANKA' as const] : []),
  ];
  const tabs: MasaTuru[] = owned.length ? owned : ['GROUP', 'ONE_ON_ONE', 'KANKA'];
  const tab = chosenTab && tabs.includes(chosenTab) ? chosenTab : tabs[0];
  const tabItem = items.find(i => i.meeting.type === tab);
  const kycApproved = me?.kyc?.status === 'APPROVED';
  const scanning = owned.includes(tab) && kycApproved && !isMatchingClosed(tab);

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
        tab={tab}
        tabs={tabs}
        onTab={setChosenTab}
        participation={<LiveParticipation tab={tab} item={tabItem} self={selfParticipant} kanka={kanka} scanning={scanning} />}
      >
        {(tabItem || !scanning) && (
          <div className="mb-3">
            <h1 className="font-serif text-3xl text-[#f5f5f5] mb-1">Bu Haftanın Masası</h1>
          </div>
        )}
        <MasalarDashboard
          apiBase={`${API_BASE}/api/v1`}
          selfParticipant={selfParticipant}
          activePlan={me?.activePlan ?? null}
          kycApproved={me?.kyc?.status === 'APPROVED'}
          kankamlaActive={!!me?.kankamla?.open}
          modalPortal={(node) => createPortal(node, document.body)}
          activeTabOverride={tab}
          onItems={setItems}
        />
      </LiveLayer>
    </div>
  );
}
