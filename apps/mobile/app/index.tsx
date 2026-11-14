// Açılış yönlendirmesi: dönen logolu 3 sn'lik açılış ekranı kaldırıldı. Yerel açılış görseli (expo-splash-screen) görünürken
// yazı tipleri yüklenir, oturum yenilenir + /auth/me rol kontrolü yapılır ve hemen gidilecek ekrana geçilir.
// Gidilecek ekranın açılış verileri arka planda ön yüklenir (beklenmez; ekranlar aynı yolları api.get ile çağırır).
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { getAccess, getRemembered } from '@/lib/session';
import { api, prefetch, refreshAtLaunch } from '@/lib/api';
import { loadFonts, loadImages } from '@/lib/boot';

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
          const me = await api.get<{ role: string }>('/auth/me').catch(() => null);
          const admin = me?.role === 'ADMIN' || me?.role === 'SUPERADMIN';
          dest = admin ? '/admin' : '/(tabs)';
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
