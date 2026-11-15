// "Bu cihazda beni hatırla" ile çıkış yapılmış cihazda uygulama açılınca: "Tekrar hoş geldin, [ad]!" + "Giriş Yap", altta yasal metin.
// Giriş Yap → Face ID / parmak izi. Başarılıysa ortada palet renginde onay işaretli daire + "Cihaz Doğrulandı" kısa süre, ardından
// şifresiz içeri (hatırlanan yenileme token'ı ile oturum açılır). Başarısızsa ya da cihazda yoksa normal giriş ekranı.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { api, refreshAtLaunch } from '@/lib/api';
import { forgetDevice, getRemembered, restoreRemembered } from '@/lib/session';
import { isAdminRole, markAdminVerified } from '@/lib/adminLock';
import { AuthBackground, useAuthBackgroundIndex, BackArrow, LegalNote, PillButton } from '@/components/AuthFlow';
import { Serif, T } from '@/components/ui';
import { ll, tw } from '@/theme/theme';

const VERIFIED_MS = 1500;

type LocalAuth = typeof import('expo-local-authentication');
function loadLocalAuth(): LocalAuth | null {
  // Yerel modül bu derlemede yoksa (eski APK) biyometri kullanılamaz → normal giriş
  try { return require('expo-local-authentication') as LocalAuth; } catch { return null; }
}

async function biometricOk(): Promise<boolean> {
  const la = loadLocalAuth();
  if (!la) return false;
  try {
    if (!(await la.hasHardwareAsync()) || !(await la.isEnrolledAsync())) return false;
    const r = await la.authenticateAsync({ promptMessage: 'Ahenk girişi', cancelLabel: 'Vazgeç', disableDeviceFallback: true });
    return r.success;
  } catch { return false; }
}

export default function TekrarHosgeldin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const bgIndex = useAuthBackgroundIndex();

  useEffect(() => { getRemembered().then((r) => { if (r) setName(r.firstName); else router.replace('/giris'); }); }, [router]);

  async function login() {
    if (busy) return;
    setBusy(true);
    if (!(await biometricOk())) { setBusy(false); router.replace('/giris'); return; }
    await restoreRemembered();
    const r = await refreshAtLaunch();
    // Hatırlanan token yenilemede tüketildi; yeni oturum token'ları aktif. Hatırlama bilgisi sonraki "beni hatırla" çıkışında yeniden yazılır
    await forgetDevice();
    if (r !== 'ok') { setBusy(false); router.replace('/giris'); return; }
    const me = await api.get<{ role?: string }>('/auth/me').catch(() => null);
    // ADMIN / SUPERADMIN de hatırlanan girişi kullanır: biyometri az önce doğrulandığı için yönetim paneli kilidi açık gelir
    const admin = isAdminRole(me?.role);
    if (admin) markAdminVerified();
    setVerified(true);
    setTimeout(() => router.replace(admin ? '/admin' : '/(tabs)'), VERIFIED_MS);
  }

  if (verified) {
    return (
      <View style={{ flex: 1, backgroundColor: ll.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: tw.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
        </View>
        <T w={700} style={{ fontSize: 18, color: ll.text }}>Cihaz Doğrulandı</T>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg }}>
      <AuthBackground index={bgIndex} overlay />
      <BackArrow onPress={() => router.replace('/giris')} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: 32, gap: 24 }}>
        <Serif style={{ fontSize: 25.6, lineHeight: 32, textAlign: 'center', color: ll.text }}>Tekrar hoş geldin, {name}!</Serif>
        <PillButton label={busy ? '…' : 'Giriş Yap'} primary disabled={busy} onPress={login} />
      </View>
      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}><LegalNote /></View>
    </View>
  );
}
