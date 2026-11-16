// Ortak izin denetimi (kamera, galeri, konum, bildirim, rehber): izin gerektiği anda önce mevcut durum okunur.
// Kalıcı olarak reddedilmişse (canAskAgain false — sistem penceresi artık gösterilemez) iznin neden gerektiğini anlatan kısa uyarı ve
// cihaz ayarlarını açan "Ayarlara Git" butonu gösterilir. İzin hiç sorulmamışsa sistem penceresi açılır.
import { Linking } from 'react-native';
import { showAlert } from '@/components/AppAlert';
import i18n from './i18n';

interface PermResult { granted: boolean; canAskAgain: boolean }

export function showSettingsAlert(reason: string) {
  showAlert(i18n.t('perm.required'), reason, [
    { text: i18n.t('masa.dismiss'), style: 'cancel' },
    { text: i18n.t('perm.goSettings'), onPress: () => { Linking.openSettings().catch(() => {}); } },
  ]);
}

// true: izin var (ya da şimdi verildi); 'blocked': kalıcı reddedilmiş, Ayarlara Git uyarısı gösterildi; false: şimdi reddedildi
export async function ensurePermission(
  get: () => Promise<PermResult>,
  request: () => Promise<PermResult>,
  reason: string,
): Promise<true | false | 'blocked'> {
  const cur = await get();
  if (cur.granted) return true;
  if (!cur.canAskAgain) { showSettingsAlert(reason); return 'blocked'; }
  const r = await request();
  return r.granted ? true : false;
}

// Kalıcı reddedilmiş mi (yalnız okuma; reddedilmişse Ayarlara Git uyarısı gösterilir)
export async function blockedWithAlert(get: () => Promise<PermResult>, reason: string): Promise<boolean> {
  const cur = await get();
  if (!cur.granted && !cur.canAskAgain) { showSettingsAlert(reason); return true; }
  return false;
}

// Metinler arayüz dilinde (okunduğu anda çevrilir)
export const PERM_REASON = {
  get library() { return i18n.t('perm.library'); },
  get camera() { return i18n.t('perm.camera'); },
  get kycCamera() { return i18n.t('perm.kycCamera'); },
  get location() { return i18n.t('perm.location'); },
  get locationAlways() { return i18n.t('perm.locationAlways'); },
  get notifications() { return i18n.t('perm.notifications'); },
  get contacts() { return i18n.t('perm.contacts'); },
};
