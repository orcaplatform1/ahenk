// S-27: SOS sırasında katılımcı konumu arka planda da gönderilir (expo-location + expo-task-manager).
// Web: 30 sn'de bir POST /sos/:meetingId/participant-location; backend { active:false } dönerse durur.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export const SOS_TASK = 'ahenk-sos-location';
const KEY = 'ahenk_sos_meeting';

TaskManager.defineTask(SOS_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const last = locs?.[locs.length - 1];
  const meetingId = await AsyncStorage.getItem(KEY);
  if (!last || !meetingId) return;
  try {
    const r = await api.post<{ active?: boolean }>(`/sos/${meetingId}/participant-location`, {
      lat: last.coords.latitude, lng: last.coords.longitude, accuracy: last.coords.accuracy ?? undefined,
    });
    if (r?.active === false) await stopSosTracking();
  } catch { /* sessiz */ }
});

// Konum izni ilk masa onaylandığında istenir (S-27)
export async function requestLocationOnFirstTable() {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status === 'undetermined') await Location.requestForegroundPermissionsAsync();
}

export async function startSosTracking(meetingId: string) {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return;
  await AsyncStorage.setItem(KEY, meetingId);
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') await Location.requestBackgroundPermissionsAsync();
  if (await Location.hasStartedLocationUpdatesAsync(SOS_TASK).catch(() => false)) return;
  await Location.startLocationUpdatesAsync(SOS_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 30_000,
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: 'Ahenk', notificationBody: 'Acil yardım için konumun paylaşılıyor.' },
  }).catch(() => {});
}

export async function stopSosTracking() {
  await AsyncStorage.removeItem(KEY);
  if (await Location.hasStartedLocationUpdatesAsync(SOS_TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(SOS_TASK).catch(() => {});
}
