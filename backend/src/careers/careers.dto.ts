import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PHONE = /^\+90[5][0-9]{9}$/;
const PHONE_MESSAGE = 'Geçerli bir Türk telefon numarası gir (+905XXXXXXXXX)';

export const EDUCATIONS = ['Lise', 'Önlisans', 'Lisans', 'Yüksek Lisans'];
export const LANGUAGES = ['İngilizce', 'Almanca', 'Arapça', 'Rusça', 'Fransızca', 'İspanyolca', 'İtalyanca'];
export const WORK_TYPES = ['Saha', 'Ofis', 'Uzaktan'];
export const SALARIES = ['Belirtmek istemiyorum', '35.000 - 45.000', '45.000 - 60.000', '60.000 - 80.000', '80.000 - 100.000'];
export const HEAR_FROM = ['Instagram', 'Google', 'Arkadaş tavsiyesi', 'Diğer'];

export class CareerSendOtpDto {
  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;
}

export class CareerVerifyOtpDto {
  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Kod 6 haneli olmalı' })
  code: string;
}

// multipart/form-data ile gelir: languages JSON metni, cv ayrı dosya alanında
export class ApplyCareerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @IsEmail({}, { message: 'Geçerli bir e-posta adresi gir' })
  email: string;

  @IsString()
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone: string;

  @IsString()
  @MinLength(10)
  @MaxLength(80)
  phoneToken: string;

  @IsIn(EDUCATIONS, { message: 'Öğrenim durumunu seç' })
  education: string;

  @IsString()
  @MaxLength(500)
  languages: string;

  @IsIn(WORK_TYPES, { message: 'Çalışma türünü seç' })
  workType: string;

  @IsIn(SALARIES, { message: 'Ücret beklentisini seç' })
  salaryExpectation: string;

  @IsDateString({}, { message: 'Doğum tarihini seç' })
  birthDate: string;

  @IsString()
  city: string;

  @IsString()
  @MinLength(2, { message: 'İlçe seç' })
  @MaxLength(60)
  district: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(300)
  @Matches(/^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\//i, { message: 'Geçerli bir LinkedIn bağlantısı gir' })
  linkedinOrCv?: string;

  @IsString()
  @MinLength(2, { message: 'Ahenk\'e neler katabileceğini yaz' })
  @MaxLength(600)
  motivation: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsIn(HEAR_FROM)
  hearFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hearFromOther?: string;
}
