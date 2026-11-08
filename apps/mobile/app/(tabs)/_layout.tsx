// Alt menü (S-26): 5 sekme, AccountTabBar renkleri, ince çizgi ikonlar, Profilim'de baş harf rozeti, Bildirimler'de sayı rozeti
import React, { useCallback, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { api } from '@/lib/api';
import { buildInitials } from '@/lib/masa';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { SOS_POLL_MS, syncSosLive } from '@/lib/sosLive';
import { LineIcon, ProfileTabIcon } from '@/components/TabIcons';
import { ShakeReport } from '@/components/ShakeReport';
import { WinbackHost } from '@/components/Winback';
import { sans, tabBar, tw } from '@/theme/theme';

interface Me { firstName: string; lastName: string; profile?: { gender?: string | null } }

export const unreadBus = { listeners: new Set<() => void>(), emit() { this.listeners.forEach((l) => l()); } };

export default function TabsLayout() {
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const loadUnread = useCallback(() => {
    api.get<{ unreadCount?: number }>('/notifications?page=1&limit=1').then((r) => setUnread(r?.unreadCount ?? 0)).catch(() => {});
  }, []);
  useEffect(() => {
    api.get<Me>('/auth/me').then(setMe).catch(() => {});
    loadUnread();
    const id = setInterval(loadUnread, 60_000);
    unreadBus.listeners.add(loadUnread);
    return () => { clearInterval(id); unreadBus.listeners.delete(loadUnread); };
  }, [loadUnread]);
  useAppRefresh(loadUnread);
  // Açık acil yardım talebi: talep edenin canlı konumu (web SosOpenReport); açık talep varken 30 sn'de bir denetlenir
  const [sosOpen, setSosOpen] = useState(false);
  const syncSos = useCallback(() => { syncSosLive().then((id) => setSosOpen(!!id)); }, []);
  useEffect(() => { syncSos(); }, [syncSos]);
  useEffect(() => { if (!sosOpen) return; const id = setInterval(syncSos, SOS_POLL_MS); return () => clearInterval(id); }, [sosOpen, syncSos]);
  useAppRefresh(syncSos);

  return (
    <>
    <ShakeReport />
    <WinbackHost />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabBar.active,
        tabBarInactiveTintColor: tabBar.inactive,
        tabBarStyle: { backgroundColor: tabBar.bg, borderTopColor: tabBar.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontFamily: sans(500), fontSize: 10 },
        tabBarBadgeStyle: { backgroundColor: tw.primary, color: '#fff', fontFamily: sans(600), fontSize: 10 },
        sceneStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Eşleşme Paneli', tabBarIcon: ({ color }) => <LineIcon name="radar" color={String(color)} /> }} />
      <Tabs.Screen name="masalarim" options={{ title: 'Masalarım', tabBarIcon: ({ color }) => <LineIcon name="table" color={String(color)} /> }} />
      <Tabs.Screen name="bildirimler" options={{ title: 'Bildirimler', tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: ({ color }) => <LineIcon name="bell" color={String(color)} /> }} />
      <Tabs.Screen name="paketim" options={{ title: 'Paketim', tabBarIcon: ({ color }) => <LineIcon name="package" color={String(color)} /> }} />
      <Tabs.Screen name="profilim" options={{ title: 'Profilim', tabBarIcon: ({ focused }) => <ProfileTabIcon initials={me ? buildInitials(me.firstName, me.lastName) : '?'} gender={me?.profile?.gender} focused={focused} /> }} />
    </Tabs>
    </>
  );
}
