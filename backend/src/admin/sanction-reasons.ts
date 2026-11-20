// Admin'in askı / ban uygularken seçebileceği hazır sebepler
export const SANCTION_REASONS = [
  "Masaya katılım sağlamama",
  "Topluluk kurallarını ihlal",
  "Taciz veya uygunsuz davranış",
  "Sahte veya yanıltıcı profil bilgisi",
  "Kullanıcı şikayetleri sonucu",
  "Ödeme veya iade kötüye kullanımı",
  "Yönetici kararı",
] as const;

export const DEFAULT_SANCTION_REASON = "Yönetici kararı";

// Gelmedi uyarısı sınırı: daha önce gelmedi uyarısı olan kullanıcıya yeni uyarı verilmez; yalnız askı (3 gün / 15 gün / 1 ay)
export const NO_SHOW_WARNING_LIMIT = 1;

// Askı süresi: 1 ay
export function suspensionEndDate(from = new Date()): Date {
  // Ay eklemesi Türkiye takviminde yapılır (Europe/Istanbul, UTC+3, yaz saati yok)
  const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const d = new Date(from.getTime() + TR_OFFSET_MS);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return new Date(d.getTime() - TR_OFFSET_MS);
}
