import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { VenueType } from '@prisma/client';
import { GOOGLE_MAPS_URL, GOOGLE_MAPS_URL_MESSAGE } from '../venue-panel/venue-url';

const PHONE = /^\+90[5][0-9]{9}$/;
const PHONE_MESSAGE = 'Geçerli bir Türk telefon numarası girin (+905XXXXXXXXX)';

export class PartnershipSendOtpDto {
  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;
}

export class PartnershipVerifyOtpDto {
  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Kod 6 haneli olmalı' })
  code: string;
}

// multipart/form-data ile gelir: sayısal alan metinden çevrilir, fotoğraflar ayrı dosya alanında
export class ApplyPartnershipDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName: string;

  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email: string;

  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @MinLength(10)
  @MaxLength(80)
  phoneToken: string;

  // Üye kaydıyla aynı kural
  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalı' })
  @MaxLength(20, { message: 'Şifre en fazla 20 karakter olabilir' })
  password: string;

  @IsString()
  city: string;

  @IsString()
  venueType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capacity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  websiteOrSocial?: string;

  @IsString()
  @MinLength(5, { message: 'Açık adres girin' })
  @MaxLength(300)
  address: string;

  @IsString()
  @MaxLength(500)
  @Matches(GOOGLE_MAPS_URL, { message: GOOGLE_MAPS_URL_MESSAGE })
  locationUrl: string;

  @IsEnum(VenueType, { message: 'Alkol durumunu seçin' })
  alcoholStatus: VenueType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceCode?: string;
}
