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
import { HideEmailForAdminInterceptor, KeepEmails } from "./hide-email.interceptor";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { Request } from "express";
import { AdminService } from "./admin.service";
import { PricingService } from "../payment/pricing.service";
import { AdminAction, planTr, reasonTr, statusTr } from "./admin-action-log";
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
  NoShowWarningDto,
  AdminUpdateUserDto,
  PlaceBotDto,
  UpdateVenuePhotosDto,
  UpdatePartnershipDto,
  UpdateCareerDto,
  UpdatePricesDto,
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
@UseInterceptors(HideEmailForAdminInterceptor)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private pricing: PricingService,
  ) {}

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
    @Query("city") city?: string,
    @Query("type") type?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Req() req?: Request,
  ) {
    return this.adminService.listUsers({ search, status, city, type, page, limit }, (req!.user as { role: UserRole }).role);
  }

  @Get("users/:id")
  getUser(@Param("id") id: string, @Req() req: Request) {
    return this.adminService.getUser(id, (req.user as { role: UserRole }).role);
  }

  @AdminAction("USER_PROFILE_EDIT", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısının profil bilgilerini düzenledi`, targetUserId: c.params.id }))
  @Patch("users/:id/profile")
  adminUpdateUser(@Param("id") id: string, @Body() dto: AdminUpdateUserDto, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.adminUpdateUser(id, actor.id, dto);
  }

  @AdminAction("USER_STATUS", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısının hesap durumunu "${statusTr(c.body.status)}" yaptı${reasonTr(c.body.reason)}`, targetUserId: c.params.id }))
  @Patch("users/:id/status")
  updateUserStatus(
    @Param("id") id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    const actor = req.user as { id: string };
    return this.adminService.updateUserStatus(id, actor.id, dto.status, dto.reason);
  }

  @Roles(UserRole.SUPERADMIN)
  @AdminAction("USER_ROLE", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısının rolünü "${String(c.body.role)}" yaptı`, targetUserId: c.params.id }))
  @Patch("users/:id/role")
  updateUserRole(
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: Request,
  ) {
    const actor = req.user as { id: string };
    return this.adminService.updateUserRole(id, actor.id, dto.role);
  }

  @AdminAction("USER_PIONEER", async (c) => ({ text: (c.result as { isPioneer?: boolean })?.isPioneer ? `${await c.userName(c.params.id)} kullanıcısına Öncü rozeti verdi` : `${await c.userName(c.params.id)} kullanıcısının Öncü rozetini kaldırdı`, targetUserId: c.params.id }))
  @Post("users/:id/pioneer")
  togglePioneer(@Param("id") id: string) {
    return this.adminService.togglePioneerBadge(id);
  }

  @Post("users/:id/free-subscription")
  @Roles(UserRole.SUPERADMIN)
  grantFreeSubscription(
    @Param("id") id: string,
    @Body() dto: GrantFreeSubscriptionDto,
  ) {
    return this.adminService.grantFreeSubscription(id, dto.plan, dto.expiresAt);
  }

  @AdminAction("KYC_APPROVE", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısının KYC başvurusunu onayladı`, targetUserId: c.params.id }))
  @Post("users/:id/kyc-approve")
  quickApproveKyc(@Param("id") userId: string, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.quickApproveKyc(userId, actor.id);
  }

  @AdminAction("TEST_LOCK_RESET", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısının kişilik testi kilidini açtı`, targetUserId: c.params.id }))
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
    @Req() req?: Request,
  ) {
    return this.adminService.listSubscriptions({ status, plan, search, page, limit }, (req!.user as { role: UserRole }).role);
  }

  @AdminAction("SUBSCRIPTION_CANCEL", async (c) => {
    const sub = await c.db.subscription.findUnique({ where: { id: c.params.id }, select: { userId: true, plan: true } });
    return { text: `${await c.userName(sub?.userId)} kullanıcısının ${planTr(sub?.plan)} paketini iptal etti${c.body.cancelNote ? ` (Not: ${c.body.cancelNote})` : ""}`, targetUserId: sub?.userId };
  })
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

  @Get("meetings/without-venue")
  countMeetingsWithoutVenue() {
    return this.adminService.countMeetingsWithoutVenue();
  }

  @Get("meetings/:id")
  getMeeting(@Param("id") id: string, @Req() req: Request) {
    return this.adminService.getMeeting(id, (req.user as { role: UserRole }).role);
  }

  @AdminAction("MEETING_CREATE", (c) => `"${(c.result as { title?: string })?.title ?? c.body.title}" masasını elle kurdu`)
  @Post("meetings")
  createManualMeeting(@Body() dto: CreateManualMeetingDto) {
    return this.adminService.createManualMeeting(dto);
  }

  @AdminAction("MEETING_VENUE", async (c) => `${await c.meetingName(c.params.id)} masasının mekanını "${c.body.locationText}" olarak belirledi`)
  @Patch("meetings/:id/venue")
  updateMeetingVenue(@Param("id") id: string, @Body() dto: UpdateMeetingVenueDto) {
    return this.adminService.updateMeetingVenue(id, dto);
  }

  @AdminAction("MEETING_VENUE_INFO", async (c) => `${await c.meetingName(c.params.id)} masasının mekan adresini ve fotoğraf bilgilerini güncelledi`)
  @Patch("meetings/:id/venue-photos")
  updateMeetingVenuePhotos(@Param("id") id: string, @Body() dto: UpdateVenuePhotosDto) {
    return this.adminService.updateMeetingVenuePhotos(id, dto);
  }

  // Mekan fotoğrafı yükle (multipart: file + slot 1|2|3) — sunucu diskine kaydedilir
  @AdminAction("MEETING_VENUE_PHOTO", async (c) => `${await c.meetingName(c.params.id)} masasına ${c.query.slot}. mekan fotoğrafını yükledi`)
  @Post("meetings/:id/venue-photo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadVenuePhoto(
    @Param("id") id: string,
    @Query("slot", ParseIntPipe) slot: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.adminService.saveVenuePhoto(id, slot, file);
  }

  @AdminAction("MEETING_EXTEND", async (c) => `${await c.meetingName(c.params.id)} masasının kapanış süresini ${c.body.extraHours} saat uzattı`)
  @Patch("meetings/:id/extend-deadline")
  extendMeetingDeadline(@Param("id") id: string, @Body() dto: ExtendMeetingDeadlineDto) {
    return this.adminService.extendMeetingDeadline(id, dto.extraHours);
  }

  @AdminAction("MEETING_CANCEL", async (c) => `${await c.meetingName(c.params.id)} masasını iptal etti`)
  @Delete("meetings/:id")
  cancelMeeting(@Param("id") id: string) {
    return this.adminService.cancelMeeting(id);
  }

  @AdminAction("MEETING_REMOVE_PARTICIPANT", async (c) => ({ text: `${await c.userName(c.params.userId)} kullanıcısını ${await c.meetingName(c.params.id)} masasından çıkardı`, targetUserId: c.params.userId }))
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
  @Roles(UserRole.SUPERADMIN)
  createVenue(@Body() dto: CreateVenueDto) {
    return this.adminService.createVenue(dto);
  }

  @Patch("venues/:id")
  @Roles(UserRole.SUPERADMIN)
  updateVenue(@Param("id") id: string, @Body() dto: UpdateVenueDto) {
    return this.adminService.updateVenue(id, dto);
  }

  @Delete("venues/:id")
  @Roles(UserRole.SUPERADMIN)
  deleteVenue(@Param("id") id: string) {
    return this.adminService.deleteVenue(id);
  }

  // ─── Şehir yönetimi ───────────────────────────────────────────────────────

  @Get("cities")
  listCities() {
    return this.adminService.listCities();
  }

  @Post("cities")
  @Roles(UserRole.SUPERADMIN)
  createCity(@Body() dto: CreateCityDto) {
    return this.adminService.createCity(dto.name);
  }

  @Patch("cities/:id")
  @Roles(UserRole.SUPERADMIN)
  updateCity(@Param("id") id: string, @Body() dto: UpdateCityDto) {
    return this.adminService.updateCity(id, dto);
  }

  // ─── Sistem ayarları ─────────────────────────────────────────────────────

  @Get("settings")
  getSettings(@Req() req: Request) {
    return this.adminService.getSettings((req.user as { role: UserRole }).role);
  }

  @Patch("settings")
  @Roles(UserRole.SUPERADMIN)
  updateSettings(@Body() dto: UpdateSettingsDto, @Req() req: Request) {
    return this.adminService.updateSettings({
      matchingEnabled: dto.matchingEnabled,
      botSystemActive: dto.botSystemActive,
      maintenanceMode: dto.maintenanceMode,
      liveDistrictSource: dto.liveDistrictSource,
    }, (req.user as { role: UserRole }).role);
  }

  // ─── ADMIN işlem kayıtları (sadece SUPERADMIN) ────────────────────────────

  @Get("action-logs")
  @Roles(UserRole.SUPERADMIN)
  listActionLogs(
    @Query("adminId") adminId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("q") q?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
  ) {
    return this.adminService.listActionLogs({ adminId, from, to, q, page });
  }

  // ─── Paket fiyatları (sadece SUPERADMIN) ─────────────────────────────────

  @Get("prices")
  @Roles(UserRole.SUPERADMIN)
  getPrices() {
    return this.pricing.listForAdmin();
  }

  @Patch("prices")
  @Roles(UserRole.SUPERADMIN)
  updatePrices(@Body() dto: UpdatePricesDto, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.pricing.updatePrices(dto.prices, actor.id);
  }

  // ─── Matches ─────────────────────────────────────────────────────────────

  @Get("matches/pending")
  getPendingMatches(@Req() req: Request) {
    return this.adminService.getPendingMatches((req.user as { role: UserRole }).role);
  }

  @Get("matches/open")
  getOpenTables(@Req() req: Request) {
    return this.adminService.getOpenTables((req.user as { role: UserRole }).role);
  }

  @Get("matches/waiting/:userId/bots")
  @Roles(UserRole.SUPERADMIN)
  getBotsForWaiting(@Param("userId") userId: string) {
    return this.adminService.getBotsForWaiting(userId);
  }

  @Post("matches/waiting/:userId/bot")
  @Roles(UserRole.SUPERADMIN)
  placeOneOnOneBot(@Param("userId") userId: string, @Body() dto: PlaceBotDto) {
    return this.adminService.placeOneOnOneBot(userId, dto.botUserId);
  }

  @Get("matches/:id/bots")
  @Roles(UserRole.SUPERADMIN)
  getBotsForMeeting(@Param("id") id: string) {
    return this.adminService.getBotsForMeeting(id);
  }

  @AdminAction("MEETING_APPROVE", async (c) => `${await c.meetingName(c.params.id)} masasını onayladı`)
  @Patch("matches/:id/approve")
  approveMatch(@Param("id") id: string) {
    return this.adminService.approveMatch(id);
  }

  @Post("matches/:id/bot")
  @Roles(UserRole.SUPERADMIN)
  placeBot(@Param("id") id: string, @Body() dto: PlaceBotDto) {
    return this.adminService.placeBot(id, dto.botUserId);
  }

  // ─── Uyarılar & İade Talepleri ────────────────────────────────────────────

  @Get("alerts")
  getAlerts(@Req() req: Request) {
    return this.adminService.getAlerts((req.user as { role: UserRole }).role);
  }

  @Patch("alerts/:id/read")
  @HttpCode(HttpStatus.OK)
  markAlertRead(@Param("id") id: string, @Req() req: Request) {
    return this.adminService.markAlertRead(id, (req.user as { role: UserRole }).role);
  }

  @Patch("refunds/:id")
  @Roles(UserRole.SUPERADMIN)
  updateRefund(@Param("id") id: string, @Body() dto: UpdateRefundDto, @Req() req: Request) {
    return this.adminService.updateRefundStatus(id, dto.status, req.ip ?? "", dto.adminNote);
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

  @AdminAction("USER_QUARANTINE", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısını karantinaya aldı${reasonTr(c.body.reason)}`, targetUserId: c.params.id }))
  @Post("users/:id/quarantine")
  quarantineUser(@Param("id") id: string, @Body() dto: SanctionReasonDto, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.quarantineUser(id, actor.id, dto.reason);
  }

  @AdminAction("USER_BAN", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısını banladı${reasonTr(c.body.reason)}`, targetUserId: c.params.id }))
  @Post("users/:id/ban")
  banUser(@Param("id") id: string, @Body() dto: SanctionReasonDto, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.banUser(id, actor.id, dto.reason);
  }

  @AdminAction("USER_NO_SHOW_WARNING", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısına ${await c.meetingName(c.body.meetingId as string)} masasına gelmediği için uyarı verdi`, targetUserId: c.params.id }))
  @Post("users/:id/no-show-warning")
  giveNoShowWarning(@Param("id") id: string, @Body() dto: NoShowWarningDto, @Req() req: Request) {
    const actor = req.user as { id: string };
    return this.adminService.giveNoShowWarning(id, dto.meetingId, actor.id);
  }

  @AdminAction("USER_SANCTION", async (c) => {
    const verb = { WARNING: "uyarı verdi", SUSPENSION: "askıya aldı", BAN: "banladı" }[String(c.body.type)] ?? "yaptırım uyguladı";
    const until = c.body.expiresAt
      ? `, bitiş: ${new Date(String(c.body.expiresAt)).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" })}`
      : "";
    const name = await c.userName(c.params.id);
    const subject = c.body.type === "WARNING" ? `${name} kullanıcısına` : `${name} kullanıcısını`;
    return { text: `${subject} ${verb} (Sebep: ${c.body.reason}${until})`, targetUserId: c.params.id };
  })
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

  @AdminAction("USER_SANCTION_LIFT", async (c) => ({ text: `${await c.userName(c.params.id)} kullanıcısının yaptırımını kaldırdı`, targetUserId: c.params.id }))
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
  getUserSanctions(@Param("id") id: string, @Req() req: Request) {
    return this.adminService.getUserSanctions(id, (req.user as { role: UserRole }).role);
  }

  @Get("partnerships")
  @Roles(UserRole.SUPERADMIN)
  @KeepEmails()
  listPartnerships() {
    return this.adminService.listPartnerships();
  }

  @Patch("partnerships/:id")
  @Roles(UserRole.SUPERADMIN)
  @KeepEmails()
  updatePartnership(@Param("id") id: string, @Body() body: UpdatePartnershipDto) {
    return this.adminService.updatePartnership(id, body);
  }

  @Get("careers")
  @Roles(UserRole.SUPERADMIN)
  @KeepEmails()
  listCareers() {
    return this.adminService.listCareers();
  }

  @Patch("careers/:id")
  @Roles(UserRole.SUPERADMIN)
  @KeepEmails()
  updateCareer(@Param("id") id: string, @Body() body: UpdateCareerDto) {
    return this.adminService.updateCareer(id, body);
  }

}
