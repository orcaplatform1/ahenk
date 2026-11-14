// KYC onaylanmamış kullanıcıda tüm sekmelerin en üstünde (web components/KycNoticeCard.tsx karşılığı).
// Basınca Profilim → Kimlik Doğrulama açılır; KYC onaylanınca kaybolur. HIG: en az 44 pt dokunma alanı.
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/lib/api';
import { T } from './ui';
import { ll } from '@/theme/theme';

export function KycNoticeCard() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  useFocusEffect(useCallback(() => {
    api.get<{ kyc?: { status: string } }>('/auth/me').then((m) => setShow(m?.kyc?.status !== 'APPROVED')).catch(() => {});
  }, []));
  if (!show) return null;
  return (
    <Pressable
      onPress={() => router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'kyc' } })}
      accessibilityRole="button"
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(214,69,58,0.45)', backgroundColor: 'rgba(214,69,58,0.08)', paddingVertical: 14, paddingHorizontal: 16 }}
    >
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 14, lineHeight: 21, color: ll.text }}>Kullanıcı güvenliği sebebiyle masaya katılım için lütfen kimliğinizi doğrulayın.</T>
      </View>
      <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={ll.red3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M9 6l6 6-6 6" /></Svg>
    </Pressable>
  );
}
