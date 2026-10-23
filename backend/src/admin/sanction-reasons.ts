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

// Askı süresi: 1 ay
export function suspensionEndDate(from = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}
