// Mobil uygulamadaki bütün "Çıkış" butonlarının ortak seçim penceresi (üye ve admin):
// "Bu cihazda beni hatırla" (oturum kapanır, cihaz hatırlanır → açılışta Tekrar hoş geldin + Face ID / parmak izi + Cihaz Doğrulandı),
// "Bu cihazda beni unut" (oturum kapanır, hatırlama bilgisi silinir), "Vazgeç". HIG: iptal seçeneği, en az 44 pt dokunma alanı.
// Admin hesabında (remember=false) yalnız "Bu cihazda beni unut" ve "Vazgeç"; hatırlama bilgisi hiçbir koşulda kaydedilmez.
import React from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { forgetDevice, rememberDevice } from '@/lib/session';
import { BtnGhost, BtnPrimary, Sheet, T } from './ui';

export function LogoutChoice({ visible, onClose, firstName = '', onLoggedOut, remember: allowRemember = true }: { visible: boolean; onClose: () => void; firstName?: string; onLoggedOut: () => void; remember?: boolean }) {
  async function remember() { if (!allowRemember) return; onClose(); await rememberDevice(firstName); onLoggedOut(); }
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
