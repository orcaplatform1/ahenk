import { Controller, Post, Patch, Get, Body, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum, Matches, IsEmail } from "class-validator";
import { VenuePreference } from "@prisma/client";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

class SaveCitiesDto {
  @IsString()
  primaryCityId: string;
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
  constructor(private usersService: UsersService) {}

  @Post("cities")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Şehir tercihlerini kaydet" })
  saveCities(@CurrentUser() user: any, @Body() dto: SaveCitiesDto) {
    return this.usersService.saveCities(user.id, dto.primaryCityId);
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

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil bilgilerini getir" })
  getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.id);
  }

  @Post("change-phone/request")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Telefon değiştirme OTP gönder" })
  requestPhoneChange(@CurrentUser() user: any, @Body() dto: RequestPhoneChangeDto) {
    return this.usersService.requestPhoneChange(user.id, dto.phone);
  }

  @Post("change-phone/verify")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Telefon değiştirme OTP doğrula" })
  verifyPhoneChange(@CurrentUser() user: any, @Body() dto: VerifyPhoneChangeDto) {
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
