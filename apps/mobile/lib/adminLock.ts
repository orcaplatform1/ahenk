// ADMIN / SUPERADMIN kalıcı oturumunda biyometrik kilit: uygulama sıfırdan açıldığında ve arka planda 5 dakikadan uzun kaldıktan
// sonra öne gelince Face ID / Touch ID / parmak izi / yüz tanıma (biyometrik yoksa cihaz şifresi) istenir. Başarısızlıkta oturum
// kapanmaz, kilit ekranında "Tekrar Dene" görünür (components/AdminLockOverlay.tsx). Normal üyeler etkilenmez.
// Cihazda ne biyometrik ne ekran kilidi (şifre / desen / PIN) varsa ADMIN / SUPERADMIN için kalıcı oturum ve "Bu cihazda beni hatırla"
// kapalıdır: her uygulama açılışında oturum kapatılıp normal giriş ekranına gidilir; kilit ekranı hiçbir cihazda açılamaz hâlde kalmaz.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getAccess } from './session';
import { myRole } from './adminRole';

const ADMIN_LOCK_AFTER_MS = 5 * 60 * 1000;

let locked = false;
let verifiedAt = 0;
let backgroundAt: number | null = null;
const listeners = new Set<(v: boolean) => void>();

function set(v: boolean) { locked = v; listeners.forEach((l) => l(v)); }
export function isAdminLocked() { return locked; }
export function onAdminLock(l: (v: boolean) => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const isAdminRole = (role?: string | null) => role === 'ADMIN' || role === 'SUPERADMIN';

type LocalAuth = typeof import('expo-local-authentication');
export function loadLocalAuth(): LocalAuth | null {
  try { return require('expo-local-authentication') as LocalAuth; } catch { return null; }
}
// Cihazda biyometrik ya da ekran kilidi var mı (yoksa ya da modül bu derlemede yoksa false)
async function deviceSecure(): Promise<boolean> {
  const la = loadLocalAuth();
  if (!la) return false;
  try { return (await la.getEnrolledLevelAsync()) !== la.SecurityLevel.NONE; } catch { return false; }
}
// "Bu cihazda beni hatırla" gösterilsin mi: üyede her zaman; ADMIN / SUPERADMIN'de yalnız cihaz güvenliyse
export function useRememberAllowed(role?: string | null): boolean {
  const admin = isAdminRole(role);
  const [ok, setOk] = useState(!admin);
  useEffect(() => {
    if (!admin) { setOk(true); return; }
    let alive = true;
    deviceSecure().then((v) => { if (alive) setOk(v); });
    return () => { alive = false; };
  }, [admin]);
  return ok;
}

// Doğrulama başarılı (kilit ekranı ya da "Tekrar hoş geldin" biyometrisi): kilit kalkar
export function markAdminVerified() { verifiedAt = Date.now(); set(false); }
// Açılışta admin oturumu bulunca (app/index.tsx): cihaz güvenli değilse 'login' (çağıran oturumu kapatıp giriş ekranına gider);
// güvenliyse ve az önce doğrulanmadıysa kilitlenir
export async function lockAdminAtLaunch(): Promise<'login' | 'ok'> {
  if (!(await deviceSecure())) return 'login';
  if (Date.now() - verifiedAt > ADMIN_LOCK_AFTER_MS) set(true);
  return 'ok';
}
// Kilitliyken cihaz güvenliği kalktıysa (ekran kilidi kaldırıldı): kilit kalkar, oturum giriş ekranına döner (AdminLockOverlay)
export function unlockForLogin() { set(false); }

AppState.addEventListener('change', async (state) => {
  if (state === 'background') { backgroundAt = Date.now(); return; }
  if (state !== 'active' || backgroundAt === null) return;
  const away = Date.now() - backgroundAt;
  backgroundAt = null;
  if (away <= ADMIN_LOCK_AFTER_MS || !isAdminRole(myRole())) return;
  // Güvenli olmayan cihazda kilit kurulmaz (açılamaz kilit olmaz); oturum zaten açılışta kalıcı değildir
  if ((await getAccess()) && (await deviceSecure())) set(true);
});
