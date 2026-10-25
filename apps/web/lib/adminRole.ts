// Oturumdaki admin kimliği (id + rol). Token JS'ten okunamadığı için /auth/me'den gelir;
// admin layout'u sayfaları göstermeden önce loadAdminIdentity() ile doldurur.
let _identity: { id: string; role: string } | null = null;

export function setAdminIdentity(identity: { id: string; role: string } | null) {
  _identity = identity;
}

export function myRole(): string | null {
  return _identity?.role ?? null;
}

export function myId(): string | null {
  return _identity?.id ?? null;
}
