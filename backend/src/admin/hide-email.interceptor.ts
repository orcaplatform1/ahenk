import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { Observable, map } from "rxjs";

// Düz nesne ve dizilerde "email" alanlarını derinlemesine siler (Date, dosya akışı vb. dokunulmaz)
function stripEmails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmails);
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "email") continue;
      out[k] = stripEmails(v);
    }
    return out;
  }
  return value;
}

// Kullanıcı hesabı olmayan iletişim e-postaları (başvurular) için gizlemeyi kapatır
const KEEP_EMAILS = "keepEmails";
export const KeepEmails = () => SetMetadata(KEEP_EMAILS, true);

// Kullanıcı e-postaları yalnızca SUPERADMIN'e gösterilir (ADMIN telefonu görür)
@Injectable()
export class HideEmailForAdminInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const role = (context.switchToHttp().getRequest().user as { role?: UserRole } | undefined)?.role;
    if (role === UserRole.SUPERADMIN) return next.handle();
    if (this.reflector.get<boolean>(KEEP_EMAILS, context.getHandler())) return next.handle();
    return next.handle().pipe(map(stripEmails));
  }
}
