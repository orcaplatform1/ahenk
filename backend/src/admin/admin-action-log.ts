import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { Observable, tap } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";

// ADMIN işlem kaydı: veri değiştiren uç noktaya @AdminAction("KOD", açıklama) eklenir. İşlem başarıyla bitince
// Türkçe açıklama yazılır. Sadece ADMIN rolü kaydedilir; SUPERADMIN işlemleri hiç kaydedilmez.

export type AdminActionContext = {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  result: unknown;
  // "Ad Soyad" (kayıtta ad soyad zorunlu)
  userName: (userId?: string | null) => Promise<string>;
  // Masa adı (ör. "İstanbul Grup 44")
  meetingName: (meetingId?: string | null) => Promise<string>;
  db: PrismaService;
};

type Describe = (c: AdminActionContext) => Promise<{ text: string; targetUserId?: string | null } | string> | string;

export const ADMIN_ACTION_KEY = "adminAction";
export const AdminAction = (action: string, describe: Describe) => SetMetadata(ADMIN_ACTION_KEY, { action, describe });

const STATUS_TR: Record<string, string> = { ACTIVE: "aktif", SUSPENDED: "askıya alınmış", BANNED: "banlı", DELETED: "silinmiş" };
export const statusTr = (s: unknown) => STATUS_TR[String(s)] ?? String(s);
const PLAN_TR: Record<string, string> = { MASADA: "Masada", KARSIMDA: "Karşımda", ICERDE: "İçerde" };
export const planTr = (p: unknown) => PLAN_TR[String(p)] ?? String(p);
export const reasonTr = (r: unknown) => (r ? ` (Sebep: ${String(r)})` : "");

@Injectable()
export class AdminActionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminActionInterceptor.name);

  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<{ action: string; describe: Describe }>(ADMIN_ACTION_KEY, context.getHandler());
    const req = context.switchToHttp().getRequest();
    const actor = req.user as { id: string; role: UserRole } | undefined;
    if (!meta || actor?.role !== UserRole.ADMIN) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        void this.write(meta, actor.id, req, result);
      }),
    );
  }

  private async write(meta: { action: string; describe: Describe }, adminId: string, req: any, result: unknown) {
    try {
      const ctx: AdminActionContext = {
        params: req.params ?? {},
        body: req.body ?? {},
        query: req.query ?? {},
        result,
        db: this.prisma,
        userName: async (id) => {
          if (!id) return "Bilinmeyen kullanıcı";
          const u = await this.prisma.user.findUnique({ where: { id }, select: { profile: { select: { firstName: true, lastName: true } } } });
          return u?.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : "Bilinmeyen kullanıcı";
        },
        meetingName: async (id) => {
          if (!id) return "Bilinmeyen masa";
          const m = await this.prisma.meeting.findUnique({ where: { id }, select: { title: true } });
          return m?.title ?? "Bilinmeyen masa";
        },
      };
      const out = await meta.describe(ctx);
      const { text, targetUserId } = typeof out === "string" ? { text: out, targetUserId: null } : out;
      await this.prisma.adminActionLog.create({
        data: { adminId, action: meta.action, description: text, targetUserId: targetUserId ?? null },
      });
    } catch (err) {
      this.logger.error(`İşlem kaydı yazılamadı (${meta.action}): ${err}`);
    }
  }
}
