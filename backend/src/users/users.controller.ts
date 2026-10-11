import { Controller, Post, Patch, Get, Body, UseGuards, HttpCode, HttpStatus, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum } from "class-validator";
import { VenuePreference } from "@prisma/client";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

class SaveCitiesDto {
  @IsString()
  primaryCityId: string;

  @IsOptional()
  @IsString()
  secondaryCityId?: string;
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
    return this.usersService.saveCities(user.id, dto.primaryCityId, dto.secondaryCityId);
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
}
