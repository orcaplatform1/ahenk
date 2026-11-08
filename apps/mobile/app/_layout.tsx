// Kök yerleşim: yazı tipleri, güvenli alan, durum çubuğu (açık içerik — web tamamen koyu tema), yığın gezinme
import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { onAuthLost } from '@/lib/api';
import '@/lib/sosTask';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const [loaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
    DMSerifDisplay_400Regular, JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold,
  });

  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  useEffect(() => onAuthLost(() => router.replace('/giris')), [router]);

  if (!loaded) return null;
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
