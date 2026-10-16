import { Controller, Get, Post, Param, Body, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { MeetingsService } from "./meetings.service";
import { AiReportService } from "./ai-report.service";
import { BlockUsersDto, ReviewMeetingDto, CancelRegistrationDto } from "./dto/meetings.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("meetings")
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private meetingsService: MeetingsService,
    private aiReportService: AiReportService,
  ) {}

  // Kullanıcının aktif/bekleyen en yakın masası
  @Get("my-current")
  getMyCurrent(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.meetingsService.getMyCurrent(user.id);
  }

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
  getAiReport(@Param("id") id: string) {
    return this.aiReportService.getReport(id);
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
    );
  }
}
