import { createContext, useContext } from 'react';
import type { VenueMe } from './venueApi';

// apps/web/app/mekan/panel/context.tsx karşılığı
export const VenuePanelContext = createContext<{ me: VenueMe; setMe: (m: VenueMe) => void; onAuthLost: () => void } | null>(null);
export function useVenuePanel() {
  const ctx = useContext(VenuePanelContext);
  if (!ctx) throw new Error('Mekân paneli dışında kullanıldı');
  return ctx;
}
export const panelCard = { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 20 } as const;
