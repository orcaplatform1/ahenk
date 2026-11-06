'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface WinbackPlan { plan: string; name: string; listTL: number; discountedTL: number; needsKanka: boolean }
export interface WinbackState {
  active: boolean;
  amountTL?: number;
  plans?: WinbackPlan[];
  kycApproved?: boolean;
  lapsed?: boolean;
  durationSeconds?: number;
  expiresAt?: string | null;
  serverNow?: string;
  autoOpen?: boolean;
}

const CHANGED = 'ahenk-winback-changed';

const pad = (n: number) => String(n).padStart(2, '0');
export const clockHMS = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
export const clockMS = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

// Geri kazanım indirimi durumu ve canlı sayaç. Sayaç sunucudaki bitiş anından, sunucu saatine göre hesaplanır.
export function useWinback() {
  const [state, setState] = useState<WinbackState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const skew = useRef(0);

  const apply = useCallback((s: WinbackState | null) => {
    if (s?.serverNow) skew.current = new Date(s.serverNow).getTime() - Date.now();
    setState(s);
  }, []);

  const load = useCallback(() => { api.get<WinbackState>('/payment/winback').then(apply).catch(() => {}); }, [apply]);

  useEffect(() => {
    load();
    window.addEventListener(CHANGED, load);
    return () => window.removeEventListener(CHANGED, load);
  }, [load]);

  const markShown = useCallback(async () => {
    const s = await api.post<WinbackState>('/payment/winback/open', {});
    apply(s);
    window.dispatchEvent(new Event(CHANGED));
  }, [apply]);

  const running = !!state?.active && !!state.expiresAt;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const remaining = running
    ? Math.max(0, Math.floor((new Date(state!.expiresAt!).getTime() - (now + skew.current)) / 1000))
    : state?.durationSeconds ?? 0;
  // Süre bitince rozet ve indirimli fiyatlar kaybolur
  const live = !!state?.active && (!running || remaining > 0);

  return { state, live, running, remaining, markShown };
}
