import { IsString, MinLength } from "class-validator";

export class RegisterTokenDto {
  @IsString()
  @MinLength(10)
  token: string;
}
