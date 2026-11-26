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
- Meslek puanı YOKTUR: hiçbir masa türünde ve iki modda algoritmada kullanılmaz (kayıttaki / profildeki meslek alanı ve kolonu durur)
- Sıralama puanı (yalnız sıralama, kimseyi dışlamaz): Planlı'da masa türünün OCEAN anahtarı AÇIKSA OCEAN %100 (Öklid mesafesi,
  normalize 0-100); KAPALIYSA ve Yarın'da her zaman yaş yakınlığı %50 + mekân kategori %50 (match-score.ts tomorrowScore)
- Admin Sistem Ayarları → "Eşleştirme Kriterleri" sekmesi (web + mobil): "OCEAN – Grup" (varsayılan AÇIK), "OCEAN – Baş Başa"
  (KAPALI), "OCEAN – Kankamla" (KAPALI); AppConfig OCEAN_GROUP / OCEAN_ONE_ON_ONE / OCEAN_KANKA, her atamada okunur (restart yok;
  app-settings.ts oceanCriteria). Yalnız Planlı'yı etkiler. Şehir, cinsiyet dengesi, engeller, alkol kuralı, yaş sınırları aynen
- Cinsiyet dengesi: 6 kişi → 3E+3K, 4 kişi → 2E+2K
- Cinsiyet değerleri: yalnızca MALE ve FEMALE
- Grup bot kuralı (Planlı ve Yarın aynı): 3 kişilik masa 1 botla 4'e, 5 kişilik masa 1 botla 6'ya tamamlanır; masaya en fazla 1 bot.
  "5 kişi kalırsa 4'e düşür" kuralı kaldırıldı
- Aynı bot aynı kullanıcıya 4 hafta içinde tekrar atanmaz (recentlyMetBotIds; addGroupBots, admin bot listesi ve placeBot 400 mesajı bu kurala uyar).
- Bot sistemi: seed'de isBot:true olan User kayıtları, admin panelinden aktif/pasif ve isim düzenleme
- Bot OceanScore: seed'de manuel atanır (50/50/50/50/50 varsayılan), test doldurmaları gerekmez
- Bot isimleri admin panelinden güncellenebilir (ad/soyad); diğer alanlar admin yetkisi dışında
- "4 kişi yoksa 12 saat uzat" kuralı kaldırıldı (Yarın Buluşma'da da yok)
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
- "Kanka Davet Et" alt penceresi (web + mobil): telefon alanına dokununca klavye açıldığında pencere klavyenin üstüne kayar; telefon alanı
  ve Davet Et butonu klavyenin üstünde (web visualViewport farkı kadar alt boşluk; mobil ui.tsx Sheet avoidKeyboard, pencere / klavye örtüşmesi kadar)
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
  - MASADA   → "Masada Paketi" (kısa "Masada"):     1 grup buluşması hakkı, ham 299 TL
  - KARSIMDA → "Karşımda Paketi" (kısa "Karşımda"; EN "Duo"): 1 baş başa buluşması hakkı, ham 399 TL
  - KANKAMLA → "Kankamla Paketi": 1 kankamla buluşması hakkı, ham 499 TL (alıcı öder, aynı cinsiyetteki kankası ücretsiz katılır)
    · Kanka davet edilmeden satın alınır; kullanıcı paketi aldıktan sonra kankasını davet eder (detay ekranında "Paket Al";
      "Önce Kanka Davet Et" yoktur). Davet linkinden gelen kankanın daveti kabul etmesi ve masaya katılması için KYC onayı zorunlu
  - ICERDE   → "İçerde Paketi" (EN "Double Pass"; "All In" yok):   1 grup + 1 baş başa buluşması hakkı, ham 599 TL
  Kankamla EN "Bring a Buddy"; Masada EN adı "Group". Abonelik kodda PRIME (enum, anahtar, fonksiyon adları aynen) ama kullanıcıya görünen
  her yerde (TR + EN, bildirimler, admin panel, yasal sayfalar) "Premium": TR "Premium Paket", "Premium abonelik"; EN "Premium Package",
  "Premium subscription"; admin "Premium 1/3/6/12 Aylık", "Aktif Premium". Paket adları yalnız paketle ilgili yerlerde değişti; masa türü
  adları (Grup, Baş Başa, Kankamla; EN Group, Duo, Bring a Buddy) eşleşme, masa detay kartı, Masalarım vb. yerlerde aynen.
  Veritabanı enum ve kod anahtarları değişmez. Kullanıcıya görünen bütün metinlerde "Başbaşa" değil "Baş Başa" yazılır (masa türü)
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
Davet sistemi:
  - Her kullanıcının kalıcı, benzersiz kişisel davet kodu ve linki vardır. Telefonla yeni davet oluşturma kaldırıldı; eski telefon
    davet kayıtları DB'de durur ve geçerli davet sayısına eklenmeye devam eder.
  - Davet edilen kişi kod veya linkle kayıt olursa %10 davet indirimi alır. %10 davet indirimi ile 100 TL indirim aynı anda kullanılamaz.
  - Geçerli davet: davet edilen kişi ilk paketini satın almış ve KYC'si onaylanmış olmalıdır.
  - Her 3 geçerli davette davet edene 1 ücretsiz masa hakkı verilir; türünü (Grup / Baş Başa / Kankamla) kullanıcı seçer; aynı türden
    haklar birikir.
  - Yapay Zekâ Masa Raporu paylaşım kartındaki link kullanıcının kişisel davet linkidir. Hikâye paylaşımında link panoya kopyalanır ve
    kullanıcıya bağlantı çıkartması uyarısı gösterilir.
  - Eski sadakat programı ve paylaşım kartı tıklama-puan sistemi yoktur.
  - Kankamla masasındaki kanka daveti (telefonla, 48 saat İptal Et) ayrı bir akıştır ve davet sisteminin parçası değildir.
İndirimler: %10 davet indirimi ve paketi / aboneliği olmayana gönderilen 100 TL indirim tüm tek seferlik paketlerde ve tüm Prime
  planlarında geçerli (WINBACK_PLANS ayarında 8 plan); ikisi aynı ödemede birlikte kullanılamaz; Prime'da yalnız satın alma ödemesine
  uygulanır, yenilemeler indirimsiz. Aktif tek seferlik paketi ya da aktif Prime'ı olana 100 TL indirim hiçbir koşulda gösterilmez/uygulanmaz
Geri kazanım indirimi: Admin → Sistem Ayarları → Genel'deki WINBACK_ENABLED anahtarına bağlıdır, varsayılan Kapalı. Kapalıyken
  ekran, rozet, indirimli fiyat, hatırlatma push'u ve WinbackOffer kaydı yoktur. Pazartesi 21:00 push'u (mondayPush) anahtardan bağımsızdır
Davet indirimi: yüzde 10'dur, davet koduyla kayıt olanın yalnız ilk ücretli paket alımında otomatik uygulanır, geri kazanım indirimine
  göre önceliklidir; iki indirim birleşmez
Davet kodu: kullanıcıya sabittir, kullanım sınırı yoktur
Mobil indirim teklifleri (IAP_ENABLED ile pasif): tek seferlik paketlerde indirimli ayrı ürünler (<ürün>.davet10, <ürün>.indirim100);
  Prime'da App Store promosyon teklifi (sunucu imzalı) / Google Play abonelik teklifi (teklif kimlikleri davet10, indirim100)
Paket kartı tasarımı (web + mobil; landing fiyatlandırma, Profil → Paketim / mobil Paketler, paket detay ekranları, Nasıl Çalışır
  tanıtım akışı): kart bütünüyle paket renginde: aynı renk ailesinde koyudan ortaya geçişli (gradient) arka plan, çerçeve, rozet, onay
  ikonu, ok ve buton. Masada mavi (#3b7dd8, gradient #071a3a → #1d4f9c), Karşımda kırmızı (#d6453a, #3d0907 → #a3231b), Kankamla mor
  (#8b5cf6, #1f0a3a → #5b2a9c), İçerde yeşil (#2e9e62, #06301c → #1c7a49), Premium altın / amber (#e0a526, #3a2804 → #9c7412; ad #f5d76e,
  rozet ve buton altın geçişli #f5d76e → #e0a526 → #b7811a, yazı #1a1406). Premium'da şarap (#7A1F2B) ve kırmızı (#d6453a) ton yok
  (detay başlığı, 3 aylık plan kartı çerçevesi, "Premium Paket Abonelik Detayları" kutusu altın / amber). Değerler web
  components/paket/PaketKarti.tsx CARDS (accent), mobil paketim.tsx CARDS ve theme.ts onb.pkgColor / primeBorder / primeTagBg.
  Rozet (kart başlığında hap, kalın büyük harf, web 0.62rem / 2px 8px, mobil 9.9 / 2-8, paket renginde): tek seferlik paketlerde
  "TEK SEFERLİK" / "ONE-TIME" (card.oneTime), abonelikte "ABONELİK" / "SUBSCRIPTION" (card.subscription); eski durum rozetleri
  ("Aktif Paketin" vb.) kartta yok (blocked kart soluk görünür; detay butonunda durum metni aynen).
  Avantaj maddelerinin başında paket renginde V (onay) ikonu.
  "PAKET AL" / "GET PACKAGE" ve Premium'da "ABONE OL" / "SUBSCRIBE" butonu (web BuyButton, mobil paketim.tsx BuyButton): paket renginde,
  büyük harf, yuvarlak hap; yalnız landing fiyatlandırma ve paket detay ekranlarında. Landing'de Premium butonu tam genişlik değil, diğer
  paket butonlarıyla aynı boyda (geniş ekranda yarım genişlik) ve ortalı. Web Profil → Paketim ve mobil Paketler liste kartlarında buton
  yok, kart detay açar.
  Paket detay ekranlarında (tek kart) Premium dahil tüm satın alma butonları tam genişliktedir. Daraltılmış ve ortalı Premium butonu
  yalnız landing fiyatlandırma bölümünde uygulanır.
  Premium avantajlarının ilki "Her masada öncelikli eşleşme hakkı". Premium detay ekranında 3 aylık plan kartının üstünde "Tercih Edilen"
  etiketi. Web'de bu kart altın / amber çerçeveli, hafif amber geçişli; mobilde diğer süre kartlarıyla aynı düz görünüm (etiket kalır).
  Seçili plan kartının çerçevesi Ahenk paleti kırmızısı (#d6453a), aynen (web + mobil).
  "TERCİH EDİLEN" etiketinin arka planı siyah (#000000), yazı rengi #f4f1ec (web + mobil).
  Mobil Paketler listesinde paket adları web'deki adlarla aynı (plans.* çeviri anahtarından: Masada Paketi, Karşımda Paketi, Kankamla Paketi,
  İçerde Paketi, Premium Paket; EN Group Package, Duo Package, Bring a Buddy Package, Double Pass Package, Premium Package).
  Nasıl Çalışır (Onboarding) paket kartlarında kısa adlar onb.pkGroup / onb.pkOne (Masada / Karşımda; EN Group / Duo), onb.pKanka,
  onb.pIcerde (EN Double Pass); hafta sonu sekmesindeki masa türü adları (onb.pGroup / pOne) aynen.
  Paket kartı tipografisi (web + mobil, bütün paket kartları ve "Premium Paket Abonelik Detayları" kutusu): başlık serif (DM Serif Display),
  normal ağırlık, web text-2xl (24/32) / mobil Serif 24/32; açıklama sans, normal ağırlık, 14 (text-sm).
  Masada Paketi avantajı "Masada erkek ve kadın eşit sayı"
Paket kartı yazıları (kart kısa açıklaması; avantajlar PaketKarti.tsx CARDS ve mobil paketim.tsx CARDS'ta aynı liste):
  Masada Paketi "1 Grup Masası'nda buluşma hakkı"; Karşımda Paketi "1 Baş Başa Masası'nda buluşma hakkı"; Kankamla Paketi
  "1 Kankamla Masası'nda buluşma hakkı"; İçerde Paketi "1 Grup Masası + 1 Baş Başa Masası'nda buluşma hakkı"; Premium Paket
  "Her ay 1 Grup + 1 Baş Başa + 1 Kankamla Masası"
Nasıl Çalışır paket sayfası (web + mobil Onboarding 3. adım): Premium kartındaki "3 ay" kutusu altın kenarlıklı (#e0a526, web AMBER,
  mobil onb.primeBorder); üst kenarında ortalı küçük siyah zeminli (#000000) beyaz yazılı "Önerilen" / "Recommended" (onb.recommended)
Nasıl Çalışır masa detay kartı sayfası (6. adım): eski örnek kart yok; Masalarım'daki gerçek MasaDetayKarti (web packages/ui, mobil
  showcase modu), Baş Başa, masa kurulmuş hâlde, ekrana sığacak şekilde orantılı küçültülmüş (web zoom, mobil Scaled); varsayılan mekân
  görseli /share-bg/datenight.webp; ana kart + Yapay Zekâ Masa Raporu'nun altında pasif Masa Sohbeti önizlemesi (önizleme modundaki
  ChatSection); mekân görselinin sağ üstünde kırmızı "Temsili" etiketi (onb.s6Badge: TR "Temsili Masa Detay Kartıdır ve Mekan Görselidir",
  EN "Sample Table Detail Card and Venue Image"); acil yardım, paylaş, Değerlendir yok; sunucuya istek yok. Katılımcılar statik
  örnek: "Mert D." (Finans & Bankacılık, apps/web/public/onboarding/sample-mert.webp) ve "Nursena Y." (Eğitim & Akademi,
  sample-nursena.webp; SUPERADMIN hesabı ve Nursena botunun fotoğraflarından kopya, canlı veriye bağlı değil). Yapay Zekâ Masa Raporu
  uyum %91, metin onb.s6AiReport; tarih önümüzdeki Cumartesi 20:00. Maddeler onb.s6b1 / s6b2; başlık ve "Buluşma günü saat 10:00'da açılır." aynen
Mobil paket detay ekranında "← Paketler" (mevcut pillRed etiket stili) ve Android geri tuşu Paketim'deki paket listesine döner
Profilim "KANKAMLA NASIL İŞLER?" metni: "Kankamla Paketi'ni al, ardından aynı cinsiyetten bir arkadaşını kanka olarak davet et. Kankan
  ücretsiz katılır; davet linkinden geldiğinde kimlik doğrulaması yapması zorunludur. İkiniz, karşı cinsten bir kanka çiftiyle Pazar
  akşamı 4 kişilik masada buluşursunuz. Davet 48 saat geçerlidir; kanka seçildiği hafta değiştirilemez." Web ve mobilde "2 masa hakkı",
  "2 hak", "4 döngü" ifadeleri yoktur
Landing "Paket Al": giriş yapmamışsa Giriş; giriş yapmışsa (KYC onaylı ya da değil) Profil → Paketim
Web paket listeleri (landing #pricing ve Profil → Paketim): landing başlığı "Fiyatlandırma". Kartlar 2 sütunlu grid (sm ve üstü; dar
  ekranda tek sütun): Masada + Karşımda, Kankamla + İçerde, Premium Paket tam genişlik; landing'de 4. satır "Premium Paket Abonelik
  Detayları" / "Premium Package Subscription Details" kutusu tam genişlik (başlık ve çerçeve altın / amber #e0a526; 1/3/6/12 aylık süre
  kartları; alttaki kural satırlarında ikon yok). Premium Paket detay ekranı tam ekran (değişmedi).
  Landing'de bütün paket kartları varsayılan açık: avantajlar ve "Paket Al" / "Abone Ol" tıklamadan görünür, aç/kapa yok; kartlar
  tıklanamaz (PaketKarti staticCard: div, ok yok). Web Profil → Paketim'de kartlar tıklanınca tam ekran detay (değişmedi). Mobil
  paket ekranlarında grid yoktur; mobil kart davranışı aynı
Paket kartları (Masada, Karşımda, Kankamla, İçerde, Premium) tek kaynaktan: apps/web/components/paket/PaketKarti.tsx — paket ekranı ve landing
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

YARIN BULUŞMA (iki takvim modeli; ayrı sistem değil, mevcut paket hakları aynen kullanılır):
  - Kodda enum MeetingMode { PLANNED, TOMORROW } ("Hızlı / Quick" adı yok). Meeting.mode ve WeeklySelection.mode (+ meetingDate,
    transferredAt); migration 20261117100000_meeting_mode, mevcut masa ve kayıtlar PLANNED. Kullanıcıya görünen adlar: "Yarın Buluşma" /
    "Hafta Sonu Buluşma" (EN "Tomorrow Meetup" / "Weekend Meetup"; live.modeTomorrow / live.modeWeekend). Admin: "Yarın Buluşma" / "Planlı Buluşma"
  - Mod kullanıcıya bağlı değildir; her katılım kaydına (masa türü seçimine) aittir. Profilim'de mod ayarı yoktur. Sistem hakları
    otomatik taramaya almaz; her hak kullanıcı seçince taramaya girer. Masa türü başına tek açık kayıt
  - Tek seçim ekranı (web components/live/WeeklySelectionModal.tsx, mobil components/WeeklySelectionModal.tsx): "Buluşma Türü" (Yarın
    Buluşma / Hafta Sonu Buluşma, tek seçim) + "Masa Türü" (Grup / Baş Başa / Kankamla, çoklu; yalnız kullanılmamış hakkı olan ve kaydı /
    masası olmayan tür seçilebilir, diğerleri pasif). Ekran paket alınınca açılır. Otomatik açılış yalnız GET /weekly-selection
    showModal'dan (backend weekly-selection.ts state()): masası kurulu / kilitli olan kullanıcıda (buluşmadan sonraki gün 08:00'e kadar,
    meetingCardEnd) hiçbir yerde otomatik açılmaz; 08:00'de kart Geçmiş Masalarım'a geçip değerlendirme açılınca yeniden açılabilir.
    Herhangi bir türde aktif seçim / tarama sürüyorsa ya da iptal sonrası 24 saat dolmadıysa false; aksi hâlde kullanılmamış hak varsa
    true. Seçilmemiş masa türü açılışı tetiklemez; "Seçim Yap" ile elle açılış aynen. Ayrı haftalık pencere yoktur. Farklı türler için farklı buluşma türü seçilebilir
  - Eşleşme Paneli'nde seçim kartı (web components/live/SelectionCard.tsx, mobil components/SelectionCard.tsx; mobilde halkaların
    altında): ekranı açar ("Seçim Yap"), kayıtları gösterir, "Değiştir" (diğer buluşma türüne geçer) ve "İptal Et". Seçim değiştirme ve
    iptal yalnız bu karttan; masa kartlarındaki eski "Rezervasyon İptal" butonu kaldırıldı
  - Seçim Yap, Değiştir ve İptal Et yalnız masa kilitli değilken aktif; kilitli masada üçü de kapalı (web + mobil seçim kartı).
    Kaydı olmayan masa türünde Seçim Yap aktif kalır
  - Değiştir: seçim yapıldıktan sonra Yarın masasında 3 saat, Hafta Sonu ve Planlı'da 24 saat değiştirilemez (WeeklySelection.createdAt +
    CHANGE_LOCK_MS; GET /weekly-selection selection.changeAvailableAt); kilit süresince seçim kartında canlı geri sayım (live.selChangeIn).
    Backend 403: Yarın "Yarın Buluşma seçimini yaptıktan sonra 3 saat değiştiremezsin.", Hafta Sonu / Planlı "Seçimini yaptıktan sonra
    24 saat değiştiremezsin."
  - İptal Et: masa kilitli olmadığı sürece serbest, kullanım hakkı YANMAZ (Yarın + Planlı); kişi yalnız o kayda ait tarama kaydını ve
    masa eşleşmesini kaybeder (backend matching/selection-cancel.ts). İptal eden kullanıcı 24 saat boyunca hiçbir masa türüne katılamaz:
    tüm türlerde Seçim Yap kapalı (User.selectionCancelledAt; GET /weekly-selection cancelCooldownUntil; backend 403 "İptal ettiğin için
    24 saat boyunca yeni masaya katılamazsın."). Paket başına tek iptal hakkı yoktur
  - İptal / değiştir uyarı penceresi (web + mobil): büyük başlık (Serif 26), altında kural metni (live.selChangeRule / live.selCancelRule),
    butonlar ortada alt alta
  - Aynı gün kuralı: kullanıcının aynı güne açık bir tarama kaydı ya da masası (kurulu / kilitli / oluşturuluyor) varsa o güne ikinci
    tarama kaydı açamaz (aynı gönderimdeki türler de birbirini sayar); seçim gönderilince / değiştirilince engellenir, uyarı "Bu güne
    zaten bir masan var." / "You already have a table on this day." (selection-cancel.ts busyMeetingDays). Eşleştirme algoritması da
    aynı kullanıcıya aynı güne ikinci masa kurmaz (matching.service poolScope → noTableOnDay)
  - Pasif butonun altında neden metni (web + mobil seçim kartı): Değiştir kilidinde (Yarın masasında 3 saat, Hafta Sonu ve Planlı'da
    24 saat) kartta canlı geri sayım "Seçimini X saat Y dakika sonra değiştirebilirsin." / "You can change your choice in X h Y min."
    (live.selChangeIn; süre dolunca metin kalkar, Değiştir aktif olur), iptal sonrası Seçim Yap kapalıyken "İptal ettiğin için 24 saat
    yeni masaya katılamazsın.", masa kilitliyken "Masan kilitlendi." (live.selReason*)
  - Hafta Sonu (Planlı) son saatler aynen: Grup Perşembe 18:00, Baş Başa Cuma 18:00, Kankamla Cumartesi 18:00; geçtiyse kayıt bir
    sonraki haftanın taramasına yazılır
  - Kankamla kanka seçilmeden de seçilir; kayıt "Kanka bekleniyor" durumunda kalır, taramaya girmez; kanka daveti kabul edince tarama
    başlar (Yarın'da kilit o günün 23:59'u). Kanka (ücretsiz) kendi seçim ekranı / buluşma türü olmadan davet edenin kaydını izler
  - Yarın akışı: her gün açık (Cuma / Cumartesi / Pazar dahil); talep ve iptal son saati her gece 23:59 (sonrası bir sonraki günün
    buluşmasına yazılır); masa 23:59'da kilitlenir (matching.service runTomorrowLock, atama kuyruğunda). Ertesi gün 10:00 kart açılır +
    bildirim + AI raporu, 20:00 buluşma, sohbet buluşma günü 22:00'de kapanır. Saat başı tarama ve :05 mekân ataması Yarın'da da çalışır;
    mekânsız masa hatırlatması her gün 08:00. Yarın masasında "Yarın" etiketi / rozeti yok
  - Yarın hak düşümü 23:59 kilidinde masa kurulunca (Grup: 6 kişi 3E+3K ya da botla 4'e tamamlanan 2E+2K; Baş Başa 2; Kankamla 4).
    Kurulamayan kayıt en yakın Planlı gününe aktarılır (Grup → Cuma, Baş Başa → Cumartesi, Kankamla → Pazar; o haftanın Planlı son
    saati geçtiyse bir sonraki hafta); kaydın modu PLANNED olur, transferredAt yazılır. İade yok, hak Planlı kuralına göre düşer
  - Yarın eşleştirme: OCEAN ve meslek puanı kullanılmaz; sıralama puanı yaş yakınlığı %50 + mekân kategori tercihi (venueCategories)
    %50 (match-score.ts tomorrowScore; yaş 30 yılda doğrusal, kategori ortak / toplam), kimseyi dışlamaz. ALCOHOLIC / NON_ALCOHOLIC
    zorunlu filtre; şehir, cinsiyet dengesi, engeller, dil kuralı aynen. Kullanıcıya OCEAN kullanılmadığı hiçbir metinde söylenmez.
    Planlı'da sıralama Eşleştirme Kriterleri anahtarlarına göre (Yarın'dan aktarılanlar dahil); meslek puanı yok
  - Yaş kuralı (iki mod): Grup yok; Baş Başa en fazla 8 yaş; Kankamla yalnız iki paket sahibi (davet eden alıcılar) arasında en fazla
    8 yaş; davet edilen kankaların yaşı hiçbir eşleştirme kontrolünde kullanılmaz
  - Bot (Planlı + Yarın): sistem otomatik botu yalnız grup masasına ekler (3 → 1 botla 4, 5 → 1 botla 6; sistem masaya en fazla 1 bot).
    Sistem Baş Başa ve Kankamla'ya ASLA otomatik bot eklemez (Planlı baş başa "ikinci hafta otomatik botu" silindi, döngüsel bot
    mantığı yok). Admin elle eklemede sayı sınırı yok: Grup, Baş Başa ve Kankamla masasına istediği sayıda bot ekleyebilir, masayı
    tamamen botla doldurabilir (cinsiyet dengesi, kapasite, aynı saatte başka masa ve 4 hafta kuralı aynen)
  - Admin İstatistikler (web + mobil): "Yarın Buluşma" ve "Planlı Buluşma" bölümleri, Bu Hafta ve Tüm Zamanlar: kurulan masa (Grup, Baş
    Başa, Kankamla, Toplam), talep, Yarın'da Planlı'ya aktarılan kayıt (GET /admin/stats/overview meetingModes)
  - Uçlar: GET /weekly-selection, POST /weekly-selection {mode, types[]}, POST /weekly-selection/change {type, mode},
    POST /weekly-selection/cancel {type} (JWT)

