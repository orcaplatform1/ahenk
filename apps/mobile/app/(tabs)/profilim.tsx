// Sekme 5 — Profilim: apps/web/app/profil/page.tsx. Üst sekme çubuğu yok; Kişilik Ağacım profil fotoğrafının altındaki kartla, Numara
// Engelleme "Gizlilik ve Güvenlik" kartıyla,
// Kimlik Doğrulama KYC kartıyla (tab=kyc) açılır; "← Profilim" ve Android geri tuşu Profilim'e döner
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Btn, BtnGhost, Serif, SkeletonBlock, T, Glow, ScreenGlow } from '@/components/ui';
import { ProfilimTab, type City, type UserData } from '@/components/profil/ProfilimTab';
import { KisilikTab } from '@/components/profil/KisilikTab';
import { RehberTab } from '@/components/profil/RehberTab';
import { KycTab } from '@/components/profil/KycTab';
import { ll, llTitle, tw } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';
import { ProfilePhotoHeader } from '@/components/ProfilePhoto';
import { Onboarding } from '@/components/Onboarding';
import { buildInitials } from '@/lib/masa';

import { useTranslation } from 'react-i18next';
const TABS = [
  { key: 'profil', label: 'tabs.profil' },
  { key: 'test', label: 'tabs.test' },
  { key: 'rehber', label: 'tabs.rehber' },
  { key: 'kyc', label: 'tabs.kyc' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function Profilim() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabKey>('profil');
  const [user, setUser] = useState<UserData | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [howOpen, setHowOpen] = useState(false);
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
            {/* Kişilik Ağacım'da büyük başlık "← Profilim" ile aynı satırda, sağa yaslı */}
            {tab === 'test' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <Btn variant="pillRed" label={t('prof.backArrow')} onPress={backToProfil} />
                <Serif accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontSize: llTitle.size, lineHeight: llTitle.size * llTitle.lineHeight, color: ll.text, textAlign: 'right' }}>{t('prof.tree')}</Serif>
              </View>
            ) : tab !== 'profil' && <Btn variant="pillRed" label={t('prof.backArrow')} style={{ alignSelf: 'flex-start', marginBottom: 16 }} onPress={backToProfil} />}
            {/* En üstte büyük yuvarlak profil alanı (fotoğraf yoksa ad soyad kısaltması) */}
            {/* Profil fotoğrafının hemen üstünde, sağa hizalı: tanıtımı 1. adımdan açar (onboardingSeenAt değişmez) */}
            {user && tab === 'profil' && (
              <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                <BtnGhost label={t('onb.howItWorks')} onPress={() => setHowOpen(true)} />
              </View>
            )}
            {user && tab === 'profil' && <ProfilePhotoHeader photoUrl={user.profilePhotoUrl} initials={buildInitials(user.firstName, user.lastName)} gender={user.profile?.gender} kycApproved={kycApproved} pending={user.profilePhotoPending} />}
            {loading ? <SkeletonBlock lines={4} /> : fetchError && !user ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
                <T style={{ color: tw.muted, fontSize: 14, marginBottom: 16 }}>{t('prof.loadFailed')}</T>
                <BtnGhost label={t('common.tryAgain')} onPress={() => { setLoading(true); load(); }} />
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
      <Onboarding visible={howOpen} onClose={() => setHowOpen(false)} />
    </View>
  );
}
