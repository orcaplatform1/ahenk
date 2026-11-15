// Sekme 5 — Profilim: apps/web/app/profil/page.tsx. Üst sekme çubuğu yok; Kişilik Ağacım ve Numara Engelleme Hesap Bilgileri'ndeki butonlarla,
// Kimlik Doğrulama KYC kartıyla (tab=kyc) açılır; "← Profilim" ve Android geri tuşu Profilim'e döner
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Btn, BtnGhost, SkeletonBlock, T, Glow, ScreenGlow } from '@/components/ui';
import { ProfilimTab, type City, type UserData } from '@/components/profil/ProfilimTab';
import { KisilikTab } from '@/components/profil/KisilikTab';
import { RehberTab } from '@/components/profil/RehberTab';
import { KycTab } from '@/components/profil/KycTab';
import { ll, tw } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';
import { ProfilePhotoHeader } from '@/components/ProfilePhoto';
import { buildInitials } from '@/lib/masa';

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
  const backToProfil = useCallback(() => { setTab('profil'); router.setParams({ tab: 'profil' }); }, [router]);
  // Alt sayfadayken Android geri tuşu Profilim'e döner
  useEffect(() => {
    if (tab === 'profil') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { backToProfil(); return true; });
    return () => sub.remove();
  }, [tab, backToProfil]);

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
          <ScreenGlow />
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 32, paddingBottom: 32, maxWidth: 896, width: '100%', alignSelf: 'center' }}>
            <Glow />
            <View style={{ marginBottom: 16 }}><KycNoticeCard /></View>
            {/* Alt sayfada (Kişilik Ağacım / Numara Engelleme / Kimlik Doğrulama) Profilim'e dönüş: mevcut pillRed etiket stili ("← Paketler" ile aynı) */}
            {tab !== 'profil' && <Btn variant="pillRed" label="← Profilim" style={{ alignSelf: 'flex-start', marginBottom: 16 }} onPress={backToProfil} />}
            {/* En üstte büyük yuvarlak profil alanı (fotoğraf yoksa ad soyad kısaltması) */}
            {user && tab === 'profil' && <ProfilePhotoHeader photoUrl={user.profilePhotoUrl} initials={buildInitials(user.firstName, user.lastName)} gender={user.profile?.gender} kycApproved={kycApproved} pending={user.profilePhotoPending} />}
            {loading ? <SkeletonBlock lines={4} /> : fetchError && !user ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
                <T style={{ color: tw.muted, fontSize: 14, marginBottom: 16 }}>Profil yüklenemedi. Lütfen tekrar deneyin.</T>
                <BtnGhost label="Yeniden Dene" onPress={() => { setLoading(true); load(); }} />
              </View>
            ) : user ? (
              <>
                {tab === 'profil' && <ProfilimTab user={user} cities={cities} onLoggedOut={() => router.replace('/giris')} onAdmin={() => router.push('/admin/stats')} onOpenTest={() => setTab('test')} onOpenRehber={() => setTab('rehber')} />}
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
