// Alt menü (S-26): 5 sekme, AccountTabBar renkleri, ince çizgi ikonlar, Profilim'de baş harf rozeti, yalnız Bildirimler'de sayı / nokta rozeti,
// seçili sekmede (Profil hariç) ikon arkasında hap zemin
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { buildInitials } from '@/lib/masa';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { SOS_LOCATION_CHECK_MS, SOS_POLL_MS, checkSosLocation, onSosLocationResumed, syncSosLive } from '@/lib/sosLive';
import { SosNotice } from '@/components/SosNotice';
import { PngTabIcon, ProfileCenterButton, TabBadge, TabPill } from '@/components/TabIcons';
import { ShakeReport } from '@/components/ShakeReport';
import { WinbackHost } from '@/components/Winback';
import { PermissionIntro } from '@/components/PermissionIntro';
import { Onboarding } from '@/components/Onboarding';
import { tabBar, tabIcon, tabNavIcon } from '@/theme/theme';

import { useTranslation } from 'react-i18next';
interface Me { firstName: string; lastName: string; profilePhotoUrl?: string | null; profile?: { gender?: string | null }; onboardingSeenAt?: string | null }

export const unreadBus = { listeners: new Set<() => void>(), emit() { this.listeners.forEach((l) => l()); } };

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<Me | null>(null);
  // Rozet: Bildirimler sayfasının son açılışından sonra gelen okunmamış sayısı; sayı yokken okunmamış varsa nokta
  const [unread, setUnread] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);
  const loadUnread = useCallback(() => {
    api.get<{ newUnreadCount?: number; hasUnread?: boolean }>('/notifications?page=1&limit=1')
      .then((r) => { setUnread(r?.newUnreadCount ?? 0); setHasUnread(!!r?.hasUnread); }).catch(() => {});
  }, []);
  useEffect(() => {
    api.get<Me>('/auth/me').then(setMe).catch(() => {});
    loadUnread();
    const id = setInterval(loadUnread, 60_000);
    unreadBus.listeners.add(loadUnread);
    return () => { clearInterval(id); unreadBus.listeners.delete(loadUnread); };
  }, [loadUnread]);
  useAppRefresh(loadUnread);
  const [onbOpen, setOnbOpen] = useState(false);
  const onbChecked = useRef(false);
  useEffect(() => { if (me && !onbChecked.current) { onbChecked.current = true; if (me.onboardingSeenAt === null) setOnbOpen(true); } }, [me]);
  const closeOnboarding = useCallback((completed: boolean) => {
    setOnbOpen(false);
    if (completed) api.post('/users/me/onboarding-seen', {}).catch(() => {});
  }, []);
  // Açık acil yardım talebi: talep edenin canlı konumu (web SosOpenReport); açık talep varken 30 sn'de bir denetlenir
  const [sosOpen, setSosOpen] = useState(false);
  const syncSos = useCallback(() => { syncSosLive().then((id) => setSosOpen(!!id)); }, []);
  useEffect(() => { syncSos(); }, [syncSos]);
  useEffect(() => { if (!sosOpen) return; const id = setInterval(syncSos, SOS_POLL_MS); return () => clearInterval(id); }, [sosOpen, syncSos]);
  useAppRefresh(syncSos);
  // Açık talepte konum servisi kapanırsa sunucuya bildirilir (sunucu push gönderir); konum yeniden gelince 10 sn "Konumun yeniden alınıyor"
  const [resumed, setResumed] = useState(false);
  useEffect(() => onSosLocationResumed(() => setResumed(true)), []);
  useEffect(() => { const id = setInterval(() => { checkSosLocation().catch(() => {}); }, SOS_LOCATION_CHECK_MS); return () => clearInterval(id); }, []);
  const closeResumed = useCallback(() => setResumed(false), []);

  return (
    <>
    <SosNotice visible={resumed} title={t('sos.resumedTitle')} lines={[t('sos.resumedLine')]} bold={t('sos.resumedBold')} durationMs={10_000} onClose={closeResumed} />
    <ShakeReport />
    <WinbackHost />
    {/* Giriş sonrası bir kerelik izin bilgilendirme ekranı */}
    <PermissionIntro />
    {/* Kayıttan sonra bir kez tanıtım ("Nasıl Çalışır"): User.onboardingSeenAt boşken; Başla / Atla ile doldurulur */}
    <Onboarding visible={onbOpen} onClose={closeOnboarding} />
    <Tabs
      screenOptions={{
        headerShown: false,
        // İkon renkleri: seçili #FF3B30, seçili olmayan beyaz (tabNavIcon); zemin, yükseklik ve kenar aynı
        tabBarActiveTintColor: tabNavIcon.active,
        tabBarInactiveTintColor: tabNavIcon.inactive,
        tabBarStyle: { backgroundColor: tabBar.bg, borderTopColor: tabBar.border, borderTopWidth: 1, height: tabIcon.barHeight + insets.bottom },
        // Sekme yazıları kaldırıldı; tüm ikonlar eşit boy (tabIcon.size), menü Instagram ölçüsünde ince (tabIcon.barHeight)
        tabBarShowLabel: false,
        tabBarIconStyle: { width: tabIcon.size, height: tabIcon.size },
        sceneStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      {/* Sıra: Ana Sayfa (Ahenk logosu) · Takvim (Masalarım) · Profil (ortada büyük) · Paketler (bilet) · Bildirimler (zil) */}
      <Tabs.Screen name="index" options={{ title: t('kankaInv.home'), tabBarIcon: ({ color, focused }) => <TabPill focused={focused}><PngTabIcon name="ahenk" color={String(color)} /></TabPill> }} />
      <Tabs.Screen name="masalarim" options={{ title: t('tabs.calendar'), tabBarIcon: ({ color, focused }) => <TabPill focused={focused}><PngTabIcon name="calendar" color={String(color)} /></TabPill> }} />
      <Tabs.Screen name="profilim" options={{ title: t('tabs.profil'), tabBarButton: (props) => <ProfileCenterButton props={props} initials={me ? buildInitials(me.firstName, me.lastName) : '?'} gender={me?.profile?.gender} photoUrl={me?.profilePhotoUrl} /> }} />
      <Tabs.Screen name="paketim" options={{ title: t('tabs.packages'), tabBarIcon: ({ color, focused }) => <TabPill focused={focused}><PngTabIcon name="package" color={String(color)} /></TabPill> }} />
      <Tabs.Screen name="bildirimler" options={{ title: t('tabs.notifications'), tabBarIcon: ({ color, focused }) => <TabPill focused={focused}><TabBadge count={unread} dot={hasUnread}><PngTabIcon name="bell" color={String(color)} /></TabBadge></TabPill> }} />
    </Tabs>
    </>
  );
}
