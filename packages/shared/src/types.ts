// Kullanıcı rolleri
export type UserRole = "user" | "coach" | "admin" | "superadmin";

// OCEAN kişilik testi boyutları
export interface OceanScore {
  openness: number;        // Açıklık (0-100)
  conscientiousness: number; // Sorumluluk (0-100)
  extraversion: number;   // Dışadönüklük (0-100)
  agreeableness: number;  // Uyumluluk (0-100)
  neuroticism: number;    // Nevrotiklik (0-100)
}

// Buluşma türleri
export type MeetingType = "group" | "one_on_one";

// KYC durumu
export type KycStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPICIOUS";

