import { API_PREFIX } from './config';
import { clearVenueTokens, getVenueAccess, getVenueRefresh, setVenueTokens } from './session';

// Web lib/venueApi.ts'nin mobil karşılığı. Çerez kullanılmaz: mekân oturumu Authorization: Bearer ile taşınır,
// token'lar expo-secure-store'da. Giriş uçları Origin'siz istekte gövdede { accessToken, refreshToken } döner.
// Kalıcı oturum: 401'de ve uygulama açılışında POST /venue-panel/refresh (365 gün kayan süre).
const BASE = `${API_PREFIX}/venue-panel`;

export function mediaUrl(path: string): string {
  return path.startsWith('/') ? `${API_PREFIX.replace(/\/api\/v1$/, '')}${path}` : path;
}

export class VenueAuthError extends Error {}

export async function readError(res: Response): Promise<string> {
  if (res.status === 429) return 'Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin.';
  if (res.status === 413) return 'Fotoğraf en fazla 5 MB olabilir.';
  const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
  return message ?? 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

type RefreshResult = 'ok' | 'expired' | 'offline';
let refreshing: Promise<RefreshResult> | null = null;
export function refreshVenueSession(): Promise<RefreshResult> {
  if (refreshing) return refreshing;
  refreshing = (async (): Promise<RefreshResult> => {
    try {
      const refreshToken = await getVenueRefresh();
      if (!refreshToken) return 'expired';
      const res = await fetch(`${BASE}/refresh`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
      if (res.status === 401 || res.status === 403) { await clearVenueTokens(); return 'expired'; }
      if (!res.ok) return 'offline';
      const d = await res.json() as { accessToken?: string; refreshToken?: string };
      if (!d.accessToken || !d.refreshToken) return 'offline';
      await setVenueTokens(d.accessToken, d.refreshToken);
      return 'ok';
    } catch { return 'offline'; }
  })();
  return refreshing.finally(() => { refreshing = null; });
}

const PUBLIC = ['/login', '/verify-login-otp', '/send-login-otp', '/forgot-password', '/reset-password'];

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const isForm = init.body instanceof FormData;
  const token = PUBLIC.includes(path) ? null : await getVenueAccess();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'omit',
    headers,
    body: isForm ? (init.body as FormData) : init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401 && !PUBLIC.includes(path)) {
    if (retry && token) {
      const r = await refreshVenueSession();
      if (r === 'ok') return request<T>(path, init, false);
      if (r === 'offline') throw new Error('Bağlantı hatası, tekrar dene.');
    }
    throw new VenueAuthError('Oturum gerekli');
  }
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json() as T & { accessToken?: string; refreshToken?: string };
  // Giriş ve şifre değişiminde yeni token'lar gelir
  if (data && typeof data === 'object' && data.accessToken && data.refreshToken) await setVenueTokens(data.accessToken, data.refreshToken);
  return data;
}

export const venueApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body: unknown) => request<T>(path, { method: 'DELETE', body }),
};

// Çıkış: backend yalnız bu cihazın yenileme token'ının oturumunu kapatır (diğer cihazlar açık kalır)
export async function logoutVenueDevice() {
  const refreshToken = await getVenueRefresh();
  await request('/logout', { method: 'POST', body: refreshToken ? { refreshToken } : {} }, false).catch(() => undefined);
}

export interface VenueMe {
  email: string;
  phone: string;
  registeredAt: string;
  venue: {
    name: string;
    city: string;
    description: string | null;
    address: string | null;
    district: string | null;
    locationUrl: string | null;
    websiteOrSocial: string | null;
    venueType: 'ALCOHOLIC' | 'NON_ALCOHOLIC';
    venueKind: string | null;
    photos: string[];
  };
}
