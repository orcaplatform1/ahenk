import * as SecureStore from 'expo-secure-store';

// Üye oturumu: erişim ve yenileme token'ları expo-secure-store'da (S-20)
const ACCESS = 'ahenk_access';
const REFRESH = 'ahenk_refresh';
// Oturum türü (yalnız üye; mekân girişi mobil uygulamada yok)
const KIND = 'ahenk_kind';

// "Bu cihazda beni hatırla": çıkışta yenileme token'ı ve kullanıcının adı bu anahtarlarda saklanır (Face ID / parmak izi ile geri açılır)
const REMEMBER_REFRESH = 'ahenk_remember_refresh';
const REMEMBER_NAME = 'ahenk_remember_name';

let accessCache: string | null | undefined;

export async function getAccess(): Promise<string | null> {
  if (accessCache !== undefined) return accessCache;
  accessCache = await SecureStore.getItemAsync(ACCESS);
  return accessCache;
}
export async function getRefresh(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH);
}
export async function setTokens(access: string, refresh: string) {
  accessCache = access;
  await SecureStore.setItemAsync(ACCESS, access);
  await SecureStore.setItemAsync(REFRESH, refresh);
  await SecureStore.setItemAsync(KIND, 'member');
}
export async function clearTokens() {
  accessCache = null;
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
  await SecureStore.deleteItemAsync(KIND);
}
// Çıkış "Bu cihazda beni hatırla": oturum kapanır (erişim token'ı ve aktif oturum silinir), yenileme token'ı cihazda hatırlanır
// Sonuç: true → cihaz hatırlandı (Tekrar hoş geldin ekranına gidilir), false → saklanacak token yoktu
export async function rememberDevice(firstName: string): Promise<boolean> {
  const refresh = await getRefresh();
  await clearTokens();
  if (!refresh) return false;
  await SecureStore.setItemAsync(REMEMBER_REFRESH, refresh);
  await SecureStore.setItemAsync(REMEMBER_NAME, firstName);
  return true;
}
export async function getRemembered(): Promise<{ refresh: string; firstName: string } | null> {
  const refresh = await SecureStore.getItemAsync(REMEMBER_REFRESH);
  if (!refresh) return null;
  return { refresh, firstName: (await SecureStore.getItemAsync(REMEMBER_NAME)) ?? '' };
}
// Hatırlanan yenileme token'ını aktif oturuma geri koyar (Face ID / parmak izi doğrulamasından sonra)
export async function restoreRemembered(): Promise<boolean> {
  const refresh = await SecureStore.getItemAsync(REMEMBER_REFRESH);
  if (!refresh) return false;
  await SecureStore.setItemAsync(REFRESH, refresh);
  await SecureStore.setItemAsync(KIND, 'member');
  return true;
}
// "Bu cihazda beni unut" ve yeni girişte: cihazdaki hatırlama bilgisi silinir
export async function forgetDevice() {
  await SecureStore.deleteItemAsync(REMEMBER_REFRESH);
  await SecureStore.deleteItemAsync(REMEMBER_NAME);
}
