import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { MeetingsService } from "./meetings.service";
import { AiReportService } from "./ai-report.service";
import { BlockUsersDto, ReviewMeetingDto, CancelRegistrationDto, MarkNoShowDto } from "./dto/meetings.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("meetings")
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private meetingsService: MeetingsService,
    private aiReportService: AiReportService,
  ) {}

  @Get("dashboard")
  getDashboard(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.getDashboardTable(user.id);
  }

  // Kullanıcının geçmiş masaları
  @Get("my-history")
  getMyHistory(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.getMyHistory(user.id);
  }

  // Katılımcı önizlemesi — ad+soyad baş harfi + cinsiyet
  // Değerlendirme sayfası başlığı: mekan adı + tarih
  @Get(":id/info")
  getMeetingInfo(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.getMeetingInfo(id, user.id);
  }

  // Masaya gelmeyen işaretleme: masa kartında 22:00 → ertesi gün 10:00
  @Get(":id/no-show")
  getNoShowMarking(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.getNoShowMarking(id, user.id);
  }

  @Post(":id/no-show")
  markNoShow(@Param("id") id: string, @Body() dto: MarkNoShowDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.markNoShow(id, user.id, dto.userIds);
  }

  @Get(":id/participants-preview")
  getParticipantsPreview(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.getParticipantsPreview(id, user.id);
  }

  // Buluşma sonrası engelleme (grup/başbaşa)
  @Post(":id/block")
  blockUsers(
    @Param("id") id: string,
    @Body() dto: BlockUsersDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.meetingsService.blockUsers(id, user.id, dto.blockedUserIds);
  }

  // Başbaşa kalıcı çift yönlü engelleme
  @Post(":id/rematch-block")
  rematchBlock(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.rematchBlock(id, user.id);
  }

  @Post(":id/on-my-way")
  onMyWay(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.onMyWay(id, user.id);
  }

  @Post(":id/cancel-registration")
  cancelRegistration(
    @Param("id") id: string,
    @Body() dto: CancelRegistrationDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.meetingsService.cancelRegistration(id, user.id, dto.reason, dto.note);
  }

  // AI masa raporu
  @Get(":id/ai-report")
  getAiReport(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.aiReportService.getReport(id, user.id);
  }

  // Buluşma değerlendirmesi
  @Post(":id/review")
  submitReview(
    @Param("id") id: string,
    @Body() dto: ReviewMeetingDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.meetingsService.submitReview(
      id,
      user.id,
      dto.rating,
      dto.blockedUserIds ?? [],
      dto.comment,
      dto.noShowUserIds ?? [],
    );
  }
}
