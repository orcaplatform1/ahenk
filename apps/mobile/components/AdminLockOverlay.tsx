// Yönetim paneli kilit ekranı (lib/adminLock.ts): kilitliyken tam ekran, kapatılamaz (Android geri tuşu etkisiz).
// Açılınca doğrulama kendiliğinden başlar; biyometrik tanımlı değilse cihaz şifresi istenir (disableDeviceFallback: false).
// Başarısızsa oturum kapanmaz, "Tekrar Dene" butonu görünür. HIG: güvenli alan, en az 44 pt dokunma alanı.
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { isAdminLocked, loadLocalAuth, markAdminVerified, onAdminLock, unlockForLogin } from '@/lib/adminLock';
import { api } from '@/lib/api';
import { forgetDevice } from '@/lib/session';
import { setAdminIdentity } from '@/lib/adminRole';
import { BtnPrimary, Serif, T } from './ui';
import { ll } from '@/theme/theme';

export function AdminLockOverlay() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [locked, setLocked] = useState(isAdminLocked());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');

  const verify = useCallback(async () => {
    setBusy(true); setFailed('');
    const la = loadLocalAuth();
    try {
      // Cihazda biyometrik de ekran kilidi de yoksa kilit açılamaz: kilit kalkar, oturum kapanıp normal giriş ekranına gidilir
      if (!la || (await la.getEnrolledLevelAsync()) === la.SecurityLevel.NONE) {
        await api.logout().catch(() => undefined);
        await forgetDevice();
        setAdminIdentity(null);
        unlockForLogin();
        router.replace('/giris');
        return;
      }
      const r = await la.authenticateAsync({ promptMessage: 'Yönetim paneli doğrulaması', cancelLabel: 'Vazgeç', disableDeviceFallback: false });
      if (r.success) { markAdminVerified(); return; }
      setFailed('Doğrulama başarısız oldu.');
    } catch (e) {
      setFailed((e as Error).message || 'Doğrulama başarısız oldu.');
    } finally { setBusy(false); }
  }, [router]);

  useEffect(() => onAdminLock(setLocked), []);
  useEffect(() => { if (locked) verify(); }, [locked, verify]);

  return (
    <Modal visible={locked} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: ll.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom, gap: 16 }}>
        <Serif style={{ fontSize: 28, lineHeight: 34, color: ll.text, textAlign: 'center' }}>Yönetim paneli kilitli</Serif>
        <T style={{ fontSize: 14, lineHeight: 21, color: ll.text2, textAlign: 'center' }}>Devam etmek için kimliğini doğrula.</T>
        {!!failed && <T style={{ fontSize: 13, lineHeight: 19, color: ll.red2, textAlign: 'center' }}>{failed}</T>}
        {!!failed && !busy && <BtnPrimary label="Tekrar Dene" full style={{ minHeight: 44, marginTop: 8 }} onPress={verify} />}
      </View>
    </Modal>
  );
}
