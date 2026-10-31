import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { VenueAccount } from "@prisma/client";
import { Request, Response } from "express";
import { VENUE_COOKIE } from "../auth/auth-cookies";
import { VenueAuthGuard } from "./venue-auth.guard";
import { VENUE_SESSION_DAYS, VenuePanelService } from "./venue-panel.service";
import { VENUE_PHOTO_MAX_BYTES, VENUE_PHOTO_MAX_COUNT } from "./venue-media";
import {
  VenueCapacityDto, VenueChangePasswordDto, VenueDeactivateDto, VenueForgotPasswordDto,
  VenueInfoDto, VenueLoginDto, VenuePhotoDeleteDto, VenueResetPasswordDto,
} from "./venue-panel.dto";

type VenueRequest = Request & { venueAccount: VenueAccount };

@Controller("venue-panel")
@Throttle({ default: { ttl: 60000, limit: 60 } })
export class VenuePanelController {
  constructor(
    private service: VenuePanelService,
    private config: ConfigService,
  ) {}

  private cookieOptions() {
    const production = this.config.get("NODE_ENV") === "production";
    return {
      httpOnly: true,
      secure: production,
      sameSite: production ? ("strict" as const) : ("lax" as const),
      path: "/api/v1/venue-panel",
    };
  }

  private setSession(res: Response, token: string) {
    res.cookie(VENUE_COOKIE, token, { ...this.cookieOptions(), maxAge: VENUE_SESSION_DAYS * 24 * 60 * 60 * 1000 });
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(@Body() dto: VenueLoginDto, @Res({ passthrough: true }) res: Response) {
    this.setSession(res, await this.service.login(dto.email, dto.password));
    return { success: true };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(VENUE_COOKIE, this.cookieOptions());
    return { success: true };
  }

  @Post("forgot-password")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  forgotPassword(@Body() dto: VenueForgotPasswordDto) {
    return this.service.forgotPassword(dto.email);
  }

  @Post("reset-password")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  resetPassword(@Body() dto: VenueResetPasswordDto) {
    return this.service.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Get("me")
  @UseGuards(VenueAuthGuard)
  me(@Req() req: VenueRequest) {
    return this.service.me(req.venueAccount);
  }

  @Get("capacity")
  @UseGuards(VenueAuthGuard)
  getCapacity(@Req() req: VenueRequest) {
    return this.service.getCapacity(req.venueAccount);
  }

  @Put("capacity")
  @UseGuards(VenueAuthGuard)
  setCapacity(@Req() req: VenueRequest, @Body() dto: VenueCapacityDto) {
    return this.service.setCapacity(req.venueAccount, dto);
  }

  @Patch("info")
  @UseGuards(VenueAuthGuard)
  updateInfo(@Req() req: VenueRequest, @Body() dto: VenueInfoDto) {
    return this.service.updateInfo(req.venueAccount, dto);
  }

  @Post("photos")
  @UseGuards(VenueAuthGuard)
  @UseInterceptors(FilesInterceptor("photos", VENUE_PHOTO_MAX_COUNT, { limits: { fileSize: VENUE_PHOTO_MAX_BYTES } }))
  addPhotos(@Req() req: VenueRequest, @UploadedFiles() files: Express.Multer.File[]) {
    return this.service.addPhotos(req.venueAccount, files);
  }

  @Delete("photos")
  @UseGuards(VenueAuthGuard)
  removePhoto(@Req() req: VenueRequest, @Body() dto: VenuePhotoDeleteDto) {
    return this.service.removePhoto(req.venueAccount, dto.url);
  }

  @Get("meetings")
  @UseGuards(VenueAuthGuard)
  meetings(@Req() req: VenueRequest) {
    return this.service.meetings(req.venueAccount);
  }

  @Post("change-password")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(VenueAuthGuard)
  async changePassword(@Req() req: VenueRequest, @Body() dto: VenueChangePasswordDto, @Res({ passthrough: true }) res: Response) {
    this.setSession(res, await this.service.changePassword(req.venueAccount, dto.currentPassword, dto.newPassword));
    return { success: true };
  }

  @Post("deactivate")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(VenueAuthGuard)
  async deactivate(@Req() req: VenueRequest, @Body() dto: VenueDeactivateDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.deactivate(req.venueAccount, dto.password);
    res.clearCookie(VENUE_COOKIE, this.cookieOptions());
    return result;
  }
}
