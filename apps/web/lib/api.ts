const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const PREFIX = `${BASE}/api/v1`;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function setToken(token: string) {
  localStorage.setItem('token', token);
  document.cookie = 'auth=1; path=/; max-age=86400; samesite=lax';
}

function clearToken() {
  localStorage.removeItem('token');
  document.cookie = 'auth=; path=/; max-age=0';
}

async function refreshToken(): Promise<string | null> {
  const res = await fetch(`${PREFIX}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    clearToken();
    return null;
  }
  const data = await res.json() as { accessToken: string };
  setToken(data.accessToken);
  return data.accessToken;
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
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  silentGet: <T>(path: string) => silentFetch<T>(path),
  setToken,
  clearToken,
  getToken,
};
