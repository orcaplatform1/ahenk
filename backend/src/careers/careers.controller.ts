import { Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CareersService } from './careers.service';
import { ApplyCareerDto, CareerSendOtpDto, CareerVerifyOtpDto } from './careers.dto';
import { CAREER_CV_MAX_BYTES } from './career-cv';

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
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: CAREER_CV_MAX_BYTES } }))
  apply(@Body() dto: ApplyCareerDto, @UploadedFile() file?: Express.Multer.File) {
    return this.service.apply(dto, file);
  }
}
