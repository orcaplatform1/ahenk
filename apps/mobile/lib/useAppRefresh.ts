import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Web'deki visibilitychange / focus / online tetiklerinin karşılığı: uygulama ön plana gelince ve internet dönünce
export function useAppRefresh(fn: () => void) {
  useEffect(() => {
    const a = AppState.addEventListener('change', (s) => { if (s === 'active') fn(); });
    let wasOff = false;
    const n = NetInfo.addEventListener((st) => {
      if (st.isConnected === false) wasOff = true;
      else if (st.isConnected && wasOff) { wasOff = false; fn(); }
    });
    return () => { a.remove(); n(); };
  }, [fn]);
}

export function isForeground() {
  return AppState.currentState === 'active';
}
