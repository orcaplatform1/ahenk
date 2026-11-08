// apps/web/app/mekan/panel/abonelik/page.tsx karşılığı
import React from 'react';
import { View } from 'react-native';
import { panelCard, useVenuePanel } from '@/lib/venueContext';
import { Serif, T } from '@/components/ui';
import { c, tw } from '@/theme/theme';

export default function Abonelik() {
  const { me } = useVenuePanel();
  return (
    <View style={{ gap: 12 }}>
      <Serif style={{ fontSize: 25.6 }}>Abonelik</Serif>
      <View style={panelCard}>
        <T style={{ fontSize: 12, color: c.t888 }}>Plan</T>
        <T w={600} style={{ marginTop: 2.4, marginBottom: 14.4, fontSize: 17.6, color: tw.accent }}>Ücretsiz dönem</T>
        <T style={{ fontSize: 12, color: c.t888 }}>Kayıt tarihi</T>
        <T style={{ marginTop: 2.4, fontSize: 16 }}>{new Date(me.registeredAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })}</T>
      </View>
    </View>
  );
}
