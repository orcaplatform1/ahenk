import { IsString, Matches, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendOtpDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @Matches(/^\+90[0-9]{10}$/, { message: "Geçerli bir Türk telefon numarası girin (+905XXXXXXXXX)" })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @Matches(/^\+90[0-9]{10}$/, { message: "Geçerli bir Türk telefon numarası girin" })
  phone: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: "OTP 6 haneli bir sayı olmalı" })
  code: string;
}

export class SendLoginOtpDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin (+905XXXXXXXXX)" })
  phone: string;
}

export class VerifyLoginOtpDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin" })
  phone: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: "OTP 6 haneli bir sayı olmalı" })
  code: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin" })
  phone: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: "+905551234567" })
  @IsString()
  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin" })
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
