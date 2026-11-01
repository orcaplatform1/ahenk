'use client';

import { AccountTabBar } from '@/components/AccountTabBar';
import MaintenanceNotice from '@/components/MaintenanceNotice';
import LiveLayer from '@/components/live/LiveLayer';
import { useMasaTabs } from '@/components/live/useMasaTabs';
import LiveParticipation from '@/components/live/LiveParticipation';
import { WinbackHost } from '@/components/winback/WinbackHost';

export default function DashboardPage() {
  const { ready, me, kanka, tab, tabItem, selectTab, statuses, kycApproved, tabPastClosing, scanning, selfParticipant } = useMasaTabs();

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
        statuses={statuses}
        tabPastClosing={tabPastClosing}
        onTab={selectTab}
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
