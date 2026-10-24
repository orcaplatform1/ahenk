// Masa saatine bağlı zaman pencereleri (TR saati, UTC+3)

// Acil yardım süresi: masa saatinden ertesi gün 10:00'a kadar. Masa kartı da bu ana kadar ekranda kalır.
export function sosWindowEnd(scheduledAt: Date): Date {
  const tr = new Date(scheduledAt.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + 1, 10 - 3, 0, 0, 0));
}

// Masa kartında "gelmeyeni işaretle": masa saatinden 2 saat sonra (22:00) açılır, değerlendirme açılınca
// (ertesi gün 10:00) karttan kalkar; sonrasında işaretleme değerlendirme formunda yapılır.
export function noShowCardWindow(scheduledAt: Date): { opensAt: Date; closesAt: Date } {
  return { opensAt: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000), closesAt: sosWindowEnd(scheduledAt) };
}
