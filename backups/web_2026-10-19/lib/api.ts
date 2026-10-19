const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co';
const PREFIX = `${BASE}/api/v1`;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)ahenk_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setToken(token: string) {
  document.cookie = `ahenk_token=${encodeURIComponent(token)}; path=/; max-age=604800; samesite=lax`;
}

function clearToken() {
  document.cookie = 'ahenk_token=; path=/; max-age=0';
  clearMeCache();
}

let _refreshPromise: Promise<string | null> | null = null;

let _meCache: { data: unknown; ts: number; token: string } | null = null;
let _meFlight: Promise<unknown> | null = null;
let _meGen = 0;

function getMeCached<T>(path: string): Promise<T> {
  const now = Date.now();
  const token = getToken();
  if (_meCache && token && _meCache.token === token && now - _meCache.ts < 30000) {
    return Promise.resolve(_meCache.data as T);
  }
  if (_meFlight) return _meFlight as Promise<T>;
  const capturedToken = token ?? '';
  const capturedGen = _meGen;
  _meFlight = apiFetch<T>(path).then(data => {
    if (_meGen === capturedGen) {
      _meCache = { data, ts: Date.now(), token: capturedToken };
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

async function refreshToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${PREFIX}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) { clearToken(); return null; }
      const data = await res.json() as { accessToken: string };
      setToken(data.accessToken);
      return data.accessToken;
    } catch {
      clearToken();
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

type FetchOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${PREFIX}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    const newToken = await refreshToken();
    if (!newToken) {
      if (typeof window !== 'undefined') window.location.href = '/giris';
      throw new Error('Oturum süresi doldu');
    }
    headers['Authorization'] = `Bearer ${newToken}`;
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
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${PREFIX}${path}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  setToken: (token: string) => { clearMeCache(); setToken(token); },
  clearToken,
  getToken,
  clearMeCache,
};
