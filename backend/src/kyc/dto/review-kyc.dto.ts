import { IsEnum, IsOptional, IsString, Matches, MaxLength, ValidateIf } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { KycStatus } from "@prisma/client";

const REVIEWABLE_STATUSES = [
  KycStatus.APPROVED,
  KycStatus.REJECTED,
  KycStatus.SUSPICIOUS,
] as const;

export class ReviewKycDto {
  @ApiProperty({ enum: REVIEWABLE_STATUSES })
  @IsEnum(REVIEWABLE_STATUSES, { message: "Geçerli durum: APPROVED, REJECTED, SUSPICIOUS" })
  status: (typeof REVIEWABLE_STATUSES)[number];

  @ApiPropertyOptional({ description: "Ret/şüphe nedeni (kullanıcıya gösterilir)" })
  @ValidateIf((o) => o.status === KycStatus.REJECTED || o.status === KycStatus.SUSPICIOUS)
  @IsString({ message: "Ret nedeni zorunludur" })
  @MaxLength(500)
  rejectReason?: string;

  // Onayda zorunlu: admin kimlik görselinden girer (şifreli saklanır, sadece ödemede iyzico'ya gider)
  @ApiPropertyOptional({ description: "TC kimlik no (onayda zorunlu)" })
  @ValidateIf((o) => o.status === KycStatus.APPROVED)
  @Matches(/^\d{11}$/, { message: "TC kimlik numarası 11 haneli olmalı" })
  identityNumber?: string;

  @ApiPropertyOptional({ description: "İç not (kullanıcıya gösterilmez)" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

// Daha önce TC girilmeden onaylanmış başvuruya TC ekleme
export class SetIdentityNumberDto {
  @Matches(/^\d{11}$/, { message: "TC kimlik numarası 11 haneli olmalı" })
  identityNumber: string;
}
