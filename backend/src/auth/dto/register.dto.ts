import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "kullanici@ornek.com" })
  @IsEmail({}, { message: "Geçerli bir e-posta adresi girin" })
  email: string;

  @ApiProperty({ example: "Güçlü1Şifre!" })
  @IsString()
  @MinLength(8, { message: "Şifre en az 8 karakter olmalı" })
  @MaxLength(20, { message: "Şifre en fazla 20 karakter olabilir" })
  password: string;

  @ApiProperty({ example: "Ayşe" })
  @IsString()
  @MinLength(2, { message: "Ad en az 2 karakter olmalı" })
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: "Yılmaz" })
  @IsString()
  @MinLength(2, { message: "Soyad en az 2 karakter olmalı" })
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({ example: "+905551234567" })
  @IsOptional()
  @Matches(/^\+90[0-9]{10}$/, { message: "Geçerli bir Türk telefon numarası girin (+905XXXXXXXXX)" })
  phone?: string;

  @ApiProperty({ description: "Kullanım şartları kabul edildi" })
  @IsBoolean({ message: "Kullanım şartlarını kabul etmelisiniz" })
  acceptTerms: boolean;

  @ApiPropertyOptional({ description: "Pazarlama iletişimlerine onay" })
  @IsOptional()
  @IsBoolean()
  acceptMarketing?: boolean;
}
