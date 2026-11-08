// Salla-Bildir tercihi: varsayılan açık, cihazda (AsyncStorage) saklanır
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ahenk_shake_report';
const listeners = new Set<(v: boolean) => void>();

export async function getShakeEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== '0'; } catch { return true; }
}
export async function setShakeEnabled(v: boolean) {
  try { await AsyncStorage.setItem(KEY, v ? '1' : '0'); } catch { /* tercih yalnız bu oturumda kalır */ }
  listeners.forEach((l) => l(v));
}
export function onShakePref(fn: (v: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
