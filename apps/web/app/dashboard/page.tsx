'use client';

import { AccountTabBar } from '@/components/AccountTabBar';
import MaintenanceNotice from '@/components/MaintenanceNotice';
import LiveLayer from '@/components/live/LiveLayer';
import { useMasaTabs } from '@/components/live/useMasaTabs';
import LiveParticipation from '@/components/live/LiveParticipation';
import { WinbackHost } from '@/components/winback/WinbackHost';
import KycNoticeCard from '@/components/KycNoticeCard';
import WeeklySelectionModal from '@/components/live/WeeklySelectionModal';

const MEETING_GRACE_MS = 3 * 60 * 60 * 1000;

export default function DashboardPage() {
  const { ready, me, kanka, tab, tabItem: rawTabItem, selectTab, statuses, kycApproved, tabPastClosing, scanning, selfParticipant, tabAdminCancelled, selection, submitSelection } = useMasaTabs();
  // Buluşma saatinden 3 saat sonra masa panelden düşer: sayaç yeni haftaya geçer, Katılım ve kontenjan sıfırlanır
  // (dashboard 15 sn'de bir yenilendiği için sayfa yenilenmeden geçer)
  const tabItem = rawTabItem && Date.now() < Date.parse(rawTabItem.meeting.scheduledAt) + MEETING_GRACE_MS ? rawTabItem : undefined;

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] pt-[52px]">
      <AccountTabBar kycApproved={kycApproved} />
      <WinbackHost badge />
      <WeeklySelectionModal selection={selection} onSubmit={submitSelection} />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 70% 30%, rgba(192,57,43,0.1) 0%, transparent 70%)' }}
      />
      <div className="relative z-10 max-w-5xl mx-auto px-4">
        <KycNoticeCard show={!!me && !kycApproved} />
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
        tabSeatsLeft={tabItem ? Math.max(0, (tabItem.meeting.maxParticipants ?? 0) - tabItem.meeting.participants.filter(p => !p.cancelled).length) : null}
        meetingAt={tabItem && statuses[tab] === 'TABLE' ? tabItem.meeting.scheduledAt : null}
        scanOff={tabAdminCancelled}
        tab={tab}
        statuses={statuses}
        tabPastClosing={tabPastClosing}
        onTab={selectTab}
        participation={<LiveParticipation tab={tab} item={tabItem} self={selfParticipant} kanka={kanka} scanning={scanning} />}
      />
    </div>
  );
}
