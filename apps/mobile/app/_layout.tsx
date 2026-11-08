// Kök yerleşim: yazı tipleri, güvenli alan, durum çubuğu (açık içerik — web tamamen koyu tema), yığın gezinme.
// Açılış ekranı (/) yazı tiplerini beklemeden hemen gösterilir; yazı tipleri 3 sn'lik açılış sırasında yüklenir (lib/boot).
// Uygulama doğrudan başka bir yola (bağlantı) açılırsa yazı tipleri yüklenene kadar yerel açılış görseli kalır.
import React, { useEffect, useState } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadFonts } from '@/lib/boot';
import { onAuthLost } from '@/lib/api';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const path = usePathname();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { loadFonts().catch(() => undefined).finally(() => setLoaded(true)); }, []);
  const splash = path === '/';
  useEffect(() => { if (loaded || splash) SplashScreen.hideAsync().catch(() => {}); }, [loaded, splash]);
  useEffect(() => onAuthLost(() => router.replace('/giris')), [router]);

  if (!loaded && !splash) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' }, gestureEnabled: true, fullScreenGestureEnabled: false }}>
        <Stack.Screen name="index" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="giris" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="mekan" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
