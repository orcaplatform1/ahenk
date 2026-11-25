// Acil durum kişileri (en fazla 2): User.emergencyContactName/Phone (1. kişi) ve emergencyContact2Name/Phone (2. kişi).
// Profilim, Acil Yardım bildirimi ve admin (Acil Yardım talep detayı, Kullanıcılar detayı) bu biçimi kullanır.
export const EMERGENCY_SELECT = {
  emergencyContactName: true, emergencyContactPhone: true, emergencyContact2Name: true, emergencyContact2Phone: true,
} as const;

type EmergencyFields = {
  emergencyContactName: string | null; emergencyContactPhone: string | null;
  emergencyContact2Name: string | null; emergencyContact2Phone: string | null;
};

export function emergencyContactsOf(u: EmergencyFields | null | undefined): { slot: 1 | 2; name: string | null; phone: string }[] {
  if (!u) return [];
  const out: { slot: 1 | 2; name: string | null; phone: string }[] = [];
  if (u.emergencyContactPhone) out.push({ slot: 1, name: u.emergencyContactName, phone: u.emergencyContactPhone });
  if (u.emergencyContact2Phone) out.push({ slot: 2, name: u.emergencyContact2Name, phone: u.emergencyContact2Phone });
  return out;
}
