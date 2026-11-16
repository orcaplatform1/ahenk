// Bir kerelik izin bilgilendirme ekranı (iOS + Android): giriş yaptıktan sonraki ilk açılışta (bu sürümü yükleyen mevcut kullanıcılar
// dahil) alttan açılan yarım pencere (en fazla ekranın %60'ı, arkada rgba(0,0,0,0.6) karartma) olarak gösterilir; gösterildiği bilgisi cihazda (AsyncStorage) saklanır, bir daha gösterilmez.
// "Devam Et" yalnız bildirim iznini sistem penceresiyle ister; bildirim izni daha önce verilmiş ya da reddedilmişse istek atlanır.
// Kamera, galeri ve konum izinleri burada istenmez (ilgili özellik kullanılırken istenir).
// Yönetim paneli kilidi açıkken (lib/adminLock) beklenir. HIG: güvenli alan, en az 44 pt buton. Yalnız "Devam Et" kapatır (karartma, kaydırma, Android geri tuşu kapatmaz).
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { isAdminLocked, onAdminLock } from '@/lib/adminLock';
import { BtnPrimary, Serif, T } from './ui';
import { ll } from '@/theme/theme';
import { useTranslation } from 'react-i18next';

const KEY = 'ahenk_permission_intro_v1';
// Aynı anda iki yerleşim (Yönetim Paneli + sekmeler) bağlıysa ekranı yalnız ilk sahiplenen gösterir
let claimed = false;
// Tanıtım ekranı süreci bitti mi: gösterilmeyecekse (daha önce gösterilmiş) hemen, gösterilecekse kapanınca çözülür.
// 100 TL indirim penceresinin otomatik açılışı bunu bekler (components/Winback.tsx WinbackHost).
let resolveDone: () => void = () => {};
const done = new Promise<void>((r) => { resolveDone = r; });
export function permissionIntroDone(): Promise<void> { return done; }

const ITEMS: { title: string; body: string }[] = [
  { title: 'permIntro.notifT', body: 'permIntro.notifB' },
  { title: 'permIntro.camT', body: 'permIntro.camB' },
  { title: 'permIntro.locT', body: 'permIntro.locB' },
];

export function PermissionIntro() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(isAdminLocked());
  const [busy, setBusy] = useState(false);

  useEffect(() => onAdminLock(setLocked), []);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === '1') { resolveDone(); return; }
      if (alive && !claimed) { claimed = true; setPending(true); }
    }).catch(() => { resolveDone(); });
    return () => { alive = false; };
  }, []);

  async function proceed() {
    if (busy) return;
    setBusy(true);
    try { await AsyncStorage.setItem(KEY, '1'); } catch { /* yalnız bu oturumda kapanır */ }
    try {
      const cur = await Notifications.getPermissionsAsync();
      // Yalnız hiç sorulmamışsa sistem penceresi; verilmiş ya da reddedilmişse istek atlanır
      if (cur.status === 'undetermined') await Notifications.requestPermissionsAsync();
    } catch { /* izin isteği başarısız: ekran yine kapanır */ }
    setPending(false);
    setBusy(false);
    resolveDone();
  }

  return (
    <Modal visible={pending && !locked} transparent animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: height * 0.6, backgroundColor: ll.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 20, paddingBottom: 16 }}>
            <Serif style={{ fontSize: 24, lineHeight: 28.8, color: ll.text }}>{t('permIntro.title')}</Serif>
            {ITEMS.map((it) => (
              <View key={it.title} style={{ gap: 6 }}>
                <T w={600} style={{ fontSize: 15, color: ll.text }}>{t(it.title)}</T>
                <T style={{ fontSize: 14, lineHeight: 21, color: ll.text2 }}>{t(it.body)}</T>
              </View>
            ))}
          </ScrollView>
          <BtnPrimary label={t('common.continue')} full disabled={busy} style={{ minHeight: 44 }} onPress={proceed} />
        </View>
      </View>
    </Modal>
  );
}
