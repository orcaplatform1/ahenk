// Mobil uygulamadaki bütün "Çıkış" butonlarının ortak seçim penceresi (üye ve admin):
// "Bu cihazda beni hatırla" (oturum kapanır, cihaz hatırlanır → açılışta Tekrar hoş geldin + Face ID / parmak izi + Cihaz Doğrulandı),
// "Bu cihazda beni unut" (oturum kapanır, hatırlama bilgisi silinir), "Vazgeç". HIG: iptal seçeneği, en az 44 pt dokunma alanı.
import React from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { forgetDevice, rememberDevice } from '@/lib/session';
import { BtnGhost, BtnPrimary, Sheet, T } from './ui';

export function LogoutChoice({ visible, onClose, firstName, onLoggedOut }: { visible: boolean; onClose: () => void; firstName: string; onLoggedOut: () => void }) {
  async function remember() { onClose(); await rememberDevice(firstName); onLoggedOut(); }
  async function forget() { onClose(); await api.logout(); await forgetDevice(); onLoggedOut(); }
  return (
    <Sheet visible={visible} onClose={onClose}>
      <T w={700} style={{ fontSize: 16, marginBottom: 16, textAlign: 'center' }}>Çıkış Yap</T>
      <View style={{ gap: 12 }}>
        <BtnPrimary label="Bu cihazda beni hatırla" full onPress={remember} />
        <BtnGhost label="Bu cihazda beni unut" full onPress={forget} />
        <BtnGhost label="Vazgeç" full onPress={onClose} />
      </View>
    </Sheet>
  );
}
