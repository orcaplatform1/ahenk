import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";
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

  @ApiPropertyOptional({ description: "İç not (kullanıcıya gösterilmez)" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
