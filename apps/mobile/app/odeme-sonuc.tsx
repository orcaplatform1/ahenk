// apps/web/app/odeme/basarili + basarisiz karşılığı (durum=basarili|basarisiz)
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { BtnGhost, BtnPrimary, Serif, T } from '@/components/ui';
import { tw } from '@/theme/theme';

export default function OdemeSonuc() {
  const router = useRouter();
  const { durum } = useLocalSearchParams<{ durum?: string }>();
  const ok = durum === 'basarili';
  useEffect(() => { if (!ok) return; const t = setTimeout(() => router.replace('/(tabs)'), 3000); return () => clearTimeout(t); }, [ok, router]);
  return (
    <View style={{ flex: 1, backgroundColor: tw.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 24 }}>
      {ok ? (
        <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={44} height={44} viewBox="0 0 44 44" fill="none"><Path d="M9 22 L19 32 L35 14" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </LinearGradient>
      ) : (
        <View style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(192,57,43,0.15)', borderWidth: 2, borderColor: 'rgba(192,57,43,0.4)' }}>
          <Svg width={44} height={44} viewBox="0 0 44 44" fill="none"><Path d="M14 14 L30 30 M30 14 L14 30" stroke="#ff6b6b" strokeWidth={3.5} strokeLinecap="round" /></Svg>
        </View>
      )}
      <Serif style={{ fontSize: 36, textAlign: 'center' }}>{ok ? 'Paketini aldın!' : 'Ödeme tamamlanamadı.'}</Serif>
      <T style={{ color: '#777', fontSize: 14 }}>{ok ? 'Artık masalara katılabilirsin.' : 'Tekrar denemek için pakete dön.'}</T>
      {ok ? <BtnPrimary label="Dashboard'a Git" style={{ alignSelf: 'center', marginTop: 8 }} onPress={() => router.replace('/(tabs)')} />
        : <BtnGhost label="Paketime Dön" style={{ alignSelf: 'center', marginTop: 8 }} onPress={() => router.replace('/(tabs)/paketim')} />}
      {ok && <T style={{ color: '#444', fontSize: 12 }}>3 saniye içinde otomatik yönlendirileceksin…</T>}
    </View>
  );
}
