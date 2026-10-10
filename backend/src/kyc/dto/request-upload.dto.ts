import { IsString, IsIn, IsInt, Min, Max } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export class RequestUploadDto {
  @ApiProperty({ enum: IMAGE_TYPES, example: "image/jpeg" })
  @IsString()
  @IsIn(IMAGE_TYPES, { message: "Kimlik ön yüzü için JPEG, PNG veya WebP girin" })
  idFrontMime: string;

  @ApiProperty({ description: "Bayt cinsinden boyut", example: 1048576 })
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024, { message: "Fotoğraf en fazla 5 MB olabilir" })
  idFrontSize: number;

  @ApiProperty({ enum: IMAGE_TYPES, example: "image/jpeg" })
  @IsString()
  @IsIn(IMAGE_TYPES, { message: "Kimlik arka yüzü için JPEG, PNG veya WebP girin" })
  idBackMime: string;

  @ApiProperty({ description: "Bayt cinsinden boyut", example: 1048576 })
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024, { message: "Fotoğraf en fazla 5 MB olabilir" })
  idBackSize: number;

  @ApiProperty({ enum: VIDEO_TYPES, example: "video/mp4" })
  @IsString()
  @IsIn(VIDEO_TYPES, { message: "Liveness videosu için MP4, WebM veya MOV girin" })
  livenessMime: string;

  @ApiProperty({ description: "Bayt cinsinden boyut", example: 20971520 })
  @IsInt()
  @Min(1)
  @Max(80 * 1024 * 1024, { message: "Video en fazla 80 MB olabilir" })
  livenessSize: number;
}
