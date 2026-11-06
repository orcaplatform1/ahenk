# AHENK — Tasarım Sistemi & UI/UX Kuralları

Bu dosya Ahenk projesinin tüm frontend tasarım kurallarını içerir.
Her UI çalışmasından önce bu dosya okunmalıdır.

---

## 1. Renk Paleti

| Token | Değer |
|---|---|
| Arka plan | `#0a0a0a` (korunacak, değiştirilmeyecek) |
| Kırmızı / Bakır gradient | `linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)` |
| Aktif buton / kenarlık vurgusu | kırmızı/bakır gradient |
| Body metin | `#f5f5f5` |
| İkincil metin | `#888` |
| Kart arka planı | `rgba(255,255,255,0.05)` |
| Kart kenarlığı | `rgba(255,255,255,0.08)` |

---

## 2. Tipografi

- **Başlıklar:** DM Serif Display (serif)
- **Body / UI:** Inter (sans-serif)
- Web ve mobil uygulama aynı font ailesini kullanır.

---

## 3. Glassmorphism Kartlar

Tüm kart bileşenlerinde aşağıdaki stil uygulanır:

```css
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.08);
backdrop-filter: blur(20px);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.08),
  0 4px 24px rgba(0, 0, 0, 0.4);
border-radius: 16px; /* rounded-2xl */
```

---

## 4. Butonlar

- **Primary:** kırmızı/bakır gradient arka plan, beyaz metin, `border-radius: 9999px`
- **Hover:** hafif parlaklık artışı (`brightness(1.1)`)
- **Outline:** `border: 1px solid rgba(255,255,255,0.15)`, şeffaf arka plan

---

## 5. Animasyonlar & Efektler

### Splash Screen (sadece mobil)
- Logo karanlıktan fade-in + glow efektiyle açılır
- Lottie animasyonu — sadece splash ve eşleşme bekleme ekranında kullanılır (bundle size koruması)

### OCEAN Testi — Sliding Kart UI
- Her soru ayrı animasyonlu kart (`AnimatePresence`, `x: ±50`, blur geçişi)
- Framer Motion kullanılır
- Progress bar: gradient kırmızı/bakır
- Test bitişinde 180 gün kilit animasyonu: halkalar asma kilit formuna dönüşür

### Ana Ekran (Dashboard) — Döngüye Göre Dinamik
- **Pazartesi–Perşembe:** logo halkalar yavaşça döner + geri sayım sayacı + "Haftalık masanı ayırt" butonu
- **Perşembe 23:59 – Cuma:** buton kalkar, halkalar yoğunlaşır, "Algoritma senin için en uyumlu ahengi arıyor..." metni
- **Cumartesi 10:00:** tam ekran animasyonla Masa Kartı açılır — mekan fotoğrafı karartılmış arka plan, katılımcı OCEAN profil özeti (isim yok, fotoğraf yok), "Rotayı Al" butonu

### Framer Motion Stagger (Kart Listeleri)
- Kartlar sırayla açılır (`staggerChildren` animasyonu)

### 3D Mouse Tilt (AhenkHistory)
- `perspective rotateX/rotateY` — hover'da kart hafifçe eğilir

---

## 6. Glassmorphism Kullanım Kuralı

- `backdrop-blur-xl` web'de sorun yok
- React Native'de (`expo-blur`) sadece kritik ekranlarda kullan — Android mid-range cihazlarda FPS düşürür

---

## 7. Admin Paneli

Admin panele de aynı glassmorphism + neon kırmızı/bakır dil uygulanır.
Admin ekranları sıradan kullanıcı ekranlarından görsel dil olarak ayrışmaz — aynı sistem.

---

## 8. Web Bileşen Listesi & Uygulama Önceliği

### OceanTest.tsx — Öncelik: 1
- Her soru ayrı animasyonlu kart
- 5'li Likert scale — glowing circle butonlar (kırmızı shadow-glow hover)
- Progress bar: gradient kırmızı/bakır
- 180 gün kilit uyarısı: küçük font + mono tracking

### MasalarDashboard — Öncelik: 2
- Framer Motion stagger — kartlar sırayla açılır
- Sol kolon: mekan fotoğrafı (Meeting.venuePhotoUrl — fallback gradient kullan)
- Sağ kolon: 3 katılımcı kartı, her birinde mini OCEAN radar

### OceanRadar.tsx (SVG tabanlı) — Öncelik: 3
- Beş boyutlu radar chart, neon kırmızı/bakır gradient
- Hover tooltip: trait adı + açıklama
- Backend: `GET /test/my-score` mevcut; diğer kullanıcılar için filtrelenmiş endpoint gerekir (sadece dominant trait)

