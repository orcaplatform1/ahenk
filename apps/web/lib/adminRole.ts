import { api } from '@/lib/api';

// Oturumdaki kullanıcının rolü (JWT içinden)
export function myRole(): string | null {
  const token = api.getToken();
  if (!token) return null;
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(b64)) as { role?: string }).role ?? null;
  } catch { return null; }
}
