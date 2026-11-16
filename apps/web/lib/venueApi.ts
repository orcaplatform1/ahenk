import { documentLang, messagesEn, messagesTr } from '@ahenk/shared';
import { API_PREFIX } from './api';
import { withResendSeconds } from './otpResend';

const BASE = `${API_PREFIX}/venue-panel`;

// Sunucudaki göreli fotoğraf adresini tam adrese çevirir
export function mediaUrl(path: string): string {
  return path.startsWith('/') ? `${API_PREFIX.replace(/\/api\/v1$/, '')}${path}` : path;
}

export class VenueAuthError extends Error {}

// Mekân paneli metinleri seçili dilde (Türkçe + İngilizce)
const vp = () => (documentLang() === 'en' ? messagesEn : messagesTr).vp;

export async function readError(res: Response): Promise<string> {
  if (res.status === 429) return vp().errTooMany;
  if (res.status === 413) return vp().errPhotoSize;
  const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
  return message ?? vp().errGeneric;
}

// Mekân paneli istekleri üye oturumundan bağımsızdır (ayrı çerez, token yenileme yok)
async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'include',
    headers: init.body && !isForm ? { 'Content-Type': 'application/json', 'Accept-Language': documentLang() } : { 'Accept-Language': documentLang() },
    body: isForm ? (init.body as FormData) : init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401 && path !== '/login') throw new VenueAuthError(vp().sessionRequired);
  if (!res.ok) {
    const body = await res.clone().json().catch(() => null);
    throw withResendSeconds(new Error(await readError(res)), body);
  }
  return res.json() as Promise<T>;
}

export const venueApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body: unknown) => request<T>(path, { method: 'DELETE', body }),
};

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
