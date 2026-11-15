import { Body, Controller, HttpCode, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CareersService } from './careers.service';
import { ApplyCareerDto, CareerSendOtpDto, CareerVerifyOtpDto } from './careers.dto';
import { CAREER_PHOTO_MAX_BYTES } from './career-cv';

@Controller('careers')
@Throttle({ default: { ttl: 60000, limit: 5 } })
export class CareersController {
  constructor(private service: CareersService) {}

  @Post('send-otp')
  @HttpCode(200)
  sendOtp(@Body() dto: CareerSendOtpDto) {
    return this.service.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyOtp(@Body() dto: CareerVerifyOtpDto) {
    return this.service.verifyOtp(dto.phone, dto.code);
  }

  @Post('apply')
  // cv: tek dosya (en fazla 5 MB, serviste kontrol); photo: zorunlu, en fazla 1 fotoğraf
  @UseInterceptors(FileFieldsInterceptor([{ name: 'cv', maxCount: 1 }, { name: 'photo', maxCount: 1 }], { limits: { fileSize: CAREER_PHOTO_MAX_BYTES } }))
  apply(@Body() dto: ApplyCareerDto, @UploadedFiles() files?: { cv?: Express.Multer.File[]; photo?: Express.Multer.File[] }) {
    return this.service.apply(dto, files?.cv?.[0], files?.photo?.[0]);
  }
}
