// Mekân paneli: apps/web/app/mekan/panel/layout.tsx (başlık: mekân adı + şehir + Çıkış, üstte 4 sekme). Üye alt menüsü yok (S-01).
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearVenueTokens } from '@/lib/session';
import { VenueAuthError, venueApi, type VenueMe } from '@/lib/venueApi';
import { VenuePanelContext } from '@/lib/venueContext';
import { Btn, Serif, T } from '@/components/ui';
import { c, tw } from '@/theme/theme';

const NAV = [
  { href: '/mekan/bilgiler', label: 'Mekân Bilgileri' },
  { href: '/mekan/masalar', label: 'Masalar' },
  { href: '/mekan/abonelik', label: 'Abonelik' },
  { href: '/mekan/hesap', label: 'Hesap' },
] as const;

export default function MekanLayout() {
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<VenueMe | null>(null);
  const [error, setError] = useState('');
  const onAuthLost = useCallback(() => { clearVenueTokens().finally(() => router.replace('/giris')); }, [router]);
  useEffect(() => {
    venueApi.get<VenueMe>('/me').then(setMe).catch((e) => { if (e instanceof VenueAuthError) onAuthLost(); else setError((e as Error).message); });
  }, [onAuthLost]);
  async function logout() { await venueApi.post('/logout').catch(() => undefined); onAuthLost(); }

  return (
    <View style={{ flex: 1, backgroundColor: tw.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: 'rgba(18,18,18,0.95)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
        <View style={{ paddingTop: 14, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Serif numberOfLines={1} style={{ fontSize: 20 }}>{me?.venue.name ?? 'Mekân Paneli'}</Serif>
              {me && <T style={{ fontSize: 12, color: c.t666 }}>{me.venue.city}</T>}
            </View>
            <Btn variant="venueLogout" label="Çıkış" onPress={logout} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, marginTop: 6 }}>
            {NAV.map(n => {
              const active = path === n.href;
              return (
                <Btn key={n.href} variant="venueTab" selected={active} label={n.label} onPress={() => router.replace(n.href)} />
              );
            })}
          </ScrollView>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ maxWidth: 820, width: '100%', alignSelf: 'center', paddingTop: 20, paddingHorizontal: 16, paddingBottom: 48 + insets.bottom }}>
        {!!error && <T style={{ color: tw.accent, fontSize: 13.6 }}>{error}</T>}
        {me ? <VenuePanelContext.Provider value={{ me, setMe, onAuthLost }}><Slot /></VenuePanelContext.Provider> : !error && <T style={{ color: c.t666, fontSize: 13.6 }}>Yükleniyor…</T>}
      </ScrollView>
    </View>
  );
}
