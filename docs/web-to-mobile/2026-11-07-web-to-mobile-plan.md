# WebToMobile Planı: Ahenk iPhone (React Native / Expo) — 1. Aşama

Plan Status: Approved (2026-11-08) — 2. aşama: üye + mekân tamam, admin yapılmadı

Bu dosya yalnızca plan. Kod yazılmadı, paket kurulmadı, commit yapılmadı.
Kaynak etiketleri: `[from-code]` = web kaynak kodunda görüldü · `[from-user]` = 2026-11-07 talimatında kullanıcı kararı · `[from-claude-md]` = CLAUDE.md · `[inferred]` = koddan çıkarım, doğrulanmadı.
Kural: CLAUDE.md "## Mobil Uygulama Kuralı (iOS / React Native)" — web ile birebir görünüm 1. öncelik; HIG yalnızca webde karşılığı olmayan iPhone'a özgü konularda (güvenli alan, 44×44 pt, klavye, geri kaydırma, durum çubuğu). Webde karşılığı olmayan her şey aşağıda **SORU** başlığında; karar verilmedi.

---

## Capabilities & Limits

- Girdi seviyesi: yerel kaynak (repo/local) → tam kaynak analizi `[from-code]`.
- Denetlenen: `apps/web` (Next.js 16.4.5 App Router, React 19.3, Tailwind 4, framer-motion, leaflet), `packages/ui`, `packages/config/tailwind`, backend'de yalnızca oturum ve bildirim uç noktalarının varlığı.
- Yapılmayan: tarayıcı testi, canlı istek, geçici kullanıcı, ekran görüntüsü karşılaştırması (talimat gereği). Görsel değerler yalnızca kaynak koddan okundu.
- Admin paneli (`app/admin/*`) ve mekân paneli (`app/mekan/*`) denetlendi ama mobil kapsamı **SORU** (S-01).

## Source

- Repo: `/root/ahenk`, dal `master`, HEAD `6564bdc`.
- Commit edilmemiş değişiklikler (denetimi etkilemez): `.claude/commands/`, `.claude/skills/*` (yeni skill klasörleri), `CLAUDE.md.bak2`.
- Audit betiği: `node .claude/skills/web-to-mobile-audit/scripts/web-repo-audit.mjs apps/web` → `inputClassification: web-frontend`, `nextjsRouter: app-router`, 120 kaynak dosya.

---

## Audit Findings

### A1. Çatı ve render modeli `[from-code]`
- `app/layout.tsx`: `force-dynamic`; her sayfa istemci bileşeni (`'use client'`) ağırlıklı; veri tamamen `lib/api.ts` üzerinden REST (`${NEXT_PUBLIC_API_URL}/api/v1`).
- Server Action yok; mobil aynı REST uç noktalarını çağırabilir.

### A2. Oturum `[from-code]`
- Web: HttpOnly çerez (`ahenk_session` işareti + erişim/yenileme çerezi), `credentials: 'include'`, 401'de `/auth/refresh`.
- Backend `auth.controller.ts:253`: istekte `Origin` başlığı yoksa gövdede `{ user, accessToken, refreshToken }` döner.
- `jwt.strategy.ts:24-26`: token hem `Authorization: Bearer` hem çerezden okunur; `csrf-origin.middleware.ts:17` Bearer isteğini CSRF kontrolünden muaf tutar.
- `packages/ui` bileşenleri (`MasaDetayKarti`, `RezervasyonIptal`, `AhenkHistory`) zaten `token` prop'u ile Bearer başlığı ekleyebilecek şekilde yazılmış.
- Mobil token saklama yeri **SORU** (S-20).

### A3. Web sayfa envanteri (kullanıcı tarafı) `[from-code]`
| Web rota | Dosya | İçerik |
|---|---|---|
| `/` | `app/page.tsx` (972 satır) | Tanıtım (hero, HeroCountdown, şehirler, paketler, SSS vb.) |
| `/giris` | `app/giris/page.tsx` | WhatsApp OTP / e-posta+şifre girişi, yaptırım (sanction) modalı, hoş geldin animasyonu |
| `/kayit` | `app/kayit/page.tsx` | 5 adım: Temel Bilgiler (+WhatsApp OTP) → Şehir Seçimi → OCEAN Testi → Mekan Tercihi → Numara Engelleme |
| `/sifremi-unuttum`, `/sifremi-sifirla` | ilgili `page.tsx` | Telefonla kod, yeni şifre |
| `/dashboard` | `app/dashboard/page.tsx` + `components/live/*` | Eşleşme Paneli: masa türü sekmeleri (GRUP/BAŞ BAŞA/KANKAMLA), geri sayım, metrikler, Eşleşme Taraması (sonar), Katılım, Canlı Akış, Semt Masa Yoğunluğu, Uyum Sinyali, Bu Hafta Dolum, CTA |
| `/profil?tab=profil` | `app/profil/tabs/TabProfilim.tsx` | Hesap Bilgileri (KYC rozeti, ad soyad, telefon değiştirme+OTP, e-posta, meslek, yaş, cinsiyet, **Aktif Kankanız / KankaSection**), aktif şehir, Şehir Tercihleri, Mekan Tercihi, Sadakat Programı, Sorun Bildir, Tüm cihazlardan çıkış, Hesabımı Sil |
| `/profil?tab=test` | `TabTest.tsx` | PersonalityAura (canvas), test tarihi, sonraki test, Tekrar Test Yap |
| `/profil?tab=masalar` | `TabMasalar.tsx` | KYC uyarısı, LiveTabs, Masa Detay Kartı (EmptyMasaCard / ConfirmedRadarView+RezervasyonIptal / MasaDetayKarti), Geçmiş Masalarım listesi + Değerlendir bağlantısı |
| `/profil?tab=paket` | `TabPaket.tsx` | Sadakat Programı, aktif paket kalan haklar/döngüler, iade talebi, 4 paket kartı (Masada, Karşımda, İçerde, Kankamla), iyzico ödeme |
| `/profil?tab=kyc` | `TabKyc.tsx` | Kimlik ön/arka fotoğraf (kamera), canlılık videosu (getUserMedia+MediaRecorder), durum ekranları |
| `/profil?tab=rehber` | `TabRehber.tsx` | Engellenen numaralar sayacı (x/50), manuel +90 numara ekleme, liste, sil |
| `/test` | `app/test/page.tsx` | Soru soru OCEAN testi |
| `/test/sonuc` | `app/test/sonuc/page.tsx` | Kişilik Profilin (PersonalityResult) |
| `/degerlendirme/[meetingId]` | ilgili `page.tsx` | Yıldız puanı, yorum, katılımcı engelleme, onay modalı |
| `/kanka/[token]` | ilgili `page.tsx` | Kanka daveti karşılama |
| `/odeme/basarili`, `/odeme/basarisiz` | ilgili `page.tsx` | iyzico dönüş ekranları |
| `/profil/gecmis` | `app/profil/gecmis/page.tsx` | AhenkHistory; uygulama içinden bağlantı bulunamadı (grep) |
| Statik | `cerez-politikasi`, `gizlilik-politikasi`, `kvkk`, `kullanim-kosullari`, `mesafeli-satis-sozlesmesi`, `topluluk-kurallari`, `hikayemiz`, `kariyer`, `is-ortakligi`, `jantihaydar`, `site-haritasi` | Metin sayfaları / formlar |
| Global | `Navbar`, `SiteFooter`, `CookieBanner`, `SosOpenReport`, `WinbackHost`, `MaintenanceNotice`, `ProblemReportModal`, `Analytics` | Site geneli katmanlar |

### A4. Web hesap gezintisi `[from-code]`
- `components/AccountTabBar.tsx`: üstte yatay kaydırmalı sekme çubuğu (sticky, top 52): Eşleşme Paneli, Masalarım, Profilim, Kişilik Testim, Paketim, Numara Engelleme, Kimlik Doğrulama (KYC onaylıysa gizlenir).
- Webde alt menü (tab bar) yok; mobil 5 sekmeli alt menü kullanıcı kararıdır `[from-user]`.

