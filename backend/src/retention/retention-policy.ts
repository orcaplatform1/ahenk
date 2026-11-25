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
    basis: { tr: "TTK m.82, VUK m.253. Hesap silinse de saklanır", en: "Turkish Commercial Code art. 82, Tax Procedure Law art. 253. Kept even if the account is deleted" },
    years: 10,
    auto: true,
    action: { tr: "Kişisel alanlar anonimleştirilir; tutar, tarih ve işlem numarası korunur", en: "Personal fields are anonymized; amount, date and transaction number are kept" },
  },
  {
    id: "DISTANCE_SALES_CONSENT",
    label: { tr: "Mesafeli satış ve abonelik onay kayıtları", en: "Distance sales and subscription consent records" },
    fields: { tr: "Sözleşme kabulü, ön bilgilendirme onayı, zaman damgası, IP", en: "Contract acceptance, pre-information consent, timestamp, IP" },
    location: "Kodda kayıt tablosu yok",
    duration: { tr: "3 yıl", en: "3 years" },
    start: { tr: "İşlem tarihi", en: "Transaction date" },
    basis: { tr: "Mesafeli Sözleşmeler Yönetmeliği", en: "Regulation on Distance Contracts" },
    years: 3,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "COMMERCIAL_MESSAGE_CONSENT",
    label: { tr: "Ticari ileti onay ve ret kayıtları", en: "Commercial message consent and opt-out records" },
    fields: { tr: "Onay türü (SMS / e-posta), onay ya da ret, zaman damgası, IP, tarayıcı bilgisi", en: "Consent type (SMS / email), consent or opt-out, timestamp, IP, browser info" },
    location: "ConsentLog (MARKETING_SMS, MARKETING_EMAIL)",
    duration: { tr: "3 yıl", en: "3 years" },
    start: { tr: "Onayın sona erdiği tarih", en: "Date the consent ended" },
    basis: { tr: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik", en: "Regulation on Commercial Communication and Commercial Electronic Messages" },
    years: 3,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "TRAFFIC_LOG",
    label: { tr: "Giriş, IP ve trafik kayıtları", en: "Login, IP and traffic records" },
    fields: { tr: "Oturum (giriş) kayıtları ve tarihleri, mekân paneli oturumları", en: "Session (login) records and dates, venue panel sessions" },
    location: "RefreshToken, VenueSession",
    duration: { tr: "2 yıl", en: "2 years" },
    start: { tr: "Kayıt tarihi", en: "Record date" },
    basis: { tr: "5651 sayılı Kanun m.5", en: "Law No. 5651 art. 5" },
    years: 2,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "KVKK_CONSENT",
    label: { tr: "KVKK aydınlatma ve açık rıza onay kayıtları", en: "KVKK notice and explicit consent records" },
    fields: { tr: "Onay türü, onay, zaman damgası, IP, tarayıcı bilgisi", en: "Consent type, consent, timestamp, IP, browser info" },
    location: "ConsentLog (PRIVACY_POLICY)",
    duration: { tr: "10 yıl", en: "10 years" },
    start: { tr: "Hesabın silinmesi", en: "Account deletion" },
    basis: { tr: "TBK genel zamanaşımı", en: "General limitation period, Turkish Code of Obligations" },
    years: 10,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "INCIDENT_IDENTITY",
    label: { tr: "Acil Yardım, şikâyet veya ban ile ilişkili kimlik bilgileri", en: "Identity details related to emergency help, complaints or bans" },
    fields: { tr: "Ad, soyad, e-posta, telefon (kilitli, yalnız SUPERADMIN görür)", en: "First name, last name, email, phone (locked, visible only to SUPERADMIN)" },
    location: "AccountDeletionRequest.retainedIdentity",
    duration: { tr: "2 yıl", en: "2 years" },
    start: { tr: "Olayın kapanışı", en: "Closure of the incident" },
    basis: { tr: "Yasal sabit süre yok, şirket politikası", en: "No fixed legal period, company policy" },
    years: 2,
    auto: true,
    action: { tr: "Silinir", en: "Deleted" },
  },
  {
    id: "BANNED_PHONE_HASH",
    label: { tr: "Banlı telefonun okunamaz özeti", en: "Unreadable summary (hash) of a banned phone number" },
    fields: { tr: "Telefon numarasının tek yönlü özeti (SHA-256)", en: "One-way summary (SHA-256) of the phone number" },
    location: "User.phoneHash",
    duration: { tr: "Süresiz", en: "Indefinitely" },
    start: { tr: "Banlı hesabın silinmesi", en: "Deletion of the banned account" },
    basis: { tr: "Yeniden kayıt engeli", en: "Preventing sign-up again" },
    years: null,
    auto: false,
    action: { tr: "Silinmez", en: "Not deleted" },
  },
  {
    id: "EXISTING_RULES",
    label: { tr: "Diğer tüm veriler", en: "All other data" },
    fields: {
      tr: "Profil, OCEAN, KYC görsel / video, rehber engelleri, sohbetler, profil fotoğrafları, sorun bildirimleri, SOS koordinat / geçmiş",
      en: "Profile, OCEAN, KYC images / video, contact blocks, chats, profile photos, problem reports, SOS coordinates / history",
    },
    location: "Profile, OceanScore, OceanAnswer, KycSubmission + uploads/kyc, ContactBlock, UserBlock, ChatMessage, ProfilePhoto + uploads/profile-photos, ProblemReport + uploads/problem-reports, SosLocationUpdate",
    duration: { tr: "Mevcut kural", en: "Existing rule" },
    start: { tr: "Mevcut kural", en: "Existing rule" },
    basis: {
      tr: "Mevcut kural: hesap silme talebi onaylanınca silinir; SOS koordinatları ve konum geçmişi talep çözülünce silinir; rehber engelleri kullanıcı silince de silinir",
      en: "Existing rule: deleted when the account deletion request is approved; SOS coordinates and location history are deleted when the request is resolved; contact blocks are also deleted when the user removes them",
    },
    years: null,
    auto: false,
    action: { tr: "Mevcut kural", en: "Existing rule" },
  },
];

export const RETENTION_JOB_CRON = "30 3 * * *"; // her gece 03:30
export const RETENTION_JOB_TZ = "Europe/Istanbul";
