import { IsArray, IsString, ArrayMinSize, IsInt, Min, Max, IsOptional, MaxLength } from "class-validator";

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
