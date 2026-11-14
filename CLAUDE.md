⚠️ ZORUNLU ÇALIŞMA KURALLARI — HER OTURUMDA UYGULANACAK

1. HER İŞLEMDE İZİN ALINACAK.
2. HİÇBİR TALİMATTA YORUM, TAHMİN VE UYDURMA YAPMAK YASAK. TALİMATTA NE YAZIYORSA SADECE O YAPILACAK.
3. BİR TALİMAT VERİLDİĞİNDE ÖNCE ANLADIĞINI LİSTELEYECEKSİN, KULLANICI ONAYLARSA İŞLEME BAŞLAYACAKSIN.
4. HER İŞLEMDEN SONRA RAPOR VERİLECEK VE BUILD / RESTART / COMMIT / PUSH İÇİN İZİN İSTENECEK.
5. İSTENMEYEN HİÇBİR EKLEMİ, DÜZELTMEYİ VEYA DEĞİŞİKLİĞİ YAPMAYACAKSIN.

---

CLAUDE.md — Ahenk Projesi
Bu dosya Ahenk projesinin tüm mimari kararlarını, kurallarını ve geliştirme standartlarını içerir.
Claude Code her oturumda bu dosyayı okuyarak çalışır. Tahmin yapma, uydurma, eksik bırakma.

⚠️ KESİN KURAL: Bu dosyada yazılı olmayan hiçbir özellik, kural, limit veya davranış ekleme.
Belirtilmemiş her karar için önce kullanıcıya sor.

