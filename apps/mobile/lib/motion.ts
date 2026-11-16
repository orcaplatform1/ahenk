import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useIsFocused } from 'expo-router';

// S-29: animasyonlar iOS "Hareketi Azalt" ayarına bağlı (web prefers-reduced-motion karşılığı)
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

// Sürekli animasyonlar yalnız ekran odaktayken ve uygulama ön plandayken çalışır (odak dışı / arka planda tamamen durur).
// AppState yalnız geçişlerde (active ↔ background) state değiştirir; her karede güncelleme yok.
export function useAnimActive() {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);
  return focused && appActive;
}
