import { IsString, Matches } from "class-validator";
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
