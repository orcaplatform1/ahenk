import { IsE164Phone } from "../../common/phone";
import { IsIn, IsOptional, IsString, Matches, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendLoginOtpDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @IsE164Phone()
  phone: string;
}

export class VerifyLoginOtpDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @IsE164Phone()
  phone: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: "OTP 6 haneli bir sayı olmalı" })
  code: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @IsE164Phone()
  phone: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @IsE164Phone()
  phone: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: "OTP 6 haneli bir sayı olmalı" })
  code: string;

  @ApiProperty()
  @IsString()
  @MinLength(6, { message: "Şifre en az 6 karakter olmalı" })
  @MaxLength(20, { message: "Şifre en fazla 20 karakter olabilir" })
  newPassword: string;
}

// Kayıt: telefon doğrulama (hesap oluşmadan önce)
export class RegisterSendOtpDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @IsE164Phone()
  phone: string;

  // Arayüz dili: OTP WhatsApp şablonunun dil kodu
  @IsOptional()
  @IsIn(["tr", "en"])
  language?: string;
}

export class RegisterVerifyOtpDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @IsE164Phone()
  phone: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: "OTP 6 haneli bir sayı olmalı" })
  code: string;
}
