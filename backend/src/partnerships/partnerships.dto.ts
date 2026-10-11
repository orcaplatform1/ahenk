import { IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ApplyPartnershipDto {
  @IsString()
  businessName: string;

  @IsString()
  contactName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  city: string;

  @IsString()
  venueType: string;

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
  websiteOrSocial?: string;
}
