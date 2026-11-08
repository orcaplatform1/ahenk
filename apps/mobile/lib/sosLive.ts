// Acil yardım: yalnız talep edenin canlı konumu (web components/SosOpenReport.tsx karşılığı).
// Web: watchPosition (yüksek doğruluk, maximumAge 10 sn) her konum güncellemesinde POST /sos/reports/:reportId/location;
// açık talep 30 sn'de bir /sos/my-open-report ile denetlenir; backend { active: false } dönünce veya talep kapanınca gönderim durur.
// Mobil: konum güncellemesi Kullanırken izniyle ön planda başlatılır (expo-location startLocationUpdatesAsync). Uygulama arka plana
// alınınca iOS'ta mavi konum göstergesiyle (showsBackgroundLocationIndicator, UIBackgroundModes location), Android'de ön plan hizmetiyle sürer.
// "Her zaman" / arka plan izni istenmez (expo-location iOS'ta yalnız ön plan iznini, Android'de ön plan hizmetiyle yalnız ön plan iznini denetler).
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export const SOS_LIVE_TASK = 'ahenk-sos-live';
const KEY = 'ahenk_sos_report';
export const SOS_POLL_MS = 30_000;

TaskManager.defineTask(SOS_LIVE_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const last = locs?.[locs.length - 1];
  const reportId = await AsyncStorage.getItem(KEY);
  if (!last || !reportId) return;
  try {
    const r = await api.post<{ active?: boolean }>(`/sos/reports/${reportId}/location`, {
      lat: last.coords.latitude, lng: last.coords.longitude, accuracy: last.coords.accuracy ?? undefined,
    });
    if (r?.active === false) await stopSosLive();
  } catch { /* sessiz */ }
});

// Talep oluşturulunca ya da açık talep bulununca çağrılır. İzin burada istenmez (izin yalnız SOS formunda "İhbarda Bulun"da istenir).
export async function startSosLive(reportId: string) {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return;
  await AsyncStorage.setItem(KEY, reportId);
  if (await Location.hasStartedLocationUpdatesAsync(SOS_LIVE_TASK).catch(() => false)) return;
  await Location.startLocationUpdatesAsync(SOS_LIVE_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10_000, // web maximumAge 10 sn
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: { notificationTitle: 'Ahenk', notificationBody: 'Acil yardım: konumun emniyet birimleriyle paylaşılıyor, ekibimiz takip ediyor.' },
  }).catch(() => {});
}

export async function stopSosLive() {
  await AsyncStorage.removeItem(KEY);
  if (await Location.hasStartedLocationUpdatesAsync(SOS_LIVE_TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(SOS_LIVE_TASK).catch(() => {});
}

// Açık talebi denetler (web SosOpenReport: sayfa açılışında ve açık talep varken 30 sn'de bir); kapanınca gönderimi durdurur
export async function syncSosLive(): Promise<string | null> {
  try {
    const r = await api.get<{ reportId: string | null }>('/sos/my-open-report');
    if (r?.reportId) { await startSosLive(r.reportId); return r.reportId; }
    await stopSosLive();
    return null;
  } catch { return null; }
}
