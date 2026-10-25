import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyCareerDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  linkedinOrCv?: string;

  @IsString()
  @MaxLength(600)
  motivation: string;

  @IsOptional()
  @IsString()
  hearFrom?: string;
}
