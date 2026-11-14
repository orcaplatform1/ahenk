import { API_PREFIX } from './config';

// Mekân fotoğraflarının (göreli /api/v1/media/... adresleri) tam adresi. Mekân girişi ve mekân paneli mobil uygulamada yoktur.
export function mediaUrl(path: string): string {
  return path.startsWith('/') ? `${API_PREFIX.replace(/\/api\/v1$/, '')}${path}` : path;
}
