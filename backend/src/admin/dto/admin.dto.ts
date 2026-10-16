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
} from "class-validator";
import { UserStatus, UserRole, SubscriptionPlan, VenueCategory, VenueType, SanctionType } from "@prisma/client";

// ─── Kullanıcı ────────────────────────────────────────────────────────────────

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
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

  @IsOptional()
  @IsInt()
  @Min(0)
  weeklyTableLimit?: number;
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
  @IsInt()
  @Min(0)
  @Max(10000)
  weeklyTableLimit?: number;

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
