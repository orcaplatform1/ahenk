import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { SupportAgentStatus, SupportTopic } from "../generated/prisma/client";

export class StartChatDto {
  @IsEnum(SupportTopic) topic!: SupportTopic;
}

export class MessageDto {
  @IsOptional() @IsString() @MaxLength(2000) content?: string;
}

export class TypingDto {
  @IsOptional() @IsString() @MaxLength(2000) text?: string;
}

export class RatingDto {
  @IsBoolean() helped!: boolean;
  @IsInt() @Min(1) @Max(5) stars!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class AgentStatusDto {
  @IsEnum(SupportAgentStatus) status!: SupportAgentStatus;
}

export class NoteDto {
  @IsString() @MaxLength(2000) content!: string;
}

export class TransferDto {
  @IsString() toAgentId!: string;
  @IsString() @MaxLength(2000) note!: string;
}

export class CloseDto {
  @IsOptional() @Type(() => Number) @IsIn([1, 7, 30]) abuseDays?: number;
  // Kötüye kullanım sebebi: abuseDays ile zorunlu, boşluklar hariç en az 5 karakter (servis denetler)
  @IsOptional() @IsString() @MaxLength(1000) abuseReason?: string;
}

export class AiDto {
  @IsOptional() @IsString() @MaxLength(2000) question?: string;
  @IsOptional() @IsBoolean() draft?: boolean;
  @IsOptional() @IsBoolean() includeImages?: boolean;
}

export class CannedDto {
  @IsString() @MaxLength(120) title!: string;
  @IsString() @MaxLength(2000) content!: string;
}

export class CreateAgentDto {
  @IsString() @MaxLength(60) firstName!: string;
  @IsString() @MaxLength(60) lastName!: string;
  @IsString() @MaxLength(200) email!: string;
  @IsString() @MaxLength(30) phone!: string;
  @IsString() @MaxLength(200) password!: string;
}

export class AgentActiveDto {
  @IsBoolean() active!: boolean;
}

export class SupportSettingsDto {
  @IsOptional() @IsInt() @Min(1) @Max(50) maxChats?: number;
  @IsOptional() @IsString() @MaxLength(11) shiftDay?: string;
  @IsOptional() @IsString() @MaxLength(11) shiftNight?: string;
}
