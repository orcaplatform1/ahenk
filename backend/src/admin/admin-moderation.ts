// Masa sohbeti şikâyetleri, otomatik engel kayıtları, admin kararları (Uyar / Masadan çıkar / Askıya al 3-15-30 gün) ve
// uygunsuz profil fotoğrafı silme. Admin serbest mesaj yazamaz: kullanıcıya yalnız hazır şablon push gider; şablonun sonunda
// ihlal türü yazar. Kullanıcı daha önce uyarı aldıysa "Uyar" kullanılamaz.
import * as fs from "fs";
import * as path from "path";
import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Injectable, NotFoundException, Param, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";
import { IsIn, IsOptional } from "class-validator";
import { ChatReportReason, LeaveReason, ParticipantStatus, ProfilePhotoStatus, SanctionType, UserRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { approvedPhotoMap, PROFILE_PHOTO_DIR, smallPhotoName } from "../profile-photo/profile-photo.util";
import { tableDisplayNames } from "../meetings/table-initials";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { HideEmailForAdminInterceptor } from "./hide-email.interceptor";
import { AdminAction } from "./admin-action-log";
import { AdminService } from "./admin.service";
import { SUSPEND_DAYS, SuspendDays, isSuspendDays } from "../common/suspension";


// Şikâyet nedeni → ihlal türü (bildirimin sonundaki "İhlal: …" / "Violation: …")
export const REASON_LABEL: Record<ChatReportReason, { tr: string; en: string }> = {
  INSULT_THREAT: { tr: "Hakaret/tehdit/aşağılayıcı ileti", en: "Insult/threat/degrading message" },
  HARASSMENT_SEXUAL: { tr: "Taciz veya cinsel içerikli ileti", en: "Harassment or sexual content" },
  VENUE_CHANGE: { tr: "Buluşma yerini değiştirme", en: "Changing the meeting place" },
  CONTACT_SHARE: { tr: "Telefon/sosyal medya paylaşımı", en: "Phone/social media sharing" },
  DRUGS: { tr: "Uyuşturucu içerikli ileti", en: "Drug-related message" },
  FRAUD_MONEY: { tr: "Dolandırıcılık/para talebi", en: "Fraud/money request" },
  ADVERTISING: { tr: "Reklam/yönlendirme", en: "Advertising/redirection" },
  DISCRIMINATION: { tr: "Ayrımcı içerik", en: "Discriminatory content" },
  FAKE_PROFILE: { tr: "Sahte profil şüphesi", en: "Suspected fake profile" },
  OTHER: { tr: "Diğer", en: "Other" },
};
const PHOTO_LABEL = { tr: "Uygunsuz profil fotoğrafı", en: "Inappropriate profile photo" };

const WARN = {
  tr: "Ahenk Ekibi: Masa sohbetindeki paylaşımın incelendi ve kural ihlali tespit edildi. Bu ilk uyarındır. Tekrarlanması halinde masadan çıkarılırsın, kullanım hakkın yanar ve iade yapılmaz.",
  en: "Ahenk Team: Your message in the table chat was reviewed and a rule violation was found. This is your first warning. If repeated, you will be removed from the table, your credit will be forfeited and no refund will be given.",
};
const REMOVE = {
  tr: "Ahenk Ekibi: Masa sohbetindeki paylaşımın incelendi ve kural ihlali tespit edildi. Bu masadan çıkarıldın, kullanım hakkın yandı ve iade yapılmayacak.",
  en: "Ahenk Team: Your message in the table chat was reviewed and a rule violation was found. You have been removed from this table, your credit has been forfeited and no refund will be given.",
};
const PHOTO_REMOVED = {
  tr: "Topluluk kurallarımıza aykırı olan uygunsuz fotoğrafınız kaldırılmıştır.",
  en: "Your inappropriate photo that violates our community guidelines has been removed.",
};

class DecisionDto {
  @IsIn(["WARN", "REMOVE", "SUSPEND"])
  action: "WARN" | "REMOVE" | "SUSPEND";

  @IsOptional()
  @IsIn(SUSPEND_DAYS as unknown as number[])
  days?: number;
}

class PhotoDeleteDto {
  @IsOptional()
  @IsIn(SUSPEND_DAYS as unknown as number[])
  suspendDays?: number;
}

@Injectable()
export class AdminModerationService {
  constructor(private prisma: PrismaService, private notifications: NotificationService, private admin: AdminService) {}

  // Kullanıcının önceki sohbet uyarıları (uyarılar türe göre ayrı sayılır: sohbet / fotoğraf / gelmedi)
  private async warnings(userId: string) {
    return this.prisma.userSanction.findMany({
      where: { userId, type: SanctionType.WARNING, liftedAt: null, source: "CHAT" },
      orderBy: { createdAt: "desc" },
      select: { id: true, reason: true, source: true, createdAt: true },
    });
  }

  private async push(userId: string, text: { tr: string; en: string }, label: { tr: string; en: string } | null, type: string) {
    const body = label ? `${text.tr} İhlal: ${label.tr}` : text.tr;
    const en = label ? `${text.en} Violation: ${label.en}` : text.en;
    await this.notifications.sendToUser(userId, { title: "Ahenk", body, data: { type }, en: { title: "Ahenk", body: en } }).catch(() => undefined);
  }

  async listReports() {
    const rows = await this.prisma.chatReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true, createdAt: true, reason: true, note: true, auto: true, decision: true, decisionDays: true, decidedAt: true,
        message: { select: { content: true, meetingId: true, senderId: true, blockedAt: true, sender: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        reporter: { select: { profile: { select: { firstName: true, lastName: true } } } },
      },
    });
    const name = (p?: { firstName: string | null; lastName: string | null } | null) => `${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim() || "—";
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      auto: r.auto,
      reason: r.reason,
      reasonLabel: r.reason ? REASON_LABEL[r.reason].tr : null,
      note: r.note,
      decision: r.decision,
      decisionDays: r.decisionDays,
      decidedAt: r.decidedAt,
      meetingId: r.message.meetingId,
      messageContent: r.message.content,
      blocked: !!r.message.blockedAt,
      senderId: r.message.senderId,
      senderName: name(r.message.sender.profile),
      reporterName: r.reporter ? name(r.reporter.profile) : null,
    }));
  }

  // Şikâyet detayı: şikâyet edilen mesaj işaretli olarak sohbetin tamamı + gönderenin önceki uyarıları
  async reportDetail(id: string) {
    const r = await this.prisma.chatReport.findUnique({
      where: { id },
      select: { id: true, reason: true, note: true, auto: true, decision: true, decisionDays: true, createdAt: true, messageId: true, message: { select: { meetingId: true, senderId: true } } },
    });
    if (!r) throw new NotFoundException("Şikâyet bulunamadı");
    const meetingId = r.message.meetingId;
    const [messages, parts, warnings] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { meetingId },
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, createdAt: true, blockedAt: true, senderId: true, sender: { select: { isBot: true, profile: { select: { gender: true } } } }, _count: { select: { reports: true } } },
      }),
      this.prisma.meetingParticipant.findMany({
        where: { meetingId },
        select: { userId: true, createdAt: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
      }),
      this.warnings(r.message.senderId),
    ]);
    const names = tableDisplayNames(parts.map((p) => ({ userId: p.userId, createdAt: p.createdAt, profile: p.user.profile })));
    const photos = await approvedPhotoMap(this.prisma, messages.map((m) => m.senderId));
    const sender = parts.find((p) => p.userId === r.message.senderId)?.user.profile;
    return {
      id: r.id,
      auto: r.auto,
      reason: r.reason,
      reasonLabel: r.reason ? REASON_LABEL[r.reason].tr : null,
      note: r.note,
      decision: r.decision,
      decisionDays: r.decisionDays,
      meetingId,
      senderId: r.message.senderId,
      senderName: `${sender?.firstName ?? ""} ${sender?.lastName ?? ""}`.trim() || "—",
      senderPhotoUrl: photos.get(r.message.senderId) ?? null,
      warnings,
      hasWarning: warnings.length > 0,
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        senderId: m.senderId,
        senderName: names.get(m.senderId) ?? "?",
        senderGender: m.sender.profile?.gender ?? null,
        senderPhotoUrl: photos.get(m.senderId) ?? null,
        blocked: !!m.blockedAt,
        reportCount: m._count.reports,
        highlighted: m.id === r.messageId,
      })),
    };
  }

  async decide(id: string, adminId: string, action: "WARN" | "REMOVE" | "SUSPEND", days?: number) {
    const r = await this.prisma.chatReport.findUnique({
      where: { id },
      select: { id: true, reason: true, decision: true, message: { select: { meetingId: true, senderId: true } } },
    });
    if (!r) throw new NotFoundException("Şikâyet bulunamadı");
    if (r.decision) throw new BadRequestException("Bu kayıt için karar verildi");
    const userId = r.message.senderId;
    const label = REASON_LABEL[r.reason ?? ChatReportReason.CONTACT_SHARE];
    const reasonText = `Masa sohbeti: ${label.tr}`;

    if (action === "WARN") {
      if ((await this.warnings(userId)).length > 0) throw new BadRequestException("Kullanıcı daha önce uyarı aldı; yalnız Masadan çıkar ve Askıya al kullanılabilir");
      const s = await this.admin.createSanction(userId, adminId, SanctionType.WARNING, reasonText);
      await this.prisma.userSanction.update({ where: { id: s.id }, data: { source: "CHAT" } });
      await this.push(userId, WARN, label, "CHAT_WARNING");
    } else if (action === "REMOVE") {
      // Masadan çıkar: o masadaki hak yanar (sohbet kilit sonrası açıldığı için hak zaten düşülmüştür; iade edilmez), masa erişimi kapanır
      const seat = await this.prisma.meetingParticipant.findUnique({ where: { meetingId_userId: { meetingId: r.message.meetingId, userId } }, select: { id: true, status: true } });
      if (!seat) throw new NotFoundException("Katılımcı bulunamadı");
      await this.prisma.meetingParticipant.update({
        where: { id: seat.id },
        data: { status: ParticipantStatus.CANCELLED, cancelledAt: new Date(), leaveReason: LeaveReason.OTHER, leaveNote: `Admin: masadan çıkarıldı (${reasonText})` },
      });
      await this.push(userId, REMOVE, label, "CHAT_REMOVED");
      // Masadaki diğer katılımcılara push + uygulama içi bildirim
      const others = await this.prisma.meetingParticipant.findMany({
        where: { meetingId: r.message.meetingId, userId: { not: userId }, status: { notIn: [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED, ParticipantStatus.NO_SHOW] }, user: { isBot: false } },
        select: { userId: true },
      });
      for (const o of others) {
        await this.notifications.sendToUser(o.userId, {
          title: "Ahenk", body: "Masandaki bir katılımcı masadan ayrıldı.", data: { type: "PARTICIPANT_LEFT", meetingId: r.message.meetingId },
          en: { title: "Ahenk", body: "A participant has left your table." },
        }).catch(() => undefined);
      }
    } else {
      if (!isSuspendDays(days)) throw new BadRequestException("Askı süresi seçilmeli (3 gün / 15 gün / 1 ay)");
      await this.admin.suspend(userId, adminId, days, reasonText, label, "CHAT");
    }
    await this.prisma.chatReport.update({
      where: { id },
      data: { decision: action, decisionDays: action === "SUSPEND" ? days : null, decidedAt: new Date(), decidedById: adminId },
    });
    return { ok: true };
  }

  // Önceki fotoğraf uyarısı sayısı (silme penceresinde askı süresi seçimi bu sayıya göre istenir; yalnız fotoğraf uyarıları)
  async photoViolations(userId: string) {
    const count = await this.prisma.userSanction.count({ where: { userId, source: "PHOTO", type: SanctionType.WARNING, liftedAt: null } });
    return { count };
  }

  // Uygunsuz profil fotoğrafını sil: onaylı fotoğraf (dosya + kayıt) sunucudan silinir. İlk ihlalde uyarı kaydı + push;
  // önceki fotoğraf ihlali varsa admin askı süresini seçer (3 / 15 / 30 gün) ve Askıya al şablonu gider
  async deletePhoto(userId: string, adminId: string, suspendDays?: number) {
    const photos = await this.prisma.profilePhoto.findMany({ where: { userId, status: ProfilePhotoStatus.APPROVED } });
    if (!photos.length) throw new NotFoundException("Onaylı profil fotoğrafı bulunamadı");
    const prior = (await this.photoViolations(userId)).count;
    if (prior > 0 && !isSuspendDays(suspendDays)) {
      throw new BadRequestException("Kullanıcının önceki fotoğraf ihlali var; askı süresi seçilmeli (3 gün / 15 gün / 1 ay)");
    }
    await this.prisma.profilePhoto.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } });
    for (const p of photos) {
      fs.rmSync(path.join(PROFILE_PHOTO_DIR, userId, p.fileName), { force: true });
      fs.rmSync(path.join(PROFILE_PHOTO_DIR, userId, smallPhotoName(p.fileName)), { force: true });
    }
    if (prior === 0) {
      const s = await this.admin.createSanction(userId, adminId, SanctionType.WARNING, PHOTO_LABEL.tr);
      await this.prisma.userSanction.update({ where: { id: s.id }, data: { source: "PHOTO" } });
      await this.push(userId, PHOTO_REMOVED, null, "PHOTO_REMOVED");
    } else {
      await this.admin.suspend(userId, adminId, suspendDays as SuspendDays, PHOTO_LABEL.tr, PHOTO_LABEL, "PHOTO");
    }
    return { deleted: true, suspended: prior > 0 };
  }
}

@SkipThrottle()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
@UseInterceptors(HideEmailForAdminInterceptor)
export class AdminModerationController {
  constructor(private moderation: AdminModerationService) {}

  // Literal route'lar parametrik route'lardan önce
  @Get("chat-reports")
  list() {
    return this.moderation.listReports();
  }

  @Get("chat-reports/:id")
  detail(@Param("id") id: string) {
    return this.moderation.reportDetail(id);
  }

  @AdminAction("CHAT_REPORT_DECISION", async (c) => {
    const verb = { WARN: "uyardı", REMOVE: "masadan çıkardı", SUSPEND: `${Number(c.body.days) === 30 ? "1 ay" : `${c.body.days} gün`} askıya aldı` }[String(c.body.action)] ?? "karar verdi";
    return { text: `Masa sohbeti şikâyeti: kullanıcıyı ${verb}` };
  })
  @Post("chat-reports/:id/decision")
  @HttpCode(HttpStatus.OK)
  decide(@Param("id") id: string, @Body() dto: DecisionDto, @Req() req: Request) {
    return this.moderation.decide(id, (req.user as { id: string }).id, dto.action, dto.days);
  }

  @Get("users/:id/photo-violations")
  photoViolations(@Param("id") id: string) {
    return this.moderation.photoViolations(id);
  }

  @AdminAction("PROFILE_PHOTO_DELETE", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısının profil fotoğrafını sildi${c.body.suspendDays ? ` ve ${Number(c.body.suspendDays) === 30 ? "1 ay" : `${c.body.suspendDays} gün`} askıya aldı` : ""}`, targetUserId: c.params.id }))
  @Post("users/:id/profile-photo/delete")
  @HttpCode(HttpStatus.OK)
  deletePhoto(@Param("id") id: string, @Body() dto: PhotoDeleteDto, @Req() req: Request) {
    return this.moderation.deletePhoto(id, (req.user as { id: string }).id, dto.suspendDays);
  }
}
