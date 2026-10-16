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
                               Abonelik almak isterse
                                          ↓
                               KYC zorunlu → yükle → admin onay
                                          ↓
                               Ödeme açılır → Masada / Karşımda / İçerde

TEST KURALLARI:
- Test oturum gerektirmez (GET /test/questions herkese açık)
- Cevaplar tek seferde gönderilir (POST /test/submit — 19 cevap zorunlu)
- OCEAN skoru: her boyut 0-100 ((ortalama-1)/4*100), ters sorularda 6-score
- Abonelik öncesi test tamamlanmış olmalı (TestCompletedGuard)
- Yeniden test: 180 gün sonra
- Admin test kilidini açabilir: PATCH /test/admin/:userId/reset-lock → adminCanReset: true
- Kullanıcı testi tamamlayınca adminCanReset otomatik false'a döner
- Test sonucu profilde kısa açıklama olarak görünür

EŞLEŞTİRME ALGORİTMASI (Modül 7):
- Tetikleme: Her Perşembe 23:59, Bull queue ile
- Ağırlıklar: OCEAN %50 / Mekan %25 / Şehir+İlçe %15 / Konu %10 (Rol faktörü yok)
- OCEAN benzerliği: Öklid mesafesi, normalize 0-50
- Mekan benzerliği: Jaccard (ortak/toplam) × 25
- Şehir+İlçe: aynı şehir+ilçe→15, aynı şehir→10, farklı→0
- Konu benzerliği: Jaccard × 10
- Cinsiyet dengesi: 6 kişi → 3E+3K, 4 kişi → 2E+2K
- PREFER_NOT_TO_SAY / OTHER → dengeden bağımsız, boş slotlara yerleştirilir
- Masa 5 kişi kalırsa: bot ile 6'ya tamamla; bot yoksa 4'e düşür, 5. kişi sonraki haftaya
- Bot sistemi: seed'de isBot:true olan User kayıtları, admin panelinden aktif/pasif ve isim düzenleme
- Bot OceanScore: seed'de manuel atanır (50/50/50/50/50 varsayılan), test doldurmaları gerekmez
- Bot isimleri admin panelinden güncellenebilir (ad/soyad); diğer alanlar admin yetkisi dışında
- Kayıt kapanış saati: Cumartesi 10:00 — 4 kişi yoksa 12 saat uzatılır (22:00'ye)
- 4. kişi kabul edince uzatma iptal, masa kesinleşir
- 5. kişi sıradaki haftaya: MatchingWaitlist tablosunda saklanır, sonraki koşuda öncelikli

KYC KURALLARI:
- Kayıt, giriş ve OCEAN testi KYC gerektirmez
- Abonelik satın alımı öncesinde KYC zorunlu (KycGuard)
- KYC onaylıysa kullanıcı profilinde isKycVerified: true → "Doğrulanmış ✓" rozeti
- Durum: PENDING / APPROVED / REJECTED / SUSPICIOUS
- REJECTED veya SUSPICIOUS → rejectReason yazılır, kullanıcı yeniden başvurabilir
- Dosyalar Cloudflare R2'de private, sadece imzalı URL ile admin görür

ÖDEME SİSTEMİ (Modül 8):
Paketler:
  - MASADA: 349 TL/ay (yenilenen abonelik, grup buluşma hakkı)
  - KARSIMDA: 449 TL/tek kullanım (başbaşa buluşma hakkı)
  - ICERDE: 679 TL — "Tercih Edilen" etiketi; 1 ay MASADA + 1 tek kullanım KARSIMDA hakkını içerir
Platform:
  - Web / Android → iyzico Checkout Form
  - iOS → StoreKit 2 stub (şimdilik "henüz aktif değil" döner)
Akış:
  - POST /payment/plans → herkese açık, paket listesi
  - POST /payment/init → TestCompletedGuard + KycGuard + JWT zorunlu; iyzico token + form döner
  - POST /payment/callback → iyzico'dan gelen callback, token ile doğrulama, abonelik aktifleşir
  - GET /payment/subscriptions → JWT zorunlu, kullanıcının aktif abonelikleri
ICERDE paketi DB'de tek Subscription kaydı olarak saklanır (plan=ICERDE); hasMasada ve hasKarsimda
  sorguları ICERDE planını da kapsar.
MASADA aboneliği 30 gün; KARSIMDA ve ICERDE'nin Subscription.expiresAt=null, usedAt ile tüketim takibi.

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
  - PATCH /admin/meetings/:id/extend-deadline — kapanış süresini uzat {extraHours: 1-72}
  - DELETE /admin/meetings/:id — masayı iptal et (CANCELLED)

Mekan yönetimi:
  - GET /admin/venues?cityId= — mekan listesi
  - POST /admin/venues — mekan ekle {name, category(SADE/ORTA/PREMIUM), cityId, address?}
  - PATCH /admin/venues/:id — güncelle (name, description, category, address, isActive)
  - DELETE /admin/venues/:id — mekan sil

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
- Web:          %0 komisyon  → kullanıcıya gösterilen fiyat = iyzico'ya gönderilen fiyat
- Google Play:  %15 komisyon → iyzico fiyatı = net_fiyat / (1 - 0.15)
- App Store:    %30 komisyon → iyzico fiyatı = net_fiyat / (1 - 0.30)
Env değişkenleri: PLATFORM_FEE_WEB=0, PLATFORM_FEE_GOOGLE=0.15, PLATFORM_FEE_APPLE=0.30
iOS StoreKit 2 ayrı modül olarak stub'lanmıştır; production'da aktif edilecek (şimdi "henüz aktif değil" döner)
Paket fiyatları (MASADA 349, KARSIMDA 449, ICERDE 679) net fiyatlardır; platform eklenince yukarı çıkar

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
- Numaralar SHA-256 ile hash'lenerek ContactBlock tablosunda saklanır — ham numara tutulmaz
- Maksimum 50 numara per kullanıcı
- Eşleştirme algoritmasında: her iki kullanıcının hash listesi karşılaştırılır, eşleşme varsa ikisi de birbirinin havuzuna dahil edilmez (UserBlock ile aynı mantık)
- Prisma modeli: ContactBlock { id, userId, phoneHash String, createdAt } — userId üzerinden User'a relation
- User modeline phoneHash alanı eklenir: kayıt sırasında kullanıcının kendi numarası SHA-256 ile hash'lenerek buraya kaydedilir
- Eşleştirmede karşı tarafın ContactBlock listesi kendi phoneHash'i ile karşılaştırılır
- Auth akışı: kayıt sırasında telefon numarası hash'lenerek User.phoneHash'e yazılır
Endpoint'ler:
  - POST /contact-blocks/sync — dizi hash alır, upsert (JWT zorunlu)
  - GET /contact-blocks — kullanıcının hash listesi (JWT zorunlu)
  - DELETE /contact-blocks/:id — tekil silme (JWT zorunlu)

SOHBET SİSTEMİ (Modül 11):
Kural: Masa onaylandığı an (REVEALED) masa kartı açılınca sohbet direkt açılır. Onay sorulmaz. Her iki masa türü için geçerli.
Kapanış:
  - Grup masası sohbeti: Cumartesi 23:59'da kapanır
  - Baş başa sohbeti: Cuma 23:59'da kapanır (tarama bitişiyle aynı)
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
