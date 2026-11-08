// Sekme 5 — Profilim: apps/web/app/profil/page.tsx + AccountTabBar (S-07: webdeki yerleşim; S-07b: KYC onaylıysa gizli)
import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Btn, BtnGhost, SkeletonBlock, T, Glow } from '@/components/ui';
import { ProfilimTab, type City, type UserData } from '@/components/profil/ProfilimTab';
import { KisilikTab } from '@/components/profil/KisilikTab';
import { RehberTab } from '@/components/profil/RehberTab';
import { KycTab } from '@/components/profil/KycTab';
import { accountTab, ll, tabBar, tw } from '@/theme/theme';

const TABS = [
  { key: 'profil', label: 'Profilim' },
  { key: 'test', label: 'Kişilik Testim' },
  { key: 'rehber', label: 'Numara Engelleme' },
  { key: 'kyc', label: 'Kimlik Doğrulama' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function Profilim() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabKey>('profil');
  const [user, setUser] = useState<UserData | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => { const p = TABS.find(t => t.key === params.tab)?.key; if (p) setTab(p); }, [params.tab]);

  const load = useCallback(() => {
    api.get<UserData>('/auth/me').then(u => { setUser(u); setFetchError(false); api.get<City[]>('/auth/cities').then(setCities).catch(() => {}); })
      .catch(() => setFetchError(true)).finally(() => setLoading(false));
  }, []);
  useFocusEffect(load);

  const kycApproved = user?.kyc?.status === 'APPROVED';
  const tabs = TABS.filter(t => !(t.key === 'kyc' && kycApproved));

  return (
    <View style={{ flex: 1, backgroundColor: tw.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: tabBar.bg, borderBottomWidth: 1, borderBottomColor: tabBar.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: accountTab.gap, paddingHorizontal: accountTab.barPadH, paddingVertical: accountTab.barPadV }}>
          {tabs.map(t => {
            const on = tab === t.key;
            return (
              <Btn key={t.key} variant="accountTab" selected={on} label={t.label} hitSlop={{ top: 8, bottom: 8 }} onPress={() => setTab(t.key)} />
            );
          })}
        </ScrollView>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 32, maxWidth: 896, width: '100%', alignSelf: 'center' }}>
            <Glow />
            {loading ? <SkeletonBlock lines={4} /> : fetchError && !user ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
                <T style={{ color: tw.muted, fontSize: 14, marginBottom: 16 }}>Profil yüklenemedi. Lütfen tekrar deneyin.</T>
                <BtnGhost label="Yeniden Dene" onPress={() => { setLoading(true); load(); }} />
              </View>
            ) : user ? (
              <>
                {tab === 'profil' && <ProfilimTab user={user} cities={cities} onLoggedOut={() => router.replace('/giris')} onAdmin={() => router.push('/admin/stats')} />}
                {tab === 'test' && <KisilikTab />}
                {tab === 'rehber' && <RehberTab />}
                {tab === 'kyc' && <KycTab />}
              </>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