### A5. Bildirim `[from-code]`
- Web kaynak kodunda bildirim listesi ekranı **yok** (`grep notification|bildirim` → yalnızca metin sayfaları ve admin bileşenleri).
- Backend'de uç noktalar var: `POST /notifications/token`, `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` (`backend/src/notification/notification.controller.ts`).

### A6. Kanka (Kankam) `[from-code]`
- Webde `KankaSection` yalnızca **Profilim → Hesap Bilgileri** kartının içinde (`TabProfilim.tsx:494`).
- Talimatta Kankam **Masalarım** sekmesinde `[from-user]` → taşıma/çoğaltma ayrıntısı **SORU** (S-06).

### A7. Mevcut `apps/mobile` klasörü `[from-code]` — dokunulmadı
- İçerik: yalnızca `package.json` ve `node_modules/` (`@ahenk`, `@babel`, `@types`, `expo`, `expo-router`, `expo-status-bar`, `react`, `react-native`, `typescript`).
- `package.json`: `main: expo-router/entry`; bağımlılıklar `expo ~58.0.23`, `expo-router ~58.0.30`, `expo-status-bar ~58.0.4`, `react 19.3.1`, `react-native 0.88.1`, `@ahenk/shared`; scriptler `start/android/ios/lint/type-check`.
- Kaynak dosya, `app.json`, ekran, tema dosyası **yok**. Ne yapılacağı **SORU** (S-02).

### A8. Paylaşılan paketler `[from-code]`
- `packages/ui`: DOM + framer-motion + SVG bileşenleri (`MasaDetayKarti`, `DetayAvatar`, `KankaPairs`, `MasalarDashboard`/`ConfirmedRadarView`, `RezervasyonIptal`, `MasaBeklemeKarti`, `AhenkSonar`, `OceanRadar`, `PersonalityResult`, `AhenkHistory`). RN'de doğrudan çalışmaz (div/span/img/fetch credentials/window).
- Saf mantık (yeniden kullanılabilir): `gColor`, `buildInitials`, `isTableLocked`, `isMatchingClosed` (`MasalarDashboard.tsx`), `getNextTarget` (`components/HeroCountdown.tsx`), `useMasaTabs` durum hesabı (`components/live/useMasaTabs.ts`), `getPlanCardState`/`getKankamlaCardState` (`lib/planCards.ts`), `LEVELS` (`components/live/levels.ts`), `OCEAN_DIMENSIONS` (`oceanData.ts`).
- `packages/shared`: `types.ts`, `constants.ts`, `index.ts`.

### A9. Tarayıcıya özgü bağımlılıklar `[from-code]`
| Web sinyali | Dosya | Not |
|---|---|---|
| `navigator.mediaDevices.getUserMedia` + `MediaRecorder` | `TabKyc.tsx:246-286` | Canlılık videosu |
| `<input type=file capture="environment">` | `TabKyc.tsx:205-208` | Kimlik fotoğrafı |
| IndexedDB (`openKycDb`) | `TabKyc.tsx:53-92` | KYC dosyalarını sayfa yenilemeye karşı saklar |
| `navigator.geolocation` (getCurrentPosition, watchPosition, permissions.query) | `MasaDetayKarti.tsx:725-806` | SOS + katılımcı konumu |
| `navigator.clipboard` | `KankaSection.tsx:46` | Davet linki kopyalama |
| `localStorage` (`ahenk_masa_tab`) | `useMasaTabs.ts:13,63` | Seçili masa türü |
| `document.visibilitychange` / `focus` / `online` | `LiveLayer.tsx`, `useMasaTabs.ts`, `MasaDetayKarti.tsx` | Yeniden çekme tetikleri |
| iyzico `checkoutFormContent` script enjeksiyonu | `lib/checkout.ts` | Ödeme formu DOM'a gömülür |
| `createPortal` | `KankaSection`, `TabMasalar` | Alt sayfa / modal |
| leaflet | `SosLiveMap.tsx` (admin) | Kullanıcı tarafında kullanılmıyor `[inferred]` |
| `canvas` | `TabTest.tsx:57-` PersonalityAura | |

---

## Tasarım Değerleri (tek tema dosyasına girecek) `[from-code]`

Tema dosyası yolu ve adı **SORU** (S-03). Aşağıdaki değerler web kaynağından birebir; yeni değer eklenmedi.

### T1. Yazı tipleri — `app/layout.tsx`
| Rol | Web | Ağırlıklar |
|---|---|---|
| serif (başlık) | DM Serif Display (`--font-serif`) | 400 |
| sans (gövde) | Inter (`--font-sans`) | değişken (400/500/600/700/800 kullanılıyor) |
| mono | JetBrains Mono (`--font-mono`) | 400, 500, 600 |
- Tailwind fallback: serif → `"DM Serif Display", serif`; sans → `Inter, sans-serif` (`packages/config/tailwind`).
- Bazı bileşenler `Georgia, serif` kullanıyor (`HeroCountdown.tsx` sayılar).

### T2. Renkler — Tailwind (`packages/config/tailwind`)
`bg #121212` · `surface #222222` · `border #1f1f1f` · `primary #c0392b` · `primary-hover #e74c3c` · `accent #ff6b6b` · `text #f5f5f5` · `muted #888888`

### T3. Renkler — `packages/ui/src/theme.ts` (Tailwind ile çelişen değerler var → S-04)
`bg #0a0a0a` · `surface #141414` · `border #1f1f1f` · `primary #c0392b` · `primaryHover #e74c3c` · `accent #ff6b6b` · `text #f5f5f5` · `muted #888888`

### T4. Renkler — Canlı Katman (`globals.css` `.live-layer`)
`--ll-bg #0a0a0a` · `--ll-text #f4f1ec` · `--ll-text-2 #c9c2b8` · `--ll-label #a39c93` · `--ll-time #8f887f` · `--ll-red #d6453a` · `--ll-red-2 #ff6b5e` · `--ll-red-3 #ff8a7e` · `--ll-copper #e8a27a` · `--ll-copper-2 #c8743c`
- `.ll-glow`: 420×420, top/right −140, `radial-gradient(circle, rgba(200,56,44,0.28) 0%, transparent 70%)`.

### T5. Cinsiyet ve durum renkleri
- `MALE_CLR #4fc3f7`, `FEMALE_CLR #f48fb1`; `gColor(null)` → `#4fc3f7` (`MasalarDashboard.tsx:46-49`).
- Cinsiyet zemin: erkek `rgba(79,195,247,0.12)`, kadın `rgba(244,143,177,0.12)` (`DetayAvatar.tsx:6-9`).
- Masa kartı: `GREEN #27ae60`, `RED #c0392b` (`MasaDetayKarti.tsx:90-91`).
- Sekme durum noktaları (`.ll-tab-dot`): varsayılan `#6e6860`; TABLE/FORMING `#7bc67e`; FAILED/CANCELLED/SCANNING `#ff3b30`; KYC `#f5a623`; PENDING/KANKA `#ffd60a`.
- Sekme halkaları: kapalı kırmızı `#4a3a3a`, kapalı bakır `#3a2e2e`; açık kırmızı `#ff3b30`, açık bakır `#e8823a`.
- Yoğunluk seviyeleri (`levels.ts`): 1 `#ff3b30`, 2 `#ff8c42`, 3 `#f2c14e`, 4 `#8a8178`.
- Sonar noktaları (`LiveSonar.tsx`): yeni `#ff6b5e`, aktif `#e8a27a`, havuz `#c9c2b8`; halka `#e8a27a` opaklık 0.18→; dilim gradyanı `#d6453a` 0→0.45.
- Uyarı/başarı: `#4ade80`, `#22c55e`, `#facc15`, `#f59e0b`, `#ffb347`, bakım `#e0b84a` / `rgba(201,162,39,0.10|0.35)`, KYC topu `#722f37`, KYC uyarı kenarı `#722F37`.
- Yapay zeka raporu: zemin `rgba(8,18,44,0.75)`, kenar `rgba(100,130,200,0.18)`, başlık `rgba(180,200,255,0.75)`, uyum çubuğu `linear-gradient(90deg, #4fc3f7, #f48fb1)`.
- Paket kartı: sol zemin `#0c0909`; öne çıkan kart altın kenar `conic-gradient(... #c9a227 78%, #e8c84a 84% ...)`.

