// Ortak izin denetimi (kamera, galeri, konum, bildirim, rehber): izin gerektiği anda önce mevcut durum okunur.
// Kalıcı olarak reddedilmişse (canAskAgain false — sistem penceresi artık gösterilemez) iznin neden gerektiğini anlatan kısa uyarı ve
// cihaz ayarlarını açan "Ayarlara Git" butonu gösterilir. İzin hiç sorulmamışsa sistem penceresi açılır.
import { Linking } from 'react-native';
import { showAlert } from '@/components/AppAlert';

interface PermResult { granted: boolean; canAskAgain: boolean }

export function showSettingsAlert(reason: string) {
  showAlert('İzin gerekli', reason, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Ayarlara Git', onPress: () => { Linking.openSettings().catch(() => {}); } },
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

export const PERM_REASON = {
  library: 'Fotoğraf seçip yükleyebilmek için galeri erişimine izin vermen gerekiyor.',
  camera: 'Fotoğraf çekebilmek için kamera erişimine izin vermen gerekiyor.',
  kycCamera: 'Kimlik doğrulaması için kamera ve mikrofon erişimine izin vermen gerekiyor.',
  location: 'Acil Yardım talebinde konumunun iletilebilmesi için konum erişimine izin vermen gerekiyor.',
  locationAlways: 'Acil Yardım talebin sürerken uygulama kapalıyken de konumunun iletilebilmesi için konum iznini "Her zaman" yapman gerekiyor.',
  notifications: 'Masa onayı ve buluşma hatırlatmalarını alabilmek için bildirim iznine ihtiyaç var.',
  contacts: 'Rehberindeki numaraları engelleme listesine ekleyebilmek için kişiler erişimine izin vermen gerekiyor.',
} as const;
