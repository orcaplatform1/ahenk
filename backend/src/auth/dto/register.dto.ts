import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "kullanici@ornek.com" })
  @IsEmail({}, { message: "Geçerli bir e-posta adresi girin" })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: "Şifre en az 6 karakter olmalı" })
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

  @ApiProperty({ description: "Kullanım şartları kabul edildi" })
  @IsBoolean({ message: "Kullanım şartlarını kabul etmelisiniz" })
  acceptTerms: boolean;

  // Zorunlu ve WhatsApp OTP ile doğrulanmış olmalı (POST /auth/register/verify-otp → phoneToken)
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin (+905XXXXXXXXX)" })
  phoneNumber: string;

  @ApiProperty({ description: "Telefon doğrulama anahtarı (register/verify-otp yanıtı)" })
  @IsString({ message: "Telefon numaranızı doğrulayın" })
  phoneToken: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryCityId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: "Meslek alanı seçin" })
  occupationSector: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralCode?: string;
}
