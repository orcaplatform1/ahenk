# Mobile Deep Review — Ahenk (apps/mobile)

- **Uygulama:** Ahenk (Expo SDK 58, React Native 0.88, expo-router)
- **Tarih:** 2026-11-08
- **Taranan kaynak dosya:** 93 (audit script), 41 ekran adayı
- **Dosya sınırı:** 13 (%15); okunan: app/_layout.tsx, app/(tabs)/_layout.tsx, app/index.tsx, app/admin/_layout.tsx, app/admin/acil-yardim.tsx, app/admin/kyc.tsx, app/admin/users.tsx, app/mekan/_layout.tsx, app/mekan/masalar.tsx, lib/api.ts, lib/session.ts, lib/venueApi.ts, components/profil/ProblemReport.tsx
- **Audit kapsam notu:** `returnNull` işaretleri sınırda kesildi; app/admin/stats.tsx, app/admin/denge.tsx ve app/kayit.tsx işaretleri incelendi, hepsi yanlış pozitif (koşullu `return null`, TextInput `placeholder`).

## Architecture
- [F01] Low — `app/admin/matches.tsx`, `app/admin/users.tsx`: kullanıcı detay penceresi iki ekranda ayrı yazılı (web'de de iki ayrı sayfa olduğu için bilinçli). Öneri: ileride ortak bileşene çekilebilir; web ile birebirlik için şimdilik ayrı.

## Code Quality
- [F02] Low — `components/admin/SosLiveMap.tsx`: react-native-webview 14.0.1 tip tanımı (`WebView<P = undefined>`) TS 7 ile prop tipini `never` yapıyor; tip dönüştürmesiyle aşıldı. Öneri: paket tipi düzelince dönüştürme kaldırılmalı.

## Robustness
- [F03] Medium — `lib/authFile.ts`: Android'de `File.preview()` dosyayı başka uygulamaya devreder (iOS Quick Look uygulama içi). Öneri: Android için uygulama içi PDF görüntüleyici gerekiyorsa ayrıca karar verilmeli.
- [F04] Low — `app/index.tsx`: `/auth/me` ağ hatasında üye tarafına gider; admin bağlantı yoksa Eşleşme Paneli'nde açılır (Profilim → Yönetim Paneli ile geçer).

## Performance
- [F05] Low — admin listeleri `ScrollView` + `map` ile çiziliyor (web ile aynı sayfalı veri, sayfa başı 20–25 kayıt); FlatList gerektirecek büyüklük yok.

## Security
- [F06] Low — Token'lar expo-secure-store'da; AsyncStorage'da token yok. Yetkili dosyalar Bearer başlığıyla indiriliyor, URL'de token yok.
- [F07] Low — `backend/src/venue-panel/venue-panel.service.ts`: 2026-11-08 öncesi verilmiş sid'siz mobil mekân yenileme token'ları, ilk refresh'e kadar cihaz bazında kapatılamaz (refresh'te oturuma geçirilir).

## What's Unfinished
- [F08] Medium — IAP makbuz doğrulama/ürün kimlikleri, Firebase push token, Universal Links (AASA/Team ID) dış bilgi bekliyor.
- [F09] Low — Native build (EAS) alınmadı; yalnız `expo export` doğrulaması var. Test dosyası yok.

## Priority List
1. [F08] Dış bilgiler gelince IAP / push / universal link tamamlanmalı.
2. [F03] Android dosya önizleme davranışına karar.
3. [F09] EAS ile cihaz derlemesi ve cihazda deneme.
4. [F07] Eski sid'siz mekân token'larının süresinin dolmasını izle.
5. [F02] WebView tip dönüştürmesini paket güncellemesinde kaldır.

## Verdict
**Needs Refactor** (küçük ölçekli: dış bağımlı akışlar ve cihaz derlemesi eksik; kod yapısı sağlam).
