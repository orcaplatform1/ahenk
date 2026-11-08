import * as SecureStore from 'expo-secure-store';

// Üye oturumu: erişim ve yenileme token'ları expo-secure-store'da (S-20)
const ACCESS = 'ahenk_access';
const REFRESH = 'ahenk_refresh';
// Oturum türü (üye / mekân). Mekân token'ları ayrı anahtarlarda (çerez kullanılmaz)
const KIND = 'ahenk_kind';
const V_ACCESS = 'ahenk_venue_access';
const V_REFRESH = 'ahenk_venue_refresh';

export type SessionKind = 'member' | 'venue';

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
export async function getKind(): Promise<SessionKind | null> {
  return (await SecureStore.getItemAsync(KIND)) as SessionKind | null;
}
export async function setVenueTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(V_ACCESS, access);
  await SecureStore.setItemAsync(V_REFRESH, refresh);
  await SecureStore.setItemAsync(KIND, 'venue');
}
export async function getVenueAccess() { return SecureStore.getItemAsync(V_ACCESS); }
export async function getVenueRefresh() { return SecureStore.getItemAsync(V_REFRESH); }
export async function clearVenueTokens() {
  await SecureStore.deleteItemAsync(V_ACCESS);
  await SecureStore.deleteItemAsync(V_REFRESH);
  await SecureStore.deleteItemAsync(KIND);
}
