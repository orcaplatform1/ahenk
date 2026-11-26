// Veri saklama politikası: tek yapılandırma. Kategori, süre, sürenin başlangıcı, yasal dayanak ve içerdiği veri.
// Gizlilik Politikası, KVKK Aydınlatma Metni, Hesap Silme sayfası ve hesap silme uyarısındaki saklama süreleri bu tabloyla aynıdır.
// Otomatik silme işi (retention.service.ts, her gece 03:30 TR) yalnız "auto" kategorilerde çalışır; diğerleri mevcut kurala göre.
export type RetentionCategoryId =
  | "PAYMENT"
  | "DISTANCE_SALES_CONSENT"
  | "COMMERCIAL_MESSAGE_CONSENT"
  | "TRAFFIC_LOG"
  | "KVKK_CONSENT"
  | "INCIDENT_IDENTITY"
  | "BANNED_PHONE_HASH"
  | "KYC_DOCUMENTS"
  | "SOS_RECORD"
  | "COMPLAINT_MODERATION"
  | "CHAT_MESSAGES"
  | "PROBLEM_REPORTS"
  | "SUPPORT_CHATS"
  | "PROFILE_DATA"
  | "COOKIES"
  | "EXISTING_RULES";

type Tx = { tr: string; en: string };

export interface RetentionCategory {
  id: RetentionCategoryId;
  label: Tx;
  fields: Tx; // içerdiği veri alanları
  location: string; // DB tablosu / dosya konumu
  duration: Tx;
  start: Tx; // sürenin başlangıcı
  basis: Tx; // yasal dayanak
  years: number | null; // null: süresiz ya da mevcut kural
  auto: boolean; // otomatik silme işi bu kategoriyi işler
  action: Tx; // süre dolunca yapılan
}

