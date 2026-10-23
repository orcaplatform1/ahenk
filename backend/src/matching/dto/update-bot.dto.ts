import { IsString, MinLength, MaxLength, IsBoolean } from "class-validator";

export class UpdateBotNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;
}

export class SetBotStatusDto {
  @IsBoolean()
  active: boolean;
}
