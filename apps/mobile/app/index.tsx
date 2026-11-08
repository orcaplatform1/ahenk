// Açılış ekranı (S-22): 3 sn, uygulama genel arka planı (web .live-layer + .ll-glow), logo kendi merkezi etrafında düz dönerek; ekranın en altında Traders.TR markası.
// Bu 3 sn boyunca arka planda: yazı tipleri, görseller, oturum yenileme + /auth/me rol kontrolü ve gidilecek ekranın açılış verileri yüklenir.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getAccess, getKind } from '@/lib/session';
import { api, prefetch, refreshAtLaunch } from '@/lib/api';
import { prefetchVenue, refreshVenueSession } from '@/lib/venueApi';
import { loadFonts, loadImages } from '@/lib/boot';
import { Glow } from '@/components/ui';
import { useReduceMotion } from '@/lib/motion';
import { c, ll, sans, tw } from '@/theme/theme';

const SPLASH_MS = 3000;
// Hedef ekran verisi 3 sn'de bitmediyse en fazla bu süreye kadar beklenir; sonra ekran açılır, süren istekler ekrana aynı yanıtla ulaşır
const DATA_WAIT_MAX_MS = 6000;

// Gidilecek ekranın ilk açılışta istediği GET uçları (ekranlar aynı yolları api.get ile çağırır, ön yüklenen yanıt kullanılır)
const ADMIN_DATA = ['/admin/alerts', '/admin/stats/overview', '/admin/stats/cities', '/admin/dashboard'];
const MEMBER_DATA = ['/payment/subscriptions', '/kyc/status', '/kanka/me', '/meetings/dashboard', '/meetings/live/overview', '/meetings/live/pulse', '/notifications?page=1&limit=1', '/payment/winback'];

export default function Acilis() {
  const router = useRouter();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, spin]);

  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const started = Date.now();
    const fonts = loadFonts().catch(() => undefined).finally(() => { if (alive) setFontsReady(true); });
    const images = loadImages().catch(() => undefined);
    (async () => {
      // Kalıcı oturum: her açılışta mevcut yenileme akışı (üye: /auth/refresh, mekân: /venue-panel/refresh)
      // Yönlendirme: ADMIN/SUPERADMIN → Yönetim Paneli, üye → Eşleşme Paneli (1. sekme), mekân → Mekân paneli, oturum yok → Giriş
      const kind = await getKind();
      let dest: '/mekan/bilgiler' | '/(tabs)' | '/admin' | '/giris' = '/giris';
      let data: Promise<unknown> = Promise.resolve();
      if (kind === 'venue') {
        if ((await refreshVenueSession()) !== 'expired') { dest = '/mekan/bilgiler'; data = Promise.all([prefetchVenue(['/me']), prefetch(['/auth/districts'])]); }
      } else if (await getAccess()) {
        if ((await refreshAtLaunch()) !== 'expired') {
          await prefetch(['/auth/me']);
          const me = await api.get<{ role: string }>('/auth/me').catch(() => null);
          const admin = me?.role === 'ADMIN' || me?.role === 'SUPERADMIN';
          dest = admin ? '/admin' : '/(tabs)';
          data = prefetch(admin ? ADMIN_DATA : MEMBER_DATA);
        }
      }
      const capped = Promise.race([data, new Promise((r) => setTimeout(r, Math.max(0, DATA_WAIT_MAX_MS - (Date.now() - started))))]);
      await Promise.all([fonts, images, capped]);
      const wait = Math.max(0, SPLASH_MS - (Date.now() - started));
      setTimeout(() => { if (alive) router.replace(dest); }, wait);
    })();
    return () => { alive = false; };
  }, [router]);

  // Web Navbar logosu gibi kendi merkezi etrafında saat yönünde düz dönüş (rotate 0→360deg)
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <Glow />
      <Animated.View style={{ marginBottom: 32, transform: [{ rotate }] }}>
        <Image source={require('@/assets/start_logo.jpg')} style={{ width: 184, height: 184, borderRadius: 92 }} />
      </Animated.View>
      {/* Yazı tipleri yüklenene kadar (birkaç ms) yer tutulur, yazı görünmez; yüklenmemiş yazı tipi adı kullanılmaz */}
      <Text style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 16, color: tw.text, fontSize: 12, lineHeight: 18, textAlign: 'center', opacity: fontsReady ? 1 : 0, ...(fontsReady ? { fontFamily: sans(400) } : null) }}>
        Ahenk bir{' '}
        <Text style={{ color: c.tradersText, ...(fontsReady ? { fontFamily: sans(700) } : { fontWeight: '700' }) }}>Traders</Text>
        <Text style={{ color: c.tradersTR, ...(fontsReady ? { fontFamily: sans(800) } : { fontWeight: '800' }) }}>.TR</Text>
        <Text> 🇹🇷</Text>
        {' '}ticari markasıdır.
      </Text>
    </View>
  );
}
