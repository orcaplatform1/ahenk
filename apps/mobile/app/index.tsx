// Açılış yönlendirmesi: dönen logolu 3 sn'lik açılış ekranı kaldırıldı. Yerel açılış görseli (expo-splash-screen) görünürken
// yazı tipleri yüklenir, oturum yenilenir + /auth/me rol kontrolü yapılır ve hemen gidilecek ekrana geçilir.
// Gidilecek ekranın açılış verileri arka planda ön yüklenir (beklenmez; ekranlar aynı yolları api.get ile çağırır).
import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { forgetDevice, getAccess, getRemembered } from '@/lib/session';
import { api, prefetch, refreshAtLaunch } from '@/lib/api';
import { loadFonts, loadImages } from '@/lib/boot';
import { lockAdminAtLaunch } from '@/lib/adminLock';
import { setAdminIdentity } from '@/lib/adminRole';
import { applyAccountLanguage } from '@/lib/i18n';

// Gidilecek ekranın ilk açılışta istediği GET uçları (ekranlar aynı yolları api.get ile çağırır, ön yüklenen yanıt kullanılır)
const ADMIN_DATA = ['/admin/alerts', '/admin/stats/overview', '/admin/stats/cities', '/admin/dashboard'];
const MEMBER_DATA = ['/payment/subscriptions', '/kyc/status', '/kanka/me', '/meetings/dashboard', '/meetings/live/overview', '/meetings/live/pulse', '/notifications?page=1&limit=1', '/payment/winback'];

export default function Acilis() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const fonts = loadFonts().catch(() => undefined);
    loadImages().catch(() => undefined);
    (async () => {
      // Yönlendirme: ADMIN/SUPERADMIN → Yönetim Paneli, üye → Eşleşme Paneli (1. sekme), oturum yok → Giriş;
      // oturum yok ama cihaz hatırlanıyorsa ("Bu cihazda beni hatırla") → Tekrar hoş geldin ekranı
      let dest: '/(tabs)' | '/admin' | '/giris' | '/tekrar-hosgeldin' = '/giris';
      if (!(await getAccess()) && (await getRemembered())) {
        dest = '/tekrar-hosgeldin';
      } else if (await getAccess()) {
        if ((await refreshAtLaunch()) !== 'expired') {
          await prefetch(['/auth/me']);
          // /auth/me ön yüklemeye alınır: rol kontrolü ve açılan ekranlardaki /auth/me çağrıları aynı yanıtı kullanır (tekrar istek yok)
          prefetch(['/auth/me']);
          const me = await api.get<{ role: string; language?: string }>('/auth/me').catch(() => null);
          applyAccountLanguage(me?.language);
          const admin = me?.role === 'ADMIN' || me?.role === 'SUPERADMIN';
          dest = admin ? '/admin' : '/(tabs)';
          // Admin kalıcı oturumu: uygulama sıfırdan açılınca biyometrik doğrulama (kilit ekranı yönetim panelinin üstünde açılır)
          if (admin && me) {
            setAdminIdentity({ id: (me as { id?: string }).id ?? '', role: me.role });
            // Cihazda biyometrik ve ekran kilidi yoksa admin oturumu kalıcı değildir: oturum kapanır, normal giriş
            if ((await lockAdminAtLaunch()) === 'login') {
              await api.logout().catch(() => undefined);
              await forgetDevice();
              setAdminIdentity(null);
              dest = '/giris';
            }
          }
          prefetch(admin ? ADMIN_DATA : MEMBER_DATA);
        }
      }
      await fonts;
      if (alive) router.replace(dest);
    })();
    return () => { alive = false; };
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
}
