import { IsString, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

// R2 anahtar formatı: kyc/{userId}/{timestamp}-{type}.{ext}
const KEY_PATTERN = /^kyc\/[a-z0-9]+\/\d+-(id-front|id-back|liveness)\.[a-z0-9]+$/;

export class SubmitKycDto {
  @ApiProperty({ example: "kyc/abc123/1700000000000-id-front.jpeg" })
  @IsString()
  @Matches(KEY_PATTERN, { message: "Geçersiz kimlik ön yüz anahtarı" })
  idFrontKey: string;

  @ApiProperty({ example: "kyc/abc123/1700000000001-id-back.jpeg" })
  @IsString()
  @Matches(KEY_PATTERN, { message: "Geçersiz kimlik arka yüz anahtarı" })
  idBackKey: string;

  @ApiProperty({ example: "kyc/abc123/1700000000002-liveness.mp4" })
  @IsString()
  @Matches(KEY_PATTERN, { message: "Geçersiz liveness video anahtarı" })
  livenessKey: string;
}
