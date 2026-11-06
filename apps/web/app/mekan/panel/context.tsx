'use client';

import { createContext, useContext } from 'react';
import type { VenueMe } from '@/lib/venueApi';

export const VenuePanelContext = createContext<{ me: VenueMe; setMe: (m: VenueMe) => void; onAuthLost: () => void } | null>(null);

export function useVenuePanel() {
  const ctx = useContext(VenuePanelContext);
  if (!ctx) throw new Error('Mekân paneli dışında kullanıldı');
  return ctx;
}

export const panelCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.25rem',
};
