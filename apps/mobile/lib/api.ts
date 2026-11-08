import { API_PREFIX } from './config';
import { clearTokens, getAccess, getRefresh, setTokens } from './session';

// Web lib/api.ts davranışının mobil karşılığı: aynı uçlar, aynı hata mesajları.
// Oturum: HttpOnly çerez yerine Bearer token (Origin'siz istemciye backend token'ı gövdede döndürür).
// Çerezler kullanılmaz (credentials: 'omit'); CSRF kontrolü Bearer isteklerinde uygulanmaz.

type Listener = () => void;
const authListeners = new Set<Listener>();
export function onAuthLost(fn: Listener) { authListeners.add(fn); return () => { authListeners.delete(fn); }; }

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const refreshToken = await getRefresh();
      if (!refreshToken) return false;
      const res = await fetch(`${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { await clearTokens(); return false; }
      const data = await res.json() as { accessToken?: string; refreshToken?: string };
      if (!data.accessToken || !data.refreshToken) { await clearTokens(); return false; }
      await setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  })();
  try { return await refreshing; } finally { refreshing = null; }
}

async function readMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
  const msg = Array.isArray(body?.message) ? body?.message[0] : body?.message;
  return msg ?? 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) { super(message); this.status = status; this.data = data; }
}

async function apiFetch<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}, retry = true): Promise<T> {
  const token = await getAccess();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined && !init.form) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'omit',
    headers,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
  if (res.status === 401 && retry && token) {
    if (await refreshSession()) return apiFetch<T>(path, init, false);
    authListeners.forEach((l) => l());
    throw new ApiError('Oturum süresi doldu', 401, null);
  }
  if (res.status === 429) throw new ApiError('__rate_limit__', 429, null);
  if (!res.ok) {
    const data = await res.clone().json().catch(() => null);
    throw new ApiError(await readMessage(res), res.status, data);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Giriş/kayıt yanıtı: { user, accessToken, refreshToken }
export async function storeLogin(data: { accessToken?: string; refreshToken?: string }) {
  if (data.accessToken && data.refreshToken) await setTokens(data.accessToken, data.refreshToken);
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown = {}) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown = {}) => apiFetch<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body: unknown = {}) => apiFetch<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  form: <T>(path: string, form: FormData) => apiFetch<T>(path, { method: 'POST', form }),
  hasSession: async () => !!(await getAccess()),
  async logout() {
    const refreshToken = await getRefresh();
    try {
      await fetch(`${API_PREFIX}/auth/logout`, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch { /* yerel çıkış yine yapılır */ }
    await clearTokens();
  },
};
