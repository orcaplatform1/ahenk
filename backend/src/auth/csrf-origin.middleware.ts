import { Request, Response, NextFunction } from "express";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth-cookies";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// iyzico'dan gelen ödeme dönüşü: kullanıcı oturumu kullanmaz, token iyzico'dan doğrulanır
const EXEMPT_PATHS = new Set([
  "/api/v1/payment/callback",
]);

// CSRF koruması: oturum çereziyle gelen ve veri değiştiren isteklerde kaynak (Origin, yoksa Referer)
// izinli site değilse 403. Bearer başlıklı istekler çerez kullanmadığı için kontrol dışıdır.
export function csrfOriginCheck(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!UNSAFE_METHODS.has(req.method)) return next();
    if (EXEMPT_PATHS.has(req.path)) return next();
    if (req.headers.authorization?.startsWith("Bearer ")) return next();
    const hasSessionCookie = !!(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
    if (!hasSessionCookie) return next();

    let source = req.headers.origin;
    if (!source && req.headers.referer) {
      try { source = new URL(req.headers.referer).origin; } catch { source = undefined; }
    }
    if (source && allowedOrigins.includes(source)) return next();

    res.status(403).json({ statusCode: 403, message: "Geçersiz istek kaynağı" });
  };
}
