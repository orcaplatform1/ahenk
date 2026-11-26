import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { SkipThrottle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { UserRole, VenueAccount } from "../generated/prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { VenueAuthGuard } from "../venue-panel/venue-auth.guard";
import { SupportService, type Requester, type Staff } from "./support.service";
import { SupportAiService } from "./support-ai.service";
import { SUPPORT_IMAGE_MAX_BYTES, SUPPORT_MAX_IMAGES } from "./support.constants";
import {
  AgentActiveDto, AgentStatusDto, AiDto, CannedDto, CloseDto, CreateAgentDto, LiftDto, MessageDto, NoteDto, RatingDto, StartChatDto,
  SupportSettingsDto, TransferDto, TypingDto,
} from "./support.dto";

const upload = FilesInterceptor("images", SUPPORT_MAX_IMAGES, { limits: { fileSize: SUPPORT_IMAGE_MAX_BYTES } });
const sendImage = (res: Response, p: string) => { res.setHeader("Cache-Control", "private, max-age=3600"); res.type("image/webp"); res.sendFile(p); };

// Ortak kullanıcı uçları (üye ve mekân aynı ekran); yalnız kimlik kaynağı farklı
abstract class RequesterEndpoints {
  constructor(protected support: SupportService) {}
  protected abstract who(req: Request): Requester;

  @Get("state") state(@Req() req: Request) { return this.support.state(this.who(req)); }
  @Get("summary") summary(@Req() req: Request) { return this.support.summary(this.who(req)); }
  @Post("chats") start(@Req() req: Request, @Body() dto: StartChatDto) { return this.support.start(this.who(req), dto.topic); }
  @Post("chats/:id/messages") @UseInterceptors(upload)
  message(@Req() req: Request, @Param("id") id: string, @Body() dto: MessageDto, @UploadedFiles() files?: Express.Multer.File[]) {
    return this.support.userMessage(this.who(req), id, dto.content, files ?? []);
  }
  @Post("chats/:id/typing") typing(@Req() req: Request, @Param("id") id: string, @Body() dto: TypingDto) { return this.support.userTyping(this.who(req), id, dto.text ?? ""); }
  @Post("chats/:id/close") close(@Req() req: Request, @Param("id") id: string) { return this.support.userClose(this.who(req), id); }
  @Post("chats/:id/rating") rate(@Req() req: Request, @Param("id") id: string, @Body() dto: RatingDto) { return this.support.rate(this.who(req), id, dto); }
  @Get("chats/:id/images/:file") async image(@Req() req: Request, @Param("id") id: string, @Param("file") file: string, @Res() res: Response) {
    sendImage(res, await this.support.userImage(this.who(req), id, file));
  }
}

// Üye (giriş zorunlu)
@Controller("support")
@UseGuards(JwtAuthGuard)
export class SupportMemberController extends RequesterEndpoints {
  constructor(support: SupportService) { super(support); }
  protected who(req: Request): Requester { return { kind: "user", id: (req.user as { id: string }).id }; }
}

// Mekân paneli (mekân oturumu zorunlu; mekân çerezi yolu /api/v1/venue-panel olduğu için bu önekte)
@Controller("venue-panel/support")
@UseGuards(VenueAuthGuard)
export class SupportVenueController extends RequesterEndpoints {
  constructor(support: SupportService) { super(support); }
  protected who(req: Request): Requester { return { kind: "venue", id: (req as Request & { venueAccount: VenueAccount }).venueAccount.id }; }
}

// Temsilci ekranı: SUPPORT, ADMIN, SUPERADMIN (rol servis içinde her istekte denetlenir)
@SkipThrottle()
@Controller("admin/live-support")
@UseGuards(JwtAuthGuard)
export class SupportAgentController {
  constructor(private support: SupportService, private ai: SupportAiService) {}
  private staff(req: Request): Staff { const u = req.user as { id: string; role: UserRole }; return { id: u.id, role: u.role }; }

  @Get("state") state(@Req() req: Request) { return this.support.agentState(this.staff(req)); }
  @Patch("status") status(@Req() req: Request, @Body() dto: AgentStatusDto) { return this.support.setStatus(this.staff(req), dto.status); }
  @Get("canned") canned(@Req() req: Request) { return this.support.cannedList(this.staff(req)); }
  @Get("chats/:id") chat(@Req() req: Request, @Param("id") id: string) { return this.support.agentChat(this.staff(req), id); }
  @Post("chats/:id/messages") @UseInterceptors(upload)
  message(@Req() req: Request, @Param("id") id: string, @Body() dto: MessageDto, @UploadedFiles() files?: Express.Multer.File[]) {
    return this.support.agentMessage(this.staff(req), id, dto.content, files ?? []);
  }
  @Post("chats/:id/typing") typing(@Req() req: Request, @Param("id") id: string) { return this.support.agentTyping(this.staff(req), id); }
  // Kullanıcının yazıyor bilgisi ve gönderilmemiş yazı önizlemesi (yalnız atanmış temsilciye; bellekten)
  @Get("chats/:id/typing") typingState(@Req() req: Request, @Param("id") id: string) { return this.support.agentTypingState(this.staff(req), id); }
  @Post("chats/:id/notes") note(@Req() req: Request, @Param("id") id: string, @Body() dto: NoteDto) { return this.support.addNote(this.staff(req), id, dto.content); }
  @Post("chats/:id/transfer") transfer(@Req() req: Request, @Param("id") id: string, @Body() dto: TransferDto) { return this.support.transfer(this.staff(req), id, dto.toAgentId, dto.note); }
  @Post("chats/:id/take") take(@Req() req: Request, @Param("id") id: string) { return this.support.takeOver(this.staff(req), id); }
  @Post("chats/:id/close") close(@Req() req: Request, @Param("id") id: string, @Body() dto: CloseDto) { return this.support.agentClose(this.staff(req), id, dto.abuseDays, dto.abuseReason); }
  @Post("chats/:id/ai") askAi(@Req() req: Request, @Param("id") id: string, @Body() dto: AiDto) { return this.ai.ask(this.staff(req), id, dto); }
  @Get("chats/:id/images/:file") async image(@Req() req: Request, @Param("id") id: string, @Param("file") file: string, @Res() res: Response) {
    sendImage(res, await this.support.agentImage(this.staff(req), id, file));
  }
}

// Yönetim: hazır yanıtlar ve raporlar (ADMIN, SUPERADMIN); temsilci hesapları, kısıtlamalar, Haiku kayıtları, ayarlar (SUPERADMIN)
@SkipThrottle()
@Controller("admin/live-support/manage")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
export class SupportManageController {
  constructor(private support: SupportService) {}
  private actor(req: Request) { return (req.user as { id: string }).id; }

  @Post("canned") cannedCreate(@Body() dto: CannedDto) { return this.support.cannedCreate(dto.title, dto.content); }
  @Patch("canned/:id") cannedUpdate(@Param("id") id: string, @Body() dto: CannedDto) { return this.support.cannedUpdate(id, dto.title, dto.content); }
  @Delete("canned/:id") cannedDelete(@Param("id") id: string) { return this.support.cannedDelete(id); }
  @Get("reports") reports(@Query("days") days?: string) { return this.support.reports(Number(days) || 0); }

  // Temsilci listesi (durum, moladaysa geçen süre) ve mola geçmişi: ADMIN + SUPERADMIN; hesap açma / kapama yalnız SUPERADMIN
  @Get("agents") agents() { return this.support.agentAccounts(); }
  @Get("agents/:userId/breaks") agentBreaks(@Param("userId") userId: string) { return this.support.agentBreaks(userId); }
  @Post("agents") @Roles(UserRole.SUPERADMIN) createAgent(@Req() req: Request, @Body() dto: CreateAgentDto) { return this.support.createAgentAccount(this.actor(req), dto); }
  @Patch("agents/:userId") @Roles(UserRole.SUPERADMIN) agentActive(@Req() req: Request, @Param("userId") userId: string, @Body() dto: AgentActiveDto) {
    return this.support.setAgentAccountActive(this.actor(req), userId, dto.active);
  }
  // Kullanıcı / mekân detayı "Canlı destek kısıtlamaları" (detay sayfasını görenler: ADMIN + SUPERADMIN); kaldırma yalnız SUPERADMIN
  @Get("restrictions/user/:userId") userRestrictions(@Param("userId") userId: string) { return this.support.restrictionsOfUser(userId); }
  @Get("restrictions/venue/:venueId") venueRestrictions(@Param("venueId") venueId: string) { return this.support.restrictionsOfVenue(venueId); }
  @Get("restrictions") @Roles(UserRole.SUPERADMIN) restrictions() { return this.support.restrictions(); }
  @Post("restrictions/:id/lift") @Roles(UserRole.SUPERADMIN) lift(@Req() req: Request, @Param("id") id: string, @Body() dto: LiftDto) { return this.support.liftRestriction(this.actor(req), id, dto.reason); }
  @Get("ai-logs") @Roles(UserRole.SUPERADMIN) aiLogs() { return this.support.aiLogs(); }
  // Tüm Sohbetler (yalnız SUPERADMIN): liste + sohbetin tamamı; devralma mevcut POST /admin/live-support/chats/:id/take ile
  @Get("chats") @Roles(UserRole.SUPERADMIN) allChats(
    @Query("from") from?: string, @Query("to") to?: string, @Query("status") status?: string, @Query("topic") topic?: string,
    @Query("agentNo") agentNo?: string, @Query("kind") kind?: string, @Query("q") q?: string, @Query("page") page?: string,
  ) { return this.support.allChats({ from, to, status, topic, agentNo, kind, q, page }); }
  @Get("chats/:id") @Roles(UserRole.SUPERADMIN) allChatDetail(@Param("id") id: string) { return this.support.allChatDetail(id); }
  @Get("settings") @Roles(UserRole.SUPERADMIN) settings() { return this.support.settings(); }
  @Patch("settings") @Roles(UserRole.SUPERADMIN) updateSettings(@Body() dto: SupportSettingsDto) { return this.support.updateSettings(dto); }
}
