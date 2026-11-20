import { IsString, MaxLength, IsNotEmpty, IsEnum, IsOptional } from "class-validator";
import { ChatReportReason } from "../../generated/prisma/client";

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}

export class ReportMessageDto {
  @IsEnum(ChatReportReason)
  reason: ChatReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
