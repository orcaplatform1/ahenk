import {
  IsArray,
  IsString,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
  IsOptional,
  MaxLength,
  MinLength,
  IsEnum,
} from "class-validator";
import { Transform } from "class-transformer";
import { LeaveReason } from "@prisma/client";

export class BlockUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  blockedUserIds: string[];
}

export class ReviewMeetingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedUserIds?: string[];

  // Masaya katılmadığı bildirilen kullanıcılar
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  noShowUserIds?: string[];

  // "Masa beklentilerini karşıladı mı?" — zorunlu
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(20, { message: "Beklenti yorumu en az 20 karakter olmalı" })
  @MaxLength(300, { message: "Beklenti yorumu en fazla 300 karakter olabilir" })
  comment: string;
}

export class CancelRegistrationDto {
  @IsEnum(LeaveReason)
  reason: LeaveReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// Masa kartından gelmeyen işaretleme (geri alınamaz)
export class MarkNoShowDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds: string[];
}
