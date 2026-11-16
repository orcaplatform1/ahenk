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
- Yeniden test: test tarihi + 6 takvim ayı (o gün TR saatiyle 00:01'den itibaren; backend test.service.ts retakeAvailableAt)
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
- Kanka bölümünde KYC bilgi yazısı yoktur (web + mobil); KYC onaysız kişinin kanka daveti / kabulü ve masaya katılamaması kuralı backend'de aynen
- KYC onaysız kullanıcıda "Kanka Davet Et" penceresinde başlık altında "Kanka davet etmek için önce kimliğini doğrula." yazısı ve
  "Kimliğimi Doğrula" butonu (KYC ekranını açar) vardır (web + mobil)
- 100 TL indirim ekranında KYC notu yoktur
- KYC onaylanmadan kullanıcı hiçbir buluşma taramasına giremez (havuz sorgularında kyc APPROVED şartı)
- Admin KYC onayında T.C. no girilmez, karşılaştırılmaz; UserIdentity tablosu kaldırıldı
- KYC onaylıysa kullanıcı profilinde isKycVerified: true → "Doğrulanmış ✓" rozeti
- Durum: PENDING / APPROVED / REJECTED / SUSPICIOUS
- REJECTED veya SUSPICIOUS → rejectReason yazılır, kullanıcı yeniden başvurabilir. İade yoktur
- T.C. NO: web'de "Paket Al" / "Abone Ol" sonrası açılan ödeme ekranında "T.C. No:" alanı zorunlu (11 haneli rakam);
  altında not: "Ödeme altyapı hizmet sağlayıcı İyzico tarafından, mevzuat gereği satın alımlarda artık T.C.K.N. zorunludur."
  Numara yalnız iyzico'ya gönderilir, veritabanına kaydedilmez, her web ödemesinde yeniden sorulur. Mobil uygulama içi satın almada T.C. alanı yok
- KYC dosyaları (ön yüz, arka yüz, canlılık videosu) Ahenk'in kendi sunucusunda (uploads/kyc/<userId>/) AES-256-GCM ile şifreli
  "<ad>.<uzantı>.enc" olarak saklanır (backend/src/kyc/kyc-crypto.ts; anahtar backend/.env KYC_ENCRYPTION_KEY, 64 hex, .env izni 600).
  Yalnız yetkili admin ucu GET /kyc/admin/file/:id/:type bellekte çözüp gönderir; çözülmüş hâli diske yazılmaz. Eski düz dosyalar
  backend/scripts/kyc-encrypt-existing.js ile şifrelendi (şifreli kopya → çöz → bayt karşılaştır → düz orijinal silinir).
  Anahtar kaybolursa KYC dosyaları kurtarılamaz; sunucu dışında yedeklenmeli

ÖDEME SİSTEMİ (Modül 8):
Tek seferlik paketler (kodlar korunur; haklar kullanılana kadar geçerli, döngü / süre sınırı yok):
  - MASADA   → "Grup Paketi":     1 grup buluşması hakkı, ham 299 TL
  - KARSIMDA → "Baş Başa Paketi": 1 baş başa buluşması hakkı, ham 399 TL
  - KANKAMLA → "Kankamla Paketi": 1 kankamla buluşması hakkı, ham 499 TL (alıcı öder, aynı cinsiyetteki kankası ücretsiz katılır)
    · Kanka davet edilmeden satın alınır; kullanıcı paketi aldıktan sonra kankasını davet eder (detay ekranında "Paket Al";
      "Önce Kanka Davet Et" yoktur). Davet linkinden gelen kankanın daveti kabul etmesi ve masaya katılması için KYC onayı zorunlu
  - ICERDE   → "İçerde Paketi":   1 grup + 1 baş başa buluşması hakkı, ham 599 TL
  Prime'ın görünen adı "Prime Paket". Kullanıcıya görünen bütün metinlerde "Başbaşa" değil "Baş Başa" yazılır (paket kodları aynen)
Prime abonelik (PRIME_1M / PRIME_3M / PRIME_6M / PRIME_12M): ham 899 / 2299 / 3899 / 6499 TL
  - Satın alındığı anda 1 grup + 1 baş başa + 1 kankamla hakkı tanımlanır
  - Abonelik devam ettiği sürece satın alma tarihinden itibaren her 30 günde haklar sıfırlanır ve yeniden 1 + 1 + 1 olur;
    kullanılmayan haklar devretmez
  - Abonelik iptal edilince (kullanıcı iptali ya da mağaza / iyzico yenilemeyi durdurunca) iptal anında elde kalan Prime hakları süre
    sınırı olmadan, kullanılana kadar geçerli kalır: 30 günlük yenileme durur, dönem sonunda haklar silinmez. İptal edilen Prime'ın
    dönemi bitince bu kayıt "aktif Prime" sayılmaz (ikinci Prime / tek seferlik paket kuralı ve profildeki Prime durumu); hakların
    tamamı kullanılınca biter (backend package-rights.ts livePrimeWhere / isLivePrime)
  - Prime expiry: saatlik expire işi (matching.scheduler.ts expireSubscriptions) Prime planlarını atlar; Prime'ı yalnızca
    prime.service.ts kapatır. İptal edilmiş Prime hakları bitince kapanır; iptal edilmemiş ve yenilenmemiş Prime expiresAt'te kapanır
  - Dönem başında planın tam tutarı tek seferde çekilir; dönem bitince aynı süreyle otomatik yenilenir
  - Aktif Prime'ı olan ikinci Prime alamaz
  - Aktif Prime'ı olan tek seferlik paket alamaz; istisna: Prime'da hakkı bitmiş tür varsa yalnız o türü içeren tek seferlik paketi alabilir
  - Admin ücretsiz Prime verebilir (paket verme ekranında Prime 1/3/6/12 aylık): ödeme alınmaz, haklar normal Prime gibi
    (1+1+1, 30 günde yenilenir, devretmez), otomatik yenileme yok, süre bitince biter. Aktif Prime'ı olana ikinci Prime verilemez
    (admin ekranında uyarı)
  - Admin panelinde (web + mobil) tek seferlik paketlerin olduğu her filtre / listede Prime 1/3/6/12 aylık da vardır
    (Kullanıcılar üye filtresi, Abonelikler paket filtresi, paket verme ekranları, işlem kaydı paket adları);
    İstatistikler → Paket Dağılımı'nda Prime planları ayrı ayrı (yüzdeler tek seferlik + Prime toplamına göre) ve "Aktif Prime" kartı
  - Profildeki paket kutusunda "Aboneliği İptal Et": otomatik yenileme durur, iptal anında elde kalan haklar kullanılana kadar geçerli,
    iade yapılmaz
    · iyzico ile alınan abonelik: web ve mobilde buton sunucu üzerinden doğrudan iptal eder
    · App Store / Play Store ile alınan abonelik: mobilde mağazanın abonelik sayfası açılır; web'de "Aboneliğini mobil uygulama
      üzerinden aldığın için iptal işlemini uygulamadan yapabilirsin." mesajı ve "Uygulamayı Aç" butonu: iOS / Android'de önce ahenk://
      ile uygulama açılmaya çalışılır, 1,5 sn içinde sayfa görünür kalırsa iOS'ta App Store'a, Android'de Play Store'a yönlendirilir;
      uygulama açılırsa yönlendirme yapılmaz. Masaüstünde App Store ve Play Store butonları. Bağlantılar apps/web/lib/appLinks.ts
Fiyatlar ham fiyattır; admin "Fiyatlar" tablosunda (PlanPrice) tutulur. Web = ham × 1,20 (KDV); mobil = ham × 1,20 ÷ 0,85 (mağaza komisyonu %15)
Sadakat Programı (%10 davet indirimi): davet edilen kişi herhangi bir tek seferlik paket aldığında ya da Prime aboneliği başlattığında
  (ücretli satın alma: iyzico ya da mağaza) davet edene %10 indirim hakkı tanımlanır; KYC şartı yoktur. Kutudaki metin: "Davet ettiğin
  arkadaşın herhangi bir paket aldığında veya abone olduğunda sana %10 indirim hakkı tanımlanır. Her indirim hakkı yalnızca bir paket
  satın alımında geçerlidir, toplu kullanılamaz ve devredilemez." (Referral durum adı KYC_APPROVED şemada aynen, "hak tanımlandı" anlamında)
İndirimler: %10 davet indirimi ve paketi / aboneliği olmayana gönderilen 100 TL indirim tüm tek seferlik paketlerde ve tüm Prime
  planlarında geçerli (WINBACK_PLANS ayarında 8 plan); ikisi aynı ödemede birlikte kullanılamaz; Prime'da yalnız satın alma ödemesine
  uygulanır, yenilemeler indirimsiz. Aktif tek seferlik paketi ya da aktif Prime'ı olana 100 TL indirim hiçbir koşulda gösterilmez/uygulanmaz
Mobil indirim teklifleri (IAP_ENABLED ile pasif): tek seferlik paketlerde indirimli ayrı ürünler (<ürün>.davet10, <ürün>.indirim100);
  Prime'da App Store promosyon teklifi (sunucu imzalı) / Google Play abonelik teklifi (teklif kimlikleri davet10, indirim100)
Paket kartı rozetleri: Tinder GOLD tarzı hap, dolgu renkli, kalın, büyük harf, küçük (web 0.62rem / 2px 8px, mobil 9.9 / 2-8);
  renk kartın tonuyla uyumlu, İçerde altın, Prime "ABONELİK" şarap kırmızısı #7A1F2B (yazı #f4f1ec)
Paket kartı tasarımı (web + mobil, landing dahil): premium; her kartta aynı renk ailesinde koyudan ortaya geçişli (gradient) arka plan,
  açık / soluk ton yok. Grup yeşil, Baş Başa kırmızı, Kankamla mavi, İçerde altın; Prime siyahtan koyu antrasite, paket listesinde
  çerçeve palet kırmızısı (#d6453a), "Prime Paket" yazısı ve sağdaki ok #7A1F2B. Prime avantajlarının ilki "Her masada öncelikli
  eşleşme hakkı". Prime detay ekranında 3 aylık plan kartının üstünde "Tercih Edilen" etiketi. Web'de bu kart altın çerçeveli, hafif
  altın geçişli; mobilde altın çerçeve / arka plan yok, diğer süre kartlarıyla aynı düz görünüm (etiket kalır).
  Seçili plan kartının çerçevesi Ahenk paleti kırmızısı (#d6453a); 3 aylık seçiliyse çerçeve kırmızı, etiket kalır (web + mobil).
  Paket kartı tipografisi (web + mobil, bütün paket kartları ve "Prime Abonelik Süreleri" kutusu): başlık serif (DM Serif Display), normal
  ağırlık, web text-2xl (24/32) / mobil Serif 24/32; açıklama sans, normal ağırlık, 14 (text-sm). Renkler ve rozetler aynı
  Grup Paketi avantajı "Masada erkek ve kadın eşit sayı"
Paket kartı yazıları (kart kısa açıklaması; avantajlar PaketKarti.tsx CARDS ve mobil paketim.tsx CARDS'ta aynı liste):
  Grup Paketi "1 Grup Masası'nda buluşma hakkı"; Baş Başa Paketi "1 Baş Başa Masası'nda buluşma hakkı"; Kankamla Paketi
  "1 Kankamla Masası'nda buluşma hakkı"; İçerde Paketi "1 Grup Masası + 1 Baş Başa Masası'nda buluşma hakkı"; Prime Paket
  "Her ay 1 Grup + 1 Baş Başa + 1 Kankamla Masası"
Mobil paket detay ekranında "← Paketler" (mevcut pillRed etiket stili) ve Android geri tuşu Paketim'deki paket listesine döner
Profilim "KANKAMLA NASIL İŞLER?" metni: "Kankamla Paketi'ni al, ardından aynı cinsiyetten bir arkadaşını kanka olarak davet et. Kankan
  ücretsiz katılır; davet linkinden geldiğinde kimlik doğrulaması yapması zorunludur. İkiniz, karşı cinsten bir kanka çiftiyle Pazar
  akşamı 4 kişilik masada buluşursunuz. Davet 48 saat geçerlidir; kanka seçildiği hafta değiştirilemez." Web ve mobilde "2 masa hakkı",
  "2 hak", "4 döngü" ifadeleri yoktur
Landing "Paket Al": giriş yapmamışsa Giriş; giriş yapmışsa (KYC onaylı ya da değil) Profil → Paketim
Web paket listeleri (landing #pricing ve Profil → Paketim): landing başlığı "Fiyatlandırma". Kartlar 2 sütunlu grid (sm ve üstü; dar
  ekranda tek sütun): Grup + Baş Başa, Kankamla + İçerde, Prime Paket tam genişlik; landing'de 4. satır "Prime Abonelik Süreleri"
  kutusu tam genişlik (eski "Prime Üyelik"; başlık #7A1F2B, çerçeve #d6453a — altın renk yok). Prime Paket detay ekranı tam ekran (değişmedi).
  Landing'de bütün paket kartları varsayılan açık: avantajlar ve "Paket Al" / "Abone Ol" tıklamadan görünür, aç/kapa yok; kartlar
  tıklanamaz (PaketKarti staticCard: div, ok yok). Web Profil → Paketim'de kartlar tıklanınca tam ekran detay (değişmedi). Mobil
  paket ekranlarında grid yoktur; mobil kart davranışı aynı
Paket kartları (Grup, Baş Başa, Kankamla, İçerde, Prime) tek kaynaktan: apps/web/components/paket/PaketKarti.tsx — paket ekranı ve landing
  aynı kartı, açıklamayı ve avantaj listesini kullanır. Landing'de eski görselli paket kartları yoktur; Prime kuralları bölümü durur
Platform:
  - Web → iyzico. Tek seferlik: Checkout Form. Prime: ilk dönem Checkout Form, otomatik yenileme iyzico abonelik API'si
    (IYZICO_SUBSCRIPTION_ENABLED=true olana kadar pasif; planlar lansmanda create-prime-plans ile tanımlanır)
  - iOS → App Store, Android → Play Store uygulama içi satın alma (IAP_ENABLED=true olana kadar pasif)
  - Mağaza bildirimleri: App Store bildirimleri JWS imzası ve Apple Root CA - G3 sertifika zinciriyle doğrulanır
    (backend/certs/AppleRootCA-G3.cer). Google Play bildirimleri Pub/Sub OIDC JWT ile doğrulanır
    (GOOGLE_PUBSUB_AUDIENCE, GOOGLE_PUBSUB_SERVICE_ACCOUNT; tanımlı değilse bütün Google bildirimleri reddedilir).
    Doğrulanmayan bildirim reddedilir
Akış:
  - GET /payment/plans → herkese açık, paket listesi
  - POST /payment/init → TestCompletedGuard + JWT; web iyzico form, mobil mağaza ürün kimliği döner
  - POST /payment/callback → iyzico callback; başarılıysa /odeme/basarili (Prime'da ?prime=1 → otomatik yenileme formu)
  - POST /payment/store/verify → mobil satın alma doğrulama; store/apple-notification, store/google-notification yenilemeler
  - POST /payment/prime/cancel, /payment/prime/autorenew/init, /payment/prime/autorenew/callback, /payment/prime/iyzico-webhook
  - GET /payment/subscriptions → JWT zorunlu, aktif paketler + türüne göre kalan hak adedi
İADE SİSTEMİ YOKTUR: kullanıcı iade talebi, admin iade ekranları ve iade endpoint'leri kaldırıldı; RefundRequest tablosu silindi.
  Landing ve yasal sayfalarda iade ifadesi yoktur (Mesafeli Satış Sözleşmesi cayma hakkı maddesi hariç); Prime kuralları yazılıdır.
  Yasal sayfalardaki paket tanımları yeni paketlerdir (Grup / Baş Başa / Kankamla / İçerde 1'er hak, kullanılana kadar; Prime 1/3/6/12 ay);
  "2 grup hakkı" ve "4 döngü" ifadeleri yoktur.
  (Para çekilip paket verilemeyen mükerrer ödemenin otomatik iyzico iadesi ve "Ödeme Sonuçlandırma" ekranı duruyor.)

HAFTALIK BULUŞMA SEÇİMİ:
  - Her Pazar 23:59'dan sonra paketi olan kullanıcıya Eşleşme Paneli / Masalarım'da pencere açılır
  - Paketinde kalan türlerden bu hafta hangilerine gireceğini seçer (1, 2 ya da 3 tür); seçim değiştirilemez
  - Sistem kimseyi otomatik taramaya sokmaz; yalnız seçilen türlerin taramasına girilir (WeeklySelection tablosu)
  - Son saatler: Grup Perşembe 18:00, Baş Başa Cuma 18:00, Kankamla Cumartesi 18:00
  - Süresinde seçim yapmayan o türün taramasına girmez, hakkı düşmez
  - Eşleşme alanı: paketi olan kullanıcıda bu hafta seçilmeyen tür "Eşleşme Pasif"; hiç paketi olmayanda "Abonelik Yok"
  - Eşleşme taraması bekleme durumu (web + mobil, useMasaTabs isScanWaiting): bu hafta seçilen türlerden en az birinin buluşma saati
    (Grup Cuma, Baş Başa Cumartesi, Kankamla Pazar 20:00) geçmemişse tarama aktif; değilse (paket yok, seçim yok ya da saatler geçmiş)
    bekleme: radar ışığı durur, bütün semt noktaları "Düşük" grisinde / aynı boy / hareketsiz, "Semt Masa Yoğunluğu" kartları gri.
    Yeni hafta (Pazar 23:59) seçimin haftasından yeniden hesaplanır
  - Tarama durumu gösterimi (web + mobil Eşleşme Paneli): BEKLEME = geri sayım kartında "Yeni tarama başlamasına" gösterilen durum
    (mevcut durum değişkenleri: meetingTarget === null && waitingScan; ayrı zaman hesabı yok), AKTİF = tarama başlamış.
    BEKLEME'de kırmızı tarama dilimi bulunduğu açıda durur (gizlenmez); başlığın sağındaki rozet "PASİF" / "INACTIVE" (nokta, yazı,
    kenarlık #ff3b30); "Semt Masa Yoğunluğu" başlığının sağında aynı satırda dikey ortalı "Tarama bekleniyor" / "Waiting for scan"
    (gövde fontu, 13, #FFFFFF, opaklık 0.6). AKTİF'te dilim döner, rozet "CANLI" / "LIVE" (nokta, yazı, kenarlık yeşil #22c55e), başlık
    yanındaki yazı yok. Semt kartlarının altında "Tarama bekleniyor" yazısı yoktur. Rozet boyut / konum / font aynı
  - GET /weekly-selection, POST /weekly-selection {types[]} (JWT)
  - Pencere tasarımı (web + mobil): başlık "Bu hafta hangi masaya katılmak için eşleşme taramasına girmek istiyorsunuz?";
    her tür için kart: solda eşleşme alanındaki halka ikonu, sağda kalın başlık + küçük alt metin
    (Grup Masası / Baş Başa Masası / Kankamla Masası metinleri; buluşma Cuma / Cumartesi / Pazar 20:00). Yalnız paketinde hakkı
    olan türlerin kartı görünür. "Sonra" ve "Seçimi Onayla" butonları, son saatler ve seçimin değiştirilemezliği aynen
  - Eşleşme taraması Katılım satırı: Grupta "Katılım x/6:" tek başına, isimler bir alt satırda; her kısaltma cinsiyet renkli
    çerçeveli yuvarlak dairede (web + mobil). Baş Başa ve Kankamla satırı eskisi gibi

PROFİL FOTOĞRAFI (web + mobil):
  - Profilim ekranının en üstünde büyük yuvarlak profil alanı (KYC kartının altında): fotoğraf yoksa ad soyad kısaltması,
    çerçeve cinsiyet rengi; sağ altta palet renginde kalem ikonlu düzenleme butonu. Fotoğraf zorunlu değil
  - Yalnız KYC onaylandıktan sonra yüklenir; onaysızda kalem: "Profil fotoğrafı kimlik doğrulamasından sonra yüklenebilir."
  - Yalnız galeriden seçilir (mobilde kamera seçeneği yok; web'de capture özniteliği yok). Kullanıcının tek profil fotoğrafı olur
  - Yüklenen fotoğraf admin onayına düşer (ProfilePhoto tablosu, PENDING / APPROVED); onay beklerken önceki onaylı fotoğraf,
    yoksa kısaltma görünür. Yeni yükleme önceki onay bekleyen fotoğrafı (dosya + kayıt) siler
  - Yükleyince "Fotoğrafın onay sürecinde." mesajı; onay bekleyen fotoğrafı olanda Profilim'deki profil dairesinin altında küçük punto
    "Fotoğrafın onay sürecinde." (/auth/me profilePhotoPending); onay ya da retle kaybolur (web + mobil)
  - Mobilde masa kartından fotoğraf yüklenince kullanıcı bilgisi (/auth/me) yenilenir; Profilim'deki "Fotoğrafın onay sürecinde." hemen görünür
  - Admin onayı: yeni fotoğraf geçerli, önceki onaylı fotoğraf dosya + kayıt silinir. Admin reddi: yeni fotoğraf dosya + kayıt
    silinir, önceki onaylı kalır, kullanıcıya bildirim "Yüklediğin fotoğraf kimliğindeki fotoğrafla eşleşmiyor."
  - Dosyalar uploads/profile-photos/<userId>/ altında WebP, iki boyut: p-….webp uzun kenar 1080 (tam ekran, Profilim büyük daire),
    p-….s.webp uzun kenar 200 (alt menü, liste, küçük daireler; mobil lib/photo.ts). Onaylılar GET /media/profile-photos/:userId/:file
    ile herkese açık. Eski fotoğraflar backend/scripts/profile-photo-sizes.js ile dönüştürülür
  - Uçlar: GET/POST /users/me/profile-photo (JWT); GET /admin/profile-photos, GET /admin/profile-photos/:id/file,
    POST /admin/profile-photos/:id/approve, POST /admin/profile-photos/:id/reject (ADMIN/SUPERADMIN). /auth/me → profilePhotoUrl
  - Admin "Profil Fotoğrafları" ekranı (web + mobil): yüklenen fotoğraf ve KYC kimlik ön yüzü yan yana, Onayla / Reddet; görsellere basınca
    uygulama / sayfa içinde tam ekran büyük görünüm (görselin tamamı), basınca / geri tuşu / Esc ile kapanır. Profil fotoğrafı alanlarında
    Janti Haydar görseli yoktur
  - Profilim'deki profil fotoğrafına basınca tam ekran büyük görünüm (Instagram gibi); kalem butonu yükleme akışını açar. Büyük görünüm
    ekrana (fotoğraf dahil) basınca ya da geri tuşuyla kapanır (masa detay kartında da aynı)
  - Mobil alt menü profil sekmesinde onaylı fotoğraf varsa kısaltma yerine fotoğraf
  - Admin panelinde kullanıcıların tıklanabildiği kısaltmalarda (Açık Masalar katılımcıları ve başbaşada eşi bekleyenler, web + mobil)
    onaylı fotoğraf varsa kısaltma yerine fotoğraf

MASA DETAY KARTI (web + mobil):
  - Katılımcıların onaylı profil fotoğrafları herkese görünür; fotoğrafı olmayanda kısaltma. Fotoğrafa basınca tam ekran büyük görünüm;
    kişi kendi fotoğrafına basarsa sağ altta palet renginde kalem butonu (yükleme akışı). Bekleme radarında fotoğraf gösterilmez
  - "Meslekler:" başlığı ve altında katılımcıların meslekleri (User.occupationSector): her satırda bir, yalnız yazı, ikonsuz;
    sıra her istekte sunucuda karışık, kime ait olduğu hiçbir şekilde gönderilmez

MOBİL GİRİŞ (yalnız mobil uygulama):
  - Mekân girişi ("M.Girişi") ve mekân paneli mobil uygulamada yok (web'deki mekân girişi aynen)
  - Giriş ekranı: tam ekran arka plan görseli (assets/mobilappscreen.webp; ekranı kaplar, kenarlardan kırpılır, esnetilmez, ortalı);
    logo yok (giriş ve "Tekrar hoş geldin" ekranında); görseli içeren alan tam ekran genişliği ve yüksekliği kadar, ekstra büyütme yok;
    arka plan dönüşümlü: mobilappscreen.webp → mobilappscreen2.webp → mobilappscreen3.webp → baştan; giriş ya da "Tekrar hoş geldin"
    ekranı her açıldığında sıradaki görsel (açılış, beni hatırla / beni unut çıkışı dahil), son sıra cihazda saklanır (AuthFlow.tsx);
    altta yasal metin "Devam ederek Kullanım Koşulları'nı kabul edersin. Verilerini nasıl işlediğimizi öğrenmek
    için Gizlilik Politikası ve Çerez Politikası'nı inceleyebilirsin." (/kullanim-kosullari, /gizlilik-politikasi, /cerez-politikasi);
    altında tam genişlikte yuvarlak üç buton: "Telefon Numarası ile devam et" (telefon ikonu), "E-posta ile devam et" (zarf ikonu), "Kayıt Ol"
  - Telefon → "Numaranı alabilir miyiz?" (TR +90 + numara, İlerle) → WhatsApp kod ekranı. E-posta → "E-postan nedir?" (İlerle) →
    "Şifreni gir" (Giriş Yap, "Şifremi unuttum" butonu — PillButton normal stil). Kayıt Ol → mevcut kayıt akışı. Giriş adımlarında sol üstte geri ok
  - "Kayıt Ol" (app/kayit.tsx) aynı sade görünüm: logo / kart yok, sol üstte geri ok, sola hizalı kalın başlıklar, tam genişlikte butonlar
  - Mobilde Janti Haydar garson görselleri yoktur (Eşleşme Paneli geri sayım kartı dahil); web'de duruyor
  - Admin "Yeni Bot" / "Botu Düzenle" penceresi klavye açılınca kayar, odaklı alan klavyenin üstünde (ADialog keyboardScroll)
  - Şifre sıfırlama ekranları (sifremi-unuttum, sifremi-sifirla) aynı sade tasarım (StepScreen): logo / kart yok, sol üstte geri ok,
    sola hizalı kalın başlık. 1. adım "Şifreni sıfırla" + "Kayıtlı telefon numarana WhatsApp ile 6 haneli bir kod göndereceğiz." +
    TR +90 ve numara + en altta tam genişlikte "Kod Gönder"; "Girişe Dön" yok. 2. adım "Yeni şifre": kod, yeni şifre, şifre tekrar,
    "Şifremi Sıfırla", "Kodu tekrar gönder"
  - Mobilde sistem uyarı penceresi (Alert.alert) kullanılmaz: components/AppAlert.tsx showAlert (Ahenk paleti; tek buton "Tamam"
    BtnPrimary, vazgeç BtnGhost, onay BtnPrimary, silme / ban BtnTone danger). iOS'taki ActionSheetIOS seçim menüleri ayrı
  - "Rehberden Seç" penceresinde başlık ve X güvenli alanın içinde (Android'de durum çubuğunun altında)
  - Mobil uygulamadaki "Çıkış" butonları ortak components/LogoutChoice.tsx kullanır. Üye, ADMIN ve SUPERADMIN hesaplarında (Profilim
    "Çıkış Yap", Yönetim Paneli "Çıkış") "Bu cihazda beni hatırla" / "Bu cihazda beni unut" / "Vazgeç". ADMIN / SUPERADMIN de
    "Tekrar hoş geldin" ekranını kullanır (doğrulama sonrası Yönetim Paneli). Web'de kalıcı oturum (365 gün yenileme çerezi) bütün
    rollerde aynı; rol ayrımı yoktur.
  - ADMIN / SUPERADMIN biyometrik kilit (mobil, lib/adminLock.ts + components/AdminLockOverlay.tsx): kalıcı oturumda uygulama sıfırdan
    açıldığında ve uygulama arka planda 5 dakikadan uzun kaldıktan sonra öne gelince tam ekran "Yönetim paneli kilitli" + Face ID /
    Touch ID / parmak izi / yüz tanıma; biyometrik tanımlı değilse cihaz şifresi (disableDeviceFallback false). Başarısızsa oturum
    kapanmaz, "Tekrar Dene". "Tekrar hoş geldin" biyometrisinden hemen sonra tekrar sorulmaz. Normal üyelerde kilit yok.
    Cihazda biyometrik de ekran kilidi (şifre / desen / PIN) de yoksa ADMIN / SUPERADMIN için kalıcı oturum ve "Bu cihazda beni hatırla"
    kapalı: her uygulama açılışında oturum kapanır, normal giriş ekranından şifreyle girilir; arka plan kilidi kurulmaz; kilit açıkken
    ekran kilidi kaldırılmışsa kilit kalkar, oturum kapanıp giriş ekranına gidilir (kilit hiçbir cihazda açılamaz hâlde kalmaz).
    NSFaceIDUsageDescription (iOS, tek metin, üye ve yönetici): "Hesap güvenliğiniz için Face ID kullanılır."
  - İzin bilgilendirme ekranı (components/PermissionIntro.tsx, iOS + Android): giriş sonrası ilk açılışta bir kez (bu sürümü yükleyen
    mevcut kullanıcılar dahil) tam ekran; gösterildiği cihazda saklanır (AsyncStorage ahenk_permission_intro_v1). İçerik: Bildirimler
    (masa onayı, buluşma hatırlatmaları), Kamera ve Galeri (profil fotoğrafı, kimlik doğrulama, sorun bildirimi; ilgili ekranda
    istenir), Konum (yalnız Acil Yardım'da, o anda). "Devam Et" yalnız bildirim iznini ister; daha önce verilmiş / reddedilmişse istemez.
    Sekmeler ve Yönetim Paneli yerleşimlerinde bağlı; yönetim kilidi açıkken bekler. Kamera, galeri, konum açılışta istenmez
  - Kalıcı reddedilmiş izin (lib/permissions.ts): kamera, galeri, konum (ön plan ve "Her zaman"), bildirim ve rehber izni gerektiği anda
    okunur; canAskAgain false ise iznin neden gerektiği + "Ayarlara Git" (Linking.openSettings) uyarısı; aksi hâlde sistem penceresi
    Unut: oturum kapanır, hatırlama bilgisi silinir.
    Hatırla: oturum kapanır, yenileme token'ı ve ad cihazda (secure-store) saklanır; açılışta "Tekrar hoş geldin, [ad]!" + "Giriş Yap"
    (aynı arka plan, altta yasal metin) → Face ID / parmak izi (expo-local-authentication) → "Cihaz Doğrulandı" (palet renginde onay
    dairesi) → şifresiz giriş. Başarısız ya da cihazda yoksa normal giriş ekranı. Yeni girişte hatırlama bilgisi silinir.
    "Beni hatırla" ile çıkışta doğrudan "Tekrar hoş geldin, [ad]!" ekranına gidilir (süren token yenilemesi beklenir); uygulama kapatılıp
    açılınca da bu ekran görünür
  - Mobil açılışta yerel açılış görseli (siyah zemin, Ahenk logosu) en az 3 sn görünür; 3 sn dolmadan, yazı tipleri yüklenmeden ve açılış yönlendirmesi bitmeden kapanmaz.
  - Üye alt menüsü (mobil, app/(tabs)/_layout.tsx): sekme sırası Ana Sayfa (Ahenk logosu, Eşleşme Paneli), Takvim (Masalarım),
    ortada büyük Profil, Paketler (bilet), Bildirimler (zil). Seçili olmayan ikon beyaz (#FFFFFF, opaklık 1), seçili ikon #FF3B30
    (theme.ts tabNavIcon). Orta Profil butonu ölçüleri theme.ts tabCenter değerlerinden (çap 64, 22 yukarı taşma, zemin renginde 4 halka,
    hafif gölge, 2 iç çerçeve: seçili değil beyaz, seçili #FF3B30; avatar daireyi doldurur). Zemin, yükseklik aynı.
    Seçili sekmede (Profil hariç) ikonun arkasında hap zemin: 64×36, köşe 18, #c0392b opaklık 0.20, ikonla ortalı, 150 ms'de belirir
    (theme.ts tabPill, TabIcons.tsx TabPill). Profil butonunun görünümü değişmez.
    Bildirim rozeti (Bildirimler ikonu sağ üst, theme.ts tabBadge): #ff3b30 daire, beyaz kalın sayı (11), tek hanede çap 18, çok hanede
    içeriğe göre genişler, 2 px koyu kenarlık (alt menü zemini), 99'dan büyükse "99+". Sayı = son Bildirimler sayfası açılışından sonra
    gelen okunmamış bildirim sayısı (User.lastNotificationsSeenAt; GET /notifications newUnreadCount, hasUnread). Bildirimler sayfası açılınca
    PATCH /notifications/seen → sayı kaybolur, okunmamış bildirim varken 8×8 #ff3b30 nokta kalır; "Tümünü okundu işaretle" ile nokta kaybolur.
    Paketim sekmesindeki kalan masa hakkı rozeti aynen.
    Yönetim Paneli menüsü ayrı (dokunulmaz)
  - 100 TL indirim penceresi (Winback otomatik açılış) izin tanıtım ekranı (PermissionIntro) kapanmadan açılmaz
    (PermissionIntro permissionIntroDone → Winback WinbackHost); tanıtım gösterilmeyecekse eskisi gibi hemen açılır
  - Profilim alt bölümü sırası (mobil): yasal bağlantılar kartı (Gizlilik Politikası, Kullanım Koşulları, KVKK Aydınlatma Metni,
    Hesap Silme — web sayfaları uygulama içi tarayıcıda, satırlar 44 pt) → "Çıkış Yap" → "Tüm cihazlardan çıkış yap" → küçük uygulama
    logosu → "Versiyon 0.1.3" → "Hesabımı Sil". Mobil sürüm 0.1.3 (Android versionCode 4)
  - Mağaza ayarları (app.json): iOS bundleIdentifier co.ahenk.app (Android package ile aynı); eas.json "production" profili (Android AAB,
    iOS mağaza), "preview" APK profili duruyor. iOS privacy manifest app.json ios.privacyManifests'te (prebuild PrivacyInfo.xcprivacy
    üretir): NSPrivacyTracking false; UserDefaults CA92.1, FileTimestamp C617.1 / 0A2A.1 / 3B52.1, SystemBootTime 35F9.1, DiskSpace
    E174.1 / 85F4.1; toplanan veri türleri Name, EmailAddress, PhoneNumber, PreciseLocation, SensitiveInfo, PhotosorVideos, AudioData,
    Contacts, EmailsOrTextMessages, OtherUserContent, CustomerSupport, UserID, PurchaseHistory, OtherDataTypes (kimliğe bağlı, takip yok,
    uygulama işlevi). NSPhotoLibraryUsageDescription: profil fotoğrafı, sorun bildirimi görselleri, yönetim panelinde bot ve mekân
    fotoğrafları. Android blockedPermissions: WRITE_CONTACTS (tools:node="remove"); RECEIVE_BOOT_COMPLETED izni var
  - Acil yardım konum açıklama ekranı (components/LocationDisclosure.tsx, iOS + Android): ön plan ya da arka plan konum izni istenmeden
    önce tam ekran (Ahenk, Acil Yardım, ne zaman toplandığı — talep süresince ~10 sn'de bir, "Her zaman" izniyle arka planda / uygulama
    kapalıyken, Android'de telefon yeniden başlatılınca da —, kiminle paylaşıldığı — acil yardım ekibi, emniyet, OpenStreetMap Nominatim).
    "Devam Et" izni ister, "Şimdi Değil" izin istemeden döner. Aynı talep akışında en fazla bir kez
  - Android yeniden başlatma: açık acil yardım talebi varken kayıtlı konum görevi expo-task-manager (RECEIVE_BOOT_COMPLETED) ile açılışta
    geri yüklenir, gönderim uygulama açılmadan sürer ("Her zaman" izni gerekir). Görev talep kapanınca silinir; yerel talep kaydı yoksa ya
    da sunucu talebin kapandığını bildirirse gönderim durur (lib/sosLive.ts). iOS önemli konum değişikliği davranışı aynı
  - Prime abonelik ekranı (mobil): butonun altında abonelik adı / süresi / fiyatı, otomatik yenileme (dönem bitiminden en az 24 saat önce
    iptal edilmezse), ödemenin Apple / Google hesabından alındığı ve mağaza hesap ayarlarından yönetim / iptal bilgisi, Kullanım Koşulları
    (EULA) ve Gizlilik Politikası linkleri, "Satın Alımları Geri Yükle" (expo-iap restorePurchases + getAvailablePurchases → POST
    /payment/store/verify). IAP kapalıysa (GET /payment/store/status {enabled}) mağazaya bağlanmadan "Şu anda kullanılamıyor"
  - Android APK sadece arm64-v8a mimarisiyle, release modunda derlenir (EAS preview profili; plugins/withAndroidRelease.js: R8 kod
    küçültme + kaynak küçültme açık, reactNativeArchitectures=arm64-v8a, Hermes açık). APK https://ahenk.co/apk/ahenk-<sürüm>.apk
  - Eşleşme Paneli: KYC kartı yokken üstte boşluk kalmaz, Grup / Baş Başa / Kankamla halkaları durum çubuğunun hemen altından başlar
  - Mobilde aynı anda süren aynı GET isteği bir kez atılır (lib/api.ts); /auth/me açılışta ön yüklenir. Backend /auth/me ve
    /meetings/dashboard sorguları paralel çalışır
  - Mobil yoklamalar yalnız odaktaki sekmede çalışır (useMasaTabs, Eşleşme Paneli canlı veriler); uygulama içi görseller gösterildikleri
    boya yakın çözünürlükte tutulur

HESAP SİLME:
  - Talep durumları yalnız PENDING / APPROVED (DeletionRequestStatus); admin reddi yoktur. PATCH /admin/deletion-requests/:id yalnız
    {status:"APPROVED"} (SUPERADMIN). Panelde (web + mobil) yalnız "Onayla"; talep en geç 48 saat içinde sonuçlanır
  - Onayda silinenler: profil, OCEAN, KYC kaydı + şifreli dosyaları (.enc) ve boşalan uploads/kyc/<userId>/ klasörü (boş değilse
    silinmez, hata loglanır, işlem sürer), rehber / kullanıcı engelleri, sohbet mesajları, bildirimler, oturumlar,
    bekleme listesi, winback, davet telefonu, profil fotoğrafları (ProfilePhoto + uploads/profile-photos/<userId>/), sorun bildirimleri
    (ProblemReport + uploads/problem-reports/<id>/); hesap anonimleşir; masa geçmişi ve değerlendirmeler kimliksiz kayda taşınır
  - Saklanan: ödeme ve fatura kayıtları 5 yıl (VUK); acil yardım / şikâyet / yaptırıma karışan kişinin kimlik bilgisi silinmeden sonra
    2 yıl (yalnız SUPERADMIN); banlı hesabın telefon özeti
  - Herkese açık https://ahenk.co/hesap-silme (apps/web/app/hesap-silme): giriş yapmamış kullanıcı otomatik /giris?donus=/hesap-silme'ye
    gider, giriş sonrası geri döner (giriş sayfasında izinli dönüş yolu yalnız /hesap-silme) ve talep oluşturur. Silinen / saklanan
    veriler ve süre yazılıdır. Footer Yasal grubunda "Hesap Silme" linki
  - KYC metni (KVKK, Gizlilik Politikası, /hesap-silme birebir): "Hesap silinene kadar saklanır; hesap silme talebi onaylanınca kimlik
    görselleri, canlılık videosu ve KYC kaydı silinir"
  - Gizlilik Politikası ve KVKK: KYC Ahenk sunucusunda AES-256-GCM şifreli, hesap silinene kadar; üçüncü taraflar iyzico, Meta (WhatsApp
    Business API), Google Firebase Cloud Messaging, Anthropic (masa uyum raporu: katılımcı başı OCEAN skoru + cinsiyet, rapor masa
    kartında), OpenStreetMap Nominatim, Apple / Google mağazaları, Google Analytics / Meta Pixel (web çerezleri). Cloudflare yoktur

WEBP KURALI:
  - Web ve mobil projedeki görseller WebP'dir (kalite 80, şeffaflık korunur; mobil sekme ikonları assets/tabs/*.webp, tintColor çalışır).
  - İstisnalar (PNG / JPG kalır): mobil uygulama ikonu, Android adaptive icon katmanları, splash görseli, bildirim ikonu ve app.json /
    app.config'te tanımlı tüm görseller (assets/app-icon.png, adaptive-icon.png, start_logo.jpg, icon.png); web favicon, apple-touch-icon,
    manifest ikonları (icon-192 / icon-512), OG ve sosyal medya paylaşım görselleri (og-image.jpg, paylaşım görselinde kullanılan
    public/logo.png), e-posta şablonlarında kullanılan görseller; tüm SVG ve GIF dosyaları; KYC dosyaları.
  - Yüklenen görseller backend'de WebP'ye çevrilir (common/image-webp.ts toWebp). Profil fotoğrafı, bot fotoğrafı ve mekân fotoğrafları
    mevcut ayarla (kalite 82, profil / bot 1080 + 200 boyutları); diğer bütün görsel yüklemeleri (sorun bildirimi, kariyer fotoğrafı,
    Janti Haydar başvurusu) UPLOAD_WEBP_QUALITY 80, önce EXIF yönü uygulanır, EXIF silinir, boyut değişmez; diske yalnız .webp yazılır,
    veritabanına .webp yolu kaydedilir. Çevrilemeyen görselde yükleme hata verir ve hata loglanır, orijinal kaydedilmez.
    KYC yüklemeleri orijinal formatta (AES-256-GCM şifreli)

İPTAL EDİLEN KONU: Admin'in verdiği paketin hangi admin tarafından verildiğinin kaydı / gösterimi (rapor104 ve rapor105'te sorulan)
  iptal edildi; tekrar sorulmayacak.

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
  - PATCH /admin/users/:id/test-lock-reset — test 6 takvim ayı kilidini sıfırla

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
  - "Eşleştirme Aktif" (MATCHING_ENABLED, açıklama: "Grup, baş başa ve Kankamla masa ataması yapılsın mı. Kapalıyken hak düşümü,
    kilit ve eşleştirme bildirimleri de durur."): kapalıyken eşleştirmeyle ilgili her zamanlanmış iş başlamadan ayarı okur ve hiçbir
    işlem yapmadan çıkar (app-settings.ts isMatchingEnabled): grup / baş başa / Kankamla masa atamaları (saatlik ve 23:44 son tarama,
    atama kuyruğu matching-assign: kişi ataması, havuz taraması, kapanış botları), mekân ataması ve mekânsız masa hatırlatması,
    Perşembe / Cuma / Cumartesi 23:59 kapanışları (Cumartesi Kankamla kilidi ve bekleme listesi dahil) ve bütün hak düşümleri,
    12 saat kala kapanış hatırlatmaları, Perşembe 20:00 grup iptal özeti, Cuma / Cumartesi / Pazar 10:00 masa bildirimleri.
    Ayar açıkken davranış aynı. Masa kapanışı (6 saat sonra), gelmeyen işaretleme, yola çıktım, değerlendirme bildirimleri,
    paket süre dolumu, Prime, winback ve ödeme işleri bu ayara bakmaz

YÖNETİM PANELİ EK KURALLARI (web + mobil):
  - Bot profil fotoğrafı: Bot Ekle / Botu Düzenle formunun üstünde yuvarlak önizleme (yoksa baş harfler, cinsiyet renkli çerçeve) ve
    "Profil Fotoğrafı Yükle" / "Fotoğrafı Değiştir"; yalnız galeri / dosya. POST /matching/admin/bots/:id/profile-photo (yalnız SUPERADMIN):
    ProfilePhoto tablosuna doğrudan APPROVED kaydedilir (onay yok), önceki fotoğraf (dosya + kayıt) silinir; GET /matching/admin/bots photoUrl döner;
    bot silinince fotoğraf klasörü de silinir
  - SUPERADMIN, SUPERADMIN ve ADMIN hesaplarını düzenleyebilir (kişisel bilgi, durum, yaptırım, yaptırım kaldırma, gelmedi uyarısı;
    assertCanSanction); ADMIN bu hesaplara işlem yapamaz; kimse kendi hesabını değiştiremez
  - Kullanıcılar listesi: satırda yalnız ad soyad, telefon ve "Detay". Detay penceresinin üstünde 72 px yuvarlak profil (onaylı fotoğraf,
    yoksa cinsiyet renkli çerçeve + baş harfler); e-posta, durum, Şehir, Bu hafta (aktif şehir), Paket, OCEAN Ort. Detay'da
    (GET /admin/users/:id photoUrl, primaryCityName, activeCityName)
  - Abonelik (Paket) Fiyat Geçmişi: en yeni en üstte; kapalı kayıtta Tarih + Paket, basınca Ham, Web, Mobil, Yapan açılır;
    sayfa başına 20 kayıt, "← Önceki", sayfa numaraları, "Sonraki →"; backend kayıt sınırı yok
  - KYC Başvuruları: kapalı kayıtta ad soyad, tarih, durum (Bekliyor / Onaylandı / Reddedildi / Şüpheli); basınca ön yüz, arka yüz, video,
    Onayla / Reddet ve red sebebi açılır, tekrar basınca kapanır; medya yalnız açılınca yüklenir
  - Kariyer başvurusu fotoğrafı: /kariyer formunda CV altında zorunlu "Fotoğraf *" (tek dosya; not "Yüzünüzün net olduğu herhangi bir
    fotoğraf yüklemelisiniz"); JPEG/PNG/WebP/HEIC/HEIF, en fazla 10 MB, WebP olarak uploads/career-photos/ (herkese açık değil;
    CareerApplication.photoFile). GET /admin/careers/:id/photo yalnız SUPERADMIN; panelde 64 px, basınca tam ekran (basınca / Esc / geri tuşu kapanır)
  - Menü: üst barda "AHENK YÖNETİM PANELİ" yanında logo yok; açılır menüde "Acil Yardım" emoji yok, kırmızı geçişli hap etiket (beyaz kalın
    büyük harf, solda beyaz nokta, kırmızı parıltı); mobil çekmece güvenli alanın hemen altından başlar (statusBarTranslucent),
    web mobil görünüm çekmecesi env(safe-area-inset-top)
  - Bot atama bildirimi: masaya bot atandığında (otomatik grup / baş başa botu, elle bot ekleme, eşi bekleyene elle bot, elle kurulan
    masadaki bot) her bot için Uyarılar'a BOT_ASSIGNED kaydı (AdminAlert.message: bot adı soyadı, masa türü, mekân, şehir, buluşma tarihi
    ve saati; mekân yoksa "Atanmadı") ve yalnız SUPERADMIN hesaplarına bildirim (IN_APP + FCM, "Masaya bot atandı"). BOT_ASSIGNED ve
    BOT_NOT_FOUND uyarılarını yalnız SUPERADMIN görür / okundu işaretler (backend getAlerts / markAlertRead)
  - Bot kullanım sayacı: Bot Yönetimi sayfasının üstünde "Bu hafta bot kullanılan masa" büyük rakam, altında son 8 hafta (bu hafta dahil,
    en yeni üstte; hafta Pazartesi – Pazar TR, buluşma tarihine göre; iptal edilmemiş ve en az bir aktif bot katılımcısı olan masa).
    GET /matching/admin/bots/usage yalnız SUPERADMIN

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

AKTİF ŞEHİRLER (4 şehir):
İstanbul, Ankara, İzmir, Antalya
Pasif bölgeler: Dubai Marina, Jumeirah Lake Towers (JLT), Downtown Dubai — City tablosunda aktif = false, şehir listelerinde "Yakında" grubunda.
Bölgeler admin panelindeki "Bölgeler" sayfasından (web + mobil) aktif / pasif yapılır.

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
- Web: manuel numara girişi (ülke kodu seçici + numara)
- Numaralar ContactBlock.hashedPhone alanında (adı eski) açık E.164 formatında (+905…, +44…) saklanır; hash kullanılmaz. Elle eklemede
  (web + mobil) ülke kodu seçici, varsayılan ülke kullanıcının kayıtlı telefonunun ülkesi; doğrulama libphonenumber-js. Rehberden Seç (mobil):
  başında + varsa olduğu gibi, yoksa kayıtlı telefonun ülkesi varsayılarak E.164'e çevrilir; çevrilemeyen numara eklenmez, satırında
  "Geçersiz numara" / "Invalid number". Backend E.164 olmayan numarayı kaydetmez (migration 20261116062126_contact_blocks_e164 eski
  kayıtları +90 varsayarak dönüştürür)
- Maksimum 50 numara per kullanıcı
- Eşleştirme algoritmasında: engel listesi User.phone ile aynı formatta (E.164) karşılaştırılır, eşleşme varsa ikisi de birbirinin havuzuna dahil edilmez (UserBlock ile aynı mantık)
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
  - Ban, askıya alma ve admin iptali iyzico aboneliğini de iptal eder (iyzico hatası loglanır, işlem sürer); sunucuda iptal
    edilmiş kayda sonradan gelen yenileme bildirimi kaydı yeniden aktif etmez, yalnız loglanır
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
  - ThrottlerModule backend'e eklenmiştir (app.module.ts); ThrottlerGuard bütün uçlarda global çalışır (APP_GUARD).
  - Tek throttler vardır: "default", IP başına 300 istek / 1 dk. Uca özel sınırlar @Throttle({ default: { ttl, limit } }) ile verilir;
    named throttler (short / medium / long / auth) yoktur. Sayaçlar süreç belleğindedir.
  - /auth uçları: controller geneli 10 / 1 dk (register, login, logout, logout-all, refresh). Ayrı sınırı olanlar:
    register/send-otp 5, register/verify-otp 10, forgot-password 5, reset-password 5, send-login-otp 5, verify-login-otp 10,
    me 60, cities 300, districts 300 (hepsi 1 dk'da).
  - /venue-panel uçları: controller geneli 60 / 1 dk. Ayrı sınırı olanlar: login 10, send-login-otp 5, verify-login-otp 10,
    refresh 20, forgot-password 5, reset-password 5, change-password 5, deactivate 5 (hepsi 1 dk'da).
  - /partnerships, /careers, /janti-haydar (başvuru formları): controller geneli 5 / 1 dk; verify-otp 10 / 1 dk.
  - /kanka/invite 5 / 1 dk; /kanka/link/:token 30 / 1 dk. POST /sos/:meetingId/report 5 / 5 dk.
  - @SkipThrottle (sınır uygulanmaz): /admin controller'ı (admin.controller.ts), /admin/janti-haydar controller'ı ve
    GET /janti-haydar/instagram.
  - OTP: deneme sayacı atomiktir, kod başına 3 deneme. Telefon başına Türkiye takvim gününde (Europe/Istanbul) günde 10 kod;
    üye OTP'si ve mekân paneli OTP'si ortak sayaçtadır, başarısız gönderimler sayılmaz. Sınır aşılınca:
    "Bugünlük doğrulama kodu hakkın doldu. Yarın tekrar deneyebilirsin."
  - Rate limit: login, telefon değiştirme, şifre sıfırlama ve şifremi unuttum endpoint'lerinde Redis tabanlı dakikada 5 limit
    (IP + telefon; e-posta + şifre girişinde IP + e-posta).
  - Hesap kilidi: yanlış şifre ve yanlış OTP denemeleri hesap başına birlikte sayılır; 5 başarısız denemeden sonra hesap
    15 dakika kilitlenir. Mesaj: "Çok fazla hatalı deneme yapıldı. Hesabın 15 dakika boyunca kilitlendi."
  - Tüm WhatsApp OTP akışlarında kod geçerlilik süresi ve yeni kod bekleme süresi 120 saniyedir, tek sabitten okunur
    (backend/src/auth/otp/otp.service.ts OTP_TTL_SECONDS).
  - Bekleme süresi telefon + akış bazlı Redis'te tutulur. Süre dolmadan istenirse kalan saniye döner.
  - OTP kodu telefon + akış bazlı anahtarda tutulur.
  - Web ve mobil OTP ekranlarında sunucudan gelen saniyeyle geri sayım sayacı gösterilir, sayaç bitince "Yeni kod gönder"
    butonu aktif olur.
  - Giriş ve şifremi unuttum akışlarında kayıtlı olmayan numaraya, kayıt ol akışında kayıtlı numaraya kod gönderilmez ve
    uyarı döner.
  - Mekân paneli giriş ve şifremi unuttum: hesap aktif değilse VENUE_ACCOUNT_INACTIVE, numara birden fazla mekân hesabına bağlıysa VENUE_PHONE_MULTIPLE döner; iki durumda kod gönderilmez, sayaç başlamaz, uyarı butonsuzdur.

API CLIENT KURALLAR (web):
  - apps/web/lib/api.ts içinde PREFIX sabiti API_PREFIX olarak export edilir.
  - Özel fetch ihtiyacı olan sayfalarda (örn. giris/page.tsx) API_PREFIX import edilir; çift tanım yapılmaz.
  - api.ts'den setToken/clearToken/getToken da export edilir; localStorage token yönetimi buradan yapılır.

ÇOK DİL (TR / EN), BÖLGE, TELEFON, KİMLİK TÜRÜ:
  - İngilizce seçeneği packages/shared/src/i18n/index.ts ENGLISH_ENABLED bayrağıyla açılır / gizlenir; false iken her durumda Türkçe,
    dil satırı ve dünya ikonu gizli.
  - Çeviri anahtarı zorunluluğu: kullanıcıya görünen bütün mobil ve web metinleri yalnız packages/shared/src/i18n/tr.json ve en.json'daki
    anahtarlardan gelir (web next-intl, mobil i18next + react-i18next); ekranlarda sabit Türkçe metin yazılmaz, yeni metinde iki dosyaya
    da anahtar eklenir. İngilizce doğal, samimi, "you" hitaplı; Ahenk ve Prime çevrilmez; "Kişilik Ağacım" → "My Personality Tree".
  - Admin paneli ve mekân paneli Türkçe kalır, çevrilmez (mobil yönetim ekranları dahil).
  - Backend mesaj dili: kullanıcıya dönen hata ve bilgi mesajları tr.json / en.json "errors.*" anahtarlarında; kod Türkçe metinle yazılır,
    backend/src/common/api-messages.ts (global filtre + dönüştürücü) metni anahtar üzerinden seçilen dile çevirir. Yeni kullanıcı mesajında
    iki dosyaya da errors.* anahtarı eklenir. Dil sırası: 1) giriş yapmış kullanıcının language alanı, 2) Accept-Language başlığı ("en" ile
    başlıyorsa English), 3) Türkçe. Hata yanıtlarının alan yapısı ve HTTP kodları değişmez, yalnız message metni. /admin/ ve /venue-panel/
    uçlarında mesajlar Türkçe kalır.
  - Accept-Language: web ve mobil her API isteğinde o anki arayüz dilini (tr / en) gönderir (web lib/api.ts langHeaders — <html lang>;
    mobil lib/api.ts langHeaders — i18n dili; elle fetch / XMLHttpRequest yapan yerler ve packages/ui istekleri dahil).
  - Dil belirleme sırası (resolveLanguage): 1) giriş yapmış kullanıcının hesabındaki dil (User.language: tr | en, varsayılan tr),
    2) cihazda / tarayıcıda kayıtlı seçim, 3) cihaz / tarayıcı dili Türkçe ise Türkçe, değilse English. Dil değişince hesaba kaydedilir
    (PATCH /users/me/language). Profilim > Hesap Bilgileri'nde "Dil / Language" satırı (Türkçe / English, seçilide ✓).
  - Web adresleri: Türkçe mevcut adreslerde, İngilizce /en önekiyle (next-intl localePrefix "as-needed", app/[locale]/).
  - Dünya ikonu (dil seçici): mobilde giriş, kayıt ve "Tekrar hoş geldin" ekranlarında sağ üst (sağdan 20 pt; 24×24 görünür, 44×44 dokunma;
    solunda "TR" / "EN" 13, #FFFFFF, opaklık 0.7, 6 pt ara; kart #181818, köşe 12, Türkçe / English, seçilide ✓); webde header'ın sağ ucu.
  - Telefon: kayıt / giriş / şifremi unuttum / kanka davet alanlarında ülke seçici (bayrak + kod, varsayılan 🇹🇷 +90, ülke adı ve koduyla
    aranabilir liste, ülke adları arayüz dilinde); doğrulama libphonenumber-js ile seçilen ülkeye göre; numaralar veritabanında E.164
    (+905…, +44…) saklanır; OTP ve giriş E.164 numarayla çalışır. Profilim telefon değiştirme ve Numara Engelleme'de de ülke kodu seçici
    (varsayılan ülke kayıtlı telefonun ülkesi, E.164 gönderim).
  - Dil soruları: kayıtta tek ekran, herkese "İngilizce biliyor musunuz?" / "Do you speak English?", yalnız İngilizce arayüzle kayıtta
    ayrıca "Do you speak Turkish?"; Türkçe arayüzle kayıtta speaksTurkish = true. User.speaksEnglish / speaksTurkish; Profilim'de
    "İngilizce biliyorum" / "Türkçe biliyorum" anahtarları (PATCH /users/me/spoken-languages).
  - Dil bazlı eşleşme (grup, baş başa, Kankamla; backend/src/matching/matching.service.ts noTurkish / englishFiller / languageCompatible),
    mevcut kurallardan önce zorunlu: a) speaksTurkish = false olan kullanıcı yalnız masadaki herkesin speaksEnglish = true olduğu masaya
    yerleşir; b) speaksTurkish = false olanlar önce birbirleriyle eşleşir; c) masa dolmuyorsa boş yerler telefon kodu +90 olan ve
    speaksEnglish = true olan kullanıcılarla doldurulur; d) dil kuralından sonra cinsiyet dengesi; e) grup masasındaki bot kuralı aynen.
  - KYC kimlik türleri (KycSubmission.idType: TC | YKN | PASSPORT): "TC Kimlik Kartı", "Yabancı Kimlik Kartı (YKN)", "Pasaport". Kimlik numarası
    alanı yok, numara istenmez ve saklanmaz. TC ve YKN'de ön + arka yüz, Pasaport'ta yalnız fotoğraflı sayfa; şifreleme / saklama kuralları
    aynen. Seçilebilir türler bölgenin idTypes alanından. İngilizce arayüzde video metni "My name is [ad soyad]" (ad soyad otomatik).
    Admin KYC ekranında kimlik türü görünür.
  - iyzico satın alma kimlik alanı: önce TC / YKN / Pasaport seçimi, sonra numara (TC mevcut doğrulama; YKN 11 hane rakam, "99" ile başlar;
    Pasaport 6–9 harf / rakam). Numara veritabanına kaydedilmez, yalnız iyzico'ya iletilir.
  - Bölge alanları (mevcut City modeli): countryCode, timezone, currency, defaultLanguage, phoneCountryCode, idTypes, isActive, sortOrder.
    İstanbul, Ankara, İzmir, Antalya: TR, Europe/Istanbul, TRY, tr, +90, TC/YKN/Pasaport. Dubai Marina, Jumeirah Lake Towers (JLT),
    Downtown Dubai: AE, Asia/Dubai, USD, en, +971, yalnız Pasaport, pasif. Admin "Bölgeler" sayfası (web + mobil; GET /admin/regions,
    PATCH /admin/regions/:id, GET /admin/regions/:id/waitlist): liste, alan düzenleme, tek tuşla aktif / pasif, bekleme listesi sayısı ve listesi.
  - Para birimi: Türkiye bölgelerinde TRY (₺), Türkiye dışındaki bütün bölgelerde USD. Dubai'de şimdilik yalnız para birimi alanı var, fiyat yok.
  - Şehir listeleri (mobil + web, kayıt ve şehir seçimi dahil): aktif şehirler (seçilebilir) → ince ayırıcı ortasında "Yakında" / "Coming soon"
    → pasif bölgeler (Dubai Marina, Jumeirah Lake Towers (JLT), Downtown Dubai sırasıyla; soluk, seçilemez, sağında "Haber ver" / "Notify me":
    RegionWaitlist, kullanıcı başına bölgeye bir kez). Aktif yapılan bölge otomatik üst gruba geçer.
  - Tarih / saat: buluşmanın yapıldığı bölgenin saat diliminde; her iki dilde sayısal gg.aa.yyyy ve 24 saat SS:dd; ay ve gün adları arayüz dilinde.
  - Bildirimler: push / IN_APP metinleri alıcının language alanına göre TR ya da EN; WhatsApp şablon dil kodu da language alanına göre
    (İngilizce şablonlar lansmanda Meta'da hazırlanacak).
  - Yasal sayfalar: İngilizce çevirileri /en altında, en üstte "This is a translation for convenience. In case of any conflict, the Turkish
    version prevails." Uygulamada ve webde seçili dil hangisiyse yasal bağlantılar (giriş ekranı yasal metni, kayıt onayları, Tekrar hoş geldin,
    Profilim yasal kartı, web footer ve diğerleri) o dildeki sayfayı açar.
  - Kişilik testi: OceanQuestion.textEn / sectionTitleEn; soru kimlikleri ve puanlama aynı; sonuç (profileEn), boyut ve Kişilik Ağacı metinleri çevrili.
  - Zamanlanmış işler (eşleştirme, kapanışlar, hak düşümleri, bildirim cron'ları) şimdilik TR saatinde (Europe/Istanbul) çalışır; bölge bazlı
    saat dilimine geçiş Dubai aktifleşmeden önce yapılacak.

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
