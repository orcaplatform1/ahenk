import * as SecureStore from 'expo-secure-store';

// Üye oturumu: erişim ve yenileme token'ları expo-secure-store'da (S-20)
const ACCESS = 'ahenk_access';
const REFRESH = 'ahenk_refresh';
// Mekân oturumu çerezde tutulur; burada yalnız oturum türü işareti saklanır
const KIND = 'ahenk_kind';

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
export async function setVenueKind() {
  await SecureStore.setItemAsync(KIND, 'venue');
}
