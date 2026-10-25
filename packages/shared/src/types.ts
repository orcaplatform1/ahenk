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

// OCEAN test sonucu
export interface OceanResult {
  completed: boolean;
  completedAt?: string;
  scores?: OceanScore;
  profile?: string;       // Kısa kişilik açıklaması
  retakeAvailableAt?: string;
}

// KYC durumu
export type KycStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPICIOUS";

// Kullanıcı özeti (API'den dönen, passwordHash içermeyen)
export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  isKycVerified: boolean;  // true → profilde "Doğrulanmış ✓" rozeti
  profile?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    city?: string | null;
  } | null;
}

// API yanıt sarmalayıcısı
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Sayfalama
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
