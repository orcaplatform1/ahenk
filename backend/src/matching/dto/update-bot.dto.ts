import { IsString, MinLength, MaxLength, IsBoolean, IsIn, IsDateString, Matches, IsNumber, Min, Max } from "class-validator";

// Bot ekleme ve düzenleme: tüm alanlar süperadmin tarafından elle girilir
export class BotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName: string;

  @IsIn(["MALE", "FEMALE"], { message: "Cinsiyet seçin" })
  gender: "MALE" | "FEMALE";

  @IsString()
  @MinLength(1, { message: "Meslek alanı seçin" })
  occupationSector: string;

  @IsDateString({}, { message: "Geçerli bir doğum tarihi girin" })
  birthDate: string;

  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir Türk telefon numarası girin" })
  phone: string;

  @IsString()
  @MinLength(1, { message: "Şehir seçin" })
  cityId: string;

  @IsNumber() @Min(0) @Max(100) openness: number;
  @IsNumber() @Min(0) @Max(100) conscientiousness: number;
  @IsNumber() @Min(0) @Max(100) extraversion: number;
  @IsNumber() @Min(0) @Max(100) agreeableness: number;
  @IsNumber() @Min(0) @Max(100) neuroticism: number;
}

export class SetBotStatusDto {
  @IsBoolean()
  active: boolean;
}
