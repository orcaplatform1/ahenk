import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { Request } from "express";
import { AdminService } from "./admin.service";
import {
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  GrantFreeSubscriptionDto,
  UpdateMeetingVenueDto,
  CreateManualMeetingDto,
  ExtendMeetingDeadlineDto,
  CreateVenueDto,
  UpdateVenueDto,
  CreateCityDto,
  UpdateCityDto,
  CancelSubscriptionDto,
  UpdateSettingsDto,
  CreateSanctionDto,
  SanctionReasonDto,
  PlaceBotDto,
  UpdateVenuePhotosDto,
  UpdatePartnershipDto,
  UpdateCareerDto,
} from "./dto/admin.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, RefundStatus } from "@prisma/client";
import { SkipThrottle } from "@nestjs/throttler";
import { SANCTION_REASONS } from "./sanction-reasons";

class UpdateRefundDto {
  @IsEnum(RefundStatus)
  status: RefundStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

@SkipThrottle()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Dashboard ───────────────────────────────────────────────────────────

  @Get("dashboard")
  getDashboard() {
    return this.adminService.getDashboard();
  }

  // ─── Öncü kota ───────────────────────────────────────────────────────────

  @Get("pioneer/quota")
  getPioneerQuota() {
    return this.adminService.getPioneerQuota();
  }

  // ─── Kullanıcı yönetimi ───────────────────────────────────────────────────

