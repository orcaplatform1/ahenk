// Acil yardım: yalnız talep edenin canlı konumu (web components/SosOpenReport.tsx karşılığı).
// Web: watchPosition (yüksek doğruluk, maximumAge 10 sn) her konum güncellemesinde POST /sos/reports/:reportId/location;
// açık talep 30 sn'de bir /sos/my-open-report ile denetlenir; backend { active: false } dönünce veya talep kapanınca gönderim durur.
// Mobil: konum güncellemesi Kullanırken izniyle ön planda başlatılır (expo-location startLocationUpdatesAsync). Uygulama arka plana
// alınınca iOS'ta mavi konum göstergesiyle (showsBackgroundLocationIndicator, UIBackgroundModes location), Android'de ön plan hizmetiyle sürer.
// SOS talebi gönderildikten sonra "Her zaman" izni istenir (yalnız SOS formunda); reddedilirse gönderim Kullanırken yöntemiyle sürer.
// Android: killServiceOnDestroy false — uygulama kaydırılarak kapatılınca ön plan hizmeti ve gönderim durmaz.
// Android yeniden başlatma: RECEIVE_BOOT_COMPLETED ile expo-task-manager (TaskBroadcastReceiver) açılışta kayıtlı konum görevini geri yükler;
// görev yalnız açık talep varken kayıtlıdır (talep kapanınca stopSosLive kaydı siler). "Her zaman" izni olmadan sistem arka planda
// konum vermez. Gönderim kullanıcı uygulamayı açmadan sürer; sunucu talebin kapandığını bildirirse ya da yerel talep kaydı yoksa durur.
// iOS: expo-location görevi önemli konum değişikliği izlemesini (startMonitoringSignificantLocationChanges) her zaman başlatır;
// "Her zaman" izni varsa iOS zorla kapatılan uygulamayı konum değişince yeniden başlatır, görev (app/_layout.tsx kaydı) gönderime devam eder.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

import i18n from './i18n';
export const SOS_LIVE_TASK = 'ahenk-sos-live';
const KEY = 'ahenk_sos_report';
export const SOS_POLL_MS = 30_000;

// Konum kesintisi bitti (sunucu konum gönderiminde resumed: true döndü): uygulama "Konumun yeniden alınıyor" uyarısını gösterir
const resumedListeners = new Set<() => void>();
export function onSosLocationResumed(cb: () => void): () => void {
  resumedListeners.add(cb);
  return () => { resumedListeners.delete(cb); };
}
function emitResumed() { resumedListeners.forEach((cb) => cb()); }

// Açık talep sırasında konum servisi (ya da konum izni) kapandı mı: uygulama açıkken ~10 sn'de bir denetlenir. Kapandığı an sunucuya
// bildirilir, sunucu talep edene bir kez push gönderir (kesinti başına bir kez). Uygulama kapalıyken sunucu 120 sn konum gelmezse aynı
// bildirimi kendisi gönderir. Konum yeniden gelince kesinti biter; tekrar kapanırsa yeni kesinti sayılır.
export const SOS_LOCATION_CHECK_MS = 10_000;
let offReported = false;
export async function checkSosLocation(): Promise<void> {
  const reportId = await AsyncStorage.getItem(KEY);
  if (!reportId) { offReported = false; return; }
  const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
  const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
  const off = !enabled || (!!perm && perm.status !== 'granted');
  if (!off) { offReported = false; return; }
  if (offReported) return;
  offReported = true;
  await api.post(`/sos/reports/${reportId}/location-off`).catch(() => { offReported = false; });
}

TaskManager.defineTask(SOS_LIVE_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const last = locs?.[locs.length - 1];
  const reportId = await AsyncStorage.getItem(KEY);
  // Açık talep yoksa (ör. cihaz kapalıyken talep çözüldü, açılışta görev geri yüklendi) gönderim hiçbir şey yapmadan durur
  if (!reportId) { await stopSosLive(); return; }
  if (!last) return;
  try {
    const r = await api.post<{ active?: boolean; resumed?: boolean }>(`/sos/reports/${reportId}/location`, {
      lat: last.coords.latitude, lng: last.coords.longitude, accuracy: last.coords.accuracy ?? undefined,
    });
    if (r?.active === false) await stopSosLive();
    else if (r?.resumed) emitResumed();
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
    foregroundService: { notificationTitle: 'Ahenk', notificationBody: i18n.t('sos.liveNotice'), killServiceOnDestroy: false },
  }).catch(() => {});
}

// Talep backend'e gönderildikten sonra çağrılır: "Her zaman" izni (yalnız Kullanırken izni verilmişse). Red talebi etkilemez.
export async function requestSosAlwaysPermission() {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return;
  await Location.requestBackgroundPermissionsAsync().catch(() => undefined);
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