### AdminQualityControl.tsx — Öncelik: 4
- Sol kolon: şikayet listesi (CRITICAL animate-pulse kırmızı, MEDIUM amber badge)
- Sağ kolon: şikayet detay paneli — gizli üye yorumları + AI özeti + yaptırım butonları
- Aksiyon: "UYAR & KARANTİNAYA AL" (30 gün) / "ÜYELİĞİ İPTAL ET (BAN)"
- BAN → iyzico abonelik iptali de tetiklenmeli

### AdminMatchManager.tsx — Öncelik: 5
- Sol kolon: algoritmik masa listesi, her masada 4 koltuk (REAL / BOT / EMPTY)
- Sağ kolon: müsait bot havuzu, sticky panel
- "BOT YERLEŞTİR" butonu → en uygun botu atar
- Uyum skoru ≥80 → yeşil badge, <80 → amber badge
- EMPTY koltuk → dashed amber border + animate-pulse
- "TÜM MASALARI ONAYLA" butonu → bildirim tetikler

### AdminStatsDashboard.tsx — Öncelik: 6
- 4 metrik kartı: Brut ciro / Net komisyon / Aktif üye + KYC bekleyen / Algoritma başarı oranı
- Şehir bazlı tablo: masa sayısı, eşleşen üye, haftalık ciro, büyüme trendi
- Paket dağılım barları: Masada %20 / Karşımda %25 / İçerde %55
- Döngü durumu header'da (animate-pulse)

### AhenkHistory.tsx — Öncelik: 7
- Dikey zaman tüneli, her buluşma bir "Koleksiyon Kartı"
- Her kart: sol = loş mekan fotoğrafı + konu etiketi, orta = masanın ortak OCEAN radar ortalaması, sağ = uyum skoru + dönen halka rozet + ID
- 3D mouse tilt efekti (hover'da kart hafifçe eğilir)
- Zaman tüneli noktası: kırmızı parlayan halka + amber animate-pulse nokta
- Backend: `GET /meetings/my-history` — mevcut

---

## 9. Route Listesi

| Route | Bileşen |
|---|---|
| `/test` | OceanTest.tsx |
| `/dashboard` | MasalarDashboard.tsx |
| `/profil/gecmis` | AhenkHistory.tsx |
| `/admin/matches` | AdminMatchManager.tsx |
| `/admin/quality` | AdminQualityControl.tsx |
| `/admin/stats` | AdminStatsDashboard.tsx |

---

## 10. SEO (Launch Öncesi)

- Her sayfa için: `title`, `description`, `og:image`, `og:title`
- `robots.txt` ve `sitemap.xml`
- Canonical URL'ler
- Structured data (Organization schema)

---

## 11. Güvenlik (Launch Öncesi)

- HTTP security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Rate limiting — NestJS throttler aktif mi kontrol
- CORS origin whitelist (wildcard mı kontrol)
- JWT secret güçlü mü, `.env`'de mi kontrol
- Admin route'larına ekstra koruma (IP whitelist veya ayrı auth)

---

## 12. Paket Seçim Ekranı (Mobil)

- İçerde paketi ortada, daha büyük, arkasında kırmızı glow efekti
- Paket isimleri altın/bakır renk, premium algı
- Minimalist halka ikonları özellik listesinde

---

## 13. Buluşma Sonrası (Mobil)

- Pazar: "Dün akşamki ahenk nasıldı?" değerlendirme ekranı
- UserBlock: "Bu kişilerle kimyam uyuşmadı" seçeneğiyle nazikçe sunulacak
- Rehber engelleme ekranı: "Rehberin şifrelenerek korunur" güven mesajı + kırmızı dairesel çizgilerle liste

---

## 14. Backend Eksikleri (UI Yazılırken Dikkat)

| Eksik | Notlar |
|---|---|
| `GET /meetings/my-history` | AhenkHistory için gerekli |
| `Meeting.venuePhotoUrl` DB field | Mekan fotoğrafı — şimdilik fallback gradient |
| `GET /admin/stats/overview` ve `/cities` | AdminStatsDashboard |
| `GET /admin/reports/pending` | AdminQualityControl |
| `POST /admin/users/:id/quarantine` | Yaptırım + iyzico iptal bağlantısı |
| `POST /admin/users/:id/ban` | Yaptırım + iyzico iptal bağlantısı |
| Filtrelenmiş OCEAN endpoint | Diğer kullanıcılar için sadece dominant trait |
