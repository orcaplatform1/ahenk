// Kök yerleşim: yazı tipleri, güvenli alan, durum çubuğu (açık içerik — web tamamen koyu tema), yığın gezinme.
// Açılış yönlendirmesi (/) yazı tiplerini ve oturumu yükler, yerel açılış görseli bu sırada görünür (lib/boot).
// Uygulama doğrudan başka bir yola (bağlantı) açılırsa yazı tipleri yüklenene kadar yerel açılış görseli kalır.
import React, { useEffect, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadFonts } from '@/lib/boot';
import { onAuthLost } from '@/lib/api';
import '@/lib/sosLive';
import { AppAlertHost } from '@/components/AppAlert';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Yerel açılış görseli (siyah zemin + logo) açılışta en az bu kadar ekranda kalır; uygulama bu sırada arkada yüklenir
const SPLASH_MIN_MS = 3000;
const BOOT_AT = Date.now();

export default function RootLayout() {
  const router = useRouter();
  const path = usePathname();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { loadFonts().catch(() => undefined).finally(() => setLoaded(true)); }, []);
  const splash = path === '/';
  // En az süre: açılıştan itibaren 3 sn dolunca işaretlenir (yükleme bu sırada beklemez, arkada sürer)
  const [minShown, setMinShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinShown(true), Math.max(0, SPLASH_MIN_MS - (Date.now() - BOOT_AT)));
    return () => clearTimeout(t);
  }, []);
  // Yerel açılış görseli yalnız 3 sn dolduğunda VE yükleme bitip açılış yönlendirmesi (/) gidilecek ekrana geçtiğinde kapanır;
  // yükleme 3 sn'den uzun sürerse yükleme bitene kadar açık kalır
  useEffect(() => { if (loaded && !splash && minShown) SplashScreen.hideAsync().catch(() => {}); }, [loaded, splash, minShown]);
  useEffect(() => onAuthLost(() => router.replace('/giris')), [router]);

  if (!loaded && !splash) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' }, gestureEnabled: true, fullScreenGestureEnabled: false }}>
        <Stack.Screen name="index" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="giris" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="tekrar-hosgeldin" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
      {/* Uygulama genelindeki uyarı penceresi (Alert.alert yerine Ahenk paletinde) */}
      <AppAlertHost />
    </SafeAreaProvider>
  );
}