  @Get("users")
  listUsers(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("type") type?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.listUsers({ search, status, type, page, limit });
  }

  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.adminService.getUser(id);
  }

  @Patch("users/:id/status")
  updateUserStatus(
    @Param("id") id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    const actor = req.user as { id: string };
    return this.adminService.updateUserStatus(id, actor.id, dto.status, dto.reason);
  }

  @Patch("users/:id/role")
  updateUserRole(
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: Request,
  ) {
    const actor = req.user as { id: string };
    return this.adminService.updateUserRole(id, actor.id, dto.role);
  }

  @Post("users/:id/pioneer")
  togglePioneer(@Param("id") id: string) {
    return this.adminService.togglePioneerBadge(id);
  }

  @Post("users/:id/free-subscription")
  grantFreeSubscription(
    @Param("id") id: string,
    @Body() dto: GrantFreeSubscriptionDto,
  ) {
    return this.adminService.grantFreeSubscription(id, dto.plan, dto.expiresAt);
  }

  @Post("users/:id/kyc-approve")
  quickApproveKyc(@Param("id") userId: string, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.quickApproveKyc(userId, actor.id);
  }

  @Patch("users/:id/test-lock-reset")
  resetTestLock(@Param("id") id: string) {
    return this.adminService.resetTestLock(id);
  }

  // ─── Abonelik yönetimi ────────────────────────────────────────────────────

  @Get("users/:id/subscriptions")
  getUserSubscriptions(@Param("id") id: string) {
    return this.adminService.getUserSubscriptions(id);
  }

  @Get("subscriptions")
  listSubscriptions(
    @Query("status") status?: string,
    @Query("plan") plan?: string,
    @Query("search") search?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.listSubscriptions({ status, plan, search, page, limit });
  }

  @Patch("subscriptions/:id/cancel")
  cancelSubscription(
    @Param("id") id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.adminService.cancelSubscription(id, dto.cancelNote);
  }

  // ─── Masa yönetimi ────────────────────────────────────────────────────────

  @Get("meetings")
  listMeetings(
    @Query("status") status?: string,
    @Query("city") city?: string,
    @Query("week", new DefaultValuePipe(0), ParseIntPipe) week?: number,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.listMeetings({ status, city, week: week || undefined, page, limit });
  }

  @Get("meetings/:id")
  getMeeting(@Param("id") id: string) {
    return this.adminService.getMeeting(id);
  }

  @Post("meetings")
  createManualMeeting(@Body() dto: CreateManualMeetingDto) {
    return this.adminService.createManualMeeting(dto);
  }

  @Patch("meetings/:id/venue")
  updateMeetingVenue(@Param("id") id: string, @Body() dto: UpdateMeetingVenueDto) {
    return this.adminService.updateMeetingVenue(id, dto);
  }

  @Patch("meetings/:id/venue-photos")
  updateMeetingVenuePhotos(@Param("id") id: string, @Body() dto: UpdateVenuePhotosDto) {
    return this.adminService.updateMeetingVenuePhotos(id, dto);
  }

  // Mekan fotoğrafı yükle (multipart: file + slot 1|2|3) — sunucu diskine kaydedilir
  @Post("meetings/:id/venue-photo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadVenuePhoto(
    @Param("id") id: string,
    @Query("slot", ParseIntPipe) slot: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.adminService.saveVenuePhoto(id, slot, file);
  }

  @Patch("meetings/:id/extend-deadline")
  extendMeetingDeadline(@Param("id") id: string, @Body() dto: ExtendMeetingDeadlineDto) {
    return this.adminService.extendMeetingDeadline(id, dto.extraHours);
  }

  @Delete("meetings/:id")
  cancelMeeting(@Param("id") id: string) {
    return this.adminService.cancelMeeting(id);
  }

  @Delete("meetings/:id/participants/:userId")
  removeParticipant(@Param("id") meetingId: string, @Param("userId") userId: string) {
    return this.adminService.removeParticipant(meetingId, userId);
  }

  // ─── Mekan yönetimi ───────────────────────────────────────────────────────

  @Get("venues")
  listVenues(@Query("cityId") cityId?: string) {
    return this.adminService.listVenues(cityId);
  }

  @Post("venues")
  createVenue(@Body() dto: CreateVenueDto) {
    return this.adminService.createVenue(dto);
  }

  @Patch("venues/:id")
  updateVenue(@Param("id") id: string, @Body() dto: UpdateVenueDto) {
    return this.adminService.updateVenue(id, dto);
  }

  @Delete("venues/:id")
  deleteVenue(@Param("id") id: string) {
    return this.adminService.deleteVenue(id);
  }

  // ─── Şehir yönetimi ───────────────────────────────────────────────────────

  @Get("cities")
  listCities() {
    return this.adminService.listCities();
  }

  @Post("cities")
  createCity(@Body() dto: CreateCityDto) {
    return this.adminService.createCity(dto.name);
  }

  @Patch("cities/:id")
  updateCity(@Param("id") id: string, @Body() dto: UpdateCityDto) {
    return this.adminService.updateCity(id, dto);
  }

  // ─── Sistem ayarları ─────────────────────────────────────────────────────

  @Get("settings")
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch("settings")
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.adminService.updateSettings({
      matchingEnabled: dto.matchingEnabled,
      botSystemActive: dto.botSystemActive,
      maintenanceMode: dto.maintenanceMode,
    });
  }

  // ─── Matches ─────────────────────────────────────────────────────────────

  @Get("matches/pending")
  getPendingMatches() {
    return this.adminService.getPendingMatches();
  }

  @Patch("matches/:id/approve")
  approveMatch(@Param("id") id: string) {
    return this.adminService.approveMatch(id);
  }

  @Post("matches/:id/bot")
  placeBot(@Param("id") id: string, @Body() dto: PlaceBotDto) {
    return this.adminService.placeBot(id, dto.botUserId);
  }

  // ─── Uyarılar & İade Talepleri ────────────────────────────────────────────

  @Get("alerts")
  getAlerts() {
    return this.adminService.getAlerts();
  }

  @Patch("alerts/:id/read")
  @HttpCode(HttpStatus.OK)
  markAlertRead(@Param("id") id: string) {
    return this.adminService.markAlertRead(id);
  }

  @Patch("refunds/:id")
  updateRefund(@Param("id") id: string, @Body() dto: UpdateRefundDto) {
    return this.adminService.updateRefundStatus(id, dto.status, dto.adminNote);
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  @Get("stats/overview")
  getStatsOverview() {
    return this.adminService.getStatsOverview();
  }

  @Get("stats/cities")
  getStatsCities() {
    return this.adminService.getStatsCities();
  }

  // ─── Reports ─────────────────────────────────────────────────────────────

  @Get("reports/pending")
  getPendingReports() {
    return this.adminService.getPendingReports();
  }

  // ─── Karantina & Ban ─────────────────────────────────────────────────────

  @Post("users/:id/quarantine")
  quarantineUser(@Param("id") id: string, @Body() dto: SanctionReasonDto, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.quarantineUser(id, actor.id, dto.reason);
  }

  @Post("users/:id/ban")
  banUser(@Param("id") id: string, @Body() dto: SanctionReasonDto, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.banUser(id, actor.id, dto.reason);
  }

  @Post("users/:id/sanction")
  createSanction(
    @Param("id") id: string,
    @Body() dto: CreateSanctionDto,
    @Req() req: Request,
  ) {
    const admin = req.user as { id: string };
    return this.adminService.createSanction(
      id,
      admin.id,
      dto.type as any,
      dto.reason,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
  }

  @Delete("users/:id/sanction/:sanctionId")
  liftSanction(@Param("id") id: string, @Param("sanctionId") sanctionId: string, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.liftSanction(id, sanctionId, actor.id);
  }

  @Get("sanction-reasons")
  getSanctionReasons() {
    return SANCTION_REASONS;
  }

  @Get("users/:id/sanctions")
  getUserSanctions(@Param("id") id: string) {
    return this.adminService.getUserSanctions(id);
  }

  @Get("partnerships")
  listPartnerships() {
    return this.adminService.listPartnerships();
  }

  @Patch("partnerships/:id")
  updatePartnership(@Param("id") id: string, @Body() body: UpdatePartnershipDto) {
    return this.adminService.updatePartnership(id, body);
  }

  @Get("careers")
  listCareers() {
    return this.adminService.listCareers();
  }

  @Patch("careers/:id")
  updateCareer(@Param("id") id: string, @Body() body: UpdateCareerDto) {
    return this.adminService.updateCareer(id, body);
  }

}
