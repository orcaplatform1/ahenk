import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PHONE = /^\+90[5][0-9]{9}$/;
const PHONE_MESSAGE = 'Geçerli bir Türk telefon numarası girin (+905XXXXXXXXX)';

export const JANTI_AD_TYPES = ['Post Animasyonu', 'Story Animasyonu', 'Reels Animasyonu'] as const;
export const JANTI_STORY_OWNERS = ['Ekibe ait', 'Bana ait', 'Ortak çalışma'] as const;

export class JantiSendOtpDto {
  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;
}

export class JantiVerifyOtpDto {
  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Kod 6 haneli olmalı' })
  code: string;
}

// multipart/form-data ile gelir: reklam türleri tekrarlanan "adTypes" alanı, dosyalar "files" alanı
export class JantiApplyDto {
  @IsString()
  @MinLength(2, { message: 'Ad soyad girin' })
  @MaxLength(120)
  fullName: string;

  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @MinLength(10)
  @MaxLength(80)
  phoneToken: string;

  @Transform(({ value }) => (Array.isArray(value) ? value : value === undefined || value === '' ? [] : [value]))
  @IsArray()
  @ArrayMinSize(1, { message: 'En az 1 reklam türü seçin' })
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(JANTI_AD_TYPES as unknown as string[], { each: true, message: 'Geçersiz reklam türü' })
  adTypes: string[];

  @IsIn(JANTI_STORY_OWNERS as unknown as string[], { message: 'Kurgu seçin' })
  storyOwner: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  websiteOrSocial?: string;

  @IsString()
  @MinLength(20, { message: 'Mesajınız çok kısa' })
  @MaxLength(300, { message: 'Mesajınız çok uzun' })
  message: string;

  // Bal küpü: gerçek kullanıcı görmez, botlar doldurur
  @IsOptional()
  @IsString()
  @MaxLength(500)
  company?: string;
}
