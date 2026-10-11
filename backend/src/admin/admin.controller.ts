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
} from "@nestjs/common";
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
} from "./dto/admin.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, RefundStatus } from "@prisma/client";

class UpdateRefundDto {
  @IsEnum(RefundStatus)
  status: RefundStatus;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

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
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.listUsers({ search, status, page, limit });
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
    return this.adminService.updateUserStatus(id, actor.id, dto.status);
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

  @Patch("users/:id/test-lock-reset")
  resetTestLock(@Param("id") id: string) {
    return this.adminService.resetTestLock(id);
  }

  // ─── Abonelik yönetimi ────────────────────────────────────────────────────

  @Get("users/:id/subscriptions")
  getUserSubscriptions(@Param("id") id: string) {
    return this.adminService.getUserSubscriptions(id);
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
  updateMeetingVenuePhotos(@Param("id") id: string, @Body() dto: {
    venueAddress?: string;
    venuePhotoUrl?: string;  venuePhotoCaption1?: string;
    venuePhoto2Url?: string; venuePhotoCaption2?: string;
    venuePhoto3Url?: string; venuePhotoCaption3?: string;
  }) {
    return this.adminService.updateMeetingVenuePhotos(id, dto);
  }

  @Post("meetings/venue-photo-upload-url")
  async getVenuePhotoUploadUrl(
    @Body() dto: { meetingId: string; slot: 1 | 2 | 3; contentType: string; contentLength: number },
  ) {
    const ext = dto.contentType.split('/')[1] ?? 'jpg';
    const key = `venues/${dto.meetingId}/photo${dto.slot}-${Date.now()}.${ext}`;
    const url = await this.adminService.storage.presignedPutUrl(key, dto.contentType, dto.contentLength);
    const publicBase = process.env.R2_PUBLIC_URL ?? '';
    return { uploadUrl: url, publicUrl: publicBase ? `${publicBase}/${key}` : null, key };
  }

  @Patch("meetings/:id/extend-deadline")
  extendMeetingDeadline(@Param("id") id: string, @Body() dto: ExtendMeetingDeadlineDto) {
    return this.adminService.extendMeetingDeadline(id, dto.extraHours);
  }

  @Delete("meetings/:id")
  cancelMeeting(@Param("id") id: string) {
    return this.adminService.cancelMeeting(id);
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
      weeklyTableLimit: dto.weeklyTableLimit,
      matchingEnabled: dto.matchingEnabled,
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
  placeBot(@Param("id") id: string, @Body() body: { botUserId: string }) {
    return this.adminService.placeBot(id, body.botUserId);
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
  quarantineUser(@Param("id") id: string) {
    return this.adminService.quarantineUser(id);
  }

  @Post("users/:id/ban")
  banUser(@Param("id") id: string) {
    return this.adminService.banUser(id);
  }
}