export const RETENTION_POLICY: RetentionCategory[] = [
  {
    id: "PAYMENT",
    label: { tr: "Ödeme, fatura ve işlem kayıtları (iyzico, App Store, Google Play)", en: "Payment, invoice and transaction records (iyzico, App Store, Google Play)" },
    fields: { tr: "Paket, tutar, ödeme durumu, platform, ödeme / işlem numarası, ödeme tarihi, kullanıcı bağlantısı, abonelik kaydı", en: "Package, amount, payment status, platform, payment / transaction number, payment date, user link, subscription record" },
    location: "Payment, Subscription",
    duration: { tr: "10 yıl", en: "10 years" },
    start: { tr: "İşlemin yapıldığı yılı izleyen takvim yılı başı", en: "Start of the calendar year following the transaction" },
    basis: { tr: "TTK m.82, VUK m.253; hukuki sebep KVKK m.5/2-ç. Hesap silinse de saklanır", en: "Turkish Commercial Code art. 82, Tax Procedure Law art. 253; legal ground KVKK art. 5/2-ç. Kept even if the account is deleted" },
    years: 10,
    auto: true,
    action: { tr: "Kişisel alanlar anonimleştirilir; tutar, tarih ve işlem numarası korunur", en: "Personal fields are anonymized; amount, date and transaction number are kept" },
  },
  {
    id: "DISTANCE_SALES_CONSENT",
    label: { tr: "Mesafeli satış onay kayıtları", en: "Distance sales consent records" },
    fields: { tr: "Mesafeli satış sözleşmesi ve ön bilgilendirme onayı, belge versiyonu, tarih-saat, IP, platform, paket", en: "Distance sales contract and pre-information consent, document version, date-time, IP, platform, package" },
    location: "AgreementConsent (mesafeli_satis, on_bilgilendirme)",
    duration: { tr: "3 yıl", en: "3 years" },
    start: { tr: "İşlem tarihi", en: "Transaction date" },
    basis: { tr: "Mesafeli Sözleşmeler Yönetmeliği; hukuki sebep KVKK m.5/2-ç. Hesap silinse de saklanır", en: "Regulation on Distance Contracts; legal ground KVKK art. 5/2-ç. Kept even if the account is deleted" },
    years: 3,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "COMMERCIAL_MESSAGE_CONSENT",
    label: { tr: "Ticari ileti onay ve ret kayıtları", en: "Commercial message consent and opt-out records" },
    fields: { tr: "Onay türü (SMS), onay ya da ret, zaman damgası, IP, tarayıcı bilgisi", en: "Consent type (SMS), consent or opt-out, timestamp, IP, browser info" },
    location: "ConsentLog (MARKETING_SMS)",
    duration: { tr: "3 yıl", en: "3 years" },
    start: { tr: "Onayın sona erdiği tarih", en: "Date the consent ended" },
    basis: { tr: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik; hukuki sebep KVKK m.5/2-ç", en: "Regulation on Commercial Communication and Commercial Electronic Messages; legal ground KVKK art. 5/2-ç" },
    years: 3,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "TRAFFIC_LOG",
    label: { tr: "Giriş / IP kayıtları ve nginx logları", en: "Login / IP records and nginx logs" },
    fields: { tr: "Giriş denemeleri (kullanıcı, IP, tarayıcı bilgisi, platform, tarih-saat, başarılı / başarısız), oturum kayıtları, mekân paneli oturumları, sunucu erişim logları", en: "Login attempts (user, IP, browser info, platform, date-time, success / failure), session records, venue panel sessions, server access logs" },
    location: "LoginLog, RefreshToken, VenueSession; nginx erişim logları (logrotate, 730 gün)",
    duration: { tr: "2 yıl", en: "2 years" },
    start: { tr: "Kayıt tarihi", en: "Record date" },
    basis: { tr: "5651 sayılı Kanun; hukuki sebep KVKK m.5/2-ç. Hesap silinse de saklanır", en: "Law No. 5651; legal ground KVKK art. 5/2-ç. Kept even if the account is deleted" },
    years: 2,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "KVKK_CONSENT",
    label: { tr: "KVKK aydınlatma ve açık rıza onay kayıtları", en: "KVKK notice and explicit consent records" },
    fields: { tr: "Onay türü, onay, zaman damgası, IP, tarayıcı bilgisi", en: "Consent type, consent, timestamp, IP, browser info" },
    location: "ConsentLog (PRIVACY_POLICY), AgreementConsent (acik_riza_biyometrik)",
    duration: { tr: "10 yıl", en: "10 years" },
    start: { tr: "Hesabın silinmesi", en: "Account deletion" },
    basis: { tr: "TBK genel zamanaşımı", en: "General limitation period, Turkish Code of Obligations" },
    years: 10,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "INCIDENT_IDENTITY",
    label: { tr: "Acil Yardım, şikâyet veya ban kaydına karışmış kullanıcının kimliği", en: "Identity of a user involved in an emergency help, complaint or ban record" },
    fields: { tr: "Ad, soyad, e-posta, telefon (kilitli, yalnız SUPERADMIN görür)", en: "First name, last name, email, phone (locked, visible only to SUPERADMIN)" },
    location: "AccountDeletionRequest.retainedIdentity",
    duration: { tr: "2 yıl", en: "2 years" },
    start: { tr: "Olayın kapanışı", en: "Closure of the incident" },
    basis: { tr: "Kilitli tutulur, yalnız SUPERADMIN erişir; hukuki sebep KVKK m.5/2-e", en: "Kept locked, accessible only to SUPERADMIN; legal ground KVKK art. 5/2-e" },
    years: 2,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "BANNED_PHONE_HASH",
    label: { tr: "Banlı telefonun okunamaz özeti", en: "Unreadable summary (hash) of a banned phone number" },
    fields: { tr: "Telefon numarasının tek yönlü özeti (SHA-256)", en: "One-way summary (SHA-256) of the phone number" },
    location: "User.phoneHash",
    duration: { tr: "Ban süresince", en: "For as long as the ban lasts" },
    start: { tr: "Banlı hesabın silinmesi", en: "Deletion of the banned account" },
    basis: { tr: "Yeniden kayıt engeli; hukuki sebep KVKK m.5/2-f", en: "Preventing sign-up again; legal ground KVKK art. 5/2-f" },
    years: null,
    auto: false,
    action: { tr: "Ban sürdükçe silinmez", en: "Not deleted while the ban lasts" },
  },
  {
    id: "KYC_DOCUMENTS",
    label: { tr: "Kimlik belgeleri ve canlılık videosu", en: "ID documents and liveness video" },
    fields: { tr: "Kimlik belgesi ön / arka yüz görselleri, canlılık videosu, KYC kaydı", en: "ID document front / back images, liveness video, KYC record" },
    location: "KycSubmission + uploads/kyc",
    duration: { tr: "Hesap silme onayından sonra 48 saat içinde silinir", en: "Deleted within 48 hours after the account deletion is approved" },
    start: { tr: "Hesap silme onayı", en: "Approval of the account deletion" },
    basis: {
      tr: "İstisna: Acil Yardım, şikâyet veya ban kaydına karışmış kullanıcının kimliği kilitli tutulur, 2 yıl saklanır ve yalnız SUPERADMIN erişir; hukuki sebep KVKK m.5/2-e",
      en: "Exception: the identity of a user involved in an emergency help, complaint or ban record is kept locked for 2 years and only SUPERADMIN can access it; legal ground KVKK art. 5/2-e",
    },
    years: null,
    auto: false,
    action: { tr: "Hesap silme onayında silinir", en: "Deleted when the account deletion is approved" },
  },
  {
    id: "SOS_RECORD",
    label: { tr: "Acil Yardım kaydı", en: "Emergency help record" },
    fields: { tr: "Koordinatlar ve konum geçmişi (talep çözülünce silinir), son açık adres", en: "Coordinates and location history (deleted when the request is resolved), last street address" },
    location: "SosReport, SosLocationUpdate",
    duration: { tr: "Son açık adres 2 yıl", en: "Last street address 2 years" },
    start: { tr: "Talebin çözülmesi", en: "Resolution of the request" },
    basis: { tr: "Hukuki sebep KVKK m.5/2-b ve m.5/2-e", en: "Legal ground KVKK art. 5/2-b and art. 5/2-e" },
    years: 2,
    auto: true,
    action: { tr: "Son açık adres silinir", en: "Last street address is deleted" },
  },
  {
    id: "COMPLAINT_MODERATION",
    label: { tr: "Şikâyet ve moderasyon kayıtları, şikâyet edilen mesajlar", en: "Complaint and moderation records, reported messages" },
    fields: {
      tr: "Sohbet şikâyetleri ve otomatik engel kayıtları, şikâyet edilen mesajlar, admin kararları; ekran görüntüsü ihlal kayıtları (ekran görüntüsünü alan kullanıcı, fotoğrafı görüntülenen kullanıcı, platform, tarih-saat, admin kararı)",
      en: "Chat reports and automatic block records, reported messages, admin decisions; screenshot violation records (user who took the screenshot, user whose photo was viewed, platform, date and time, admin decision)",
    },
    location: "ChatReport, ChatMessage (şikâyet edilen), ScreenshotLog",
    duration: { tr: "2 yıl", en: "2 years" },
    start: { tr: "Kayıt tarihi", en: "Record date" },
    basis: { tr: "Hukuki sebep KVKK m.5/2-e", en: "Legal ground KVKK art. 5/2-e" },
    years: 2,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "CHAT_MESSAGES",
    label: { tr: "Şikâyet edilmemiş masa sohbeti mesajları", en: "Table chat messages that were not reported" },
    fields: { tr: "Masa sohbeti mesajları", en: "Table chat messages" },
    location: "ChatMessage",
    duration: { tr: "6 ay", en: "6 months" },
    start: { tr: "Masa tarihi", en: "Table date" },
    basis: { tr: "Hukuki sebep KVKK m.5/2-c", en: "Legal ground KVKK art. 5/2-c" },
    years: null,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "PROBLEM_REPORTS",
    label: { tr: "Sorun bildirimleri", en: "Problem reports" },
    fields: { tr: "Sorun bildirimi metni ve görselleri", en: "Problem report text and images" },
    location: "ProblemReport + uploads/problem-reports",
    duration: { tr: "2 yıl", en: "2 years" },
    start: { tr: "Kayıt tarihi", en: "Record date" },
    basis: { tr: "Hukuki sebep KVKK m.5/2-f", en: "Legal ground KVKK art. 5/2-f" },
    years: 2,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "SUPPORT_CHATS",
    label: { tr: "Canlı destek sohbetleri", en: "Live support chats" },
    fields: {
      tr: "Destek sohbeti mesajları ve görselleri, konu, temsilci numarası, iç notlar, devir notları, değerlendirmeler, Haiku asistanı sorgu kayıtları",
      en: "Support chat messages and images, topic, representative number, internal notes, transfer notes, ratings, Haiku assistant query logs",
    },
    location: "SupportChat, SupportMessage, SupportNote, SupportTransfer, SupportRating, SupportAiLog + uploads/support",
    duration: { tr: "2 yıl", en: "2 years" },
    start: { tr: "Sohbet tarihi", en: "Chat date" },
    basis: { tr: "Hukuki sebep KVKK m.5/2-c ve m.5/2-f. Hesap silinince sohbetin hesapla bağı koparılır, ad soyad anonimleştirilir", en: "Legal ground KVKK art. 5/2-c and art. 5/2-f. When the account is deleted, the chat is unlinked from the account and the name is anonymized" },
    years: 2,
    auto: true,
    action: { tr: "Sohbet, mesajlar, görseller, notlar, değerlendirme ve sorgu kayıtları silinir", en: "Chat, messages, images, notes, rating and query logs are deleted" },
  },
  {
    id: "PROFILE_DATA",
    label: { tr: "Profil, kişilik testi (OCEAN) ve push token", en: "Profile, personality test (OCEAN) and push token" },
    fields: { tr: "Profil bilgileri ve profil fotoğrafı, OCEAN cevapları ve skorları, FCM push token", en: "Profile details and profile photo, OCEAN answers and scores, FCM push token" },
    location: "Profile, ProfilePhoto + uploads/profile-photos, OceanScore, OceanAnswer, User.fcmToken",
    duration: { tr: "Hesap silinene kadar", en: "Until the account is deleted" },
    start: { tr: "Hesap silme onayı", en: "Approval of the account deletion" },
    basis: { tr: "Hukuki sebep KVKK m.5/2-c", en: "Legal ground KVKK art. 5/2-c" },
    years: null,
    auto: false,
    action: { tr: "Hesap silme onayında silinir", en: "Deleted when the account deletion is approved" },
  },
  {
    id: "COOKIES",
    label: { tr: "Çerezler", en: "Cookies" },
    fields: { tr: "Oturum çerezleri (refresh_token, ahenk_session)", en: "Session cookies (refresh_token, ahenk_session)" },
    location: "Tarayıcı",
    duration: { tr: "365 gün", en: "365 days" },
    start: { tr: "Girişin yapıldığı an", en: "Time of login" },
    basis: { tr: "Çerez Politikası", en: "Cookie Policy" },
    years: null,
    auto: false,
    action: { tr: "Süre dolunca tarayıcıdan silinir", en: "Removed from the browser when it expires" },
  },
  {
    id: "EXISTING_RULES",
    label: { tr: "Diğer tüm veriler", en: "All other data" },
    fields: {
      tr: "Rehber engelleri, kullanıcı engelleri, bildirimler ve diğer hesap verileri",
      en: "Contact blocks, user blocks, notifications and other account data",
    },
    location: "ContactBlock, UserBlock, Notification ve diğer tablolar",
    duration: { tr: "Mevcut kural", en: "Existing rule" },
    start: { tr: "Mevcut kural", en: "Existing rule" },
    basis: {
      tr: "Mevcut kural: hesap silme talebi onaylanınca silinir; rehber engelleri kullanıcı silince de silinir",
      en: "Existing rule: deleted when the account deletion request is approved; contact blocks are also deleted when the user removes them",
    },
    years: null,
    auto: false,
    action: { tr: "Mevcut kural", en: "Existing rule" },
  },
];

export const RETENTION_JOB_CRON = "30 3 * * *"; // her gece 03:30
export const RETENTION_JOB_TZ = "Europe/Istanbul";
