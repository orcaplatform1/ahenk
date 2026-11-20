// Askı süresince Profilim'de profil fotoğrafının altında: "Hesabın askıya alındı", "Askının bitmesine" ve Eşleşme Paneli'ndeki
// geri sayım sayacının aynısı (aynı kart zemini, Serif 40). Süre bitince kart kendiliğinden kaybolur (web components/SuspensionCard.tsx).
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Countdown } from './Countdown';
import { Eyebrow, T } from './ui';
import { ll } from '@/theme/theme';

export function SuspensionCard({ until }: { until?: string | null }) {
  const { t } = useTranslation();
  const end = until ? Date.parse(until) : 0;
  const [active, setActive] = useState(() => end > Date.now());
  useEffect(() => {
    setActive(end > Date.now());
    if (!end) return;
    const id = setInterval(() => { if (Date.now() >= end) { setActive(false); clearInterval(id); } }, 1000);
    return () => clearInterval(id);
  }, [end]);
  if (!active) return null;
  return (
    <View accessibilityRole="summary" style={{ borderRadius: 20, borderWidth: 1, borderColor: 'rgba(232,162,122,0.22)', padding: 18, overflow: 'hidden' }}>
      <LinearGradient colors={['rgba(214,69,58,0.14)', 'rgba(255,255,255,0.02)']} locations={[0, 0.6]} start={{ x: 0.33, y: 0.03 }} end={{ x: 0.67, y: 0.97 }} style={StyleSheet.absoluteFill} />
      <T w={700} style={{ fontSize: 16, color: ll.text, textAlign: 'center', marginBottom: 8 }}>{t('prof.suspendedTitle')}</T>
      <Eyebrow style={{ textAlign: 'center' }}>{t('prof.suspendedUntil')}</Eyebrow>
      <Countdown day={0} targetAt={end} />
    </View>
  );
}
