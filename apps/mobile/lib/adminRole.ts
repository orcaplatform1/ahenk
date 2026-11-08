// apps/web/lib/adminRole.ts karşılığı: oturumdaki admin kimliği (id + rol), admin yerleşimi /auth/me'den doldurur
let _identity: { id: string; role: string } | null = null;
export function setAdminIdentity(identity: { id: string; role: string } | null) { _identity = identity; }
export function myRole(): string | null { return _identity?.role ?? null; }
export function myId(): string | null { return _identity?.id ?? null; }
