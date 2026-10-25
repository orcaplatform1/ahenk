import { IsEmail, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "kullanici@ornek.com" })
  @IsEmail({}, { message: "Geçerli bir e-posta adresi girin" })
  email: string;

  @ApiProperty({ example: "Güçlü1Şifre!" })
  @IsString()
  @MinLength(1, { message: "Şifre boş olamaz" })
  password: string;
}