HAFTALIK BULUŞMA SEÇİMİ (Planlı):
  - Seçimi süresinde yapmayan o türün taramasına girmez, hakkı düşmez
  - Eşleşme alanı: paketi olan kullanıcıda kaydı olmayan tür "Eşleşme Pasif"; hiç paketi olmayanda "Abonelik Yok"
  - Tarama göstergesi web ve mobilde yalnızca tek PASSIVE / LIVE state'ten okur: PASSIVE'de radar durur ve her şey gridir; LIVE'da radar
    sürekli döner, her semt kendi yoğunluk renginde görünür ve noktası yanıp söner
  - Tarama durumu gösterimi (web + mobil Eşleşme Paneli): PASSIVE = geri sayım kartında "Yeni tarama başlamasına" gösterilen durum
    (scanIdle = meetingTarget === null && waitingScan; ayrı zaman hesabı yok), LIVE = tarama başlamış. "Eşleşme Taraması" başlığının
    sağındaki rozet: PASSIVE'de "PASİF" / "INACTIVE" (live.badgeInactive), nokta, yazı ve 1 px kenarlık #ff3b30; LIVE'da "CANLI" / "LIVE"
    (live.liveBadge), nokta, yazı ve kenarlık #22c55e. Rozet ölçüleri: hap (köşe 9999), dolgu 5 / 10, nokta ile yazı arası 7, nokta 7×7,
    yazı 11 / kalınlık 600 (web .ll-live mono font, nokta nabızlı ll-pulse 1,8 sn; mobil Sonar.tsx gövde fontu, nokta sabit).
    PASSIVE'de "Semt Masa Yoğunluğu" başlığının sağında aynı satırda dikey ortalı "Tarama bekleniyor" / "Waiting for scan"
    (live.waitScan; 13, #FFFFFF, opaklık 0.6); LIVE'da bu yazı yok. Semt kartlarının altında "Tarama bekleniyor" yazısı yoktur
  - Eşleşme Paneli (web + mobil): rozet, radar ve "Semt Masa Yoğunluğu" kartları yalnız bu tek durumdan okunur (scanIdle). PASİF'te radar
    durur, semt noktaları "Düşük" grisinde, aynı boy, hareketsiz; kartlar gri. CANLI'da ışın sürekli döner; her semtin noktası ve adı
    yoğunluk seviyesinin renginde, noktalar yanıp söner; kartlar aynı seviye renginde. Yoğunluk renkleri iki platformda ortak (web
    components/live/levels.ts, mobil theme LEVELS; lejant renkleri): Çok yoğun #ff3b30, Yoğun #ff8c42, Orta #f2c14e, Düşük #8a8178.
    Seviyeler backend live-layer.service.ts density (LIVE_DISTRICT_SOURCE: static → admin ilçe listesindeki seviye, real → talep;
    talebi olmayan ilçe 4. seviye / gri)
  - LIVE_DISTRICT_SOURCE ayarı AppConfig tablosunda kayıtlı değildir, varsayılan "static" kullanılır; semt yoğunlukları admin Şehirler
    ayarındaki 1–4 seviyesinden gelir, gerçek talepten gelmez. Şu an bilinçli olarak static kullanılıyor; gerçek talebe geçiş ileride ayrı
    kararla yapılacak.
  - Seçim ekranı kartları (web + mobil): solda eşleşme alanındaki halka ikonu, sağda kalın başlık + küçük alt metin (Hafta Sonu'nda
    Grup / Baş Başa / Kankamla metinleri, buluşma Cuma / Cumartesi / Pazar 20:00; Yarın'da "Buluşma yarın 20:00'de gerçekleşir.").
    "Sonra" ve "Seçimi Onayla" butonları
  - Sayaç kartı ("[Masa türü] masası kurulmasına", web components/live/LiveLayer.tsx, mobil app/(tabs)/index.tsx): sayaç ve kapanış metni
    o masa türünün açık kaydındaki buluşma türüne göre; her türün kartı kendi kaydından ayrı hesaplanır. Hedef an backend'den gelir
    (GET /weekly-selection options[].selection.lockAt; selection-cancel.ts selectionLockAt: Yarın meetingLockAt, Hafta Sonu haftalık kilit
    plannedLockOf ile aynı hesap); istemcide gün / saat yeniden yazılmaz. Yarın Buluşma: Türkiye saatiyle bugün 23:59, metin "Bugün 23:59'da
    masa kapanır." / "The table closes today at 23:59." (live.closesTomorrow). Hafta Sonu: Grup Perşembe, Baş Başa Cuma, Kankamla Cumartesi
    23:59 (live.closes<TÜR>); kilit geçmiş Hafta Sonu kaydında mevcut "Yeni tarama başlamasına" kartı, Yarın kaydında bu durum yok.
    Kurulmuş masada "Buluşmana kalan süre". Açık kaydı (ve kurulmuş masası) olmayan türde kart gösterilmez. Sayaç 0'da durur, eksiye
    düşmez; kilit anından 5 sn ve 65 sn sonra seçim yeniden okunur, kart kilit sonrası duruma geçer (Yarın kilidi geçince veri gelene
    kadar kart gizli). Sandalye satırı kartın ait olduğu masanın verisinden: "Masanda X boş sandalye kaldı." / "X empty chairs left at
    your table." (live.seatsLeft), tekil "Masanda 1 boş sandalye kaldı." / "1 empty chair left at your table." (live.seatsLeftOne);
    "koltuk" yazılmaz. Eşleşme Paneli buton metni live.reserveSeats TR "Masanı Ayır · {count} sandalye kaldı", EN "Book Your Seat ·
    {count} chairs left"
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
  - Profilim'deki profil fotoğrafına basınca tam ekran büyük görünüm (Instagram gibi; web + mobil PhotoViewer own, kendi fotoğrafı
    olduğu için koruma yok); kalem butonu galeri → kırpma akışını açar. Büyük görünüm
    ekrana (fotoğraf dahil) basınca ya da geri tuşuyla kapanır (masa detay kartında da aynı). Fotoğraf yalnız Profilim'den değiştirilir:
    masa detay kartında ve başka hiçbir yerde kendi fotoğrafına basınca düzenleme (kalem) ikonu çıkmaz
  - Mobil alt menü profil sekmesinde onaylı fotoğraf varsa kısaltma yerine fotoğraf
  - Kırpma (web + mobil): Profilim'den fotoğraf eklenirken / değiştirilirken galeriden seçilen görsel önce tam ekran kırpma ekranında
    açılır (WhatsApp / Instagram gibi): yuvarlak kırpma çerçevesi, mobilde tek parmakla sürükle + iki parmakla yakınlaştır, web'de
    tek parmak / fareyle sürükle, dokunmatikte iki parmakla yakınlaştır / uzaklaştır (Instagram gibi), masaüstünde fare tekerleği;
    yakınlaştırma sürgüsü yok; butonlar "İptal" / "Bitti" (photo.cropCancel / cropDone). Bitti → çerçevedeki kare alan
    (mobil expo-image-manipulator, web canvas, JPEG) mevcut POST /users/me/profile-photo akışıyla gider (web components/PhotoCropper.tsx,
    mobil components/PhotoCropper.tsx)
  - Büyütülmüş profil fotoğrafı koruması YALNIZ büyütülmüş görünüm (PhotoViewer) açıkken; uygulamanın diğer ekranlarında kısıtlama yok.
    Kullanıcının KENDİ fotoğrafında (Profilim, masa detay kartında isSelf; PhotoViewer own) koruma yok: FLAG_SECURE, kayıt bulanıklaştırması,
    ekran görüntüsü uyarısı, ScreenshotLog ve admin bildirimi oluşmaz (backend de targetUserId = userId ise kayıt yazmaz):
    · Android: ekran görüntüsü ve ekran kaydı FLAG_SECURE ile engellenir (expo-screen-capture preventScreenCaptureAsync); görünüm kapanınca kalkar
    · iOS ekran kaydı / yansıtma: sürerken fotoğrafın yerine koyu bulanık alan + "Ekran kaydı sırasında fotoğraf gösterilmez." /
      "Photos are hidden during screen recording." (photo.recordingHidden); kayıt bitince fotoğraf geri gelir (yerel modül
      apps/mobile/modules/screen-recording, UIScreen.isCaptured)
    · iOS ekran görüntüsü: uyarı penceresi "Ekran görüntüsü almak yasaktır. Tekrarı halinde hesabın sırasıyla 3/15/30 gün askıya
      alınır." (photo.screenshotWarn), tek buton "Anladım" / "Got it"; POST /users/me/screenshot-log {photoUrl, platform}
    · Web: büyütülmüş görünümde fotoğrafta sağ tık menüsü ve sürükleyerek kaydetme kapalı (packages/ui PhotoViewer)
  - ScreenshotLog (migration 20261125900000_screenshot_log): id, userId (görüntüyü alan), targetUserId (fotoğraf sahibi; fotoğraf
    adresinden), platform, createdAt, adminAction (NONE | SUSPEND_3 | SUSPEND_15 | SUSPEND_30), adminActionAt, adminId. Her kayıtta admin
    Uyarılar'a SCREENSHOT_VIOLATION + bütün ADMIN / SUPERADMIN hesaplarına bildirim: "Ekran görüntüsü ihlali: [Ad S.] ([telefon]), [Ad S.]
    adlı kullanıcının profil fotoğrafının ekran görüntüsünü aldı. Bu, kullanıcının [N]. ekran görüntüsü." (EN "Screenshot violation: [Name S.]
    ([phone]) took a screenshot of [Name S.]'s profile photo. This is the user's [Nth] screenshot."; N = kullanıcının toplam kaydı).
    User.id (cuid) bildirimde ve ihlal sayfasında gösterilmez; telefon gösterilir
  - Android: app.json android.blockedPermissions'ta READ_MEDIA_IMAGES ve DETECT_SCREEN_CAPTURE (kodda kullanılmıyor; expo-screen-capture
    ekran görüntüsü dinleyicisi yalnız iOS'ta, expo-media-library yalnız yazma izniyle kullanılır)
  - Kullanım Koşulları 10 (Hesap Askıya Alma ve Kapatma) ve Topluluk Kuralları 06 (TR + EN): "Profil fotoğrafları kişiye özeldir.
    Büyütülmüş profil fotoğrafı görünümünde Android cihazlarda ekran görüntüsü ve ekran kaydı tamamen engellenir. iOS cihazlarda ekran
    kaydı sırasında fotoğraf gösterilmez; ekran görüntüsü alınması ise kayıt altına alınır ve ihlal sayılır. İlk ihlalde uyarı yapılır;
    ikinci ihlalde hesap 3 gün, üçüncü ihlalde 15 gün, dördüncü ve sonraki ihlallerde 30 gün süreyle askıya alınır. Askı süresince yeni
    masalara katılamaz ve satın alma yapamazsın." (web'den bahsedilmez)
  - Gizlilik Politikası ve KVKK (TR + EN): veri kategorisi "Ekran görüntüsü ihlal kayıtları: ekran görüntüsünü alan kullanıcı, fotoğrafı
    görüntülenen kullanıcı, platform ve tarih-saat bilgisi. Kayıtları yalnız ADMIN ve SUPERADMIN görür"; amaç topluluk kurallarının
    uygulanması ve kullanıcıların kişisel verilerinin korunması; hukuki sebep KVKK m.5/2-f ve m.5/2-c; saklama 2 yıl (şikâyet ve moderasyon
    kayıtlarıyla aynı; retention-policy.ts COMPLAINT_MODERATION kategorisinde ScreenshotLog, gece silme işine bağlı, iş kapalı)
  - Admin "Ekran Görüntüsü İhlalleri" (web /admin/ekran-goruntusu, mobil admin/ekran-goruntusu; backend admin/admin-screenshot.ts):
    alan kullanıcı (foto + ad + telefon + Detay), fotoğraf sahibi, platform, tarih saat, kaçıncı ihlal, yapılan işlem; kullanıcı filtresi.
    Önerilen işlem: 1. ihlal işlem yok, askı seçeneği de yok (yalnız "Kullanıcıya uyarı gösterildi"), 2. ihlal "3 gün askıya al",
    3. ihlal "15 gün askıya al", 4. ve sonrası "30 gün askıya al"; 2. ihlalden itibaren ayrıca diğer süreler (3 / 15 / 30 gün) ve "İşlem yapma". Askı mevcut askı sistemi + askı bildirim
    şablonu, sebep "Ekran görüntüsü ihlali"; karar adminAction / adminActionAt / adminId'ye yazılır (POST /admin/screenshot-logs/:id/decision).
    Kullanıcı detayında ihlal sayısı ve listesi (GET /admin/users/:id/screenshot-logs)

MASA DETAY KARTI (web + mobil):
  - Katılımcıların onaylı profil fotoğrafları herkese görünür; fotoğrafı olmayanda kısaltma. Fotoğrafa basınca tam ekran büyük görünüm
    (kendi fotoğrafında da düzenleme ikonu yok). Bekleme radarında fotoğraf gösterilmez
  - Her katılımcı: fotoğraf, altında "Ahmet Y." biçiminde ad, onun altında kendi mesleği (User.occupationSector; dashboard /
    my-history participant.occupation). Ayrı "Meslekler" listesi yoktur. Mesleği olmayan botun meslek satırı boş kalır

MOBİL GİRİŞ (yalnız mobil uygulama):
  - Mekân girişi ("M.Girişi") ve mekân paneli mobil uygulamada yok (web'deki mekân girişi aynen)
  - Giriş ekranı: tam ekran arka plan görseli (assets/mobilappscreen.webp; ekranı kaplar, kenarlardan kırpılır, esnetilmez, ortalı);
    logo yok (giriş ve "Tekrar hoş geldin" ekranında); görseli içeren alan tam ekran genişliği ve yüksekliği kadar, ekstra büyütme yok;
    arka plan dönüşümlü: mobilappscreen.webp → mobilappscreen2.webp → mobilappscreen3.webp → baştan; giriş ya da "Tekrar hoş geldin"
    ekranı her açıldığında sıradaki görsel (açılış, beni hatırla / beni unut çıkışı dahil), son sıra cihazda saklanır (AuthFlow.tsx);
    başlık olarak yalnız "Ahenk" (altında açıklama yazısı yok, iki dilde);
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
    Native açılış ekranında (splash) ve 3 sn'lik açılışta ana logo (uygulama ikonundaki işaret, saydam zemin; assets/splash-logo.png,
    app.json expo-splash-screen, imageWidth 160) ekrana taşmadan, tam sığacak şekilde ortalı kullanılır
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
  - Profilim yerleşimi (mobil): profil fotoğrafının hemen altında küçük "Kişilik Ağacım" kartı (basınca Kişilik Ağacım ekranı); Hesap
    Bilgileri'nde Kişilik Ağacım ve Numara Engelleme butonları yok. Yasal kartın hemen üstünde "Gizlilik ve Güvenlik" kartı, içinde
    Numara Engelleme. Hesap Bilgileri'nde "Arayüz Dili / Interface Lang." seçili tarafı kayan segment kontrol (renkler theme.ts: iz inputGlass form zemini,
    kayan zemin tabBar.activeBg / activeBorder, seçili yazı tw.accent)
  - Kişilik Ağacım ekranı (mobil): "Kişilik Ağacım" büyük başlık (Serif) "← Profilim" ile aynı satırda, sağa yaslı; üstteki küçük etiket
    yok. Ağaç ekran açılınca bir kez hesaplanır, sabit resim (SkPicture) olarak çizilir; büyüme, yaprak / dal animasyonu, düşen yaprak ve
    dokununca yeniden büyüme yok. Tek animasyon: bütün ağaç kökü etrafında tek parça hafif salınır (Reanimated frame callback, UI
    thread, en fazla 30 kare/sn), ekran odakta değilken durur. Görünüm (şekil, renk, yaprak yoğunluğu, boyut) aynı (KisilikAgaci.tsx)
  - Profilim alt bölümü sırası (mobil): "Gizlilik ve Güvenlik" kartı → yasal bağlantılar kartı (Gizlilik Politikası, Kullanım Koşulları,
    KVKK Aydınlatma Metni, Topluluk Kuralları, Hesap Silme — web sayfaları uygulama içi tarayıcıda, satırlar 44 pt) → "Çıkış Yap" → "Tüm cihazlardan çıkış
    yap" → küçük uygulama logosu → "Versiyon 0.1.6" → "Hesabımı Sil". Mobil sürüm 0.1.6 (Android versionCode 7)
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
    eşleştirme bekleme listesi (MatchingWaitlist), winback, davet telefonu, profil fotoğrafları (ProfilePhoto + uploads/profile-photos/<userId>/), sorun bildirimleri
    (ProblemReport + uploads/problem-reports/<id>/); hesap anonimleşir; masa geçmişi ve değerlendirmeler kimliksiz kayda taşınır
  - Saklanan (süreler VERİ SAKLAMA tablosunda): ödeme ve fatura kayıtları 10 yıl; mesafeli satış onay kayıtları 3 yıl; giriş / IP
    kayıtları 2 yıl; acil yardım / şikâyet / ban kaydına karışan kişinin kimliği 2 yıl (kilitli, yalnız SUPERADMIN); banlı hesabın
    telefon özeti ban süresince. Oturumların silinmesi kodda aynen; sayfa metni (del.del7): "Tüm oturumların kapatılır ve silinir; giriş
    ve IP kayıtların 5651 sayılı Kanun gereği 2 yıl saklanır." Hesap silme uyarısı (del.modalBody, prof.deleteBody) ödeme için 10 yıl
  - Herkese açık https://ahenk.co/hesap-silme (apps/web/app/hesap-silme): giriş yapmamış kullanıcı otomatik /giris?donus=/hesap-silme'ye
    gider, giriş sonrası geri döner (giriş sayfasında izinli dönüş yolu yalnız /hesap-silme) ve talep oluşturur. Silinen / saklanan
    veriler ve süre yazılıdır. Footer Yasal grubunda "Hesap Silme" linki
  - KYC metni (KVKK, Gizlilik Politikası, /hesap-silme, Açık Rıza Metni birebir): "Kimlik belgeleri ve canlılık videosu hesap silme
    onayından sonra 48 saat içinde silinir. İstisna: Acil Yardım, şikâyet veya ban kaydına karışmış kullanıcının kimliği kilitli tutulur,
    2 yıl saklanır ve yalnız SUPERADMIN erişir." (kimlik belgesi için "10 yıl" ifadesi yoktur)
  - Gizlilik Politikası ve KVKK: KYC Ahenk sunucusunda AES-256-GCM şifreli; üçüncü taraflar iyzico, Meta (WhatsApp Business API),
    Google Firebase Cloud Messaging, Anthropic, OpenStreetMap Nominatim, Google Maps, Apple / Google mağazaları, Google Analytics / Meta
    Pixel (web çerezleri). Anthropic'e giden veriler: masa raporu (ai-report.service.ts, claude-sonnet-5-5) için katılımcı başı ad yerine
    P1, P2 etiketiyle beş OCEAN skoru ve varsa meslek alanı, masa türü, katılımcı sayısı, masanın genel uyum skoru (ad, cinsiyet, yaş,
    iletişim, kimlik, masa ID, mekân, tarih gitmez); sohbet denetimi (chat-moderation.ts, claude-haiku-5-5) için yalnız şüpheli / yasaklı
    madde kelimesi geçen mesajın metni (ilk 1.000 karakter; gönderen, masa, saat gitmez)
  - Yurt dışı aktarım dayanakları (KVKK + Gizlilik): Anthropic, Google Firebase FCM, Meta WhatsApp KVKK m.9/4 standart sözleşme
    (Kurum'a 5 iş günü içinde bildirim); OpenStreetMap Nominatim m.9/6 arızi aktarım (sözleşmenin ifası için zorunlu). İşleme sebepleri:
    masa raporu, push ve OTP m.5/2-c; sohbet moderasyonu m.5/2-f; Acil Yardım konumu ve emniyetle paylaşım m.5/2-b ve m.5/2-ç.
    Konum iki kategori: şehir tercihi ve Acil Yardım hassas konumu (yalnız butona basınca, talep çözülene kadar canlı; ekip, acil durum
    kişileri ve emniyete iletilir; çözülünce koordinatlar silinir, son açık adres 2 yıl). KVKK'da üç ayrı başlık: Kişilik testi (OCEAN)
    m.5/2-c; Kimlik belgesi m.5/2-c ve m.5/2-f; Canlılık videosu ve yüz eşleştirme biyometrik (özel nitelikli) veri, m.6 açık rıza
  - Cloudflare / R2: ahenk.co trafiği Cloudflare proxy'sinden geçmez (nginx'te real_ip / CF başlığı yok, istemci IP'leri doğrudan);
    Cloudflare metinlerde yoktur. R2 kullanılmaz, R2_* anahtarları backend/.env'den silindi, @aws-sdk/client-s3 ve
    s3-request-presigner bağımlılıkları kaldırıldı; ConsentType.MARKETING_EMAIL enum değeri silindi (migration
    20261125700000_drop_consent_marketing_email); SMTP_* anahtarları da silindi (e-posta
    gönderim kodu yok; fatura e-postası ve e-posta ile şifre sıfırlama yok, şifre sıfırlama WhatsApp OTP)

AÇIK RIZA METNİ (web /acik-riza-metni, /en/acik-riza-metni; footer Yasal grubu ve mobil Profilim yasal kartı "Açık Rıza Metni"):
  - Canlılık videosu ve yüz eşleştirme (biyometrik veri, KVKK m.6) için açık rıza; ehliyette kan grubu gibi özel nitelikli veriler
    bulunabilir ve işlenmez
  - KYC adımında (web TabKyc, mobil KycTab) canlılık videosundan önce ayrı onay kutusu (kycf.bioConsent*): işaretlenmeden video adımı
    açılmaz ve gönderilemez (yeni mobil sürümde de zorunlu). POST /kyc/upload biometricConsent "true" ise AgreementConsent'e documentType
    "acik_riza_biyometrik" yazılır; backend eski sürümler için alanı zorunlu tutmaz
  - KYC gizlilik notu (kycf.privacy) retention-policy.ts KYC kuralıyla birebir: kimlik belgeleri ve canlılık videosu hesap silme onayından
    sonra 48 saat içinde silinir; istisna (Acil Yardım / şikâyet / ban kimliği kilitli, 2 yıl, yalnız SUPERADMIN)

YASAL ONAY KUTULARI (web + mobil, TR + EN; hepsi AgreementConsent'e belge versiyonu "2026-11" ile yazılır):
  - Kayıt (web kayit 3. adım, mobil kayit.tsx şehir adımı; reg.legal*): "Kullanım Koşulları'nı okudum ve kabul ediyorum; KVKK Aydınlatma
    Metni'ni okudum." İki ayrı link; işaretlenmeden kayıt butonu pasif. acceptTerms = kutu değeri; backend kayıtta kullanim_kosullari +
    kvkk_aydinlatma yazar (ConsentLog TERMS_OF_SERVICE / PRIVACY_POLICY aynen)
  - Paket ve Premium ödeme (web TcknModal: Paket Al, Abone Ol, winback, Premium otomatik yenileme formu; mobil Paketim detay ekranı;
    pay.agree*): "Ön Bilgilendirme Formu'nu ve Mesafeli Satış Sözleşmesi'ni okudum, onaylıyorum." İki ayrı link; işaretlenmeden ödeme
    butonu pasif. Backend POST /payment/init ve POST /payment/prime/autorenew/init'te mesafeli_satis + on_bilgilendirme yazar
  - Ön Bilgilendirme Formu sayfası: web /on-bilgilendirme-formu, /en/on-bilgilendirme-formu (satıcı bilgileri Mesafeli Satış'tan,
    hizmetin temel nitelikleri, toplam fiyat PlanPriceText, ödeme şekli, cayma hakkı ve istisnası, şikâyet yolları)
  - KYC: biyometrik açık rıza (yukarıda)
  - Mesafeli Satış "Sözleşmenin Yürürlüğü": "Sözleşme ve ön bilgilendirme formu, hesabında kalıcı olarak saklanır ve istediğin zaman
    erişebilirsin." (e-posta ile gönderim cümlesi yoktur)

ONAY KAYDI (AgreementConsent, migration 20261125600000_agreement_consent_login_log):
  - Alanlar: userId, documentType (kullanim_kosullari | kvkk_aydinlatma | mesafeli_satis | on_bilgilendirme | acik_riza_biyometrik),
    documentVersion ("2026-11";
    common/agreement-consent.ts AGREEMENT_VERSIONS), acceptedAt, ip, platform (web | ios | android), packageId (plan kodu)
  - Satın alma onayı anında POST /payment/init içinde mesafeli_satis + on_bilgilendirme kaydı (web: kimlik numarası doğrulandıktan sonra;
    mobil: mağaza ürün bilgisi döndükten sonra). Saklama 3 yıl; hesap silinse de kalır (FK yok)

GİRİŞ IP KAYDI (LoginLog, aynı migration; hesap türü migration 20261125800000_login_log_account_type):
  - Alanlar: accountType (LoginAccountType: USER | VENUE | ADMIN), userId (USER / ADMIN: User.id), venueAccountId (VENUE:
    VenueAccount.id), ip, userAgent, platform, success, createdAt. Bütün giriş kayıtları accountType'ı doldurur: üye USER,
    ADMIN / SUPERADMIN ADMIN, mekân paneli VENUE (common/agreement-consent.ts writeLoginLog). Yazılan girişler: POST /auth/login ve /auth/verify-login-otp (üye,
    ADMIN, SUPERADMIN; başarılı ve başarısız, yalnız kayıtlı hesaba ait), POST /auth/register sonrası açılan oturum, mobil "Tekrar hoş
    geldin" biyometrik girişi (POST /auth/refresh + X-Login-Event: biometric; olağan token yenilemesi yazılmaz), mekân paneli
    POST /venue-panel/login ve /venue-panel/verify-login-otp (accountType VENUE, venueAccountId; "venue:" öneki yoktur, eski kayıtlar
    migration'da venueAccountId'ye taşındı)
  - Platform X-Client-Platform başlığından (web | ios | android; web lib/api.ts ve mobil lib/api.ts langHeaders her istekte gönderir);
    başlık yoksa User-Agent'tan ("okhttp" android, "CFNetwork / Darwin" ios, diğerleri web). User-Agent ayrıca kaydedilir
  - Saklama 2 yıl (5651); veri saklama işi TRAFFIC_LOG kategorisinde siler. nginx logları logrotate 730 gün
    (/etc/logrotate.d/nginx rotate 730, günlük)

VERİ SAKLAMA (backend/src/retention/retention-policy.ts; admin Veri Saklama sekmesi, KVKK 07, Gizlilik 05, /hesap-silme del.ret0-13 aynı):
  - Ödeme ve fatura kayıtları: 10 yıl (TTK m.82, VUK m.253), m.5/2-ç
  - Mesafeli satış onay kayıtları: 3 yıl (Mesafeli Sözleşmeler Yönetmeliği), m.5/2-ç
  - Ticari elektronik ileti onayları: onayın sona ermesinden itibaren 3 yıl, m.5/2-ç
  - Giriş / IP kayıtları ve nginx logları: 2 yıl (5651), m.5/2-ç
  - Kimlik belgeleri ve canlılık videosu: hesap silme onayından sonra 48 saat içinde silinir; istisna Acil Yardım, şikâyet veya ban kaydına
    karışmış kullanıcının kimliği kilitli, 2 yıl, yalnız SUPERADMIN; m.5/2-e
  - Acil Yardım kaydı: koordinat ve konum geçmişi talep çözülünce silinir, son açık adres 2 yıl; m.5/2-b ve m.5/2-e
  - Şikâyet ve moderasyon kayıtları ile şikâyet edilen mesajlar: 2 yıl, m.5/2-e
  - Ekran görüntüsü ihlal kayıtları (ScreenshotLog): 2 yıl (şikâyet ve moderasyon kategorisinde), yasal metinlerde m.5/2-f ve m.5/2-c
  - Şikâyet edilmemiş masa sohbeti mesajları: masa tarihinden 6 ay sonra silinir, m.5/2-c
  - Sorun bildirimleri: 2 yıl, m.5/2-f
  - Profil, kişilik testi (OCEAN) ve push token: hesap silinene kadar, m.5/2-c
  - Banlı kullanıcının okunamaz telefon özeti: ban süresince, m.5/2-f
  - Çerezler: oturum çerezi (refresh_token, ahenk_session) 365 gün (Çerez Politikası)
  - KVKK aydınlatma ve açık rıza onay kayıtları: hesap silinmesinden 10 yıl (mevcut kategori)
  - Gece 03:30 otomatik silme işi (AUTO_DATA_DELETION) varsayılan kapalı. Otomatik işe bağlı kategoriler: ödeme, mesafeli satış, ticari
    ileti, giriş / IP, KVKK onayı, olay kimliği, Acil Yardım son adresi, şikâyet / moderasyon (ChatReport + başka şikâyeti kalmayan
    şikâyet edilen mesaj + ScreenshotLog, 2 yıl), şikâyet edilmemiş masa sohbeti (masa tarihinden 6 ay), sorun bildirimleri (kayıt + uploads klasörü,
    2 yıl). Kimlik belgeleri, profil, çerez kategorileri tabloda gösterilir, otomatik işe bağlı değildir. Hesap silme davranışı ayrıdır
  - Ödeme ve fatura kayıtları bütün yasal metinlerde, hesap silme sayfasında ve retention-policy.ts'de 10 yıl (TTK m.82, VUK m.253)

YURT DIŞI BÖLGE KURALI: yurt dışında tek dil İngilizce; kimlik türleri Kimlik Kartı, Pasaport, Ehliyet; Oturma İzni yalnız Türkiye.
  Mevcut DB / kod bu kurala uymuyor (yurt dışı şehirlerde defaultLanguage tr, idTypes dört tür); değiştirilmedi, ayrı karar bekliyor

PARA BİRİMİ (rapor41): City.currency yurt dışı şehirlerde yerel para birimi (Dubai AED, Bangkok THB, Hong Kong HKD, Singapur SGD,
  Tokyo JPY; packages/shared/src/countryRegion.ts). Ödeme ve fiyat hesabı City.currency kullanmaz: iyzico istekleri ve web analytics
  Purchase olayı sabit TRY; USD fiyat yoktur

ÇEREZ POLİTİKASI: oturum çerezleri refresh_token / ahenk_session 365 gün (JWT_REFRESH_EXPIRES 365d); analitik çerez kategorisinde
  "Şu anda analitik çerez kullanılmamaktadır.", pazarlama kategorisinde "Şu anda pazarlama çerezi kullanılmamaktadır."
  (NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_META_PIXEL_ID boş, mobilde analitik yok); iyzico ödeme formu yalnız web'de, ödeme başlatılınca açılır
  pencere olarak yüklenir; mobilde iyzico yok. Cloudflare ifadesi yok
  - Google Analytics ve Meta Pixel yüklenmediği için Çerez, Gizlilik ve KVKK metinlerinde GA / Pixel paragrafı yoktur
  - Talimat dışı alıcı dayanakları (KVKK + Gizlilik): Google Maps "sözleşmenin ifası"; aktarılan veri Acil Yardım konum koordinatları;
    kullanım yerleri: yönetici Acil Yardım haritası (web + mobil), açık adres çözümleme (Google Geocoding), acil durum kişilerine giden
    WhatsApp bildirimindeki ve yönetici Acil Yardım ekranındaki konum bağlantısı, masa detay kartı "Haritada Gör" (mekânın Google Maps
    bağlantısı ya da adresi), yönetici mekân formundaki harita bağlantısı ("buluşma konumu" ifadesi yoktur); App Store ve
    Google Play "sözleşmenin ifası (ödeme ve abonelik işlemleri)"

KULLANIM KOŞULLARI: 06 Paketler ve Ödeme aynen; 07 "Premium Abonelik" bölümü (1/3/6/12 ay, web fiyatları PlanPriceText, 30 günde
  1+1+1, otomatik yenileme, iyzico / App Store / Google Play iptal yolu); 08 İptal Politikası'ndaki eski Premium maddeleri 07'ye taşındı,
  Kankamla "pakette tek iptal hakkı" maddesi kaldırıldı. Premium iptal kuralı (koddaki davranış; Kullanım Koşulları
  07, Mesafeli Satış 06, Profil / landing Premium metinleri aynı): "Premium aboneliği iptal edildiğinde otomatik yenileme durur; iptal
  anında elde kalan haklar süre sınırı olmadan, kullanılana kadar geçerli kalır; iade yapılmaz." "Dönem sonuna kadar" / "mevcut fatura
  döneminin sonunda" iptal metni yoktur; sonraki bölümler 08–15. Bütün yasal sayfalarda "Son güncelleme: Kasım 2026" / "Last updated: November 2026"

METİN KURALI (TR + EN, web + mobil + admin, i18n, bildirim / WhatsApp / e-posta, yasal sayfalar, Topluluk Kuralları, Nasıl Çalışır):
  cümle içinde ayraç olarak uzun tire (—), orta tire (–) ve çift tire (--) kullanılmaz; cümle virgül, nokta ya da iki nokta ile kurulur.
  Tarih / sayı aralıkları (4–6, 15 Mayıs – 15 Eylül) ve koddaki tireler (boş değer "—" vb.) bu kuralın dışında.

WEBP KURALI:
  - Web ve mobil projedeki görseller WebP'dir (kalite 80, şeffaflık korunur; mobil sekme ikonları assets/tabs/*.webp, tintColor çalışır).
  - İstisnalar (PNG / JPG kalır): mobil uygulama ikonu, Android adaptive icon katmanları, splash görseli, bildirim ikonu ve app.json /
    app.config'te tanımlı tüm görseller (assets/app-icon.png, adaptive-icon.png, splash-logo.png, icon.png); web favicon, apple-touch-icon,
    manifest ikonları (icon-192 / icon-512), OG ve sosyal medya paylaşım görseli (public/og-image.jpg; bütün sayfalarda og:image /
    twitter:image https://ahenk.co/og-image.jpg, lib/seo.ts OG_IMAGE; dinamik opengraph-image / twitter-image dosyaları yok), e-posta şablonlarında kullanılan görseller; tüm SVG ve GIF dosyaları; KYC dosyaları.
  - Yüklenen görseller backend'de WebP'ye çevrilir (common/image-webp.ts toWebp). Profil fotoğrafı, bot fotoğrafı ve mekân fotoğrafları
    mevcut ayarla (kalite 82, profil / bot 1080 + 200 boyutları); diğer bütün görsel yüklemeleri (sorun bildirimi, kariyer fotoğrafı,
    Janti Haydar başvurusu) UPLOAD_WEBP_QUALITY 80, önce EXIF yönü uygulanır, EXIF silinir, boyut değişmez; diske yalnız .webp yazılır,
    veritabanına .webp yolu kaydedilir. Çevrilemeyen görselde yükleme hata verir ve hata loglanır, orijinal kaydedilmez.
    KYC yüklemeleri orijinal formatta (AES-256-GCM şifreli)

VERİTABANI YEDEĞİ: Yeni veritabanı yedeği alınıp doğrulandığında önceki tüm veritabanı yedekleri silinir.

İPTAL EDİLEN KONU: Admin'in verdiği paketin hangi admin tarafından verildiğinin kaydı / gösterimi (rapor104 ve rapor105'te sorulan)
  iptal edildi; tekrar sorulmayacak.

CANLI DESTEK (backend/src/support, migration 20261126100000_live_support):
  - Erişim: yalnız giriş yapmış üye (Profilim → "Canlı Destek", web /canli-destek, mobil app/canli-destek.tsx) ve mekân paneline giriş
    yapmış mekân sahibi (web mekân paneli menüsü "Canlı Destek", /mekan/panel/canli-destek; mobilde mekân paneli yok). Uçlar oturum zorunlu:
    üye /support/* (JWT), mekân /venue-panel/support/* (mekân çerezi yolu /api/v1/venue-panel). Sohbet başlatan hesabın ID'sine bağlı
    (SupportChat.userId / venueAccountId); hiçbir eşleştirme isimle yapılmaz. Üye ve mekân aynı ekran (web components/support/SupportChatScreen.tsx)
  - Kullanıcı ekranı (sup.* anahtarları, TR + EN): konu Hesap / Ödeme / Masa / Diğer; sırada canlı "Önünde {n} kişi var · ~{m} dk" /
    "{n} people ahead of you · ~{m} min" (tahmin = önündeki kişi × son 7 günün ortalama sohbet süresi ÷ çevrimiçi temsilci sayısı, tam
    dakikaya yukarı, en az 1 dk; çevrimiçi temsilci yoksa ya da son 7 günde veri yoksa yalnız "Önünde {n} kişi var"); çevrimiçi temsilci
    yoksa ayrıca "Şu an tüm temsilcilerimiz meşgul ya da çevrimdışı…" (mesaj bırakılır, sıraya girer). Altında "Beklerken oyna" /
    "Play while you wait". Başlık kelime kelime kırılmaz: 1. satır "Ahenk Müşteri Temsilcisi" / "Ahenk Support Agent" (sup.header), 2. satır
    "Temsilci No: {agentNo}" / "Agent No: {agentNo}" (sup.agentNo) ve hemen yanında karşı tarafın durum etiketi; küçült ve "Sohbeti
    Sonlandır" başlığı daraltmaz, dar ekranda (mobilde her zaman) başlığın altında tek satırda. Durum etiketi (yuvarlak köşeli küçük rozet,
    kullanıcı, mekân ve temsilci ekranı; web components/support/ChatParts.tsx StatusPill, mobil components/SupportChatParts.tsx):
    "Çevrimiçi" yeşil, "Çevrimdışı" gri, "yazıyor…" Ahenk kırmızısı (EN Online / Offline / typing…; çevrimiçi = son 20 sn'de yoklama,
    bellekte); temsilci tarafında da kullanıcının durumu. Mesaj kutusu (kullanıcı, mekân ve temsilci ekranı aynı; web ChatParts, mobil
    SupportChatParts ChatComposer): dosya ikonu, emoji ikonu, yazı alanı ve en sağda gönder ikonu ("Gönder" yazısı yok) kutunun içinde;
    en az 48 px, yazdıkça en fazla 5 satır büyür; temsilci ekranında "/" hazır yanıt ve yer tutucu aynen. "Okundu" / "Read" yalnız
    gönderenin kendi mesajlarından karşı tarafın okuduğu sonuncusunun hemen altında. Temsilci ekranı başlığında (web) Devral / Kapat /
    Kötüye kullanım sağda alt alta, bilgi alanı solda geniş; mobil temsilci ekranında "⋯" panelinin içinde aynı sırayla alt alta (Devral,
    Kapat, Kötüye kullanım · 1 / 7 / 30 gün; tam genişlik). Temsilcinin adı / cinsiyeti / fotoğrafı hiçbir yerde
    gösterilmez. Temsilci bağlandığı an mobilde hafif titreşim (expo-haptics). İlk atamada 2 otomatik mesaj (sistem kodları NOTICE: kayıt + Aydınlatma Metni linki
    /kvkk, GREETING: karşılama); istemci kodu arayüz dilinde gösterir. GREETING metni (sup.sysGreeting) TR "Merhaba, ben Ahenk müşteri
    temsilcisiyim. Bugün size yardımcı olmaktan mutluluk duyacağım.", EN "Hello, I'm an Ahenk customer representative. I'll be happy to
    help you today."; TR metin harfiyen böyledir: sen dili (hitap) kuralının bilinçli istisnasıdır, değiştirilmez. Yazıyor göstergesi, okundu, saat, emoji, görsel (yalnız JPG / PNG /
    WebP, dosya başına 5 MB, mesaj başına 3; EXIF silinerek WebP'ye çevrilir, bulanıklaştırma yok; uploads/support/<chatId>/, git'e eklenmez).
    Masa Sohbeti link / telefon / şüpheli kelime engelleri destek sohbetinde yok. "Sohbeti Sonlandır" ve küçült butonu. Mobilde klavye açıkken mesaj alanı
    klavyenin üstünde (KeyboardAvoidingView). Kullanıcı geçmiş destek sohbetlerini göremez, kapanan sohbet ekrandan kalkar
  - Anlık iletişim: Masa Sohbeti gibi yoklama (3 sn). Yazıyor göstergesi ve gönderilmemiş yazı önizlemesi yalnız backend süreç belleğinde
    (5 sn), hiçbir yere yazılmaz. Kullanıcı 20 sn'dir yoklamıyorsa temsilci cevabı push + uygulama içi bildirimle gider (üye; mekân hesabında
    bildirim altyapısı yok)
  - Hareketsizlik: temsilcinin son (elle yazdığı) mesajından sonra kullanıcı 2 dk cevap vermezse sistem mesajı "1 dakika içinde yanıt vermezsen
    sohbet sonlanacak.", 3. dakikada otomatik sonlanır (closedBy AUTO) ve değerlendirme push ile gider
  - Değerlendirme (sohbet kullanıcı, temsilci ya da otomatik kapanınca; kötüye kullanımla kapananda yok; kapanıştan 24 saat açılabilir):
    "Sorunun çözüldü mü?" / "Was your issue resolved?" Evet / Hayır + 5 yıldız (zorunlu); 4–5 yıldız "Neyi beğendin?", 2–3 "Ne daha iyi olabilirdi?",
    1 "Ne kötü gitti?" etiketleri (hepsi isteğe bağlı, etiket seçmeden gönderilebilir); serbest metin; "Değerlendir" → "Değerlendirmeni aldık! …" + "Kapat"
  - Beklerken oyna (web components/support/Breakout.tsx canvas, mobil components/Breakout.tsx Skia + Reanimated frame callback): yalnız
    kuyruktayken butonla açılır; tek seviye, 5 sıra tuğla, 3 can, bitince "Tekrar oyna" / "Play again"; oyun ekranında "Oyunu kapat" / "Close game" butonu (oyun tamamen kapanır, sıra ekranına dönülür); ses / efekt yok; top, raket, tuğla
    Ahenk renklerinde; raket parmak / fareyle sürüklenir; sabit adımlı (en fazla 60 kare/sn). Oyun açıkken sıra satırı üstte küçük. Skor
    yalnız ekranda; hiçbir oyun verisi DB'ye, sunucuya, yerel depolamaya ya da loga yazılmaz. Temsilci bağlanınca ya da sohbet küçültülünce
    oyun tamamen kapanır, dönüşte yeniden başlamaz
  - Baloncuk (web components/support/SupportBubble.tsx: üyenin her sayfası [locale]/layout, mekân panelinin her sayfası; mobil
    components/SupportBubble.tsx: her ekran; yönetim panelinde, giriş ekranlarında ve sohbet ekranında yok): yalnız açık destek sohbeti
    varken (Canlı Destek'ten başlatılmış) sağ altta sabit, sürüklenmez. Kuyruktayken sıra numarası; yeni mesajda okunmamış sayı rozeti
    (mobilde hafif titreşim). Basınca sohbet açılır; sohbet herhangi bir şekilde kapanınca kaybolur. GET /support/summary ve
    /venue-panel/support/summary (durum, sıra, okunmamış; okundu yazmaz), açık sohbet varken 4 sn'de bir. Mekân paneli menüsündeki
    "Canlı Destek" öğesinde okunmamış mesaj sayısı baloncuğu (10 sn'de bir; mekân hesabına uygulama içi bildirim)
  - Rol: UserRole.SUPPORT (Temsilci). Yönetim panelinde (web + mobil) yalnız "Canlı Destek" sekmesi; diğer sayfalar açılmaz, ADMIN uçları
    RolesGuard'da reddedilir (SUPPORT seviyesi ADMIN'in altında), canlı destek uçları rolü ayrıca denetler. Temsilci hesabını yalnız SUPERADMIN
    açar (ad, soyad, e-posta, telefon, şifre; rol SUPPORT) ve kapatır (status DELETED, oturumlar düşer, açık sohbetleri sıraya döner;
    girişte ve temsilci listesinde "Bu temsilci artık destek ekibinde değil." / "This agent is no longer on the support team.").
    Her temsilciye ve canlı destek yapan ADMIN / SUPERADMIN'e benzersiz, rastgele, 5 haneli, değişmeyen Temsilci No (SupportAgent.agentNo).
    ADMIN bütün sohbetleri salt okunur görür, yalnız kendine atanan sohbete yazar (mesaj, iç not). SUPERADMIN bütün açık sohbetleri canlı
    izler ve istediğini devralır (devir notu "SUPERADMIN devraldı", TAKEOVER_NOTE). Devralınan sohbet eski temsilcinin "Açık Sohbetlerim"
    listesinden ve kotasından hemen düşer, eski temsilciye bildirim gitmez; ekranında açıksa 403 gösterilmez, son hâli salt okunur kalır
    (mesaj alanı, hazır yanıtlar, iç not, devir, Haiku kapalı), en altta "Bu sohbet SUPERADMIN tarafından devralındı." (yönetim paneli
    yalnız Türkçe); SUPPORT rolüne GET /admin/live-support/chats/:id yalnız {takenOver: true} döner, ekrandan çıkınca yeniden açılamaz. Yazıyor ve çevrimiçi / çevrimdışı durumu bellekte; Temsilci No ilk kullanımda atanır
  - Sıra ve atama (her 10 sn zamanlanmış iş + her olayda): tek ortak sıra, ilk gelen ilk alınır (queuedAt). Çevrimiçi temsilciler arasında en
    az açık sohbeti olana, eşitse en uzun süredir boşta olana (idleSince). Eşzamanlı sınır varsayılan 3 (AppConfig SUPPORT_MAX_CHATS, Ayarlar →
    Canlı Destek). Herkes doluysa sırada bekler, sohbet kapanınca sıradaki atanır. Atanan temsilci 2 dk içinde ilk cevabı vermezse başka uygun
    temsilciye; yoksa sıranın başına döner. Durum Çevrimiçi / Mola / Çevrimdışı; mola ve çevrimdışı yeni sohbet almaz, açıklara devam eder.
    Devret: zorunlu notla başka çevrimiçi temsilciye; devralan geçmişi ve notu görür; kullanıcı yeni Temsilci No'yu görür ve sistem mesajı
    "Görüşmen başka bir temsilcimize aktarıldı, durumu baştan anlatmana gerek yok." düşer. Vardiya (Ayarlar): Gündüz 08:00-20:00, Gece
    20:00-08:00 (SUPPORT_SHIFT_DAY / SUPPORT_SHIFT_NIGHT), yalnız raporlamada; sistem 7/24 açık. Sırada 90 sn'yi geçen sohbet: bütün ADMIN ve
    SUPERADMIN'e uygulama içi bildirim + push (sohbet başına bir kez). Admin menüsünde "/admin/canli-destek" baloncuğu sıradaki sohbet sayısı
    (menu-counts; Temsilci için canlı destek durumundan)
  - Temsilci ekranı: web 3 sütun (sol sıradaki ve açık sohbetler, orta aktif sohbet, sağ Haiku paneli); mobil sohbet ekranında "Haiku" butonu
    alttan yarım ekran panel. Listede / başlıkta üye için ad soyad, mekân için mekân adı · yetkili ad soyad, konu etiketi, bekleme süresi;
    kullanıcı hakkında Haiku dışında veri yok. Hazır yanıtlar (admin ekler / düzenler / siler; "/" ile liste), yazı önizlemesi, iç not
    (kullanıcıya asla gösterilmez), web sesli uyarı (yeni sohbet / yeni mesaj), mobilde push. Kötüye kullanım: sohbeti kapatıp canlı destek
    erişimini 1 / 7 / 30 gün kısıtlar (SupportRestriction); kısıtlı kullanıcı butonda kalan süreyi görür; SUPERADMIN kaldırır; İşlem Kayıtları'na yazılır
  - Haiku asistanı (support-ai.service.ts, claude-haiku-5-5, CLAUDE_API_KEY): yalnız okur; veri değiştirmez / silmez, iade / iptal / hak
    tanımlamaz, kullanıcıya mesaj göndermez (mesajı temsilci gönderir: "Kopyala", "Sohbete ekle"). Okuma işlevleri parametre almaz; hesabı
    sunucu sohbet kaydından verir (metinden ID / isim / telefon alınmaz, başka hesap istenirse reddeder). Tahmin yok: tutar, tarih, sayı
    veritabanından. Üye işlevleri: hesap_ozeti, paketler_ve_haklar, premium_abonelik, odemeler, masalar, haftalik_secim, kyc_durumu, yaptirimlar,
    davet_ve_indirim; mekân: mekan_bilgisi, mekan_masalari. Kapalı: KYC görsel / video, kimlik no, telefon, OCEAN, Masa Sohbeti, Acil Yardım,
    başka kullanıcıların verisi. Temsilci isterse sohbetteki görselleri okur; taslak cevap önerir. Her yanıtta "Kopyala" (panoya yazar, 1,5 sn "Kopyalandı ✓",
    mobilde hafif titreşim; kopyalama kaydedilmez). Her istek SupportAiLog (Temsilci No, sohbet ID, istek türü requestType QUESTION | DRAFT,
    soru, çağrılan işlevler, sonuç success, hata türü errorType NO_KEY | TIMEOUT | MODEL_ERROR | CONNECTION_ERROR | INTERNAL_ERROR, zaman;
    başarısız istekler de yazılır, temsilciye giden hata metni aynı; migration 20261126200000_support_ai_log_result; SUPERADMIN görür)
  - Tüm Sohbetler sekmesi (yalnız SUPERADMIN; ADMIN ve SUPPORT görmez; web + mobil): açık, sıradaki ve kapanmış bütün üye ve mekân sohbetleri;
    satırda ad soyad (mekânda mekân adı), konu, durum, Temsilci No, başlangıç tarihi saati, süre (başlangıçtan kapanışa / şimdiye), yıldız;
    filtre tarih aralığı, durum, konu, Temsilci No, hesap türü; ad soyad / mekân adıyla arama; sayfa başına 50. Basınca sohbetin tamamı
    (mesajlar, görseller, iç notlar, devirler, değerlendirme + yorum, o sohbetin Haiku sorgu kayıtları); açık sohbette "Devral" (mevcut
    devralma). Uçlar GET /admin/live-support/manage/chats, GET /admin/live-support/manage/chats/:id (SUPERADMIN)
  - Raporlar (ADMIN + SUPERADMIN): temsilci başına ilk yanıt süresi, ortalama sohbet süresi, kapatılan sohbet, puan ortalaması, Evet oranı,
    etiket dağılımı; genel konu dağılımı, saatlik ve vardiya yoğunluğu, ortalama bekleme
  - Saklama: destek sohbetleri, görseller, iç notlar, değerlendirmeler ve Haiku sorgu kayıtları 2 yıl (retention-policy.ts SUPPORT_CHATS, gece
    otomatik silme işine bağlı). Hesap silinince sohbetin hesapla bağı koparılır (userId boş), ad soyad "Silinmiş kullanıcı", içerik süre
    dolana kadar kalır. KVKK, Gizlilik (TR + EN) ve hesap silme sayfası (del.ret15) metinleri; Anthropic (ABD) aktarımı KVKK m.9/4, işleme
    sebebi m.5/2-c ve m.5/2-f. Kişisel veri dökümünde (Veri Saklama) destek sohbetleri ve görselleri var
  - SupportChat.status: QUEUED (sırada), ACTIVE (atanmış), CLOSED; OPEN ve TICKET ileride destek bileti için ayrıldı (arayüz yok)
  - Maskot (kırmızı kulaklıklı sandalye, şeffaf WebP): baloncuk sürümü yalnız üst kısım 512×512 (web public/maskot/destek-baloncuk.webp,
    mobil assets/destek-baloncuk.webp); tam sürüm uzun kenar 1024 (public/maskot/destek-tam.webp, assets/destek-tam.webp)
  - Baloncuk: mesaj ikonu yok, maskotun baloncuk sürümü; mobil 60 pt, web 64 px; sıra (kuyrukta) ve okunmamış rozeti sağ üstte maskotun
    üstünde; erişilebilirlik etiketi sup.title ("Canlı Destek" / "Live Support") + sıra / okunmamış bilgisi; davranış aynen
  - Kuyruk: sıra satırının hemen üstünde maskot tam sürüm, yükseklik 72 (pt / px); oyun açıkken gösterilmez
  - Sohbet başlığı: temsilci bağlanınca (ACTIVE) başlık bloğunun üstünde ortalı maskot baloncuk sürümü 40 (pt / px); iki satırlı başlık ve
    Sohbeti Sonlandır aynen
  - Filigran (yalnız üye ve mekân ekranı; temsilci / ADMIN / SUPERADMIN ekranında yok): sohbet alanının ortasında maskot tam sürüm, alan
    genişliğinin %60'ı, oran korunur, sabit (mesajlar üstünden kayar), opaklık %8 (uygulama yalnız koyu tema; açık temada %10 kuralı),
    renkli, dokunma almaz (web pointer-events none, mobil pointerEvents none); kuyrukta ve sohbet boyunca görünür, Breakout açıkken gizli
  - Temsilci ekranı avatarı (web + mobil; sohbet listesi satırları, açık sohbet başlığı, Tüm Sohbetler satırı ve detayı): Masa Kuruldu
    DetayAvatar (web @ahenk/ui, mobil components/DetayAvatar). Üye: onaylı profil fotoğrafı ya da ad soyad baş harfleri, cinsiyet renkli
    çerçeve + cinsiyet tonlu zemin. Mekân hesabında cinsiyet ve fotoğraf yok: yetkili ad soyadının baş harfleri (ad yoksa "?.?."),
    altın çerçeve #e0a526 (web PaketKarti AMBER, mobil onb.primeBorder; Nasıl Çalışır 3 aylık kutu kenarlığı) + hafif altın zemin
    rgba(224,165,38,0.12), baş harfler beyaz kalın (DetayAvatar ring; yalnız canlı destek mekân sohbetlerinde, diğer ekranlar aynen). Backend satır ve detay yanıtlarında avatar {initials, gender, photoUrl} (support.service.ts avatars)

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

MASADAN AYRILMA / İPTAL AKIŞI (eski; iptal artık Eşleşme Paneli seçim kartından, sebep sorulmadan ve hak yakmadan yapılır — YARIN BULUŞMA):
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
    12 saat kala kapanış hatırlatmaları, Perşembe 20:00 grup iptal özeti, Cuma / Cumartesi / Pazar 10:00 masa bildirimleri;
    Yarın Buluşma'nın ataması, 23:59 kilidi, Planlı'ya aktarımı, hak düşümü ve her gün 10:00 masa bildirimi.
    Ayar açıkken davranış aynı. Masa kapanışı (6 saat sonra), gelmeyen işaretleme, değerlendirme bildirimleri,
    paket süre dolumu, Prime, winback ve ödeme işleri bu ayara bakmaz

YÖNETİM PANELİ EK KURALLARI (web + mobil):
  - Bot profil fotoğrafı: Bot Ekle / Botu Düzenle formunun üstünde yuvarlak önizleme (yoksa baş harfler, cinsiyet renkli çerçeve) ve
    "Profil Fotoğrafı Yükle" / "Fotoğrafı Değiştir"; yalnız galeri / dosya. POST /matching/admin/bots/:id/profile-photo (yalnız SUPERADMIN):
    ProfilePhoto tablosuna doğrudan APPROVED kaydedilir (onay yok), önceki fotoğraf (dosya + kayıt) silinir; GET /matching/admin/bots photoUrl döner;
    bot silinince fotoğraf klasörü de silinir
  - SUPERADMIN, SUPERADMIN ve ADMIN hesaplarını düzenleyebilir (kişisel bilgi, durum, yaptırım, yaptırım kaldırma, gelmedi uyarısı;
    assertCanSanction); ADMIN, SUPERADMIN ve ADMIN hesaplarına hiçbir işlem yapamaz. SUPERADMIN kendi hesabını da düzenler (kendi
    detayında hesap işlemleri görünür, "Bu hesaba işlem yetkin yok" çıkmaz); diğer roller kendi hesabını değiştiremez; kendi rolünü kimse
    değiştiremez
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
  - Menü bildirim baloncukları (web + mobil): GET /admin/menu-counts (backend admin/admin-menu-counts.ts) sayfa açılınca ve 60 sn'de bir;
    her sekmede bekleyen iş sayısı küçük kırmızı yuvarlak (0 ise yok, 99'dan fazlası 99+): Acil Yardım açık talep, KYC Bekleyenler PENDING,
    Profil Fotoğrafları PENDING, Kullanıcılar onay bekleyen hesap silme talebi, Uyarılar okunmamış (rol filtresi aynen), Ekran Görüntüsü
    İhlalleri karar bekleyen 2. ve sonraki ihlal, Şikayetler kararsız kayıt, Ödeme Sonuçlandırma DUPLICATE ödeme, İş Ortaklığı ve Kariyer
    PENDING başvuru (son üçü yalnız SUPERADMIN)
  - Veri Saklama sekmesi (web + mobil): dar ekranda (web 768 px altı, mobil uygulama) her kategori ayrı kart, alanlar "Etiket: Değer" alt
    alta; geniş ekranda tablo, sütunlar okunabilir en küçük genişlikte, gerekirse yatay kaydırma (kelimeler harf harf kırılmaz)
  - Menü: üst barda "AHENK YÖNETİM PANELİ" yanında logo yok; açılır menüde "Acil Yardım" emoji yok, kırmızı geçişli hap etiket (beyaz kalın
    büyük harf, solda beyaz nokta, kırmızı parıltı); mobil çekmece güvenli alanın hemen altından başlar (statusBarTranslucent),
    web mobil görünüm çekmecesi env(safe-area-inset-top)
  - Bot atama bildirimi: masaya bot atandığında (otomatik grup / baş başa botu, elle bot ekleme, elle kurulan
    masadaki bot) her bot için Uyarılar'a BOT_ASSIGNED kaydı (AdminAlert.message: bot adı soyadı, masa türü, mekân, şehir, buluşma tarihi
    ve saati; mekân yoksa "Atanmadı") ve yalnız SUPERADMIN hesaplarına bildirim (IN_APP + FCM, "Masaya bot atandı"). BOT_ASSIGNED ve
    BOT_NOT_FOUND uyarılarını yalnız SUPERADMIN görür / okundu işaretler (backend getAlerts / markAlertRead)
  - Elle bot ekleme yalnızca masa detayındaki bot yerleştirme ile yapılır.
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
Görünüm (web packages/ui MasaDetayKarti ChatSection, mobil MasaDetayKarti ChatSection):
  - Her masa türünde başlık "Masa Sohbeti" (EN "Table Chat", masa.chatTitle), sağında katılımcı sayısı (ör. 2/2)
  - Her mesajda gönderenin onaylı profil fotoğrafı (yoksa cinsiyet renkli baş harf) ve "Ahmet Y." adı (serinin ilk mesajında);
    saat baloncuğun içinde sağ altta, metinden farklı renkte; gönderilirken "gönderiliyor"
  - Gönder yazısı yok, gönder (ileti) ikonu; yazı alanının solunda emoji seçici
  - Klavye: web'de odak / visualViewport değişiminde son mesajlar ve yazı alanı görünür kalır; mobilde Masalarım ScrollView
    automaticallyAdjustKeyboardInsets + useKeyboardFieldScroll
  - Sohbet Kuralları açılır penceresi (gerçek kart + önizleme): sohbetin altında sabit kural kartı yok. Mesaj yazma alanına ilk
    dokunuşta sarı çerçeveli "Sohbet Kuralları: …" metni (masa.chatRulesTitle / chatRulesText; "yasaklı madde içerikli mesajlar")
    pencerede açılır; altında yalnız "Anladım" / "Got it" (masa.chatRulesGotIt). Dışarı basınca, Esc ya da Android geri tuşuyla kapanmaz;
    "Anladım" ile kapanır, yazı alanı odaklanır ve klavye açılır (önizlemede alan pasif). Masa başına bir kez: cihazda saklanır (web
    localStorage, mobil AsyncStorage, anahtar ahenk_chat_rules_<masa ID>), DB'ye yazılmaz
Otomatik mesaj engeli (backend chat/chat-moderation.ts):
  - Normalize: boşluk, nokta, tire silinir; küçük harf; 1→i, 0→o, 3→e. 7+ rakam (rakam sayımı harf dönüşümünden önce) ya da link
    (www, http, .com / .net / .org / .tr ve benzeri alan uzantıları; uzantı noktayla aranır) → anında engel, karşı tarafa iletilmez
  - Şüpheli kelime (instagram, insta, instgram, ig, snap, snapchat, telegram, whatsapp, wp, numaram, tel, hesabım, takip et, dm;
    ig / wp / tel / dm yalnız ayrı sözcük) → mesaj bekletilir (gönderende "gönderiliyor"), Claude Haiku (claude-haiku-5-5, CLAUDE_API_KEY)
    sorulur: masum → iletilir, ihlal → engellenir. Listeye girmeyen mesaj Haiku'ya gönderilmez
  - Yasaklı madde şüpheli kelimeleri (kokain, koko, eroin, metamfetamin, met, kristal, kri, kıristal, kıris, esrar, kenevir, hint keneviri,
    türk otu, mariana, marik, mariuana, marry jane, marry ceyn, meri ceyn, lemon / limon / purple haise-haize-heys-heyz-hais-haiz, ot,
    extacy, lilika, ilaç): aynı normalize kuralıyla eşleşir, çok sözcüklüler boşluksuz hâliyle; kısa olanlar (ot, met, kri) yalnız ayrı
    sözcük. Anında engel yok: mesaj Haiku'ya gider, istemde yasaklı madde kuralı açıkça yazılıdır ve Haiku kelimenin mesajdaki kullanımına
    göre karar verir ("ilaç", "ot", "met", "koko", "kri" başka anlamdaysa ihlal sayılmaz); ihlalde mevcut engel akışı
  - Engelde gönderene errors.chatBlocked ("Yapay zekâ bu mesajda kural ihlali tespit etti. …"); mesaj ChatMessage.blockedAt ile saklanır
    (yalnız admin görür) ve Şikâyetler'e "Otomatik engel" kaydı (ChatReport.auto) düşer
  - Haiku'ya ulaşılamazsa / anahtar yoksa mesaj iletilmez, kaydedilmez: "Mesajın gönderilemedi, tekrar dene." (errors.chatSendFailed)
Şikayet sistemi:
  - Başkasının mesajına basılı tutunca (web: sağ tık ya da ⋯ mesaj menüsü) "Şikâyet Et"; nedenler (ChatReportReason): Hakaret/tehdit/
    aşağılayıcı ileti, Taciz veya cinsel içerikli ileti, Buluşma yerini değiştirme, Telefon/sosyal medya paylaşımı, Uyuşturucu içerikli
    ileti, Dolandırıcılık/para talebi, Reklam/yönlendirme, Ayrımcı içerik, Sahte profil şüphesi, Diğer ("Diğer"de açıklama zorunlu)
  - Bir kullanıcı aynı mesajı yalnız 1 kez şikâyet eder; şikâyet edilen kişiye hiçbir bildirim gitmez
  - Admin Şikâyetler (web /admin/quality, mobil admin/quality): şikâyet ve otomatik engel kayıtları; detayda şikâyet edilen mesaj
    işaretli olarak sohbetin tamamı, gönderenin fotoğrafı ve önceki uyarıları
Admin kararları ve bildirim şablonları (backend admin/admin-moderation.ts):
  - Uyar / Masadan çıkar / Askıya al (3 / 15 / 30 gün). Kullanıcı daha önce uyarı aldıysa (kaldırılmamış WARNING) yalnız Masadan çıkar
    ve Askıya al aktif. Admin serbest mesaj yazamaz; kullanıcıya yalnız hazır şablon push (başlık "Ahenk") gider, sonunda ihlal türü
    ("İhlal: …" / "Violation: …"). Uyar: WARNING yaptırımı (source CHAT). Masadan çıkar: katılım CANCELLED, masa erişimi kapanır,
    hak iade edilmez (sohbet kilit sonrası açıldığı için hak düşülmüştür). Askıya al: mevcut SUSPENSION akışı (createSanction)
  - Şablon metinleri talimattaki gibi: Uyar "Ahenk Ekibi: … Bu ilk uyarındır. …", Masadan çıkar "Ahenk Ekibi: … Bu masadan çıkarıldın …",
    Askıya al "Ahenk Ekibi: Kural ihlalin nedeniyle hesabın [3 gün / 15 gün / 30 gün] boyunca askıya alındı. …" (EN karşılıkları)
Profil fotoğrafı silme (admin, web + mobil AdminUserPhoto):
  - Kullanıcı fotoğrafı büyütülünce "Sil" → onay. Fotoğraf (dosya + kayıt) sunucudan silinir. İlk fotoğraf ihlalinde push "Topluluk
    kurallarımıza aykırı olan uygunsuz fotoğrafınız kaldırılmıştır." ve WARNING (source PHOTO); önceki fotoğraf ihlali varsa admin askı
    süresini seçer (3 / 15 / 30 gün), Askıya al şablonu gider. Şu an Kullanıcılar detayı ve Şikâyetler detayında
Prisma modeli:
  - ChatMessage { id, meetingId, senderId, content, createdAt, deletedAt?, blockedAt? }
  - ChatReport { id, messageId, reporterId?, reason?, note?, auto, decision?, decisionDays?, decidedAt?, decidedById?, createdAt }
  - UserSanction.source (CHAT | PHOTO)
Endpoint'ler:
  - GET /chat/:meetingId/messages — mesaj listesi (JWT zorunlu, masa katılımcısı olmalı; senderPhotoUrl)
  - POST /chat/:meetingId/messages — mesaj gönder (JWT, kapanış saati kontrolü, otomatik engel)
  - POST /chat/messages/:messageId/report — şikayet et {reason, note?} (JWT)
  - GET /chat/admin/:meetingId — admin sohbet geçmişi (ADMIN guard)
  - GET /admin/chat-reports, GET /admin/chat-reports/:id, POST /admin/chat-reports/:id/decision {action, days?}
  - GET /admin/users/:id/photo-violations, POST /admin/users/:id/profile-photo/delete {suspendDays?}

REZERVASYON İPTALİ KURALLARI (güncelleme):
  - İptal masa kilidine kadar (buluşmadan önceki gün 23:59) seçim kartından yapılır, hak yanmaz; iptal eden 24 saat hiçbir masaya
    katılamaz (YARIN BULUŞMA); aşağıdaki
    "Perşembe / Cuma 20:00" son anları ve iptalde hak düşümü kaldırıldı. Planlı grup iptal bildirimi Perşembe 20:00 özetiyle,
    Yarın grup masasında kalanlara hemen
  - (eski) Grup masası: Perşembe 20:00'a kadar iptal butonu aktif
  - (eski) Baş başa: Cuma 20:00'a kadar iptal butonu aktif
  - İptal anında admin masa detayına log düşer: "K.A. — 18:34'te rezervasyonu iptal etti"
  - İptal sonrası son 1 saate kadar sistem yeni kişi arar
  - 1 saat içinde bulunamazsa: eksik cinsiyete göre bot eklenir
  - Grup dengesi zorunlu: 3E + 3K; bot da bu dengeyi koruyarak girer (kız eksikse kız bot, erkek eksikse erkek bot)
  - (eski) Baş başa iptalinde de aynı mantık: yeni eşleşme arar, bulamazsa bot — sistem baş başaya otomatik bot eklemez

KULLANICI UYARI / ASKIYA ALMA / BANLAMA SİSTEMİ:
Admin işlemleri (masa detayında veya kullanıcı profilinde):
  - Katılımcılar admin panelinde K.A. gibi kısaltmayla gösterilir
  - K.A.'ya tıklayınca o kullanıcının tam profili + geçmişi açılır
  - Uyarı ver: sebep zorunlu, kullanıcı giriş yapabilir ama uyarı mesajı görür ve devam edebilir
  - Askıya al (tek model, backend common/suspension.ts): süre yalnız 3 gün / 15 gün / 1 ay (admin web + mobil bütün askı butonları).
    Askı giriş, oturum, paket, abonelik, iyzico / mağaza aboneliğini etkilemez; User.status değişmez (eski SUSPENDED üye hesapları
    migration 20261121100000 ile ACTIVE yapıldı, botlarda SUSPENDED = pasif). Askıdaki kullanıcı: seçim / değiştir, kanka daveti / kabulü,
    paket ve abonelik satın alma (iyzico init + mağaza doğrulama) reddedilir; eşleştirme havuzuna girmez; seçim ekranı otomatik açılmaz,
    Seçim Yap kapalı + uyarı metni. Askıda şablon push (süre otomatik). Profilim'de geri sayım kartı (Eşleşme Paneli sayacıyla aynı; süre
    bitince kaybolur; web + mobil). Askı nedeniyle daha önce kesilen abonelikler geri verilmez (konu kapandı)
  - Uyarılar türe göre ayrı sayılır: sohbet (source CHAT), fotoğraf (PHOTO), gelmedi (meetingId / NO_SHOW). Masadan çıkarmada diğer
    katılımcılara push + uygulama içi "Masandaki bir katılımcı masadan ayrıldı." (EN karşılığı)
  - Profilim gelmedi uyarısı (web + mobil, prof.noShow): uyarı varsa yalnız "Gelmedi uyarın var. Tekrarlanırsa hesabın askıya alınır." /
    "You have a no-show warning. If it happens again, your account will be suspended."; "kalan hak" ifadesi / sayısı yok; uyarı yoksa alan yok
  - Banla: sebep zorunlu; kullanıcı kalıcı olarak giriş yapamaz. Banlı telefonla yeniden kayıt engeli mesajı "Bu numarayla kayıt
    yapılamaz." / "You can't sign up with this number." (errors.phoneCannotRegister)
  - Ban ve admin iptali iyzico aboneliğini de iptal eder (askı etmez) (iyzico hatası loglanır, işlem sürer); sunucuda iptal
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
  - SUSPENDED: (eski model) askı artık User.status'u değiştirmez; eski kayıtlar için checkSanction kuralı duruyor
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
  Admin Acil Yardım (web + mobil): üstte isim / telefon yok; "Haritada Gör" ve "Kapat" / "Detay" buton görünümünde; konum kesildi satırı
  (son konum zamanı + adres); kişi kartları: fotoğraf (büyür + Sil), ad, telefon, Detay → tüm bilgiler + kimlik ön yüzü (büyür).
  Google Maps anahtarları: web NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, mobil EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, backend GOOGLE_MAPS_API_KEY (açık
  talep adresi 50 m değişimde ya da 1 dk'da); anahtar yoksa Leaflet / OSM + Nominatim aynen.
  Acil Durum Kişisi (web + mobil Profilim > Gizlilik ve Güvenlik): en fazla 2 kişi, her biri ad + ülke kodlu telefon (1. kişi
  User.emergencyContactName / Phone, 2. kişi emergencyContact2Name / Phone; migration 20261125400000_emergency_contact_2). Her kişi
  düzenlenir / silinir (1. silinirse 2. kişi 1. sıraya geçer), 2 kişi kayıtlıyken "Kişi Ekle" gizli; "Kişi Ekle" başlığın sağında; not metni.
  Her kişi Numara Engelleme'deki engellenen numara kutularıyla aynı stilde ayrı kutu (web ll-card 12 / 16, mobil Card): solda
  "Babam · +905…" ana kırmızı (#c0392b), sağda kalem (düzenle) ve kırmızı çöp kutusu (sil) ikonu (44 pt); 2 kişi alt alta. DÜZENLE / SİL
  yazılı butonları yok.
  Uçlar: GET /users/me/emergency-contacts, PUT / DELETE /users/me/emergency-contacts/:slot (1 | 2); eski tek kişilik
  /users/me/emergency-contact uçları 1. kişi için duruyor. SOS talebinde ahenk_emergency_contact WhatsApp şablonu kayıtlı her iki kişiye
  gider (dil kullanıcıya göre, talep başına bir kez; SosReport.emergencyNotifiedAt / emergencyNotifyFailed); biri başarısızsa admin
  detayında "Acil durum kişisine bildirim gönderilemedi". Admin Acil Yardım talep detayında "ACİL DURUM KİŞİLERİ" ve admin Kullanıcılar
  detayında "Acil durum kişisi 1 / 2" (ad + telefon; yanıtlarda emergencyContacts) görünür (web + mobil).
  KVKK + Gizlilik Politikası (TR + EN) maddesi var. Hesap silinince kişiler silinir.
Admin masa detayı (web + mobil): katılımcı kartı (fotoğraf büyür + Sil, ad, telefon, Detay); gelmeyende kırmızı "GELMEDİ" → detay
  penceresi (fotoğraf, ad, bildirenler + zaman, önceki gelmedi uyarıları, "Uyarı ver"; önceki uyarı varsa yalnız askı). Uyarı ver:
  şablon push + uygulama içi (tarih otomatik). Gelmedi bildirimi admin Uyarılar'a düşer (AdminAlertType NO_SHOW_REPORTED).
  Nominatim (OpenStreetMap) reverse geocoding: TR dili, max 1 istek/saniye (seri kuyruk), adres cache max 200 kayıt.
Kullanıcı tarafı (web + mobil masa detay kartı):
  - Acil Yardım butonu alt kartın en üstünde (eski Rezervasyon kartı ve Yola Çıktım yerinde); masa saatinden buluşmadan sonraki gün
    08:00'e kadar görünür (sosEndsAt). Altında: "Buluşma akşamından sabah 08:00'e kadar, nerede olursan ol yanındayız. Kendini tehlikede
    hissedersen hemen bas. · Nasıl çalışır?" (masa.sosHelp + masa.sosHow); "Nasıl çalışır?" penceresi masa.sosHowText
  - Talep Formu metni "ekibimiz tarafından takip edilir" (masa.sosShared); formun altında "Arayabilecek durumdaysan 112" (tel:112)
  - Talep gönderilince 30 sn uyarı: "ACİL YARDIM TALEBİN ALINDI / Ekibimiz seni şu an takip ediyor. / Konumun ve masa bilgileri
    gerektiğinde emniyet birimleriyle paylaşılır. / Konumunu kapatma." (son satır kalın), 30 sn geri sayım çubuğu + X
    (web components/SosOpenReport.tsx, mobil components/SosNotice.tsx)
  - Konum kesintisi (açık talep): (b) mobil ~10 sn'de bir konum servisi / iznini denetler, kapanınca POST /sos/reports/:reportId/location-off
    (web: watchPosition hata verince aynı uç); (a) yedek: sunucu 30 sn'de bir bakar, 120 sn konum gelmeyen talepte bildirir.
    Talep edene push: başlık yalnız "Ahenk", metin "Konum servisin kapalı görünüyor. Uygulamanın düzgün çalışması için konumunu aç."
    ("acil yardım" ifadesi yok, IN_APP kaydı yok). Kesinti başına bir kez (SosReport.locationOffNotifiedAt); konum yeniden gelince alan
    boşalır, konum yanıtı resumed: true döner ve uygulama 10 sn "KONUMUN YENİDEN ALINIYOR / Ekibimiz takipte. Konumunu açık tut."
    (son cümle kalın, X ile kapanır) gösterir; tekrar kesilirse yeni kesinti sayılır
Endpoint'ler:
  - POST /sos/:meetingId/report — SOS raporu oluştur {threats[], lat?, lng?, accuracy?} (JWT)
  - POST /sos/reports/:reportId/location-off — açık talepte konum kesintisi (JWT, talep sahibi)
  - POST /sos/:reportId/location — canlı konum güncelle {lat, lng, accuracy?} (JWT)
  - POST /sos/:meetingId/participant-location — tüm katılımcı konumu gönder (JWT)
  - GET /sos/admin/reports — tüm raporlar listesi (ADMIN guard)
  - GET /sos/admin/reports/:id — rapor detayı + konum geçmişi (ADMIN guard)

REZERVASYON İPTALİ EK KURALLAR:
  - cancelRegistration bildirim listesi: CANCELLED, DECLINED, NO_SHOW statüsündeki katılımcılar "1 kişi ayrıldı" bildiriminden çıkarılır.
  - Admin masalar/[id] sayfasında iptal eden katılımcının cancelledAt tarihi ve leaveReason metni gösterilir.
  - MeetingParticipant.cancelledAt alanı iptal anında set edilir.

SOHBET SİSTEMİ EK KURALLAR:
  - chatCloseTime hesaplaması TR timezone (UTC+3 sabit offset) ile yapılır.
  - Grup masası gece yarısı güvenliği: scheduledAt >= kapanış saati ise closeTime = scheduledAt + 4 saat.
  - Bu güvenlik sadece GROUP için geçerlidir; ONE_ON_ONE için uygulanmaz (Cuma kapanışı geçtiyse sohbet zaten kapalıdır).
  - Admin şikâyet listesi /admin/chat-reports'a taşındı (chat controller'daki admin/reports/list kaldırıldı); literal route'lar her zaman
    parametrik route'lardan önce tanımlanır.
  - Topluluk Kuralları (web /topluluk-kurallari TR + EN; mobil Profilim yasal kartında): "Masa Sohbeti ve Profil Fotoğrafı Kuralları"
    bölümü — sohbet kuralları, otomatik engel, şikâyet, fotoğraf kuralları, yaptırımlar (uyarı, masadan çıkarma, 3/15/30 gün askı,
    hak yanması, iade yok).
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
  - Admin paneli yalnızca Türkçe (istisna: Veri Saklama sekmesinde TR / EN seçici, dr.* anahtarları; rapor41). Mekân paneli Türkçe + İngilizce (web app/[locale]/mekan, /en/mekan…; metinler vp.* anahtarlarında).
    /en/admin… Türkçe /admin… adresine yönlenir. Mobil yönetim ekranları Türkçe; mobil uygulamada mekân paneli yoktur.
  - Backend mesaj dili: kullanıcıya dönen hata ve bilgi mesajları tr.json / en.json "errors.*" anahtarlarında; kod Türkçe metinle yazılır,
    backend/src/common/api-messages.ts (global filtre + dönüştürücü) metni anahtar üzerinden seçilen dile çevirir. Yeni kullanıcı mesajında
    iki dosyaya da errors.* anahtarı eklenir. Dil sırası: 1) giriş yapmış kullanıcının language alanı, 2) Accept-Language başlığı ("en" ile
    başlıyorsa English), 3) Türkçe. Hata yanıtlarının alan yapısı ve HTTP kodları değişmez, yalnız message metni. /admin/ uçlarında
    mesajlar Türkçe kalır; /venue-panel/ uçları Accept-Language'a göre Türkçe / İngilizce.
  - Accept-Language: web ve mobil her API isteğinde o anki arayüz dilini (tr / en) gönderir (web lib/api.ts langHeaders — <html lang>;
    mobil lib/api.ts langHeaders — i18n dili; elle fetch / XMLHttpRequest yapan yerler ve packages/ui istekleri dahil).
  - Dil belirleme sırası (resolveLanguage): 1) giriş yapmış kullanıcının hesabındaki dil (User.language: tr | en, varsayılan tr),
    2) cihazda / tarayıcıda kayıtlı seçim, 3) cihaz / tarayıcı dili Türkçe ise Türkçe, değilse English. Dil değişince hesaba kaydedilir
    (PATCH /users/me/language). Profilim > Hesap Bilgileri'nde "Arayüz Dili / Interface Lang." satırı (Türkçe / English, seçilide ✓).
  - Web adresleri: Türkçe mevcut adreslerde, İngilizce /en önekiyle (next-intl localePrefix "as-needed", app/[locale]/).
  - Dünya ikonu (dil seçici): mobilde giriş, kayıt ve "Tekrar hoş geldin" ekranlarında sağ üst (sağdan 20 pt; 24×24 görünür, 44×44 dokunma;
    solunda "TR" / "EN" 13, #FFFFFF, opaklık 0.7, 6 pt ara; açılır kart köşe 12, Türkçe / English, seçilide ✓; renkler tema paletinden:
    kart zemini ll.bg + llCard çerçeve, yazı ll.text, seçili satır tabBar.activeBg, ✓ ll.red — sistem grisi yok); webde header'ın sağ ucu.
  - Telefon: telefon numarası girilen bütün ekranlarda (giriş, kayıt, şifre sıfırlama, kanka davet, Profilim telefon
    değiştirme, Numara Engelleme; web + mobil) tek ortak ülke listesi (packages/shared/src/i18n/countries.ts): yalnız 42 ülke, şu sırayla,
    grup başlığı yok: Türkiye, Birleşik Arap Emirlikleri, Katar, Bahreyn, Kuveyt, ABD, Rusya, Almanya, Birleşik Krallık, Polonya, Bulgaristan,
    Hollanda, Fransa, İtalya, Ukrayna, Romanya, İspanya, Belçika, Avusturya, İsveç, İsviçre, Yunanistan, Danimarka, Çekya, Macaristan,
    Finlandiya, İrlanda, Litvanya, Portekiz, Slovakya, Hırvatistan, Slovenya, Letonya, Estonya, Lüksemburg, Malta, Güney Kore, Japonya, Çin,
    Endonezya, Tayland, İran. Varsayılan 🇹🇷 +90; listede olmayan ülke +90 Türkiye sayılır (splitE164). Ad ve kodla aranabilir, ülke adları
    arayüz dilinde. Mobilde liste yalnız seçici açılınca oluşturulur, FlatList ile sanallaştırılır. Backend telefon doğrulaması aynı; doğrulama libphonenumber-js ile seçilen ülkeye göre; numaralar veritabanında E.164
    (+905…, +44…) saklanır; OTP ve giriş E.164 numarayla çalışır. Profilim telefon değiştirme ve Numara Engelleme'de de ülke kodu seçici
    (varsayılan ülke kayıtlı telefonun ülkesi, E.164 gönderim).
  - Dil soruları: kayıtta tek ekran. Türkçe arayüzle kayıtta "Yabancılarla masaya oturmak ister misin?" Evet / Hayır (prof.foreignersQ),
    altında küçük not (prof.foreignersNote: "Evet seçersen masanda yabancı katılımcılar olabilir. Ortak dil İngilizce olacağı için temel
    düzeyde İngilizce bilmen gerekir."); varsayılan boş, zorunlu, seçilmeden kayıt tamamlanmaz; speaksTurkish = true. İngilizce arayüzle
    kayıtta bu soru yok (speaksEnglish = true), yalnız "Do you speak Turkish?". "İngilizce biliyor musunuz?" sorusu yok. Kayıt ve Profilim
    aynı tek alanı yazar: User.speaksEnglish (Evet → true; eşleştirmede englishFiller). User.speaksEnglish / speaksTurkish.
    Ana dil: User.nativeLanguage (tr | en) = kayıt olunan arayüz dili (migration 20261116200000: mevcut kullanıcılarda o anki User.language);
    değiştirilemez, ana dilin speaks alanı hep true (kayıt ve PATCH /users/me/spoken-languages zorlar). Profilim'de (web + mobil)
    "Ana dilin: Türkçe" kilitli satır; Türkçe arayüzde altında "Yabancılarla masaya oturmak ister misin?" Evet / Hayır + not (İngilizce
    arayüzde gösterilmez). "Başka konuştuğun diller" bölümü ve "İngilizce biliyorum" / "Türkçe biliyorum" anahtarları yok.
  - Dil bazlı eşleşme (grup, baş başa, Kankamla; backend/src/matching/matching.service.ts noTurkish / englishFiller / languageCompatible),
    mevcut kurallardan önce zorunlu: a) speaksTurkish = false olan kullanıcı yalnız masadaki herkesin speaksEnglish = true olduğu masaya
    yerleşir; b) speaksTurkish = false olanlar önce birbirleriyle eşleşir; c) masa dolmuyorsa boş yerler telefon kodu +90 olan ve
    speaksEnglish = true olan kullanıcılarla doldurulur; d) dil kuralından sonra cinsiyet dengesi; e) grup masasındaki bot kuralı aynen.
    İngilizce arayüz kullanıcısı yalnız "Yabancılarla masaya oturmak" sorusuna Evet diyen Türklerle ve diğer İngilizce arayüz
    kullanıcılarıyla eşleşir.
  - KYC belge türleri (KycSubmission.idType: ID_CARD | DRIVER_LICENSE | PASSPORT | RESIDENCE_PERMIT; TC / YKN eski kayıtlar için enum'da
    durur, seçilemez, mevcut kayda dokunulmadı): "Kimlik Kartı", "Ehliyet", "Pasaport", "Oturma İzni". Kimlik doğrulama başlarken önce
    belge türü sorulur (web + mobil), sonra çekim: Kimlik Kartı / Ehliyet / Oturma İzni'nde önce ön yüz, ön yüz çekilince arka yüz;
    Pasaport'ta yalnız fotoğraflı sayfa; ardından mevcut adımlar (canlılık videosu, gönder) aynen. Mobilde çekim yalnız kamerayla.
    Kimlik numarası alanı yok, numara istenmez ve saklanmaz. Arka yüz de AES-256-GCM şifreli (id-back.<uzantı>.enc), hesap silinince diğer
    KYC dosyalarıyla silinir. Seçilebilir türler bölgenin idTypes alanından: Türkiye bölgeleri dört tür, diğer bölgeler Pasaport, Oturma
    İzni, Ehliyet. İngilizce arayüzde video metni "My name is [ad soyad]" (ad soyad otomatik). Admin KYC ekranında (web + mobil) belge
    türü ve bütün yüzler (ön, arka, video) görünür.
  - iyzico satın alma kimlik alanı: önce TC / YKN / Pasaport seçimi, sonra numara (TC mevcut doğrulama; YKN 11 hane rakam, "99" ile başlar;
    Pasaport 6–9 harf / rakam). Numara veritabanına kaydedilmez, yalnız iyzico'ya iletilir.
  - Bölge alanları (mevcut City modeli): countryCode, timezone, currency, defaultLanguage, phoneCountryCode, idTypes, isActive, sortOrder.
    İstanbul, Ankara, İzmir, Antalya: TR, Europe/Istanbul, TRY, tr, +90, Kimlik Kartı / Ehliyet / Pasaport / Oturma İzni. Dubai Marina,
    Jumeirah Lake Towers (JLT), Downtown Dubai: AE, Asia/Dubai, USD, en, +971, Pasaport / Oturma İzni / Ehliyet, pasif (migration
    20261116200100). Admin "Bölgeler" sayfası (web + mobil; GET /admin/regions,
    PATCH /admin/regions/:id): liste, alan düzenleme, tek tuşla aktif / pasif.
  - Para birimi: Türkiye bölgelerinde TRY (₺); yurt dışı şehirlerde City.currency yerel para birimi (bkz. PARA BİRİMİ); fiyat yalnız TRY.
  - Şehir listeleri (mobil + web, kayıt ve şehir seçimi dahil): aktif şehirler (seçilebilir) → Yakında şehirler iki grupta (soluk, seçilemez).
    Aktif yapılan bölge otomatik üst gruba geçer.
    Grup 1: countryCode TR; ayırıcı TR "Sezon Masaları 🇹🇷", EN "Season Tables 🇹🇷". Grup 2: countryCode TR değil; ayırıcı TR "Yeni Duraklar 📍",
    EN "Next Stops 📍". Grup içi sıralama City.sortOrder'a göre; sortOrder admin şehir formundaki "Sıra" alanından değiştirilir.
    Her ayırıcının hemen altında ortalı tek satır takvim (ikon yok; italik, şehir adından küçük, ayırıcı yazısıyla aynı renk; ay adları arayüz
    dilinde): Grup 1 TR "Takvim: 1 Haziran >< 15 Eylül", EN "Schedule: June 1 >< September 15"; tarih Grup 1 şehirlerinin sezon alanlarından:
    hepsinde aynıysa o, farklıysa en erken başlangıç ile en geç bitiş, hiçbirinde yoksa TR "Takvim: Yakında", EN "Schedule: Coming soon".
    Grup 2 her zaman TR "Takvim: Yakında", EN "Schedule: Coming soon". Sezon isteğe bağlı, admin şehir formundan girilir.
    Grup 1 ve Grup 2 şehirleri görseli varsa kare kart (aşağıda); görseli yoksa düz satır: Grup 1 yalnız şehir adı ve en sağda "Yakında"
    etiketi (satırda sezon metni yok), Grup 2 şehir adı, sağında bayrak (countryCode'dan emoji), en sağda "Yakında" etiketi.
    Ortak mantık packages/shared/src/citySeason.ts (cityExtras, soonCityGroups, groupSeason).
  - Şehir kartı görselleri (web + mobil, TR + EN): kayıt ve Profilim "Hangi şehirdeki masalara katılmak istersin?" şehir seçimi listesinde
    görseli olan şehirler kare kart, her satırda yan yana 2 kart (web grid 2 sütun aralık 8, CITY_GRID / cityGridItem; mobilde satır başına
    2 kart, kartlar arası yatay boşluk tam 8 pt, CityGrid / CityGridCell bileşenleri (SoonCityGroups.tsx) kullanılır, görselli şehirde
    kart genişliği ölçüme göre hesaplanır, görselsiz şehirler ve şehir dışı satırlar tam genişliktir): üstte kare görsel (1:1, kart genişliğini doldurur, köşe 8, kırpmalı / cover), altında şehir adı. Aktif şehirler
    (İstanbul, Ankara, İzmir, Antalya) seçilebilir, seçili kart görünümü aynen. Sezon Masaları (Çeşme, Bodrum, Fethiye, Marmaris, Kuşadası,
    Ayvalık) ve Yeni Duraklar (Dubai, Hong Kong, Singapur, Bangkok, Tokyo) aynı kare kart düzeninde, görsel soluk (opaklık 0.4), seçilemez;
    adın yanında (Yeni Duraklar'da bayrakla) kartın içinde "Yakında" etiketi; grup başlıkları ve takvim satırları aynen. Görseli olmayan
    şehir tam satır düz satır. Seçim mantığı, sıralama, filtreler, grup yapısı ve liste yüksekliği (300) aynen. Görseller
    apps/web/public/share-bg/<şehir>.webp (istanbul, ankara, izmir, antalya, cesme, bodrum, fethiye, marmaris, kusadasi, ayvalik, dubai,
    hongkong, singapur, bangkok, tokyo); mobil https://ahenk.co önekiyle. Eşleme packages/shared/src/citySeason.ts CITY_IMAGES / cityImage /
    SEASIDE_CITY_IMAGES; web components/SoonCityGroups.tsx (CITY_GRID, cityGridItem, CITY_SQUARE_IMG), mobil SoonCityGroups.tsx
    (CityGrid, CityGridCell, cityImageOption: Btn listOption içeriği)
  - Nasıl Çalışır son sayfası (8. adım, web + mobil Onboarding): dalga ikonlu şehir kutuları yok; 2 sütunda 6 görselli kart: Çeşme, Bodrum,
    Fethiye, Marmaris, Kuşadası, Ayvalık (onb.s8c1–s8c6). Kart: üstte görsel (16:10, cover), altında yalnız kalın şehir adı (tarih satırı
    yok; mobil erişilebilirlik etiketi yalnız şehir adı); alt metin onb.s8Body ve üstteki sezon etiketi aynen
  - Tarih / saat: buluşmanın yapıldığı bölgenin saat diliminde; her iki dilde sayısal gg.aa.yyyy ve 24 saat SS:dd; ay ve gün adları arayüz dilinde.
    İstisnalar: masa detay kartı tarih satırı TR "18 Kasım, Çarşamba 20:00", EN "Wednesday, 18 November 20:00" (shared formatCardDate);
    Masalarım tarih sekmesi TR "18 Kasım Çarşamba", EN "Wednesday, 18 November" (formatDayTab).
  - Bildirimler: push / IN_APP metinleri alıcının language alanına göre TR ya da EN; WhatsApp şablon dil kodu da language alanına göre
    (İngilizce şablonlar lansmanda Meta'da hazırlanacak).
  - Yasal sayfalar: İngilizce çevirileri /en altında, en üstte "This is a translation for convenience. In case of any conflict, the Turkish
    version prevails." Uygulamada ve webde seçili dil hangisiyse yasal bağlantılar (giriş ekranı yasal metni, kayıt onayları, Tekrar hoş geldin,
    Profilim yasal kartı, web footer ve diğerleri) o dildeki sayfayı açar.
  - Kişilik testi: OceanQuestion.textEn / sectionTitleEn; soru kimlikleri ve puanlama aynı; sonuç (profileEn), boyut ve Kişilik Ağacı metinleri çevrili.
  - Zamanlanmış işler (eşleştirme, kapanışlar, hak düşümleri, bildirim cron'ları) şimdilik TR saatinde (Europe/Istanbul) çalışır; bölge bazlı
    saat dilimine geçiş Dubai aktifleşmeden önce yapılacak.

ŞEHİR DURUM MODELİ (Aktif / Pasif / Yakında):
  - Aktif = isActive true. Yakında = isActive false + isComingSoon true. Pasif = ikisi de false (City.isComingSoon,
    migration 20261116210000_city_coming_soon; Dubai Marina, JLT, Downtown Dubai Yakında).
  - Pasif şehirler kayıt ve haftalık şehir seçiminde görünmez.
  - Yakında şehirler listenin sonunda iki grupta (bkz. Şehir listeleri), her birinin yanında "Yakında" etiketiyle görünür, seçilemez,
    eşleştirmeye ve taramaya girmez.
  - Şehir adı düzenlenebilir (admin İlçe Ekle penceresi: ad alanı + "Adı Kaydet", web + mobil), id değişmez; ilçe, mekân ve kullanıcı
    bağları korunur. Yeni şehir varsayılan Pasif; admin Şehirler ve Bölgeler sayfalarında (web + mobil) üç durum seçilir.

MASA DETAY VE ÖN İZLEME KARTI DÜZENİ (web packages/ui MasaDetayKarti + TabMasalar EmptyMasaCard; mobil MasaDetayKarti + masalarim EmptyMasaCard):
  - Masalarım'da (web + mobil) üstteki 3 masa türü ikonu (halkalar) yok: sekmeler yalnız ad + durum (LiveTabs noRings). En üstte ortalı
    türe göre başlık: "Grup Masa Kartı" / "Baş Başa Masa Kartı" / "Kankamla Masa Kartı" (tm.cardGroup / cardOne / cardKanka)
  - Farklı günlerde birden fazla aktif masa varsa en üstte tarih sekmeleri (formatDayTab); masa türü sekmeleri tarih sekmelerinin altında
  - Varsayılan sekme: masası kurulu, kilitli ya da oluşturuluyor olan tür (birden fazlaysa en yakın tarihli masa); yoksa taramadaki /
    bekleyen ilk tür. "Eşleşme Pasif" hiçbir zaman varsayılan değildir (web + mobil useMasaTabs)
  - Geçmiş Masalarım bölümü masa kartı ve Masa Sohbeti'nin altında (ortalı "Geçmiş Masalarım" butonu + liste)
  - Kapak: mekânın tek fotoğrafı; kapakta masa türü etiketi ve "Haritada Gör" yok; fotoğraf önizlemesinde (lightbox) "Alan 1" / açıklama
    yazısı yok. Mekân adı + yalnızca ilçe adı (Venue.district, venueDistrict), mesafe (km) yok.
  - Tarih satırı: "18 Kasım, Çarşamba 20:00" (EN "Wednesday, 18 November 20:00"), sağında "Haritada Gör". Kişi / kadın-erkek sayısı satırı yok
  - Katılımcılar: satırda en fazla 2 kişi; fotoğraf (yoksa baş harf, cinsiyet renkli çerçeve), altında "Ahmet Y.", altında meslek.
    Grup'ta her satır 1 erkek + 1 kadın; Kankamla'da üst satır kullanıcının kanka çifti, alt satır karşı çift; Baş Başa'da 1 erkek 1 kadın
    yan yana. Kullanıcının kendi avatarında ek kırmızı çerçeve yok. Taramada fotoğraf gösterilmez
  - Yapay Zeka Masa Raporu: mevcut rapor metni + uyumSkoru yeşil (#27ae60) halka "Genel Uyum", alt skor yok.
  - Alt kart: Acil Yardım (bkz. ACİL YARDIM), sohbet, gelmeyen işaretleme, "Değerlendir". "Masa Sohbeti" butonu yok. Geçmiş masada alt kart yok
  - "Rezervasyonun tamamlandı" kartı ve "Yola Çıktım" sistemden tamamen kaldırıldı: buton, POST /meetings/:id/on-my-way, dakikalık
    hatırlatma işi, ON_MY_WAY / ON_MY_WAY_OPEN bildirimleri, MeetingParticipant.onMyWayAt (migration 20261120100000) ve metinler
  - 08:00 kuralı: masa detay kartı buluşmadan sonraki gün 08:00'e kadar Masalarım'da aktif kalır (meetingCardEnd; gece masa kapanışında
    COMPLETED olsa da Geçmiş'e düşmez; GET /meetings/my-history yalnız 08:00'i geçenler). Acil Yardım da 08:00'e kadar görünür
  - Değerlendirme süresi (tüm masa türleri, Hafta Sonu / Planlı ve Yarın): buluşma günü 23:59'dan sonra (ertesi gün 00:00 TR) açılır,
    değerlendirme yapılmamışsa açılıştan 7 gün sonra Değerlendir butonu kaybolur (backend meeting-windows.ts reviewWindow; web + mobil
    shared reviewOpensAt / reviewClosesAt; değerlendirme bildirimi cron'u 00:00). Süre dolunca ya da değerlendirme yapılmışsa buton yok;
    yapılmışsa puan ve yorum gösterilir. Gelmeyen işaretleme kartta 08:00'e kadar. "Değerlendir" İçerde paket kartı rozetindeki altın
    geçişli hap (web GOLD_PILL, mobil GoldPill); açılıştan önce basılırsa "[tarih] 00:00'dan sonra değerlendirebilirsin" / "You can rate
    after [date] 00:00" (masa.reviewNotYet; tarih değerlendirmenin açıldığı gün)

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
