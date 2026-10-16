import {
  IsArray,
  IsString,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
  IsOptional,
  MaxLength,
  IsEnum,
} from "class-validator";
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

  @IsOptional()
  @IsString()
  @MaxLength(300)
  comment?: string;
}

export class CancelRegistrationDto {
  @IsEnum(LeaveReason)
  reason: LeaveReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
