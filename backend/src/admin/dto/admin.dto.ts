import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsBoolean,
  IsArray,
  MinLength,
  MaxLength,
  ArrayMinSize,
  IsNotEmpty,
  IsIn,
  IsEmail,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SANCTION_REASONS } from "../sanction-reasons";
import { UserStatus, UserRole, SubscriptionPlan, VenueCategory, VenueType, SanctionType, PartnershipStatus, CareerStatus } from "@prisma/client";

// ─── Kullanıcı ────────────────────────────────────────────────────────────────

// Admin kişisel bilgi düzenleme; e-posta yalnızca SUPERADMIN
export class AdminUpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) firstName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) lastName?: string;
  @IsOptional() @IsIn(["MALE", "FEMALE"], { message: "Geçersiz cinsiyet" }) gender?: "MALE" | "FEMALE";
  @IsOptional() @IsDateString({}, { message: "Geçerli bir doğum tarihi girin" }) birthDate?: string;
  @IsOptional() @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin" }) phone?: string;
  @IsOptional() @IsString() @MinLength(1) cityId?: string;
  @IsOptional() @IsString() @MinLength(1) occupationSector?: string;
  @IsOptional() @IsEmail({}, { message: "Geçerli bir e-posta adresi girin" }) email?: string;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  // SUSPENDED / BANNED için seçilen sebep (boşsa "Yönetici kararı")
  @IsOptional()
  @IsIn(SANCTION_REASONS, { message: "Geçersiz sebep" })
  reason?: string;
}

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class GrantFreeSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// ─── Masa ──────────────────────────────────────────────────────────────────────

export class UpdateMeetingVenueDto {
  @IsOptional()
  @IsString()
  locationText?: string;

  @IsOptional()
  @IsString()
  locationUrl?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CreateManualMeetingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title: string;

  @IsDateString()
  scheduledAt: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  participantIds: string[];

  @IsOptional()
  @IsString()
  locationText?: string;

  @IsOptional()
  @IsString()
  locationUrl?: string;
}

export class ExtendMeetingDeadlineDto {
  @IsInt()
  @Min(1)
  @Max(72)
  extraHours: number;
}

// ─── Mekan ─────────────────────────────────────────────────────────────────────

export class CreateVenueDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(VenueCategory)
  category: VenueCategory;

  @IsOptional()
  @IsEnum(VenueType)
  venueType?: VenueType;

  @IsString()
  cityId: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;
}

export class UpdateVenueDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(VenueCategory)
  category?: VenueCategory;

  @IsOptional()
  @IsEnum(VenueType)
  venueType?: VenueType;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;
}

// ─── Şehir ─────────────────────────────────────────────────────────────────────

export class CreateCityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;
}

export class UpdateCityDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Abonelik ──────────────────────────────────────────────────────────────────

export class CancelSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelNote?: string;
}

// ─── Sistem ayarları ───────────────────────────────────────────────────────────

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  matchingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  botSystemActive?: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}


export class CreateSanctionDto {
  @IsEnum(['WARNING', 'SUSPENSION', 'BAN'])
  type: 'WARNING' | 'SUSPENSION' | 'BAN';

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// ─── Mekan fotoğrafları / adres ─────────────────────────────────────────────
// Boş string → alan temizlenir

export class UpdateVenuePhotosDto {
  @IsOptional() @IsString() @MaxLength(300) venueAddress?: string;
  @IsOptional() @IsString() @MaxLength(500) venuePhotoUrl?: string;
  @IsOptional() @IsString() @MaxLength(80)  venuePhotoCaption1?: string;
  @IsOptional() @IsString() @MaxLength(500) venuePhoto2Url?: string;
  @IsOptional() @IsString() @MaxLength(80)  venuePhotoCaption2?: string;
  @IsOptional() @IsString() @MaxLength(500) venuePhoto3Url?: string;
  @IsOptional() @IsString() @MaxLength(80)  venuePhotoCaption3?: string;
}

// ─── Masaya bot yerleştir ────────────────────────────────────────────────────

export class PlaceBotDto {
  @IsString()
  @IsNotEmpty()
  botUserId: string;
}

// ─── Karantina / Ban sebebi ──────────────────────────────────────────────────

export class SanctionReasonDto {
  @IsOptional()
  @IsIn(SANCTION_REASONS, { message: "Geçersiz sebep" })
  reason?: string;
}

export class NoShowWarningDto {
  @IsString()
  @IsNotEmpty()
  meetingId: string;
}

// ─── Başvurular ────────────────────────────────────────────────────────────────

export class UpdatePartnershipDto {
  @IsOptional()
  @IsEnum(PartnershipStatus)
  status?: PartnershipStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

export class UpdateCareerDto {
  @IsOptional()
  @IsEnum(CareerStatus)
  status?: CareerStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

// SUPERADMIN paket fiyatı: ham (KDV hariç) fiyat, kuruş
export class PlanNetPriceDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsInt()
  @Min(100, { message: "Ham fiyat en az 1 ₺ olmalı" })
  @Max(10_000_000)
  netKurus: number;
}

export class UpdatePricesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanNetPriceDto)
  prices: PlanNetPriceDto[];
}
