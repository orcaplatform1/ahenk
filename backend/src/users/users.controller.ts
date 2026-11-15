import { Controller, Post, Patch, Get, Body, Req, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { Request } from "express";
import { LoginGuardService } from "../auth/login-guard.service";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum, Matches, IsEmail } from "class-validator";
import { VenuePreference } from "../generated/prisma/client";
import { UsersService } from "./users.service";
import { AccountDeletionService } from "./account-deletion.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

class UpdateVenuePreferenceDto {
  @IsEnum(VenuePreference)
  venuePreference: VenuePreference;
}

class UpdateActiveCityDto {
  @IsOptional()
  @IsString()
  activeCityId?: string | null;
}

class RequestPhoneChangeDto {
  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin (+905XXXXXXXXX)" })
  phone: string;
}

class VerifyPhoneChangeDto {
  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin" })
  phone: string;
  @Matches(/^[0-9]{6}$/, { message: "6 haneli kod girin" })
  code: string;
}

class ChangeEmailDto {
  @IsEmail({}, { message: "Geçerli bir e-posta adresi girin" })
  email: string;
  @IsString()
  currentPassword: string;
}

@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(
    private usersService: UsersService,
    private accountDeletion: AccountDeletionService,
    private loginGuard: LoginGuardService,
  ) {}

  @Get("me/deletion-request")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Bekleyen hesap silme talebi" })
  async getDeletionRequest(@CurrentUser() user: any) {
    return { request: await this.accountDeletion.pendingOf(user.id) };
  }

  @Post("me/deletion-request")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Hesap silme talebi oluştur" })
  requestDeletion(@CurrentUser() user: any) {
    return this.accountDeletion.request(user.id);
  }

  @Patch("venue-preference")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mekan tercihi güncelle" })
  updateVenuePreference(@CurrentUser() user: any, @Body() dto: UpdateVenuePreferenceDto) {
    return this.usersService.updateVenuePreference(user.id, dto.venuePreference);
  }

  @Patch("active-city")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Bu haftaki aktif şehri güncelle" })
  updateActiveCity(@CurrentUser() user: any, @Body() dto: UpdateActiveCityDto) {
    return this.usersService.updateActiveCity(user.id, dto.activeCityId ?? null);
  }

  @Post("change-phone/request")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Telefon değiştirme OTP gönder" })
  async requestPhoneChange(@CurrentUser() user: any, @Req() req: Request, @Body() dto: RequestPhoneChangeDto) {
    await this.loginGuard.hit("change-phone-request", req.ip, dto.phone);
    return this.usersService.requestPhoneChange(user.id, dto.phone);
  }

  @Post("change-phone/verify")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Telefon değiştirme OTP doğrula" })
  async verifyPhoneChange(@CurrentUser() user: any, @Req() req: Request, @Body() dto: VerifyPhoneChangeDto) {
    await this.loginGuard.hit("change-phone-verify", req.ip, dto.phone);
    return this.usersService.verifyPhoneChange(user.id, dto.phone, dto.code);
  }

  @Patch("change-email")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "E-posta değiştir" })
  changeEmail(@CurrentUser() user: any, @Body() dto: ChangeEmailDto) {
    return this.usersService.changeEmail(user.id, dto.email, dto.currentPassword);
  }
}
