// Mobil uygulamadaki bütün "Çıkış" butonlarının ortak seçim penceresi (üye, ADMIN ve SUPERADMIN aynı):
// "Bu cihazda beni hatırla" (oturum kapanır, cihaz hatırlanır → açılışta Tekrar hoş geldin + Face ID / parmak izi + Cihaz Doğrulandı),
// "Bu cihazda beni unut" (oturum kapanır, hatırlama bilgisi silinir), "Vazgeç". HIG: iptal seçeneği, en az 44 pt dokunma alanı.
// remember=false verilirse yalnız "Bu cihazda beni unut" ve "Vazgeç" (şu an bütün çağrılar varsayılanı kullanır).
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, settleRefresh } from '@/lib/api';
import { forgetDevice, rememberDevice } from '@/lib/session';
import { BtnGhost, BtnPrimary, Sheet, T } from './ui';

export function LogoutChoice({ visible, onClose, firstName = '', onLoggedOut, remember: allowRemember = true }: { visible: boolean; onClose: () => void; firstName?: string; onLoggedOut: () => void; remember?: boolean }) {
  const router = useRouter();
  // Hatırla: süren token yenilemesi beklenir, yenileme token'ı ve ad saklanır, doğrudan "Tekrar hoş geldin, [ad]!" ekranına gidilir
  // (önceden normal giriş ekranına gidiliyordu; orada yeniden giriş yapılınca hatırlama bilgisi siliniyordu)
  async function remember() {
    if (!allowRemember) return;
    onClose();
    await settleRefresh();
    if (await rememberDevice(firstName)) router.replace('/tekrar-hosgeldin'); else onLoggedOut();
  }
  async function forget() { onClose(); await api.logout(); await forgetDevice(); onLoggedOut(); }
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T w={700} style={{ fontSize: 16, marginBottom: 16, textAlign: 'center' }}>Çıkış Yap</T>
      <View style={{ gap: 12 }}>
        {allowRemember && <BtnPrimary label="Bu cihazda beni hatırla" full onPress={remember} />}
        <BtnGhost label="Bu cihazda beni unut" full onPress={forget} />
        <BtnGhost label="Vazgeç" full onPress={onClose} />
      </View>
    </Sheet>
  );
}
