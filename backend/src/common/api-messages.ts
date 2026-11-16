// Kullanıcıya dönen hata / bilgi mesajlarının dili. Kod Türkçe metinle yazılır; metinler packages/shared/src/i18n/tr.json ve
// en.json "errors.*" anahtarlarında. Dil sırası: 1) giriş yapmış kullanıcının language alanı, 2) Accept-Language (en ile başlıyorsa
// English), 3) Türkçe. Yalnız "message" metni değişir; yanıtın alan yapısı ve HTTP kodu aynı kalır. Admin ve mekân paneli uçları Türkçe.
import * as fs from "fs";
import * as path from "path";
import { ArgumentsHost, CallHandler, Catch, ExecutionContext, HttpException, Injectable, NestInterceptor } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Request } from "express";
import { map, Observable } from "rxjs";

type Lang = "tr" | "en";

// packages/shared/src/i18n — src (ts-node) ve dist/src (derlenmiş) konumlarından yukarı doğru aranır
function loadErrors(lang: Lang): Record<string, string> {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const p = path.join(dir, "packages", "shared", "src", "i18n", `${lang}.json`);
    if (fs.existsSync(p)) return (JSON.parse(fs.readFileSync(p, "utf8")).errors ?? {}) as Record<string, string>;
    dir = path.dirname(dir);
  }
  return {};
}

interface Entry { re: RegExp; vars: string[]; en: string }
const exact = new Map<string, string>();
const patterns: Entry[] = [];
(() => {
  const tr = loadErrors("tr");
  const en = loadErrors("en");
  for (const [key, trText] of Object.entries(tr)) {
    const enText = en[key];
    if (!enText) continue;
    const vars = [...trText.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (vars.length === 0) { exact.set(trText, enText); continue; }
    const src = trText.split(/\{\w+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)");
    patterns.push({ re: new RegExp(`^${src}$`), vars, en: enText });
  }
})();

function toEnglish(text: string): string {
  const hit = exact.get(text);
  if (hit) return hit;
  for (const p of patterns) {
    const m = p.re.exec(text);
    if (m) return p.vars.reduce((s, v, i) => s.replace(`{${v}}`, m[i + 1]), p.en);
  }
  return text;
}

// Admin ve mekân paneli uçları (…/admin/…, /venue-panel/…) Türkçe kalır
function isPanelPath(url: string): boolean {
  const p = url.split("?")[0];
  return /\/admin(\/|$)/.test(p) || /\/venue-panel(\/|$)/.test(p);
}

export function requestLang(req: Request): Lang {
  const user = req.user as { language?: string } | undefined;
  if (user?.language === "en" || user?.language === "tr") return user.language;
  const h = String(req.headers["accept-language"] ?? "").trim().toLowerCase();
  return h.startsWith("en") ? "en" : "tr";
}

function translateMessage(msg: unknown): unknown {
  if (typeof msg === "string") return toEnglish(msg);
  if (Array.isArray(msg)) return msg.map((m) => (typeof m === "string" ? toEnglish(m) : m));
  return msg;
}

@Catch()
export class ApiMessageExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== "http" || !(exception instanceof HttpException)) return super.catch(exception, host);
    const req = host.switchToHttp().getRequest<Request>();
    if (isPanelPath(req.originalUrl ?? req.url) || requestLang(req) !== "en") return super.catch(exception, host);
    const body = exception.getResponse();
    const status = exception.getStatus();
    // Nest varsayılanıyla aynı gövde: nesne olduğu gibi, metin { statusCode, message }
    const out = typeof body === "string"
      ? { statusCode: status, message: toEnglish(body) }
      : { ...(body as Record<string, unknown>), ...("message" in (body as object) ? { message: translateMessage((body as { message: unknown }).message) } : {}) };
    const res = host.switchToHttp().getResponse();
    res.status(status).json(out);
  }
}

// Başarılı yanıtlardaki bilgi mesajı ({ message: "…" })
@Injectable()
export class ApiMessageInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(map((data) => {
      if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as { message?: unknown }).message !== "string") return data;
      if (isPanelPath(req.originalUrl ?? req.url) || requestLang(req) !== "en") return data;
      return { ...(data as object), message: toEnglish((data as { message: string }).message) };
    }));
  }
}