### T6. Kart, buton, girdi bileşen değerleri (`globals.css`)
| Sınıf | Değerler |
|---|---|
| `.ll-card` | radius 20, border 1 `rgba(255,255,255,0.08)`, bg `rgba(255,255,255,0.025)`, padding 18 |
| `.ll-metric` | radius 16, border 1 `rgba(255,255,255,0.08)`, bg `rgba(255,255,255,0.03)`, padding 12/10 |
| `.ll-column` | max-width 480, padding 16/20/28, gap 28 |
| `.ll-head` | flex, baseline, space-between, gap 12, margin-bottom 12 |
| `.ll-title` | serif 400, 23px, line-height 1.2 |
| `.ll-note` | mono 11px, `--ll-label` |
| `.ll-eyebrow` | mono 11px, letter-spacing 1.6px, `--ll-copper` |
| `.ll-live` | pill, padding 5/10, border `rgba(255,107,94,0.35)`, mono 11 600; yeşil varyant `#22c55e` |
| `.ll-badge` | mono 10 600, padding 3/7, radius 6, border 1 currentColor |
| `.ll-heat-cell` | yükseklik 84, radius 12, padding 10; ızgara 3 sütun gap 6 |
| `.ll-tab` | min-height 44, padding 8/2, gap 6; açıkken translateY(−3); etiket mono 11 600 letter-spacing 0.14em `#8f887f` → açık `#fff`; durum 10.5px `#a39c93` |
| `.ll-cta` | min-height 56, radius 16, Inter 700 16px, `linear-gradient(90deg, #c7342a, #d9603f 55%, #e8a27a)`, gölge `0 10px 30px rgba(214,69,58,0.35)` |
| `.btn-primary` | pill (999), padding 9/24, 11px 600 letter-spacing 0.14em BÜYÜK HARF, bg `rgba(255,255,255,0.07)`, border `rgba(255,255,255,0.12)`, blur 12, solda 4px nokta `#A21A26`; disabled opaklık 0.4 |
| `.btn-ghost` | pill, padding 9/24, 11px 500 letter-spacing 0.14em BÜYÜK HARF, şeffaf, border `rgba(255,255,255,0.14)`, renk `rgba(255,255,255,0.88)`, nokta `rgba(230,225,218,0.5)`; kırmızı nokta varyantı `#e74c3c` |
| `.btn-grad` (eski) | `linear-gradient(135deg, #c0392b, #ff6b6b)`, gölge `0 0 20px rgba(192,57,43,0.35)` |
| `.input-glass` | bg `rgba(255,255,255,0.10)`, border `rgba(255,255,255,0.10)`, blur 8, radius 12, renk `#f5f5f5`, placeholder `#888`, odak kenarı `rgba(192,57,43,0.6)` + halka `rgba(192,57,43,0.1)` 3px |
| `.glass-card` | bg `rgba(255,255,255,0.10)`, border `rgba(255,255,255,0.10)`, blur 20, radius 16, gölge `inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 24px rgba(0,0,0,0.4)` |
| `.progress-grad` | `linear-gradient(90deg, #c0392b, #ff6b6b)` |
| Alt sayfa (Sheet) | bg `#1a1a1a`, üst radius 20, padding 24/20/36, karartma `rgba(0,0,0,0.72)` + blur 6 (`KankaSection.tsx`, `TabProfilim.tsx`) |
| Modal | `glass-card`, p-6, max-w-md, karartma `bg-black/60` blur-sm (`components/ui/Modal.tsx`) |
| Skeleton | `bg-surface` (#222222), rounded-xl, h-5, animate-pulse |
| AccountTabBar seçili | bg `rgba(192,57,43,0.18)`, renk `#ff6b6b`, border `rgba(192,57,43,0.35)`; seçili değil renk `#666`; 12px 500, padding 6/12, radius 8 |
| Navbar | yükseklik 52, `bg-bg/80` + backdrop-blur-md, alt kenar `border`; logo 28 yuvarlak, "AHENK" 14px 600 letter-spacing 0.12em |

### T7. Animasyon süreleri (`globals.css` / bileşenler)
`ll-pulse 1.8s`, `ll-blink 1.4s`, `ll-spin 6s` (sonar), sekme halkası `3.2s`, `ll-ring-drift 1.6s`, `ll-fade 0.35s`, `ll-flash 1.4s`; DetayAvatar giriş 0.6s `[0.34,1.56,0.64,1]`, halka çizimi 0.8s, nabız 2.6s; `prefers-reduced-motion` → animasyonlar kapanır.

### T8. Görseller (`apps/web/public`)
`logo.webp/png`, `lock-icon.webp`, `clock-icon.webp`, `plan-masada.webp`, `plan-karsimda.webp`, `plan-icerde.webp`, `kyc_demo_identity_card.svg`, `kyc_demo_identity_card_back.svg`, `kyc-liveness-demo.png`, `maskot/jantihaydar_run.webp`, `maskot/jantihaydar_stop.webp`, `icon-192/512.png`, `apple-touch-icon.png`, hero/cta arka planları.

---

## Profilim Sekme İkonu — Kaynak Bileşen `[from-user]` + `[from-code]`

Talimat: ikon, masa detay kartındaki katılımcı baş harf rozetinin birebir kopyası; kullanıcının ad soyad baş harfleri (ör. M.D.), cinsiyet rengiyle; renk, yazı tipi, boyut oranı ve kenarlık o bileşenden.

Masa detay kartındaki (`packages/ui/src/components/tables/MasaDetayKarti.tsx`) KATILIMCILAR bölümü (`:974-977`) `DetayAvatar` kullanır. `DetayAvatar.tsx` değerleri:
- Çap `AV_D = 48`; zemin dairesi r = 23 (`AV_R − 1`), dolgu: erkek `rgba(79,195,247,0.12)` / kadın `rgba(244,143,177,0.12)`.
- Kenar halkası r = 21.5 (`AV_R − 2.5`), `strokeWidth 2.5`, renk `gColor(gender)` (`#4fc3f7` / `#f48fb1`; cinsiyet yoksa `#4fc3f7`), `strokeLinecap round`.
- İkinci halka: aynı renk, `drop-shadow(0 0 4px <renk>88)`, opaklık 0.35→0.85→0.35, 2.6 s sonsuz.
- Giriş animasyonu: ölçek 0.5→1 (0.6 s), halka çizimi 0.8 s.
- Metin: Inter, 700, `#f0f0f0`, letter-spacing 0.02em; boyut 11px (metin 4 karakterden uzunsa 10px); format "M.D." (`buildInitials`).
- Oranlar (48 tabanlı): kenar kalınlığı 2.5/48, yazı 11/48, zemin yarıçapı 23/48, halka yarıçapı 21.5/48.

Aynı kartta ikinci bir rozet daha var: sohbet `ChatBadge` (`MasaDetayKarti.tsx:58-73`, yorumda "Masa kartındaki baş harf rozetinin küçük hali": 28px, kenar 1.5px, yazı 8.5/7.5px). Hangisinin esas alınacağı ve ölçü/animasyon ayrıntıları **SORU** (S-08…S-11).

---

## Migration Fit Verdict

Önerilen yol: **Expo React Native** (mevcut `apps/mobile/package.json` Expo 58 + expo-router içeriyor; CLAUDE.md monorepo yapısı `apps/mobile → React Native (Expo)`) `[from-claude-md]` `[from-code]`.
- App Store ihtiyacı: var (CLAUDE.md "iOS", StoreKit 2 stub) `[from-claude-md]`.
- Native API ihtiyacı: kamera + video (KYC), konum (SOS), push (FCM), rehber (CLAUDE.md'de mobil Contacts API) → web sarmalayıcı yeterli değil `[inferred]`.
- Yeniden kullanım: saf mantık ve tipler (A8); görsel bileşenler RN için yeniden yazılacak.
- Risk: web görünümünü birebir tutturma (blur, gradyan, SVG animasyonları), ödeme akışı (S-13), oturum (S-20).

## Route To Mobile Navigation Map

Alt menü sırası ve içerikleri kullanıcı kararıdır `[from-user]`.

| Web rota | Mobil hedef | Navigator | Gerekçe | Güven |
|---|---|---|---|---|
| `/dashboard` | **Sekme 1 – Eşleşme Paneli** (ana ekran) | Tab | Sonar, geri sayım, Katılım | `[from-user]` |
| `/profil?tab=masalar` | **Sekme 2 – Masalarım** | Tab | Aktif masa, Kankam, geçmiş masalar, Değerlendir | `[from-user]` |
| `components/KankaSection.tsx` (webde Profilim içinde) | Masalarım → Kankam bölümü | Tab içi bölüm + alt sayfalar | Talimat | `[from-user]`, ayrıntı S-06 |
| Geçmiş Masalarım (TabMasalar içi liste) | Masalarım → geçmiş listesi (+ kart açılımı) | Tab içi | Web ile aynı | `[from-code]` |
| `/degerlendirme/[meetingId]` | Masalarım yığını → Değerlendir ekranı | Stack | Web ayrı sayfa | `[from-code]` |
| — (webde yok) | **Sekme 3 – Bildirimler** | Tab | İçerik S-14 | `[from-user]` |
| `/profil?tab=paket` | **Sekme 4 – Paketim** | Tab | Paket satın alma, kalan hak | `[from-user]` |
| `/odeme/basarili`, `/odeme/basarisiz` | Paketim yığını | Stack/Modal | Ödeme kararına bağlı (S-13) | `[from-code]` |
| `/profil?tab=profil` | **Sekme 5 – Profilim** | Tab | | `[from-user]` |
| `/profil?tab=test` | Profilim → Kişilik Testim | Stack | Talimat | `[from-user]` |
| `/test`, `/test/sonuc` | Profilim → Kişilik Testim yığını | Stack | Webde ayrı sayfalar | `[from-code]` |
| `/profil?tab=rehber` | Profilim → Numara Engelleme | Stack | Talimat | `[from-user]` |
| `/profil?tab=kyc` | Profilim → Kimlik Doğrulama | Stack | Talimat | `[from-user]` |
| `/giris` | Auth akışı → Giriş | Auth stack | | `[from-code]` |
| `/kayit` | Auth akışı → Kayıt (5 adım) | Auth stack | | `[from-code]` |
| `/sifremi-unuttum`, `/sifremi-sifirla` | Auth akışı | Auth stack | | `[from-code]` |
| `/kanka/[token]` | Derin bağlantı ekranı | Stack | Bağlantı yöntemi S-21 | `[from-code]` |
| Yaptırım modalı (`giris/page.tsx:169-215`) | Modal | Modal | | `[from-code]` |
| `WinbackScreen` | Modal | Modal | | `[from-code]` |
| `SosOpenReport` (site geneli SOS kartı) | Kalıcı katman | Overlay | | `[from-code]` |
| `ProblemReportModal` | Modal (Profilim) | Modal | | `[from-code]` |
| `/`, statik/yasal sayfalar, `/profil/gecmis`, admin, mekân paneli, Navbar menüsü, Footer, CookieBanner | — | — | Kapsam kararı yok | S-01, S-15…S-19 |

## Mobil Ekran Listesi ve Kullanılacak Bileşenler

| # | Mobil ekran | Web karşılığı | Kullanılacak web bileşenleri / bölümler (RN'e birebir yeniden yazılacak) |
|---|---|---|---|
| M1 | Eşleşme Paneli | `app/dashboard/page.tsx` | KYC red uyarısı, MaintenanceNotice, WinbackHost rozeti, KYC kilit kartı (`lock-icon.webp`), `LiveTabs` (halka SVG'leri), Geri sayım kartı (`Countdown`, Janti Haydar maskotu), Metrikler (3 `.ll-metric`), `LiveSonar` + `AhenkSonar`, `LiveParticipation` (Katılım), `LiveFeed`, Semt Masa Yoğunluğu, Uyum Sinyali, Bu Hafta Dolum (`FillRow`), `.ll-cta` |
| M2 | Masalarım | `TabMasalar.tsx` | KYC uyarı şeridi, "Paket Seç" + önizleme notu, `LiveTabs`, kart başlığı + "Geçmiş Masalarım", `EmptyMasaCard`/`MockAvatar`, `ConfirmedRadarView`, `KankaPairs`, `RezervasyonIptal`, `MasaDetayKarti` (fotoğraflar+Lightbox, HARİTADA GÖR, Buluşma, KATILIMCILAR/`DetayAvatar`, Yapay Zeka Masa Raporu, Yola Çıktım, Sohbet `ChatSection`/`ChatBadge`, `NoShowSection`, Acil Yardım `SosModal`), admin iptal kartı |
| M2a | Kankam (Masalarım içinde) | `components/KankaSection.tsx` | Aktif Kankanız satırı (`Bubble`), Davet Et / Davet Var, giden davet + `CopyLink`, Kankamla hak satırı, "KANKAMLA NASIL İŞLER?" kartı, 3 alt sayfa (davet, gelen davet, kankan) |
| M2b | Geçmiş masalar | `HistoryList`, `HistoryCard` | Satır (tarih – tür – mekân – şehir), ▾ açılır kart (`MasaDetayKarti archive`), DEĞERLENDİRMEN, ENGELLEDİKLERİN, "Değerlendir" bağlantısı |
| M2c | Değerlendir | `app/degerlendirme/[meetingId]/page.tsx` | Yıldızlar, katılımcı engelleme rozetleri, yorum (min uzunluk), onay modalı |
| M3 | Bildirimler | yok | **S-14** |
| M4 | Paketim | `TabPaket.tsx` | MaintenanceNotice, Sadakat Programı kartı, Aktif paket kalan hak/döngü satırları, iade butonları, 4 paket kartı (sol metin %55 `#0c0909` + sağ görsel, rozet, öne çıkan altın kenar, "Tercih Edilen"), Winback indirimli fiyat/sayaç, referans indirimi |
| M5 | Profilim | `TabProfilim.tsx` | Hesap Bilgileri `Card`/`Row`, KYC rozeti, telefon değiştirme + 6 haneli OTP, cinsiyet etiketi, aktif şehir + onay alt sayfası, Şehir Tercihleri (`CityPickerModalP`), Mekan Tercihi, Sadakat Programı, Sorun Bildir, Tüm cihazlardan çıkış, Hesabımı Sil (`Modal`); Kişilik Testim / Numara Engelleme / Kimlik Doğrulama girişleri (yerleşim S-07) |
| M5a | Kişilik Testim | `TabTest.tsx` | `PersonalityAura`, Test Tarihi / Sonraki Test, Tekrar Test Yap / Teste Başla |
| M5b | Test soruları | `app/test/page.tsx` | Soru kartı, ilerleme, Geri/İleri, Test Tamamlandı ekranı |
| M5c | Test sonucu | `app/test/sonuc/page.tsx` | `PersonalityResult`, `OceanRadar` |
| M5d | Numara Engelleme | `TabRehber.tsx` | Sayaç kartı, +90 girişi, Ekle, liste, Sil |
| M5e | Kimlik Doğrulama | `TabKyc.tsx` | `ImageUploader` ×2 (örnek SVG), `LivenessRecorder`, durum ekranları (APPROVED / PENDING top animasyonu / REJECTED), gönder + ilerleme çubuğu |
| A1 | Giriş | `app/giris/page.tsx` | Logo 48, `ll-title`, WhatsApp/E-posta anahtarı, `OtpInput`, yaptırım modalı, hoş geldin animasyonu, Şifremi unuttum |
| A2 | Kayıt | `app/kayit/page.tsx` | Adım göstergesi (5 daire 32px + 40px çizgi), Field/PasswordField/DateField(`BirthDateField`)/OccupationField, `CityPickerField`, `SiteSelect`, test adımı, mekan tercihi, numara engelleme |
| A3 | Şifremi unuttum / Yeni şifre | ilgili sayfalar | |
| D1 | Kanka daveti | `app/kanka/[token]/page.tsx` | |
| O1 | Global katmanlar | `SosOpenReport`, `WinbackScreen`, `ProblemReportModal`, yaptırım modalı | |

## Target Mobile Architecture

- `apps/mobile` içinde expo-router; kök yerleşim: Auth yığını + 5 sekmeli Tab navigator; her sekmenin kendi Stack'i `[inferred]`. Klasör yapısı S-02 kararına bağlı.
- Tek tema dosyası (T1–T8 değerleri); ekranlar yalnızca bu dosyayı kullanır `[from-claude-md]`.
- API istemcisi: `lib/api.ts` davranışının Bearer token'lı karşılığı (A2) — saklama yeri S-20.
- Paylaşılan mantık: A8'deki saf fonksiyonlar; nereye taşınacağı (packages/shared mı, kopya mı) S-05.

## API Needs

| Uç nokta | Kullanan ekran | Not |
|---|---|---|
| `/auth/login`, `/auth/register`, `/auth/register/send-otp`, `/auth/register/verify-otp`, `send-login-otp`/OTP doğrulama, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/cities`, `/auth/districts`, `/auth/forgot-password`, `/auth/reset-password` | A1–A3, tümü | Origin başlıksız istekte token gövdede döner (A2) |
| `/meetings/dashboard`, `/meetings/live/overview`, `/meetings/live/pulse`, `/kanka/me` | M1, M2 | 15 s / 60 s yoklama (web) |
| `/meetings/my-history`, `/meetings/:id/participants-preview`, `/meetings/:id/info`, `/meetings/:id/review`, `/meetings/:id/no-show`, `/meetings/:id/on-my-way` | M2, M2b, M2c | |
| `/chat/:meetingId/messages` (GET/POST), `/chat/messages/:id/report` | M2 | 8 s yoklama (web) |
| `/sos/:meetingId/report`, `/sos/:meetingId/participant-location`, `/sos/meetings/:id/my-report` | M2, O1 | Konum |
| `/kanka/invite`, `/kanka/invites/:id/accept|decline`, `/kanka/unlink` | M2a | |
| `/payment/plans`, `/payment/subscriptions`, `/payment/discount-info`, `/payment/init`, `/payment/refund-request`, `/referral/invite`, `/referral/my-stats` | M4, M5 | `/payment/init` platform alanı: web `WEB` gönderiyor; iOS değeri S-13 |
| `/test/questions`, `/test/submit`, `/test/result` | A2, M5a–c | |
| `/kyc/status`, KYC yükleme (multipart: idFront, idBack, liveness) | M5e | |
| `/contact-blocks` (GET), `/contact-blocks/sync`, `/contact-blocks/:id` (DELETE) | M5d, A2 | |
| `/users/venue-preference` ve Profilim güncelleme uçları | M5 | |
| `/notifications/token`, `/notifications`, `/notifications/:id/read`, `/notifications/read-all` | M3 | Backend'de var, webde ekran yok |

## Reusable Code

Bkz. A8 (saf mantık), `packages/shared`, `lib/planCards.ts`, `components/live/levels.ts`, `components/live/types.ts` tipleri, metinler (TR) birebir.

## Rewrite-Required Code

- `packages/ui` görsel bileşenlerinin tamamı (DOM/SVG/framer-motion → RN + react-native-svg + RN animasyon kütüphanesi) `[inferred]`.
- `globals.css` sınıfları → tema dosyası + RN stilleri.
- `backdrop-filter: blur` (btn-primary, glass-card, input-glass, Navbar, Sheet) → bulanıklık bileşeni gerekir `[inferred]`.
- CSS gradyanları (`linear/radial/conic`) → gradyan bileşeni gerekir `[inferred]`.
- `PersonalityAura` (canvas) → yeniden yazım.
- iyzico DOM enjeksiyonu → S-13.
- Paket seçimi/kurulumu bu aşamada yapılmadı; kütüphane seçimleri onaydan sonra.

## Native Feature Gaps

| Web sinyali | Mobil ihtiyaç | Önerilen Expo API | Durum |
|---|---|---|---|
| getUserMedia + MediaRecorder (KYC canlılık) | Ön kamera video kaydı | expo-camera `[inferred]` | Onay bekliyor |
| file input capture (KYC kimlik) | Arka kamera fotoğraf | expo-camera / expo-image-picker `[inferred]` | Onay bekliyor; seçim S-12 |
| IndexedDB (KYC taslak) | Yerel dosya saklama | expo-file-system `[inferred]` | Onay bekliyor |
| navigator.geolocation (SOS) | Ön plan konumu | expo-location `[inferred]` | Onay bekliyor |
| navigator.clipboard | Pano | expo-clipboard `[inferred]` | Onay bekliyor |
| localStorage | Anahtar-değer | AsyncStorage `[inferred]` | Onay bekliyor |
| visibilitychange/focus/online | Uygulama durumu, ağ durumu | AppState + NetInfo `[inferred]` | Onay bekliyor |
| — (CLAUDE.md: FCM push) | Push token → `/notifications/token` | expo-notifications / FCM `[inferred]` | S-14 |
| — (CLAUDE.md: mobil Contacts API) | Rehber okuma | expo-contacts `[inferred]` | S-12 |
| iyzico checkout | Ödeme | — | S-13 |
| next/font Google fontları | Font yükleme | expo-font `[inferred]` | Onay bekliyor |

## HIG — Yalnızca iPhone'a Özgü Noktalar

Kaynak: `.claude/skills/hig-foundations`, `hig-components-layout` (`references/tab-bars.md`), `hig-inputs`, `hig-components-controls` (`virtual-keyboards.md`), `hig-components-status`. Web görünümü değiştirilmez.

| Konu | Uygulanacak yer | Not |
|---|---|---|
| Güvenli alan (çentik / Dynamic Island / ana ekran çubuğu) | Tüm ekranlar; alt sekme çubuğu ana ekran çubuğunun üstünde; global SOS kartı (`SosOpenReport`, web `bottom:16`) ve CookieBanner benzeri alt katmanlar; Lightbox kapat düğmesi (web `top:16`); Sheet alt boşluğu (web 36) | HIG: "No interactive content behind the status bar"; web ölçüleri güvenli alana eklenir mi → S-23 |
| 44×44 pt dokunma alanı | Webde 44'ün altında kalan dokunmatik öğeler: OTP kutuları 40×50 (`TabProfilim`), Lightbox noktaları 8×8, Lightbox kapat 36×36, "Şikayet et" 10px metin, `btn-primary` (9px dikey dolgu + 11px yazı ≈ 30 pt), ▾ geçmiş açma (padding 6), KankaSection kopyala (padding 2), sohbet Gönder, Profilim "Düzenle" (px-3 py-1), Navbar avatar 36 | Görünür boyut aynı kalır; yalnızca dokunma alanı (hitSlop) büyür `[inferred]` — onay S-24 |
| Klavye | Telefon (+90 5XX…): sayısal klavye (`type=tel`/`inputMode=numeric` webde var); OTP: tek seferlik kod otomatik doldurma; e-posta: e-posta klavyesi; şifre: güvenli giriş; sohbet girişi ve Değerlendir yorumu klavye açılınca görünür kalmalı; formlarda klavye kapatma | |
| Geri kaydırma (soldan kenar) | Tüm Stack ekranları (Değerlendir, Kişilik Testim, Test, Sonuç, Numara Engelleme, Kimlik Doğrulama, Kanka daveti) | Test ortasında / KYC kaydı sırasında geri kaydırma davranışı S-25 |
| Durum çubuğu | Tüm ekranlar koyu zeminli (`#0a0a0a` / `#121212`) → açık içerikli durum çubuğu | Web tamamen koyu tema; açık tema yok |
| Sekme çubuğu | 5 sekme (HIG: 3–5 uygun), etiketli, gizlenmez/devre dışı bırakılmaz | Sekme renkleri/ikonları S-08, S-09, S-26 |

## Unknowns And Blockers

- Tüm **SORU** maddeleri (aşağıda) çözülmeden kod adımları başlamaz.
- Engel olmayan ilk adım: S-02 ve S-03 yanıtlandıktan sonra tema dosyası.

## Implementation Checklist (onaydan sonra; şu an hiçbiri başlamadı)

- [ ] S-02/S-03 yanıtı → tema dosyası (T1–T8) — `apps/web/app/globals.css`, `packages/config/tailwind`, `packages/ui/src/theme.ts` → `<S-03 yolu>` — her değer kaynak satırıyla eşleşir — `tsc --noEmit` — `[from-code]`
- [ ] Expo proje iskeleti (`apps/mobile`) — S-02 kararına göre — `expo start` açılır — `[inferred]`
- [ ] API istemcisi + oturum — `apps/web/lib/api.ts` → mobil karşılığı — giriş sonrası `/auth/me` 200 — S-20 — `[from-code]`
- [ ] Auth yığını A1–A3 — `app/giris`, `app/kayit`, `app/sifremi-*` → ilgili ekranlar — web ekranıyla tek tek karşılaştırma — `[from-code]`
- [ ] Sekme çubuğu + Profilim ikonu — `DetayAvatar.tsx` → sekme ikonu — S-08…S-11, S-26 — `[from-user]`
- [ ] M1 Eşleşme Paneli — `app/dashboard`, `components/live/*` — `[from-code]`
- [ ] M2/M2a/M2b/M2c Masalarım — `TabMasalar.tsx`, `KankaSection.tsx`, `MasaDetayKarti.tsx`, `degerlendirme` — S-06 — `[from-code]`
- [ ] M4 Paketim — `TabPaket.tsx` — S-13 engelli — `[from-code]`
- [ ] M5…M5e Profilim ve alt ekranlar — S-07, S-12 — `[from-code]`
- [ ] M3 Bildirimler — S-14 engelli — `[from-user]`
- [ ] Global katmanlar O1 — `[from-code]`

## Test Plan

- T-01 `tsc --noEmit` (apps/mobile). T-02 lint. T-03 Expo iOS simülatörde açılış. T-04 her ekran için web mobil görünümüyle yan yana görsel karşılaştırma (insan). Bu aşamada çalıştırılmadı.

## Acceptance Criteria

- Her mobil ekran, karşılığı olan web ekranıyla renk, yazı tipi, boyut, boşluk, köşe, gölge ve düzen bakımından aynı; tüm değerler tek tema dosyasından.
- HIG yalnızca yukarıdaki iPhone'a özgü noktalarda uygulanmış.
- SORU maddeleri kullanıcı yanıtıyla kapanmış.

## Human Sign-Off Required

Gerçek cihazda piksel doğruluğu, animasyon hissi, bulanıklık/gradyan görünümü, güvenli alan, kamera/konum izin akışları, ödeme.

---

## SORU

Aşağıdakiler için karar verilmedi; yanıt bekleniyor.

**Kapsam**
- **S-01** Admin paneli (`app/admin/*`) ve mekân paneli (`app/mekan/*`) mobil uygulamaya girecek mi?
- **S-02** `apps/mobile` şu an yalnızca `package.json` + `node_modules` içeriyor (Expo ~58.0.23, expo-router ~58.0.30, expo-status-bar ~58.0.4, react 19.3.1, react-native 0.88.1, @ahenk/shared). Bu klasör üzerine mi kurulacak, sıfırdan mı oluşturulacak, sürümler korunacak mı?
- **S-03** Tek tema dosyasının yolu ve adı ne olacak (ör. `apps/mobile/theme.ts` veya `packages/...`)?
- **S-04** Webde iki çelişen renk kaynağı var: Tailwind `bg #121212 / surface #222222` ve `packages/ui/src/theme.ts` `bg #0a0a0a / surface #141414`. Webde ikisi de farklı ekranlarda kullanılıyor (Profil `bg-bg` #121212 içinde `.live-layer` #0a0a0a; Dashboard #0a0a0a). Tema dosyasına ikisi de ayrı adlarla mı girecek, her mobil ekran webdeki karşılığının değerini mi alacak?
- **S-05** Saf mantık fonksiyonları (`gColor`, `buildInitials`, `isTableLocked`, `getNextTarget`, `useMasaTabs` hesapları, `planCards`) `packages/shared`'a mı taşınacak, mobilde kopya mı olacak? (Web koduna dokunmayı gerektirebilir.)

**Sekmeler**
- **S-06** Kankam: webde yalnızca Profilim → Hesap Bilgileri içinde. Mobilde Masalarım'a taşınınca Profilim'den kaldırılacak mı, iki yerde de mi olacak? Masalarım içinde hangi sırada (aktif masa kartından önce/sonra, Geçmiş Masalarım'a göre)?
- **S-07** Profilim içinde Kişilik Testim, Numara Engelleme, Kimlik Doğrulama nasıl yerleşecek (Profilim ekranında satır/düğme ile ayrı ekrana geçiş mi, Profilim içinde üst sekme mi, kart olarak mı)? Webde bu yerleşimin karşılığı yok (webde yatay AccountTabBar sekmeleri).
- **S-07b** Webde KYC onaylanınca "Kimlik Doğrulama" sekmesi gizleniyor (`AccountTabBar.tsx:17`). Mobilde Profilim içindeki giriş de gizlenecek mi?

**Profilim sekme ikonu**
- **S-08** Esas alınacak rozet: Masa detay kartındaki KATILIMCILAR `DetayAvatar` (48px, 2.5 kenar, 11px yazı) mı, aynı karttaki sohbet `ChatBadge` (28px, 1.5 kenar, 8.5px yazı, "baş harf rozetinin küçük hali") mı?
- **S-09** Sekme ikonunun pt boyutu ne olacak? (DetayAvatar 48 tabanlı; oranlar korunarak ölçeklenecek.) Webde sekme ikonu boyutu yok.
- **S-10** DetayAvatar animasyonları (giriş ölçeği, halka çizimi, 2.6 s nabız/parlama) ikonda olacak mı?
- **S-11** Sekme seçili/seçili değil durumunda ikon nasıl görünecek (değişmeyecek mi, opaklık/renk değişimi mi)? Cinsiyet bilgisi yoksa (`gColor(null)` → `#4fc3f7` mavi) bu varsayılan kullanılacak mı?
- **S-26** Diğer 4 sekmenin (Eşleşme Paneli, Masalarım, Bildirimler, Paketim) ikonları ne olacak? Webde karşılığı yok. Sekme çubuğu zemin/etiket/seçili renkleri ne olacak (web AccountTabBar seçili değerleri `rgba(192,57,43,0.18)` / `#ff6b6b` / `#666` kullanılsın mı)? Bildirimler sekmesinde okunmamış sayısı rozeti olacak mı?

**Native özellikler**
- **S-12** Numara Engelleme: webde yalnızca manuel giriş var; CLAUDE.md mobilde "native Contacts API ile rehber senkronizasyonu" diyor. Mobilde rehberden seçme eklenecek mi? Eklenecekse webde karşılığı olmayan bu ekranın tasarımı ne olacak? KYC kimlik fotoğrafında galeriden seçme olacak mı (web yalnızca kamera, `capture="environment"`)?
- **S-13** Ödeme: web iyzico Checkout Form'u sayfaya gömüyor (`lib/checkout.ts`, `platform: 'WEB'`). CLAUDE.md: iOS → StoreKit 2 stub ("henüz aktif değil"), App Store komisyonu %30; `PlanPrice.tsx` yorumu "mobil: + %15 mağaza komisyonu" ve `mobileTL` alanı var. iOS'ta paket satın alma nasıl olacak (stub mesajı mı, iyzico web görünümü mü), hangi fiyat (`webTL` / `mobileTL`) gösterilecek, `platform` değeri ne gönderilecek? `/odeme/basarili|basarisiz` ekranları mobilde olacak mı?
- **S-14** Bildirimler sekmesi webde yok. Backend uçları: `GET /notifications` (sayfalı), `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `POST /notifications/token`. CLAUDE.md olayları: KYC_APPROVED, KYC_REJECTED, MEETING_CONFIRMED, SUBSCRIPTION_EXPIRING, MEETING_PARTICIPANT_LEFT. Ekranda ne gösterilecek: liste satır içeriği (başlık/metin/tarih), okundu/okunmadı görünümü, "tümünü okundu işaretle" düğmesi, boş durum metni, satıra dokununca gidilecek yer, sayfalama, push izni isteme zamanı ve yeri, tasarım değerleri (webde karşılığı olmadığı için hangi web bileşeni örnek alınacak)?

**Webde olup mobil kapsamı belirsiz**
- **S-15** Tanıtım sayfası (`/`), Hikayemiz, Kariyer, İş Ortaklığı, Janti Haydar, Site Haritası mobilde olacak mı?
- **S-16** Yasal sayfalar (KVKK, Gizlilik, Kullanım Koşulları, Çerez, Mesafeli Satış, Topluluk Kuralları) mobilde nerede ve nasıl gösterilecek (uygulama içi ekran / tarayıcıda açma / hiç)?
- **S-17** Webdeki üst Navbar (52px: logo + AHENK + avatar + hamburger menü) ve SiteFooter mobilde olacak mı? Hamburger menü öğeleri (Nasıl Çalışır?, Buluşmalar, Test, Hikayemiz, Giriş/Kayıt) nereye gidecek?
- **S-18** CookieBanner ve Analytics (GA/Pixel) mobilde olacak mı?
- **S-19** `/profil/gecmis` (AhenkHistory) sayfasına uygulama içinden bağlantı bulunamadı; Masalarım'daki Geçmiş Masalarım ile aynı amaç. Mobile alınacak mı? Ayrıca `TabProfilim.tsx:72` `PoolScreen` tanımlı ama kullanılmıyor; mobilde yok sayılacak mı?

**Oturum, bağlantı, davranış**
- **S-20** Mobil oturum: backend Origin başlığı olmayan istekte token'ı gövdede döndürüyor ve Bearer kabul ediyor. Token nerede saklanacak (ör. güvenli depo) ve yenileme akışı web ile aynı mı olacak? Backend'de değişiklik gerekmeyecek şekilde mi?
- **S-21** `/kanka/[token]` davet linki ve iyzico dönüşü gibi bağlantılar uygulamayı açacak mı (Universal Links / özel şema)? Domain (`ahenk.co` / `ahenk.tr`) hangisi?
- **S-22** Açılış ekranı (splash) ve uygulama ikonu: web `apple-touch-icon.png` / `icon-512.png` / `logo.webp` mi kullanılacak? Webde splash karşılığı yok.
- **S-23** Web ölçüleri (ör. SOS kartı `bottom:16`, Sheet alt dolgu 36, Lightbox `top:16`) güvenli alan boşluğunun üstüne mi eklenecek, güvenli alanla mı değiştirilecek?
- **S-24** 44×44 pt için görünür boyutu değiştirmeden yalnızca dokunma alanını büyütme yaklaşımı onaylanıyor mu? (HIG listesindeki öğeler.)
- **S-25** Test sırasında ve KYC video kaydı sırasında soldan geri kaydırma serbest mi olacak, uyarı mı gösterilecek, kapalı mı olacak? Webde karşılığı yok (tarayıcı geri tuşu).
- **S-27** SOS sırasında katılımcı konumu webde yalnızca sayfa açıkken ve izin önceden verilmişse 30 sn'de bir gönderiliyor. Mobilde de yalnızca uygulama ön plandayken mi olacak? Konum izni ne zaman istenecek?
- **S-28** HARİTADA GÖR webde `maps.google.com` linki açıyor. iPhone'da aynı link mi açılacak (tarayıcı/Google Maps), Apple Haritalar mı?
- **S-29** Web `prefers-reduced-motion` ile animasyonları kapatıyor. Mobilde iOS "Hareketi Azalt" ayarına aynı şekilde bağlanacak mı?

## 2. Aşama Kararları (2026-11-08, kullanıcı onayı) `[from-user]`

- S-01: Admin paneli ve mekân paneli mobile girer (web mobil görünümünün aynısı). Admin girişi: Profilim en üstünde "Yönetim Paneli" bağlantısı, yalnız ADMIN/SUPERADMIN. Mekân hesabı yalnız mekân panelini görür, üye alt menüsünü görmez.
- S-02: `apps/mobile` üzerine kurulur, mevcut sürümler korunur. S-03: tema `apps/mobile/theme/theme.ts`. S-04: iki renk kaynağı ayrı adlarla; her ekran web karşılığının değerini alır.
- S-05: web dosyaları değişmez; `gColor`, `buildInitials`, `isTableLocked`, `getNextTarget`, `useMasaTabs` hesapları, `planCards` aynı mantıkla `apps/mobile/lib` altına kopyalanır.
- S-06: Kankam webdeki gibi Profilim'de kalır; Masalarım webdeki içerikle aynı. S-07: Profilim içi yerleşim web ile aynı (üstte AccountTabBar biçiminde alt sekmeler: Profilim, Kişilik Testim, Numara Engelleme, Kimlik Doğrulama). S-07b: KYC onaylıysa Kimlik Doğrulama gizlenir.
- S-08: DetayAvatar esas. S-09: sekme ikonu 28 pt, oranlar DetayAvatar'dan (kenar 2.5/48, yazı 11/48, zemin r 23/48, halka r 21.5/48). S-10: animasyon yok. S-11: seçili değilken soluk; cinsiyet yoksa `#4fc3f7`.
- S-12: Numara Engelleme'de rehberden seçme (expo-contacts), liste web liste stilinde. KYC fotoğrafı yalnız kamera.
- S-13: iOS Apple IAP, Android Google Play Billing (expo-iap); mobil fiyat (`mobileTL`); `/payment/init` platform `IOS` / `ANDROID` (PaymentPlatform enum). Ödeme sonucu ekranları var. Backend `.env`: `PLATFORM_FEE_APPLE=0.15`, `PLATFORM_FEE_GOOGLE=0.15`. Apple/Google makbuz doğrulama ucu ve ürün kimlikleri yazılmaz, raporlanır.
- S-14: Bildirimler satırı Canlı Akış kart stilinde (olay başlığı + zaman), okunmamışta kırmızı nokta, "Tümünü okundu işaretle", boş durum "Henüz bildirimin yok", 20'şer sayfalama. Dokununca: KYC_APPROVED/KYC_REJECTED → Profilim (Kimlik Doğrulama), MEETING_CONFIRMED/MEETING_PARTICIPANT_LEFT → Masalarım, SUBSCRIPTION_EXPIRING → Paketim. Push token alma Firebase dosyaları gelene kadar raporlanır. Webe eklenmez.
- S-15: tanıtım/kurumsal sayfalar yok. S-16: yasal sayfalar uygulama içi tarayıcıda (expo-web-browser). S-17: Navbar/Footer yok, çıkış Profilim'de. S-18: CookieBanner/Analytics yok. S-19: `/profil/gecmis`, PoolScreen yok.
- S-20: üye token'ları expo-secure-store; yenileme webdeki gibi (401 → `/auth/refresh`, Origin'siz istemci gövdede `refreshToken` gönderir). Üye istekleri `credentials: 'omit'` + `Authorization: Bearer`.
- S-21: Universal Links (ahenk.co); AASA/assetlinks dosyaları webe eklenmez, Team ID/uygulama kimliği raporlanır.
- S-22: açılış 3 sn, siyah zemin, `assets/start_logo.jpg` dikey eksende dönerek; altında "Ahenk bir Traders.TR 🇹🇷 ticari markasıdır." (Traders `#e8e8e8` 700, .TR `#4a90d9` 800, footer stili). Uygulama ikonu aynı logo.
- S-23: web kenar boşlukları güvenli alanın üstüne eklenir. S-24: görünür boyut aynı, dokunma alanı 44×44 pt (hitSlop).
- S-25: test ekranında geri kaydırmada uyarı; KYC video kaydında geri kaydırma kapalı.
- S-26: sekme ikonları ince çizgi; sekme çubuğu renkleri AccountTabBar (seçili `#ff6b6b`, seçili değil `#666`, zemin `#0a0a0a`, üst kenar `rgba(255,255,255,0.12)`); Bildirimler'de okunmamış sayı rozeti.
- S-27: konum izni ilk masa onaylandığında; SOS sırasında konum arka planda da gönderilir (expo-location + expo-task-manager).
- S-28: HARİTADA GÖR → Apple Haritalar / Google Maps seçim menüsü. S-29: animasyonlar iOS Hareketi Azalt'a bağlı.
- Giriş ekranı: "Üye Girişi" (web girişinin aynısı) ve "İşletme Girişi" (varsayılan WhatsApp kodu, ikinci seçenek e-posta+şifre).
- Backend (izinli tek değişiklik): `POST /venue-panel/send-login-otp`, `POST /venue-panel/verify-login-otp` (üye OTP yapısı; telefon tek mekân hesabına bağlıysa kod gider). Mekân oturumu çerezle (RN çerez desteği, `credentials: 'include'`); CSRF kontrolü için mekân isteklerine `Origin: https://ahenk.co` başlığı eklenir. `venue-auth.guard.ts` değişmez.

## Ekran → API / Veri Tipi / Auth

| Mobil ekran | API uçları | Veri tipleri (web kaynağı) | Auth |
|---|---|---|---|
| Açılış | — | — | — |
| Giriş seçimi | — | — | — |
| Üye Girişi | `POST /auth/send-login-otp`, `POST /auth/verify-login-otp`, `POST /auth/login`, `GET /auth/me` | `SanctionPayload` (`app/giris/page.tsx`) | yok → yanıt gövdesindeki `accessToken`/`refreshToken` secure-store'a |
| İşletme Girişi | `POST /venue-panel/send-login-otp`, `POST /venue-panel/verify-login-otp`, `POST /venue-panel/login` | — | mekân çerezi |
| Kayıt | `POST /auth/register/send-otp`, `POST /auth/register/verify-otp`, `GET /auth/cities`, `GET /auth/districts`, `POST /auth/register`, `GET /test/questions`, `POST /test/submit`, `PATCH /users/venue-preference`, `POST /contact-blocks/sync` | `FormState`, `QuestionsResponse` (`app/kayit/page.tsx`) | kayıttan sonra Bearer |
| Şifremi unuttum / Yeni şifre | `POST /auth/forgot-password`, `POST /auth/reset-password` | — | yok |
| Eşleşme Paneli | `GET /auth/me`, `GET /payment/subscriptions`, `GET /kyc/status`, `GET /kanka/me`, `GET /meetings/dashboard`, `GET /meetings/live/overview`, `GET /meetings/live/pulse` | `MeData`, `OwnSub` (`useMasaTabs.ts`), `DashboardItem` (`MasalarDashboard.tsx`), `LiveOverview`, `LivePulse` (`live/types.ts`) | Bearer |
| Masalarım | yukarıdakiler + `GET /meetings/my-history`, `GET/POST /chat/:id/messages`, `POST /chat/messages/:id/report`, `POST /meetings/:id/on-my-way`, `GET/POST /meetings/:id/no-show`, `POST /meetings/:id/cancel-registration` {note}, `POST /sos/:id/report`, `POST /sos/:id/participant-location`, `GET /sos/meetings/:id/my-report` | `HistoryMeeting` (`TabMasalar.tsx`), `MasaDetayData`, `ChatMsg`, `NoShowMarking` (`MasaDetayKarti.tsx`) | Bearer |
| Değerlendir | `GET /meetings/:id/participants-preview`, `GET /meetings/:id/info`, `POST /meetings/:id/review` | `Participant`, `MeetingInfo` (`degerlendirme/[meetingId]/page.tsx`) | Bearer |
| Bildirimler | `GET /notifications?page=&limit=20`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | backend `Notification {id,type,title,body,read,createdAt}` | Bearer |
| Paketim | `GET /payment/plans`, `GET /payment/subscriptions`, `GET /payment/discount-info`, `GET /auth/me`, `GET /referral/my-stats`, `POST /referral/invite`, `POST /payment/refund-request`, `POST /payment/init` (platform IOS/ANDROID) | `Subscription`, `RefundOption`, `DiscountInfo` (`TabPaket.tsx`), `PlanPriceInfo` (`PlanPrice.tsx`), `KankamlaState` (`planCards.ts`) | Bearer |
| Ödeme sonucu | — | — | — |
| Profilim | `GET /auth/me`, `GET /auth/cities`, `POST /auth/logout-all`, `POST /users/me/deletion-request`, `POST /users/change-phone/request|verify`, `PATCH /users/change-email`, `POST /users/cities`, `PATCH /users/active-city`, `PATCH /users/venue-preference`, `POST /referral/invite`, `GET /kanka/me`, `POST /kanka/invite`, `POST /kanka/invites/:id/accept|decline`, `POST /kanka/unlink`, `POST /auth/logout` | `UserData` (`profil/page.tsx`), `KankaState` (`KankaSection.tsx`) | Bearer |
| Kişilik Testim / Test / Sonuç | `GET /test/result`, `GET /test/questions`, `POST /test/submit` | `TestResult` (`TabTest.tsx`) | Bearer |
| Numara Engelleme | `GET /contact-blocks`, `POST /contact-blocks/sync`, `DELETE /contact-blocks/:id` | `ServerBlock` (`TabRehber.tsx`) | Bearer |
| Kimlik Doğrulama | `GET /kyc/status`, `POST /kyc/upload` (multipart idFront, idBack, liveness) | `KycStatus` (`TabKyc.tsx`) | Bearer |
| Mekân paneli | `GET /venue-panel/me`, `PATCH /venue-panel/info`, `POST/DELETE /venue-panel/photos`, `GET /venue-panel/meetings`, `POST /venue-panel/change-password`, `POST /venue-panel/deactivate`, `POST /venue-panel/logout` | `VenueMe` (`lib/venueApi.ts`) | mekân çerezi |
| Admin paneli | `/admin/*` (web `app/admin/*`) | web admin tipleri | Bearer (ADMIN/SUPERADMIN) |

## Approval

2026-11-08: Kullanıcı 1. aşama anlayışını ve yukarıdaki kararları onayladı; uygulama başladı (sıra: üye → mekân → admin).


## 2. Aşama Uygulama Durumu (2026-11-08)

- [x] Tema `apps/mobile/theme/theme.ts`, mantık kopyaları `apps/mobile/lib/*` — `npx tsc --noEmit` çıkış 0
- [x] Açılış, Giriş (Üye/İşletme), Kayıt, Şifre sıfırlama, 5 sekme, Değerlendir, Test, Test sonucu, Ödeme sonucu, Kanka daveti — `npx expo export --platform ios|android` başarılı (3.6 MB hbc)
- [x] Mekân paneli (Bilgiler, Masalar, Abonelik, Hesap, Şifremi unuttum)
- [x] Backend: `POST /venue-panel/send-login-otp`, `POST /venue-panel/verify-login-otp`; `.env` PLATFORM_FEE_APPLE/GOOGLE=0.15 — build + ahenk-api restart, rotalar loglarda
- [ ] Admin paneli (web `app/admin/*`) ve Profilim "Yönetim Paneli" bağlantısı — yapılmadı (oturumda bitmedi)
- [ ] Apple/Google makbuz doğrulama ucu, mağaza ürün kimlikleri — raporlandı
- [ ] Push token alma (Firebase dosyaları yok) — raporlandı
- [ ] Universal Links AASA/assetlinks + Team ID/uygulama kimliği — raporlandı
Sıradaki engelsiz iş: admin paneli ekranları.
