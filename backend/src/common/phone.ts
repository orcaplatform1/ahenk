// Rehber engeli için tek format: "+90XXXXXXXXXX" (son 10 hane)
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? `+90${digits.slice(-10)}` : raw.trim();
}
