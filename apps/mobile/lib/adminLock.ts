// ADMIN / SUPERADMIN kalıcı oturumunda biyometrik kilit: uygulama sıfırdan açıldığında ve arka planda 5 dakikadan uzun kaldıktan
// sonra öne gelince Face ID / Touch ID / parmak izi / yüz tanıma (biyometrik yoksa cihaz şifresi) istenir. Başarısızlıkta oturum
// kapanmaz, kilit ekranında "Tekrar Dene" görünür (components/AdminLockOverlay.tsx). Normal üyeler etkilenmez.
import { AppState } from 'react-native';
import { getAccess } from './session';
import { myRole } from './adminRole';

export const ADMIN_LOCK_AFTER_MS = 5 * 60 * 1000;

let locked = false;
let verifiedAt = 0;
let backgroundAt: number | null = null;
const listeners = new Set<(v: boolean) => void>();

function set(v: boolean) { locked = v; listeners.forEach((l) => l(v)); }
export function isAdminLocked() { return locked; }
export function onAdminLock(l: (v: boolean) => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const isAdminRole = (role?: string | null) => role === 'ADMIN' || role === 'SUPERADMIN';

// Doğrulama başarılı (kilit ekranı ya da "Tekrar hoş geldin" biyometrisi): kilit kalkar
export function markAdminVerified() { verifiedAt = Date.now(); set(false); }
// Açılışta admin oturumu bulunca (app/index.tsx): az önce doğrulanmadıysa kilitlenir
export function lockAdminAtLaunch() { if (Date.now() - verifiedAt > ADMIN_LOCK_AFTER_MS) set(true); }

AppState.addEventListener('change', async (state) => {
  if (state === 'background') { backgroundAt = Date.now(); return; }
  if (state !== 'active' || backgroundAt === null) return;
  const away = Date.now() - backgroundAt;
  backgroundAt = null;
  if (away <= ADMIN_LOCK_AFTER_MS || !isAdminRole(myRole())) return;
  if (await getAccess()) set(true);
});
