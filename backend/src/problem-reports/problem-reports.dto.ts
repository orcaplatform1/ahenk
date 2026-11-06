import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ProblemReportPlatform } from "../generated/prisma/client";

export class CreateProblemReportDto {
  @IsEnum(ProblemReportPlatform)
  platform: ProblemReportPlatform;

  // Bildirildiği ekran / sayfa adı
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  screen: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  @IsString()
  @IsNotEmpty({ message: "Açıklama zorunludur" })
  @MaxLength(5000)
  description: string;
}
