const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co';
const PREFIX = `${BASE}/api/v1`;

// Oturum token'ları HttpOnly çerezlerde (JS okuyamaz). JS sadece gizli değer taşımayan
// "ahenk_session" işaretine bakar; istekler credentials: 'include' ile çerezi taşır.
const SESSION_COOKIE = 'ahenk_session';
const LEGACY_TOKEN_COOKIE = 'ahenk_token'; // eski sürümden kalan, JS okunabilir token çerezi

function hasSession(): boolean {
  if (typeof window === 'undefined') return false;
  return new RegExp(`(?:^|;\\s*)(?:${SESSION_COOKIE}|${LEGACY_TOKEN_COOKIE})=`).test(document.cookie);
}

function clearLegacyToken() {
  if (typeof window === 'undefined') return;
  document.cookie = `${LEGACY_TOKEN_COOKIE}=; path=/; max-age=0`;
}

// Yerel çıkış: işaret + eski token çerezi silinir (HttpOnly çerezleri backend siler)
function clearSession() {
  if (typeof window !== 'undefined') {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
    clearLegacyToken();
  }
  clearMeCache();
}

// Giriş/kayıt sonrası: backend çerezleri yazdı; önbellek ve eski token temizlenir
function onLogin() {
  clearLegacyToken();
  clearMeCache();
}

// Sunucuda refresh token iptal edilir ve çerezler silinir; istek başarısız olsa da yerel çıkış yapılır
async function logout(): Promise<void> {
  try {
    await fetch(`${PREFIX}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch { /* yerel çıkış yine yapılır */ }
  clearSession();
}

let _refreshPromise: Promise<boolean> | null = null;

let _meCache: { data: unknown; ts: number } | null = null;
let _meFlight: Promise<unknown> | null = null;
let _meGen = 0;

function getMeCached<T>(path: string): Promise<T> {
  const now = Date.now();
  if (_meCache && hasSession() && now - _meCache.ts < 30000) {
    return Promise.resolve(_meCache.data as T);
  }
  if (_meFlight) return _meFlight as Promise<T>;
  const capturedGen = _meGen;
  _meFlight = apiFetch<T>(path).then(data => {
    if (_meGen === capturedGen) {
      _meCache = { data, ts: Date.now() };
      _meFlight = null;
    }
    return data;
  }).catch(err => {
    if (_meGen === capturedGen) _meFlight = null;
    throw err;
  });
  return _meFlight as Promise<T>;
}

function clearMeCache() {
  _meCache = null;
  _meFlight = null;
  _meGen++;
}

// Yeni erişim çerezi alır; başarılıysa true
async function refreshSession(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${PREFIX}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) { clearSession(); return false; }
      clearLegacyToken();
      return true;
    } catch {
      clearSession();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

type FetchOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${PREFIX}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      if (typeof window !== 'undefined') window.location.href = '/giris';
      throw new Error('Oturum süresi doldu');
    }
    const retry = await fetch(`${PREFIX}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (!retry.ok) {
      const err = await retry.json().catch(() => ({ message: 'Bir hata oluştu' }));
      throw new Error((err as { message?: string }).message ?? 'Bir hata oluştu');
    }
    return retry.json() as Promise<T>;
  }

  if (res.status === 429) {
    throw new Error('__rate_limit__');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Bir hata oluştu' }));
    throw new Error((err as { message?: string | string[] }).message instanceof Array
      ? ((err as { message: string[] }).message[0])
      : ((err as { message?: string }).message ?? 'Bir hata oluştu'));
  }

  return res.json() as Promise<T>;
}

async function silentFetch<T>(path: string): Promise<T | null> {
  if (!hasSession()) return null;
  try {
    const res = await fetch(`${PREFIX}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export const API_PREFIX = PREFIX;

export const api = {
  get: <T>(path: string) => path === '/auth/me' ? getMeCached<T>(path) : apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  silentGet: <T>(path: string) => silentFetch<T>(path),
  onLogin,
  clearSession,
  hasSession,
  logout,
  clearMeCache,
};
