// Yönetim Paneli yerleşimi: apps/web/app/admin/layout.tsx mobil görünümü (üst çubuk 52 px + hamburger çekmece, 208 px)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { setAdminIdentity } from '@/lib/adminRole';
import { Btn, Spinner } from '@/components/ui';
import { ALabel, AT } from '@/components/admin/AdminUi';
import { adm } from '@/theme/theme';

const NAV_TOP = [{ href: '/(tabs)', label: 'Anasayfa' }, { href: '/(tabs)/profilim', label: 'Profilim' }] as const;
export const ADMIN_NAV: { href: string; label: string; alertKey?: boolean; sos?: boolean; superadminOnly?: boolean }[] = [
  { href: '/admin/acil-yardim', label: '🚨 Acil Yardım', sos: true },
  { href: '/admin/stats', label: 'İstatistikler' },
  { href: '/admin/matches', label: 'Masalar' },
  { href: '/admin/kyc', label: 'KYC Bekleyenler' },
  { href: '/admin/users', label: 'Kullanıcılar' },
  { href: '/admin/subscriptions', label: 'Abonelikler' },
  { href: '/admin/alerts', label: 'Uyarılar', alertKey: true },
  { href: '/admin/sonuclandirma', label: 'Ödeme Sonuçlandırma', superadminOnly: true },
  { href: '/admin/venues', label: 'Mekanlar', superadminOnly: true },
  { href: '/admin/cities', label: 'Şehirler' },
  { href: '/admin/denge', label: 'Bot Yönetimi', superadminOnly: true },
  { href: '/admin/fiyatlar', label: 'Paket Fiyatları', superadminOnly: true },
  { href: '/admin/islem-kayitlari', label: 'İşlem Kayıtları', superadminOnly: true },
  { href: '/admin/quality', label: 'Şikayetler' },
  { href: '/admin/sorun-bildirimleri', label: 'Sorun Bildirimleri' },
  { href: '/admin/partnerships', label: 'İş Ortaklığı', superadminOnly: true },
  { href: '/admin/careers', label: 'Kariyer', superadminOnly: true },
  { href: '/admin/janti-haydar', label: 'Janti Haydar' },
  { href: '/admin/settings', label: 'Ayarlar', superadminOnly: true },
];

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const x = useRef(new Animated.Value(-adm.drawerW)).current;
  const drawerOpen = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.get<{ id: string; role: string }>('/auth/me').then(me => {
      if (cancelled) return;
      if (me?.role !== 'ADMIN' && me?.role !== 'SUPERADMIN') { router.replace('/(tabs)'); return; }
      setAdminIdentity({ id: me.id, role: me.role }); setRole(me.role); setReady(true);
      api.get<{ unreadCount: number }>('/admin/alerts').then(d => setUnread(d.unreadCount ?? 0)).catch(() => {});
    }).catch(() => { if (!cancelled) router.replace('/giris'); });
    return () => { cancelled = true; };
  }, [router]);

  const blocked = ready && role !== 'SUPERADMIN' && ADMIN_NAV.some(n => n.superadminOnly && (pathname === n.href || pathname.startsWith(n.href + '/')));
  useEffect(() => { if (blocked) router.replace('/admin/stats'); }, [blocked, router]);

  const openDrawer = useCallback((v: boolean) => {
    drawerOpen.current = v;
    setDrawer(true);
    Animated.timing(x, { toValue: v ? 0 : -adm.drawerW, duration: 250, useNativeDriver: true }).start(() => { if (!v) setDrawer(false); });
  }, [x]);
  // Sayfa değişince yalnız açık çekmece kapatılır. Önceden açılışta da kapatma çağrılıyordu: çekmece Modal'ı (rgba(0,0,0,0.7) örtü)
  // kapanma animasyonu bitene kadar görünür kalıyor, panel açılırken ekran karanlık/soluk görünüyordu.
  useEffect(() => { if (drawerOpen.current) openDrawer(false); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  async function logout() { await api.logout(); setAdminIdentity(null); router.replace('/giris'); }
  const go = (href: string) => { openDrawer(false); router.navigate(href as never); };

  if (!ready || blocked) return <View style={{ flex: 1, backgroundColor: adm.bg, alignItems: 'center', justifyContent: 'center' }}><Spinner /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: adm.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: adm.surface, borderBottomWidth: 1, borderBottomColor: adm.border, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, zIndex: 30 }}>
        <View style={{ height: adm.headerH, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
          <Pressable onPress={() => openDrawer(true)} accessibilityLabel="Menü" hitSlop={10} style={{ padding: 4, gap: 5 }}>
            {[0, 1, 2].map(i => <View key={i} style={{ width: 18, height: 1.5, backgroundColor: adm.muted, borderRadius: 2 }} />)}
          </Pressable>
          <Pressable onPress={() => router.navigate('/admin/stats')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <Image source={require('@/assets/logo.png')} style={{ width: 22, height: 22, borderRadius: 11 }} />
            <ALabel style={{ flexShrink: 1 }}>AHENK YÖNETİM PANELİ</ALabel>
          </Pressable>
          {unread > 0 && (
            <Pressable onPress={() => router.navigate('/admin/alerts')} style={{ marginLeft: 'auto' }}>
              <AT w={700} style={{ fontSize: 11, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99, backgroundColor: adm.red, color: '#fff', overflow: 'hidden' }}>{unread} uyarı</AT>
            </Pressable>
          )}
        </View>
      </View>
      <View style={{ flex: 1 }}><Slot /></View>

      <Modal visible={drawer} transparent animationType="none" onRequestClose={() => openDrawer(false)}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }} onPress={() => openDrawer(false)} />
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: adm.drawerW, backgroundColor: adm.surface, borderRightWidth: 1, borderRightColor: adm.border, paddingTop: insets.top + adm.headerH, transform: [{ translateX: x }], shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 16, shadowOffset: { width: 8, height: 0 } }}>
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 12 }}>
            <View style={{ gap: 2, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: adm.border }}>
              {NAV_TOP.map(n => <Btn key={n.href} variant="admNav" label={n.label} onPress={() => go(n.href)} />)}
            </View>
            <View style={{ gap: 2 }}>
              {ADMIN_NAV.filter(n => !n.superadminOnly || role === 'SUPERADMIN').map(n => {
                const active = pathname === n.href || pathname.startsWith(n.href + '/');
                return (
                  <Btn key={n.href} variant={n.sos ? 'admNavSos' : 'admNav'} selected={active} accessibilityLabel={n.label} onPress={() => go(n.href)}>
                    <AT w={n.sos ? (active ? 700 : 600) : 400} style={{ fontSize: 13, color: n.sos ? adm.red : active ? adm.navActive : adm.muted, flexShrink: 1 }}>{n.label}</AT>
                    {n.alertKey && unread > 0 && <AT w={700} style={{ fontSize: 10, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 99, backgroundColor: adm.red, color: '#fff', minWidth: 18, textAlign: 'center', overflow: 'hidden' }}>{unread > 99 ? '99+' : unread}</AT>}
                  </Btn>
                );
              })}
            </View>
            <View style={{ paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: adm.border }}>
              <Btn variant="admLogout" label="Çıkış" onPress={logout} />
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
}
