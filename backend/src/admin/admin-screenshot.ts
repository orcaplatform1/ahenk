// Büyütülmüş profil fotoğrafı ekran görüntüsü ihlalleri (ScreenshotLog). iOS uygulaması büyütülmüş görünüm açıkken alınan ekran
// görüntüsünü POST /users/me/screenshot-log ile bildirir; her kayıtta admin Uyarılar'a SCREENSHOT_VIOLATION kaydı + ADMIN / SUPERADMIN
// hesaplarına bildirim gider. Admin "Ekran Görüntüsü İhlalleri" ekranında önerilen işlem: 1. ihlal işlem yok (kullanıcıya uyarı
// gösterildi), 2. ihlal 3 gün, 3. ihlal 15 gün, 4. ve sonrası 30 gün askı; admin 3 / 15 / 30 günden birini ya da "İşlem yapma"yı seçebilir.
import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, Logger, NotFoundException, Param, Post, Query, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { AdminAlertType, UserRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { approvedPhotoMap, PROFILE_PHOTO_PREFIX } from "../profile-photo/profile-photo.util";
import { baseDisplayName } from "../meetings/table-initials";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { HideEmailForAdminInterceptor } from "./hide-email.interceptor";
import { AdminAction } from "./admin-action-log";
import { AdminService } from "./admin.service";
import { SUSPEND_DAYS, SuspendDays, isSuspendDays } from "../common/suspension";

const VIOLATION_LABEL = { tr: "Ekran görüntüsü ihlali", en: "Screenshot violation" };

// Kaçıncı ihlal → önerilen askı süresi (1. ihlal: işlem yok)
export function suggestedDays(nth: number): SuspendDays | null {
  if (nth <= 1) return null;
  if (nth === 2) return 3;
  if (nth === 3) return 15;
  return 30;
}

// 1st, 2nd, 3rd, 4th … (İngilizce bildirim metni)
function ordinalEn(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export class ScreenshotLogDto {
  @IsString() @MaxLength(500)
  photoUrl!: string;

  @IsIn(["ios", "android", "web"])
  platform!: string;
}

export class ScreenshotDecisionDto {
  @IsIn(["NONE", "SUSPEND"])
  action!: "NONE" | "SUSPEND";

  @IsOptional()
  @IsIn(SUSPEND_DAYS as unknown as number[])
  days?: number;
}

@Injectable()
export class ScreenshotLogService {
  private readonly logger = new Logger("ScreenshotLog");
  constructor(private prisma: PrismaService, private notifications: NotificationService, private admin: AdminService) {}

  // Fotoğraf adresinden sahibi: /api/v1/media/profile-photos/<userId>/<dosya>
  private ownerFromUrl(photoUrl: string): string | null {
    const i = photoUrl.indexOf(`${PROFILE_PHOTO_PREFIX}/`);
    if (i < 0) return null;
    const id = photoUrl.slice(i + PROFILE_PHOTO_PREFIX.length + 1).split("/")[0];
    return id || null;
  }

  async record(userId: string, dto: ScreenshotLogDto) {
    const targetUserId = this.ownerFromUrl(dto.photoUrl);
    if (!targetUserId) throw new BadRequestException("Geçersiz fotoğraf");
    // Kendi fotoğrafı: kayıt ve admin bildirimi oluşmaz
    if (targetUserId === userId) return { ok: true };
    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true } } } }),
      this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, profile: { select: { firstName: true, lastName: true } } } }),
    ]);
    if (!actor || !target) throw new NotFoundException("Kullanıcı bulunamadı");
    await this.prisma.screenshotLog.create({ data: { userId, targetUserId, platform: dto.platform } });
    const n = await this.prisma.screenshotLog.count({ where: { userId } });
    const phone = actor.phone ?? "—";
    const message = `Ekran görüntüsü ihlali: ${baseDisplayName(actor.profile)} (${phone}), ${baseDisplayName(target.profile)} adlı kullanıcının profil fotoğrafının ekran görüntüsünü aldı. Bu, kullanıcının ${n}. ekran görüntüsü.`;
    const messageEn = `Screenshot violation: ${baseDisplayName(actor.profile)} (${phone}) took a screenshot of ${baseDisplayName(target.profile)}'s profile photo. This is the user's ${ordinalEn(n)} screenshot.`;
    try {
      await this.prisma.adminAlert.create({ data: { userId, alertType: AdminAlertType.SCREENSHOT_VIOLATION, message } });
      const admins = await this.prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] }, isBot: false }, select: { id: true } });
      for (const a of admins) {
        await this.notifications.sendToUser(a.id, { title: "Ekran görüntüsü ihlali", body: message, data: { type: "SCREENSHOT_VIOLATION" }, en: { title: "Screenshot violation", body: messageEn } }).catch(() => undefined);
      }
    } catch (e) {
      this.logger.error(`Admin bildirimi gönderilemedi: ${(e as Error).message}`);
    }
    return { ok: true };
  }

  // Liste (userId verilirse yalnız o kullanıcının ihlalleri). nth: kullanıcının kaçıncı ekran görüntüsü
  async list(userId?: string) {
    const rows = await this.prisma.screenshotLog.findMany({ where: userId ? { userId } : {}, orderBy: { createdAt: "desc" }, take: 500 });
    const userIds = [...new Set(rows.flatMap((r) => [r.userId, r.targetUserId, r.adminId ?? ""]).filter(Boolean))];
    const [users, photos, all] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true } } } }),
      approvedPhotoMap(this.prisma, userIds),
      this.prisma.screenshotLog.findMany({ where: { userId: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, userId: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const nth = new Map<string, number>();
    const counter = new Map<string, number>();
    for (const r of all) { const c = (counter.get(r.userId) ?? 0) + 1; counter.set(r.userId, c); nth.set(r.id, c); }
    const person = (id: string) => {
      const u = byId.get(id);
      return { id, name: `${u?.profile?.firstName ?? ""} ${u?.profile?.lastName ?? ""}`.trim() || "—", phone: u?.phone ?? null, photoUrl: photos.get(id) ?? null };
    };
    const items = rows.map((r) => {
      const n = nth.get(r.id) ?? 1;
      return {
        id: r.id, platform: r.platform, createdAt: r.createdAt, nth: n, suggestedDays: suggestedDays(n),
        user: person(r.userId), target: person(r.targetUserId),
        adminAction: r.adminAction, adminActionAt: r.adminActionAt, admin: r.adminId ? person(r.adminId) : null,
      };
    });
    return { count: userId ? (counter.get(userId) ?? 0) : rows.length, items };
  }

  // Karar: İşlem yapma ya da 3 / 15 / 30 gün askı (mevcut askı sistemi + askı bildirim şablonu, sebep "Ekran görüntüsü ihlali")
  async decide(id: string, adminId: string, action: "NONE" | "SUSPEND", days?: number) {
    const r = await this.prisma.screenshotLog.findUnique({ where: { id }, select: { id: true, userId: true, adminAction: true } });
    if (!r) throw new NotFoundException("Kayıt bulunamadı");
    if (r.adminAction) throw new BadRequestException("Bu kayıt için işlem yapıldı");
    if (action === "SUSPEND") {
      if (!isSuspendDays(days)) throw new BadRequestException("Askı süresi seçilmeli (3 gün / 15 gün / 1 ay)");
      await this.admin.suspend(r.userId, adminId, days, VIOLATION_LABEL.tr, VIOLATION_LABEL);
    }
    await this.prisma.screenshotLog.update({
      where: { id },
      data: { adminAction: action === "SUSPEND" ? `SUSPEND_${days}` : "NONE", adminActionAt: new Date(), adminId },
    });
    return { ok: true };
  }
}

@Controller("users/me")
@UseGuards(JwtAuthGuard)
export class ScreenshotLogController {
  constructor(private service: ScreenshotLogService) {}

  @Post("screenshot-log")
  @HttpCode(HttpStatus.OK)
  record(@CurrentUser("id") userId: string, @Body() dto: ScreenshotLogDto) {
    return this.service.record(userId, dto);
  }
}

@SkipThrottle()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@UseInterceptors(HideEmailForAdminInterceptor)
export class AdminScreenshotController {
  constructor(private service: ScreenshotLogService) {}

  @Get("screenshot-logs")
  list(@Query("userId") userId?: string) {
    return this.service.list(userId || undefined);
  }

  @Get("users/:id/screenshot-logs")
  forUser(@Param("id") id: string) {
    return this.service.list(id);
  }

  @AdminAction("SCREENSHOT_DECISION", async (c) => {
    const row = await c.db.screenshotLog.findUnique({ where: { id: c.params.id }, select: { userId: true } });
    const name = await c.userName(row?.userId);
    const text = c.body.action === "SUSPEND"
      ? `Ekran görüntüsü ihlali: ${name} kullanıcısını ${Number(c.body.days) === 30 ? "1 ay" : `${c.body.days} gün`} askıya aldı`
      : `Ekran görüntüsü ihlali: ${name} kullanıcısı için işlem yapmadı`;
    return { text, targetUserId: row?.userId };
  })
  @Post("screenshot-logs/:id/decision")
  @HttpCode(HttpStatus.OK)
  decide(@Param("id") id: string, @Body() dto: ScreenshotDecisionDto, @Req() req: Request) {
    return this.service.decide(id, (req.user as { id: string }).id, dto.action, dto.days);
  }
}
