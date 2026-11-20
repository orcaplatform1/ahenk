import { IsE164Phone } from "../common/phone";
import { Controller, Post, Patch, Get, Put, Delete, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { Request } from "express";
import { LoginGuardService } from "../auth/login-guard.service";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum, Matches, IsEmail, IsIn, IsBoolean, IsNotEmpty, MaxLength } from "class-validator";
import { VenuePreference } from "../generated/prisma/client";
import { UsersService } from "./users.service";
import { AccountDeletionService } from "./account-deletion.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

class UpdateLanguageDto {
  @IsIn(["tr", "en"])
  language: string;
}

class UpdateSpokenLanguagesDto {
  @IsOptional()
  @IsBoolean()
  speaksEnglish?: boolean;

  @IsOptional()
  @IsBoolean()
  speaksTurkish?: boolean;
}

// Acil durum kişisi (en fazla 1): ad + E.164 telefon (giriş / kayıttaki ülke listesi)
class EmergencyContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsE164Phone()
  phone: string;
}

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
  @IsE164Phone()
  phone: string;
}

class VerifyPhoneChangeDto {
  @IsE164Phone()
  phone: string;
  @Matches(/^[0-9]{6}$/, { message: "6 haneli kod gir" })
  code: string;
}

class ChangeEmailDto {
  @IsEmail({}, { message: "Geçerli bir e-posta adresi gir" })
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

  // Tanıtım ("Nasıl Çalışır") son adımda Başla ya da herhangi bir adımda Atla: User.onboardingSeenAt (yalnız ilk kez doldurulur)
  @Post("me/onboarding-seen")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Tanıtım akışı görüldü" })
  markOnboardingSeen(@CurrentUser() user: any) {
    return this.usersService.markOnboardingSeen(user.id);
  }

  @Patch("me/language")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Arayüz dilini hesaba kaydet (tr | en)" })
  updateLanguage(@CurrentUser() user: any, @Body() dto: UpdateLanguageDto) {
    return this.usersService.updateLanguage(user.id, dto.language);
  }

  @Patch("me/spoken-languages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "İngilizce / Türkçe biliyorum (dil bazlı eşleşme)" })
  updateSpokenLanguages(@CurrentUser() user: any, @Body() dto: UpdateSpokenLanguagesDto) {
    return this.usersService.updateSpokenLanguages(user.id, dto);
  }

  @Get("me/emergency-contact")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getEmergencyContact(@CurrentUser() user: any) {
    return this.usersService.getEmergencyContact(user.id);
  }

  @Put("me/emergency-contact")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Acil durum kişisi ekle / düzenle (Acil Yardım talebinde WhatsApp bildirimi)" })
  setEmergencyContact(@CurrentUser() user: any, @Body() dto: EmergencyContactDto) {
    return this.usersService.setEmergencyContact(user.id, dto.name.trim(), dto.phone);
  }

  @Delete("me/emergency-contact")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  deleteEmergencyContact(@CurrentUser() user: any) {
    return this.usersService.setEmergencyContact(user.id, null, null);
  }

  @Post("me/region-waitlist/:cityId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Pasif bölge için \"Haber ver\" (bekleme listesi; aynı bölgeye bir kez)" })
  joinRegionWaitlist(@CurrentUser() user: any, @Param("cityId") cityId: string) {
    return this.usersService.joinRegionWaitlist(user.id, cityId);
  }

  @Get("me/region-waitlist")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Kullanıcının \"Haber ver\" dediği bölgeler" })
  myRegionWaitlist(@CurrentUser() user: any) {
    return this.usersService.myRegionWaitlist(user.id);
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
