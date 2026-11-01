import { Request } from "express";

// Web oturum çerez adları (auth.controller, jwt.strategy ve CSRF middleware'i ortak kullanır)
export const REFRESH_COOKIE = "refresh_token";
export const ACCESS_COOKIE = "access_token";
export const SESSION_COOKIE = "ahenk_session";
// Mekân paneli oturumu: üye oturumundan bağımsız
export const VENUE_COOKIE = "venue_token";

// Web: yalnız HttpOnly çerez. Origin başlığı olmayan istemci (mobil uygulama): gövdedeki refreshToken.
export function refreshTokenFromRequest(req: Request): string | null {
  const fromCookie = req?.cookies?.[REFRESH_COOKIE];
  if (fromCookie) return fromCookie;
  const fromBody = req?.body?.refreshToken;
  return !req?.headers?.origin && typeof fromBody === "string" && fromBody ? fromBody : null;
}
