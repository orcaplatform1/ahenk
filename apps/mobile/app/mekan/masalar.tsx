// apps/web/app/mekan/panel/masalar/page.tsx karşılığı
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { VenueAuthError, venueApi } from '@/lib/venueApi';
import { panelCard, useVenuePanel } from '@/lib/venueContext';
import { Serif, T } from '@/components/ui';
import { c, tw } from '@/theme/theme';

interface Row { id: string; scheduledAt: string; type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA'; seats: number }
const TYPE_LABEL: Record<Row['type'], string> = { GROUP: 'Grup masası', ONE_ON_ONE: 'Başbaşa masa', KANKA: 'Kankamla masası' };

function RowList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <T style={{ color: c.t666, fontSize: 13.6 }}>{empty}</T>;
  return <>{rows.map(m => { const d = new Date(m.scheduledAt); return (
    <View key={m.id} style={[panelCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18 }]}>
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 14.4 }}>{d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'Europe/Istanbul' })}</T>
        <T style={{ marginTop: 2, fontSize: 12, color: c.t888 }}>{d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })} · {TYPE_LABEL[m.type]}</T>
      </View>
      <T w={600} style={{ color: tw.accent, fontSize: 13.6 }}>{m.seats} kişi</T>
    </View>
  ); })}</>;
}

export default function Masalar() {
  const { onAuthLost } = useVenuePanel();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { venueApi.get<Row[]>('/meetings').then(setRows).catch((e) => { if (e instanceof VenueAuthError) onAuthLost(); else setError((e as Error).message); }); }, [onAuthLost]);
  const now = Date.now();
  const upcoming = (rows ?? []).filter(m => new Date(m.scheduledAt).getTime() >= now).reverse();
  const past = (rows ?? []).filter(m => new Date(m.scheduledAt).getTime() < now);
  return (
    <View style={{ gap: 10 }}>
      <Serif style={{ fontSize: 25.6 }}>Masalar</Serif>
      {!!error && <T style={{ color: tw.accent, fontSize: 13.6 }}>{error}</T>}
      {!rows && !error && <T style={{ color: c.t666, fontSize: 13.6 }}>Yükleniyor…</T>}
      {rows && (
        <>
          <T w={600} style={{ fontSize: 16, marginTop: 8 }}>Yaklaşan</T>
          <RowList rows={upcoming} empty="Yaklaşan masa yok." />
          <T w={600} style={{ fontSize: 16, marginTop: 12 }}>Geçmiş</T>
          <RowList rows={past} empty="Geçmiş masa yok." />
        </>
      )}
    </View>
  );
}