1. PROJE KİMLİĞİ
Proje adı: Ahenk
Domain: ahenk.tr (henüz onay bekliyor — şimdilik localhost, .env'den yönetilecek)
Konsept: Türkiye odaklı haftalık algoritmik sosyal buluşma platformu. Yabancılarla OCEAN (Big Five) kişilik testine dayalı eşleştirme ile grup ve başbaşa buluşmalar.
Dil: Tamamen Türkçe (arayüz, bildirimler, metinler)
Hedef kitle: Türkiye'deki 20-50 yaş arası sosyal bağlantı arayan bireyler

2. MİMARİ — MONOREPO YAPISI
ahenk/
├── apps/
│   ├── web/          → Next.js 14 (App Router) — web sitesi + kullanıcı paneli
│   ├── admin/        → Next.js 14 — admin paneli (ayrı port, ayrı auth)
│   └── mobile/       → React Native (Expo) — iOS + Android
├── packages/
│   ├── shared/       → Ortak tipler, API client, utility fonksiyonlar
│   ├── ui/           → Ortak UI component'ları (web + mobile paylaşımlı)
│   └── config/       → ESLint, TypeScript, Tailwind config
└── backend/          → NestJS + Prisma + PostgreSQL

3. KULLANICI AKIŞI
Kayıt → WhatsApp OTP → OCEAN Testi → Dashboard  (KYC YOK)
                                          ↓
                               Paket / Prime almak isterse → ödeme (KYC istenmez)
                                          ↓
                               Ödeme sonrası serbestçe gezer; KYC onaysızsa her sayfanın üstünde KYC kartı → yükle → admin onay
                                          ↓
                               KYC onaylanınca buluşma taramalarına girebilir (haftalık seçim)

TEST KURALLARI:
- Test oturum gerektirmez (GET /test/questions herkese açık)
- Cevaplar tek seferde gönderilir (POST /test/submit — 19 cevap zorunlu)
- OCEAN skoru: her boyut 0-100 ((ortalama-1)/4*100), ters sorularda 6-score
- Paket satın alma öncesi test tamamlanmış olmalı (TestCompletedGuard)
- Yeniden test: 180 gün sonra
- Admin test kilidini açabilir: PATCH /test/admin/:userId/reset-lock → adminCanReset: true
- Kullanıcı testi tamamlayınca adminCanReset otomatik false'a döner
- Test sonucu profilde kısa açıklama olarak görünür

EŞLEŞTİRME ALGORİTMASI (Modül 7):
- Tetikleme: Her Perşembe 23:59, Bull queue ile
- Eşleştirme puanı: OCEAN 65 + aynı meslek sektörü 35, başka faktör yok
- OCEAN benzerliği: Öklid mesafesi, normalize 0-65
- Meslek: iki kişi aynı meslek sektöründeyse +35, değilse 0
- Cinsiyet dengesi: 6 kişi → 3E+3K, 4 kişi → 2E+2K
- Cinsiyet değerleri: yalnızca MALE ve FEMALE
- Masa 5 kişi kalırsa: bot ile 6'ya tamamla; bot yoksa 4'e düşür, 5. kişi sonraki haftaya
- Bot sistemi: seed'de isBot:true olan User kayıtları, admin panelinden aktif/pasif ve isim düzenleme
- Bot OceanScore: seed'de manuel atanır (50/50/50/50/50 varsayılan), test doldurmaları gerekmez
- Bot isimleri admin panelinden güncellenebilir (ad/soyad); diğer alanlar admin yetkisi dışında
- Kayıt kapanış saati: Cumartesi 10:00 — 4 kişi yoksa 12 saat uzatılır (22:00'ye)
- 4. kişi kabul edince uzatma iptal, masa kesinleşir
- 5. kişi sıradaki haftaya: MatchingWaitlist tablosunda saklanır, sonraki koşuda öncelikli

KYC KURALLARI:
- Kayıt, giriş, OCEAN testi ve paket satın alma KYC gerektirmez (POST /payment/init üzerinde KycGuard yok)
- Ödeme sonrası zorunlu KYC yönlendirmesi yoktur; kullanıcı uygulamada ve sitede serbestçe gezer
- KYC onaylanmamış kullanıcıda mobil uygulamanın tüm sekmelerinin ve web kullanıcı paneli sayfalarının en üstünde kart:
  "Kullanıcı güvenliği sebebiyle masaya katılım için lütfen kimliğinizi doğrulayın." Basınca KYC ekranı açılır, onaylanınca kaybolur
- KYC kartının gösterildiği ekranlarda eski "Kimliğimi Doğrula" / "Doğrula" uyarıları yoktur (Eşleşme Paneli, Masalarım; web + mobil)
- KYC onaylanmadan kullanıcı hiçbir buluşma taramasına giremez (havuz sorgularında kyc APPROVED şartı)
- Admin KYC onayında T.C. no girilmez, karşılaştırılmaz; UserIdentity tablosu kaldırıldı
- KYC onaylıysa kullanıcı profilinde isKycVerified: true → "Doğrulanmış ✓" rozeti
- Durum: PENDING / APPROVED / REJECTED / SUSPICIOUS
- REJECTED veya SUSPICIOUS → rejectReason yazılır, kullanıcı yeniden başvurabilir. İade yoktur
- T.C. NO: web'de "Paket Al" / "Abone Ol" sonrası açılan ödeme ekranında "T.C. No:" alanı zorunlu (11 haneli rakam);
  altında not: "Ödeme altyapı hizmet sağlayıcı İyzico tarafından, mevzuat gereği satın alımlarda artık T.C.K.N. zorunludur."
  Numara yalnız iyzico'ya gönderilir, veritabanına kaydedilmez, her web ödemesinde yeniden sorulur. Mobil uygulama içi satın almada T.C. alanı yok
- Dosyalar Cloudflare R2'de private, sadece imzalı URL ile admin görür

ÖDEME SİSTEMİ (Modül 8):
Tek seferlik paketler (kodlar korunur; haklar kullanılana kadar geçerli, döngü / süre sınırı yok):
  - MASADA   → "Grup":     1 grup buluşması hakkı, ham 299 TL
  - KARSIMDA → "Başbaşa":  1 başbaşa buluşması hakkı, ham 399 TL
  - KANKAMLA → "Kankamla": 1 kankamla buluşması hakkı, ham 499 TL (alıcı öder, aynı cinsiyetteki kankası ücretsiz katılır)
  - ICERDE   → "İçerde":   1 grup + 1 başbaşa buluşması hakkı, ham 599 TL
Prime abonelik (PRIME_1M / PRIME_3M / PRIME_6M / PRIME_12M): ham 899 / 2299 / 3899 / 6499 TL
  - Satın alındığı anda 1 grup + 1 başbaşa + 1 kankamla hakkı tanımlanır
  - Satın alma tarihinden itibaren her 30 günde haklar sıfırlanır ve yeniden 1 + 1 + 1 olur; kullanılmayan haklar devretmez
  - Dönem başında planın tam tutarı tek seferde çekilir; dönem bitince aynı süreyle otomatik yenilenir
  - Aktif Prime'ı olan ikinci Prime alamaz
  - Aktif Prime'ı olan tek seferlik paket alamaz; istisna: Prime'da hakkı bitmiş tür varsa yalnız o türü içeren tek seferlik paketi alabilir
  - Profildeki paket kutusunda "Aboneliği İptal Et": otomatik yenileme durur, haklar dönem sonuna kadar kullanılır, iade yapılmaz
    · iyzico ile alınan abonelik: web ve mobilde buton sunucu üzerinden doğrudan iptal eder
    · App Store / Play Store ile alınan abonelik: mobilde mağazanın abonelik sayfası açılır; web'de "Aboneliğini mobil uygulama
      üzerinden aldığın için iptal işlemini uygulamadan yapabilirsin." mesajı ve altında mağaza yönlendirmesi: iOS → App Store,
      Android → Play Store, masaüstü → App Store ve Play Store butonları. Bağlantılar apps/web/lib/appLinks.ts (lansmanda doldurulacak).
      Site içinden uygulamayı otomatik açma (Universal Links / App Links) aynı alan adındaki bağlantıda çalışmadığı için kullanılmaz
Fiyatlar ham fiyattır; admin "Fiyatlar" tablosunda (PlanPrice) tutulur. Web = ham × 1,20 (KDV); mobil = ham × 1,20 ÷ 0,85 (mağaza komisyonu %15)
İndirimler: %10 davet indirimi ve paketi / aboneliği olmayana gönderilen 100 TL indirim tüm tek seferlik paketlerde ve tüm Prime
  planlarında geçerli (WINBACK_PLANS ayarında 8 plan); ikisi aynı ödemede birlikte kullanılamaz; Prime'da yalnız satın alma ödemesine
  uygulanır, yenilemeler indirimsiz. Aktif tek seferlik paketi ya da aktif Prime'ı olana 100 TL indirim hiçbir koşulda gösterilmez/uygulanmaz
Mobil indirim teklifleri (IAP_ENABLED ile pasif): tek seferlik paketlerde indirimli ayrı ürünler (<ürün>.davet10, <ürün>.indirim100);
  Prime'da App Store promosyon teklifi (sunucu imzalı) / Google Play abonelik teklifi (teklif kimlikleri davet10, indirim100)
Paket kartı rozetleri: Tinder GOLD tarzı hap, dolgu renkli, kalın, büyük harf; renk kartın tonuyla uyumlu, Prime altın
Paket kartları (Grup, Başbaşa, Kankamla, İçerde, Prime) tek kaynaktan: apps/web/components/paket/PaketKarti.tsx — paket ekranı ve landing
  aynı kartı, açıklamayı ve avantaj listesini kullanır. Landing'de eski görselli paket kartları yoktur; Prime kuralları bölümü durur
Platform:
  - Web → iyzico. Tek seferlik: Checkout Form. Prime: ilk dönem Checkout Form, otomatik yenileme iyzico abonelik API'si
    (IYZICO_SUBSCRIPTION_ENABLED=true olana kadar pasif; planlar lansmanda create-prime-plans ile tanımlanır)
  - iOS → App Store, Android → Play Store uygulama içi satın alma (IAP_ENABLED=true olana kadar pasif)
Akış:
  - GET /payment/plans → herkese açık, paket listesi
  - POST /payment/init → TestCompletedGuard + JWT; web iyzico form, mobil mağaza ürün kimliği döner
  - POST /payment/callback → iyzico callback; başarılıysa /odeme/basarili (Prime'da ?prime=1 → otomatik yenileme formu)
  - POST /payment/store/verify → mobil satın alma doğrulama; store/apple-notification, store/google-notification yenilemeler
  - POST /payment/prime/cancel, /payment/prime/autorenew/init, /payment/prime/autorenew/callback, /payment/prime/iyzico-webhook
  - GET /payment/subscriptions → JWT zorunlu, aktif paketler + türüne göre kalan hak adedi
İADE SİSTEMİ YOKTUR: kullanıcı iade talebi, admin iade ekranları ve iade endpoint'leri kaldırıldı; RefundRequest tablosu silindi.
  Landing ve yasal sayfalarda iade ifadesi yoktur (Mesafeli Satış Sözleşmesi cayma hakkı maddesi hariç); Prime kuralları yazılıdır.
  Yasal sayfalardaki paket tanımları yeni paketlerdir (Grup / Başbaşa / Kankamla / İçerde 1'er hak, kullanılana kadar; Prime 1/3/6/12 ay);
  "2 grup hakkı" ve "4 döngü" ifadeleri yoktur.
  (Para çekilip paket verilemeyen mükerrer ödemenin otomatik iyzico iadesi ve "Ödeme Sonuçlandırma" ekranı duruyor.)

HAFTALIK BULUŞMA SEÇİMİ:
  - Her Pazar 23:59'dan sonra paketi olan kullanıcıya Eşleşme Paneli / Masalarım'da pencere açılır
  - Paketinde kalan türlerden bu hafta hangilerine gireceğini seçer (1, 2 ya da 3 tür); seçim değiştirilemez
  - Sistem kimseyi otomatik taramaya sokmaz; yalnız seçilen türlerin taramasına girilir (WeeklySelection tablosu)
  - Son saatler: Grup Perşembe 18:00, Başbaşa Cuma 18:00, Kankamla Cumartesi 18:00
  - Süresinde seçim yapmayan o türün taramasına girmez, hakkı düşmez
  - Eşleşme alanı: paketi olan kullanıcıda bu hafta seçilmeyen tür "Eşleşme Pasif"; hiç paketi olmayanda "Abonelik Yok"
  - GET /weekly-selection, POST /weekly-selection {types[]} (JWT)

BİLDİRİM SERVİSİ (Modül 9):
Kanallar:
  - FCM (Firebase Cloud Messaging): in-app push — tüm bildirimler
  - WhatsApp Business API: sadece kritik bildirimler (KYC onay/red, masa onayı)
  - IN_APP: her bildirim DB'ye de kaydedilir (Notification tablosu)
Olaylar:
  - KYC_APPROVED: WhatsApp + FCM + DB (kritik)
  - KYC_REJECTED: WhatsApp + FCM + DB (kritik)
  - MEETING_CONFIRMED: WhatsApp + FCM + DB (kritik) — Cumartesi 10:00'da admin onayında tek bildirim
  - SUBSCRIPTION_EXPIRING: FCM + DB — abonelik bitişine 3 gün kala (günlük cron 10:00 TR)
  - MEETING_PARTICIPANT_LEFT: FCM + DB — "1 kişi ayrıldı" bildirimi, kalan katılımcılara
FCM token: User.fcmToken alanında saklanır; POST /notifications/token ile güncellenir
Uç noktalar:
  - POST /notifications/token — FCM token kayıt (JWT)
  - GET /notifications — IN_APP bildirim listesi, sayfalı (JWT)
  - PATCH /notifications/:id/read — okundu işaret (JWT)
  - PATCH /notifications/read-all — tümünü okundu (JWT)
KYC entegrasyonu: adminReview() içinde otomatik tetiklenir

MASA BİLDİRİM AKIŞI:
  Perşembe 23:59 → algoritma çalışır, kullanıcıya HİÇBİR BİLDİRİM GİTMEZ
  Cuma        → admin panelden mekan seçer ve masayı onaylar
  Cumartesi 10:00 → admin onayıyla tek bildirim gider (WhatsApp + FCM + DB)
  Bildirim içeriği: saat + mekan adı + mekan adresi + katılımcı baş harfleri (M.A., A.K. vb.) + cinsiyet
  Örnek: "Bugün saat 20:00, Petra Kahve (Bağdat Cad. No:12) — M.A. (E), A.K. (K), S.T. (E) ile buluşuyorsun"
  MEETING_VENUE_SET eventi KALDIRILDI — mekan bildirimi ayrı gitmez, onay anında tek seferde gider

MASADAN AYRILMA / İPTAL AKIŞI:
  Kullanıcı masadan ayrılırken sebep seçmek zorunda:
    - Mekan uygun değil
    - Zaman değişti
    - Kişisel sebep
    - Diğer → metin kutusu açılır, kullanıcı not yazar
  Seçilen sebep sadece admin paneline düşer; diğer katılımcılara gösterilmez
  Kalan katılımcılara sadece "1 kişi ayrıldı" FCM + DB bildirimi gider (isim verilmez)
  DB: MeetingParticipant tablosuna leaveReason(enum) + leaveNote(text?) alanları eklenir
  LeaveReason enum: VENUE_NOT_SUITABLE, TIME_CHANGED, PERSONAL, OTHER

ADMİN API (Modül 10):
Tüm endpoint'ler ADMIN veya SUPERADMIN guard ile korunur.

Dashboard:
  - GET /admin/dashboard — toplam kullanıcı, KYC bekleyen, bu hafta aktif masa, şehir bazlı dağılım, Öncü sayısı

Kullanıcı yönetimi:
  - GET /admin/users — liste (search, status filtresi, sayfalı)
  - GET /admin/users/:id — detay (profil, KYC, OCEAN, abonelikler, masalar)
  - PATCH /admin/users/:id/status — ACTIVE/SUSPENDED/DELETED (hesap askıya alma)
  - PATCH /admin/users/:id/role — rol değiştir (sadece SUPERADMIN yapabilir)
  - POST /admin/users/:id/pioneer — Öncü rozetini aç/kapat (500 kota kontrolü)
  - POST /admin/users/:id/free-subscription — ücretsiz abonelik ver {plan, expiresAt?}
  - PATCH /admin/users/:id/test-lock-reset — test 180 gün kilidini sıfırla

Öncü kota:
  - GET /admin/pioneer/quota — {max:500, used, remaining, full}
  - Kota dolunca yeni atama ForbiddenException ile engellenir

Bot yönetimi (→ /matching/admin/bots):
  - GET /matching/admin/bots
  - POST /matching/admin/bots — yeni bot {firstName, lastName, openness?, ...}
  - PATCH /matching/admin/bots/:id/name
  - PATCH /matching/admin/bots/:id/status
  - DELETE /matching/admin/bots/:id

Masa yönetimi:
  - GET /admin/meetings — liste (status, şehir, hafta filtresi, sayfalı)
  - GET /admin/meetings/:id — detay + katılımcılar
  - POST /admin/meetings — manuel masa kur {title, scheduledAt, participantIds[], locationText?}
  - PATCH /admin/meetings/:id/venue — mekan/saat güncelle
  - DELETE /admin/meetings/:id — masayı iptal et (CANCELLED)

Mekan yönetimi:
  - GET /admin/venues?cityId= — mekan listesi
  - POST /admin/venues — mekan ekle {name, category(SADE/ORTA/PREMIUM), cityId, address?}
  - PATCH /admin/venues/:id — güncelle (name, description, category, address, isActive)
  - DELETE /admin/venues/:id — mekan sil
  - Mekânda tek kapasite alanı kullanılır (Venue.seatCapacity, "Kapasite"); kontenjan alanı (Venue.capacity) kullanılmaz, DB kolonu duruyor
  - Mekân kapasite kuralı: aynı mekânda aynı tarih ve saatteki masaların maxParticipants toplamı + atanacak masanın
    maxParticipants değeri mekânın kapasitesini aşamaz (ör. kapasite 20 → 3 grup masası 18 kişi + 1 başbaşa 2 kişi).
    Tüm atama yollarında geçerli: elle atama (assignMeetingVenue, updateMeetingVenue), mekân seçenek listesi ve saatlik otomatik atama.
    Elle atamada kapasitesi boş mekânda kontrol yapılmaz; otomatik atama kapasitesi boş mekânı seçmez, uygun mekân yoksa masa mekânsız kalır.

Şehir yönetimi:
  - GET /admin/cities — liste (mekan sayısıyla)
  - POST /admin/cities — şehir ekle {name}
  - PATCH /admin/cities/:id — güncelle {isActive, weeklyTableLimit(0=global ayarı kullan)}

Abonelik yönetimi:
  - GET /admin/users/:id/subscriptions — kullanıcının tüm abonelikleri
  - PATCH /admin/subscriptions/:id/cancel — iptal et {cancelNote?}

Sistem ayarları:
  - GET /admin/settings — AppConfig key-value
  - PATCH /admin/settings — {weeklyTableLimit, matchingEnabled}

KYC inceleme → /kyc/admin/* (Modül 5'ten)
Şema: Profile.isPioneer, City, Venue(VenueCategory: SADE/ORTA/PREMIUM), Subscription.cancelNote

KULLANICI ENGELLEME (UserBlock):
- Tablo: UserBlock {id, blockerId, blockedId, createdAt} — @@unique([blockerId, blockedId])
- GET /meetings/:id/participants-preview — JWT zorunlu; sadece o masanın katılımcıları görebilir
  → her katılımcı için: {userId, initials (örn. "M.A."), gender, isRequester}; başka bilgi yok
  → masa onaylanmadan önce de (PENDING) görüntülenebilir
- POST /meetings/:id/block — body: {blockedUserIds: string[]} — JWT zorunlu
  → engelleyenin ve engellenenin ikisi de o masanın katılımcısı olmalı
  → upsert ile kaydedilir (tekrar engel koymak hata vermez)
  → dönüş: {blocked: N}
- POST /meetings/:id/rematch-block — JWT zorunlu; sadece ONE_ON_ONE masalar için
  → çift yönlü kalıcı engel: A→B ve B→A aynı anda oluşturulur
  → dönüş: {rematchBlocked: true, pairedUserId: string}
- UserBlock kalıcıdır; A→B engellerse algoritma her iki yönü de kontrol eder (B de A ile eşleşemez)
- Aynı baş harf çakışması (~%1-2 ihtimal) kabul edilmiş durumdur; çözüm üretilmez
- Eşleştirme algoritması:
  → runWeeklyMatching() eligible kullanıcı listesinden tüm block çiftlerini yükler
  → blockedSet: Set<"blockerId:blockedId"> olarak tutulur
  → areBlocked(a, b) → blockedSet'te "a:b" veya "b:a" var mı kontrol eder
  → pickBest() kandidatları filtrelerken engelli çiftleri dışlar
  → Phase 3 karma masalarda da engelli çiftler aynı masaya yerleştirilmez

PLATFORM KOMİSYON KURALLARI:
- Fiyat hesabı: web = ham × 1,20; mobil (App Store ve Play Store) = ham × 1,20 ÷ (1 − 0,15) — mağaza komisyonu %15
- Admin net gelir hesabı: PLATFORM_FEE_WEB=0, PLATFORM_FEE_GOOGLE=0.15, PLATFORM_FEE_APPLE=0.15
- Mobil ödeme uygulama içi satın almadır (App Store / Play Store); lansmana kadar pasif (IAP_ENABLED)

AKTİF ŞEHİRLER (7 şehir):
İstanbul, Ankara, İzmir, Antalya, Balıkesir, Muğla, Aydın
(Mersin, Adana, Bursa, Konya platformda aktif değil)

ŞEHİR SEÇİMİ KURALLARI:
- Kullanıcı kayıtta yaşadığı şehri değil, katılmak istediği şehri seçer
- primaryCity: zorunlu — asıl katılım şehri
- secondaryCity: opsiyonel — ikinci tercih şehir
- Algoritma eşleştirmede önce primaryCity, sonra secondaryCity üzerinden eşleştirir
- Bu kural hem grup masaları (MASADA) hem başbaşa (KARSIMDA) için geçerlidir
- Profile tablosuna primaryCity ve secondaryCity alanları eklendi
- Eski city alanı ikamet için kalır; eşleştirme primaryCity/secondaryCity kullanır

REHBER ENGELLEME (Contact Block):
- Kullanıcı kayıt akışında opsiyonel adım olarak rehberinden numara yükleyebilir; sonradan profil ayarlarından da yapılabilir
- Mobil (React Native): native Contacts API ile rehber senkronizasyonu
- Web: manuel numara girişi (alan kodu + numara)
- Numaralar ContactBlock.hashedPhone alanında (adı eski) açık "+90XXXXXXXXXX" formatında saklanır; hash kullanılmaz
- Maksimum 50 numara per kullanıcı
- Eşleştirme algoritmasında: engel listesi User.phone ile aynı formatta karşılaştırılır, eşleşme varsa ikisi de birbirinin havuzuna dahil edilmez (UserBlock ile aynı mantık)
- Prisma modeli: ContactBlock { id, userId, hashedPhone String, createdAt } — userId üzerinden User'a relation
Endpoint'ler:
  - POST /contact-blocks/sync — numara dizisi alır, upsert (JWT zorunlu)
  - GET /contact-blocks — kullanıcının numara listesi (JWT zorunlu)
  - DELETE /contact-blocks/:id — tekil silme (JWT zorunlu)

SOHBET SİSTEMİ (Modül 11):
Kural: Masa onaylandığı an (REVEALED) masa kartı açılınca sohbet direkt açılır. Onay sorulmaz. Her iki masa türü için geçerli.
Kapanış:
  - Grup masası sohbeti: Cuma 22:00'de kapanır (TR)
  - Baş başa sohbeti: Cumartesi 22:00'de kapanır (TR)
  - Kankamla sohbeti: Pazar 22:00'de kapanır (TR)
Kapanınca:
  - Kullanıcı tarafında mesajlar silinir (görünmez olur)
  - Admin panelinde mesajlar kalıcı olarak saklanır
Admin erişimi:
  - Masa detayında sohbet geçmişi salt okunur görünür
  - Şikayet edilen mesajlar ayrıca işaretli görünür
Şikayet sistemi:
  - Her mesajın yanında "Şikayet et" butonu
  - Her şikayet anında admin paneline düşer (eşik yok)
  - Şikayet: mesaj içeriği + şikayetçi + şikayet zamanı admin görür
Prisma modeli:
  - ChatMessage { id, meetingId, senderId, content, createdAt, deletedAt? }
  - ChatReport { id, messageId, reporterId, createdAt }
Endpoint'ler:
  - GET /chat/:meetingId/messages — mesaj listesi (JWT zorunlu, masa katılımcısı olmalı)
  - POST /chat/:meetingId/messages — mesaj gönder (JWT, kapanış saati kontrolü)
  - POST /chat/messages/:messageId/report — şikayet et (JWT)
  - GET /admin/chat/:meetingId — admin sohbet geçmişi (ADMIN guard)
  - GET /admin/chat/reports — tüm şikayetler listesi (ADMIN guard)

REZERVASYON İPTALİ KURALLARI (güncelleme):
  - Grup masası: Perşembe 20:00'a kadar iptal butonu aktif
  - Baş başa: Cuma 20:00'a kadar iptal butonu aktif (CLAUDE.md Modül 3'teki mevcut kurala ek)
  - İptal anında admin masa detayına log düşer: "K.A. — 18:34'te rezervasyonu iptal etti"
  - İptal sonrası son 1 saate kadar sistem yeni kişi arar
  - 1 saat içinde bulunamazsa: eksik cinsiyete göre bot eklenir
  - Grup dengesi zorunlu: 3E + 3K; bot da bu dengeyi koruyarak girer (kız eksikse kız bot, erkek eksikse erkek bot)
  - Baş başa iptalinde de aynı mantık: yeni eşleşme arar, bulamazsa bot

KULLANICI UYARI / ASKIYA ALMA / BANLAMA SİSTEMİ:
Admin işlemleri (masa detayında veya kullanıcı profilinde):
  - Katılımcılar admin panelinde K.A. gibi kısaltmayla gösterilir
  - K.A.'ya tıklayınca o kullanıcının tam profili + geçmişi açılır
  - Uyarı ver: sebep zorunlu, kullanıcı giriş yapabilir ama uyarı mesajı görür ve devam edebilir
  - Askıya al: sebep + süre zorunlu; kullanıcı o süre boyunca giriş yapamaz
  - Banla: sebep zorunlu; kullanıcı kalıcı olarak giriş yapamaz
Kullanıcı giriş ekranında:
  - Uyarı varsa: uyarı metni gösterilir, "Devam et" butonu ile geçilebilir
  - Askıya alınmışsa: askıya alma nedeni + süre gösterilir, giriş engellenir
  - Banlıysa: banlama nedeni gösterilir, giriş engellenir
  - Her iki durumda da: "Hatalı olduğunu düşünüyorsan bilgi@ahenk.co adresiyle iletişime geç" mesajı
Prisma modeli:
  - UserSanction { id, userId, type (WARNING|SUSPENSION|BAN), reason, expiresAt?, createdAt, adminId }
  - User.activeSanction ilişkisi (en son aktif yaptırım)
Endpoint'ler:
  - POST /admin/users/:id/sanction — yaptırım uygula { type, reason, expiresAt? }
  - DELETE /admin/users/:id/sanction/:sanctionId — yaptırım kaldır
  - GET /auth/me → activeSanction alanı döner (giriş ekranında kontrol için)
Otomatik geri alma:
  - SUSPENDED: askı süresi dolan kullanıcı giriş yapınca aktif UserSanction yoksa status → ACTIVE otomatik
  - BANNED: aynı kural — admin tüm BAN kayıtlarını kaldırırsa status → ACTIVE otomatik (manuel status düzeltmesi gerekmez)
  - Bu mantık checkSanction() içinde uygulanır, her giriş denemesinde kontrol edilir
WhatsApp OTP giriş yolunda (send-login-otp) da sanction kontrolü yapılır; 403 dönünce frontend sanction modal'ını gösterir

ACİL YARDIM (SOS) SİSTEMİ (Modül 12):
Kapsam: Masanın aktif katılımcısı tehlike anında acil yardım talebinde bulunabilir.
Guard: CANCELLED, DECLINED, NO_SHOW statüsündeki katılımcılar SOS açamaz.
Prisma modeli:
  - SosReport { id, userId, meetingId, threats[], lat?, lng?, accuracy?, resolvedAt?, participantSnapshot (JSON), createdAt }
  - SosLocationUpdate { id, reportId, lat, lng, accuracy?, timestamp }
  - ParticipantLocation { id, meetingId, userId, lat, lng, accuracy?, timestamp }
  - AdminAlertType enum'a SOS_ALERT eklendi
Tehdit tipleri: LIFE_DANGER, PHYSICAL_VIOLENCE, ABDUCTION, HARASSMENT
SOS raporu başına tek AdminAlert oluşur. Bildirim tüm ADMIN ve SUPERADMIN'lere gider. Raporu tek bir admin üstlenir, diğer adminler izleyemez. SUPERADMIN sınırsız izler ve müdahale eder.
Kullanıcı konumu: masa katılımcıları SOS sırasında konum paylaşabilir (ParticipantLocation tablosu).
Admin SOS sayfası: /acil-yardim — canlı rapor listesi, 15s otomatik yenileme.
  Nominatim (OpenStreetMap) reverse geocoding: TR dili, max 1 istek/saniye (seri kuyruk), adres cache max 200 kayıt.
Endpoint'ler:
  - POST /sos/:meetingId/report — SOS raporu oluştur {threats[], lat?, lng?, accuracy?} (JWT)
  - POST /sos/:reportId/location — canlı konum güncelle {lat, lng, accuracy?} (JWT)
  - POST /sos/:meetingId/participant-location — tüm katılımcı konumu gönder (JWT)
  - GET /sos/admin/reports — tüm raporlar listesi (ADMIN guard)
  - GET /sos/admin/reports/:id — rapor detayı + konum geçmişi (ADMIN guard)

BOT DOLDURMA DETAYLARI:
Bot doldurma kuyruğu: BOT_FILL_QUEUE ("bot-fill"), JOB_FILL_SPOT ("fill-spot")
İptal anında 1 saat gecikmeli Bull job eklenir.
İş çalışınca:
  - Masa PENDING veya ACTIVE değilse işlem yapılmaz.
  - Kapasite dolu ise (anlık sayım) işlem yapılmaz.
  - Kapasite kontrolü + bot ekleme Prisma $transaction içinde atomik yapılır (race condition önlemi).
  - Grup masası: mevcut MALE/FEMALE sayısına bakarak hedef cinsiyet belirlenir (iptal edenin cinsiyetine bakılmaz).
  - ONE_ON_ONE: iptal edenin cinsiyeti hedef (MALE/FEMALE).
  - Hedef cinsiyette profile'lı bot bulunamazsa herhangi aktif bot fallback olarak denenir.
  - Aynı bot 4 hafta kuralı: masadaki gerçek katılımcılardan biriyle son 28 gün içinde aynı masada bulunmuş bot o masaya seçilmez (addGroupBots, admin bot listesi); placeBot'ta seçilirse 400 "Bu bot son 4 hafta içinde masadaki bir kullanıcıyla eşleşti."

REZERVASYON İPTALİ EK KURALLAR:
  - cancelRegistration bildirim listesi: CANCELLED, DECLINED, NO_SHOW statüsündeki katılımcılar "1 kişi ayrıldı" bildiriminden çıkarılır.
  - Admin masalar/[id] sayfasında iptal eden katılımcının cancelledAt tarihi ve leaveReason metni gösterilir.
  - MeetingParticipant.cancelledAt alanı iptal anında set edilir.

SOHBET SİSTEMİ EK KURALLAR:
  - chatCloseTime hesaplaması TR timezone (UTC+3 sabit offset) ile yapılır.
  - Grup masası gece yarısı güvenliği: scheduledAt >= kapanış saati ise closeTime = scheduledAt + 4 saat.
  - Bu güvenlik sadece GROUP için geçerlidir; ONE_ON_ONE için uygulanmaz (Cuma kapanışı geçtiyse sohbet zaten kapalıdır).
  - Chat controller'da literal route (admin/reports/list) her zaman parametrik route'tan (admin/:meetingId) önce tanımlanmalıdır; aksi halde route shadow oluşur.
  - MeetingStatus.REVEALED henüz şemada yok; spec'te var ama migration bekleniyor. Şu an sohbet sadece ACTIVE masalar için açık.

RATE LIMITING:
  - ThrottlerModule backend'e eklenmiştir.
  - 4 ayrı named throttler: short (10 req/3s), medium (30 req/10s), long (100 req/1m), auth (5 req/1m).
  - Auth endpoint'leri (login, register, OTP) auth throttler ile korunur.

API CLIENT KURALLAR (web):
  - apps/web/lib/api.ts içinde PREFIX sabiti API_PREFIX olarak export edilir.
  - Özel fetch ihtiyacı olan sayfalarda (örn. giris/page.tsx) API_PREFIX import edilir; çift tanım yapılmaz.
  - api.ts'den setToken/clearToken/getToken da export edilir; localStorage token yönetimi buradan yapılır.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Mobil Uygulama Kuralı (iOS / React Native)
- Ahenk mobil uygulaması, ahenk.co web sitesinin mobil görünümüyle birebir aynı görünecek.
- 1. öncelik: web ile birebir görünüm. Renkler, yazı tipleri, yazı boyları, boşluklar, köşe yuvarlaklıkları, gölgeler, ikonlar ve düzen web kaynak kodundan birebir alınacak.
- Web tasarım değerleri tek bir tema dosyasında toplanacak; mobil ekranlar yalnızca bu tema dosyasını kullanacak. Tema dosyasında olmayan renk veya boyut değeri uydurulmayacak.
- Her mobil ekran, webdeki karşılık gelen ekranla tek tek karşılaştırılarak yazılacak. Webde karşılığı olmayan ekran, bileşen veya düzen uydurulmayacak; kullanıcıya sorulacak.
- Apple HIG (.claude/skills içindeki hig-* skill'leri) yalnızca webde karşılığı olmayan iPhone'a özgü konularda uygulanacak: güvenli alan (çentik, alt çubuk), en az 44×44 pt dokunma alanı, klavye davranışı, geri kaydırma hareketi, durum çubuğu. HIG, webdeki görünümü değiştirmek için kullanılmayacak.
- Web'den mobile dönüşüm işlerinde WebToMobile skill'leri kullanılacak.
- Talimatta "hig skill'lerini kullan" yazdığında bu öncelik sırası geçerlidir.
