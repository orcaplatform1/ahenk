// iOS ekran kaydı / yansıtma durumu (yerel Expo modülü, yalnız iOS). Android ve modülün olmadığı ortamda her zaman false.
import { Platform } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo';

type Native = {
  isCaptured(): boolean;
  addListener(event: 'onChange', listener: (e: { captured: boolean }) => void): EventSubscription;
};

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<Native>('ScreenRecording') : null;

export function isScreenCaptured(): boolean {
  try { return native?.isCaptured() ?? false; } catch { return false; }
}

export function addScreenCaptureListener(listener: (captured: boolean) => void): { remove: () => void } {
  if (!native) return { remove: () => undefined };
  const sub = native.addListener('onChange', (e) => listener(!!e.captured));
  return { remove: () => sub.remove() };
}
