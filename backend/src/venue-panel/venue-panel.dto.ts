import { IsEmail, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { VenueType } from "@prisma/client";
import { GOOGLE_MAPS_URL, GOOGLE_MAPS_URL_MESSAGE } from "./venue-url";

const PASSWORD_MIN = { message: "Şifre en az 6 karakter olmalı" };
const PASSWORD_MAX = { message: "Şifre en fazla 20 karakter olabilir" };

export class VenueLoginDto {
  @IsEmail({}, { message: "Geçerli bir e-posta adresi girin" })
  email: string;

  @IsString()
  @MaxLength(20)
  password: string;
}

export class VenueForgotPasswordDto {
  @IsEmail({}, { message: "Geçerli bir e-posta adresi girin" })
  email: string;
}

export class VenueResetPasswordDto {
  @IsEmail({}, { message: "Geçerli bir e-posta adresi girin" })
  email: string;

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: "Kod 6 haneli olmalı" })
  code: string;

  @IsString()
  @MinLength(6, PASSWORD_MIN)
  @MaxLength(20, PASSWORD_MAX)
  newPassword: string;
}

export class VenueChangePasswordDto {
  @IsString()
  @MaxLength(20)
  currentPassword: string;

  @IsString()
  @MinLength(6, PASSWORD_MIN)
  @MaxLength(20, PASSWORD_MAX)
  newPassword: string;
}

export class VenueDeactivateDto {
  @IsString()
  @MaxLength(20)
  password: string;
}

export class VenueCapacityDto {
  @IsISO8601()
  weekStart: string;

  @IsInt()
  @Min(0)
  @Max(500)
  capacity: number;
}

export class VenueInfoDto {
  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsString() @MinLength(5, { message: "Açık adres girin" }) @MaxLength(300)
  address?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  district?: string;

  @IsOptional() @IsString() @MaxLength(500) @Matches(GOOGLE_MAPS_URL, { message: GOOGLE_MAPS_URL_MESSAGE })
  locationUrl?: string;

  @IsOptional() @IsString() @MaxLength(300)
  websiteOrSocial?: string;

  @IsOptional() @IsEnum(VenueType)
  venueType?: VenueType;
}

export class VenuePhotoDeleteDto {
  @IsString()
  @MaxLength(300)
  url: string;
}
