import { IsOptional, IsString, MaxLength } from "class-validator";

export class LiveLayerQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  cityId?: string;
}
