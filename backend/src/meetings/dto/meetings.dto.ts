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
} from "class-validator";
import { Transform } from "class-transformer";

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
  // "İptal nedenini belirtin" — zorunlu; yalnızca boşluk kabul edilmez
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: "İptal nedenini belirtin" })
  @MaxLength(300, { message: "İptal nedeni en fazla 300 karakter olabilir" })
  note: string;
}

// Masa kartından gelmeyen işaretleme (geri alınamaz)
export class MarkNoShowDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds: string[];
}
