import { Body, Controller, HttpCode, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PartnershipsService } from './partnerships.service';
import { ApplyPartnershipDto, PartnershipSendOtpDto, PartnershipVerifyOtpDto } from './partnerships.dto';
import { Throttle } from '@nestjs/throttler';
import { VENUE_PHOTO_MAX_BYTES, VENUE_PHOTO_MAX_COUNT } from '../venue-panel/venue-media';

@Controller('partnerships')
@Throttle({ default: { ttl: 60000, limit: 5 } })
export class PartnershipsController {
  constructor(private service: PartnershipsService) {}

  @Post('send-otp')
  @HttpCode(200)
  sendOtp(@Body() dto: PartnershipSendOtpDto) {
    return this.service.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyOtp(@Body() dto: PartnershipVerifyOtpDto) {
    return this.service.verifyOtp(dto.phone, dto.code);
  }

  @Post('apply')
  @UseInterceptors(FilesInterceptor('photos', VENUE_PHOTO_MAX_COUNT, { limits: { fileSize: VENUE_PHOTO_MAX_BYTES } }))
  apply(@Body() dto: ApplyPartnershipDto, @UploadedFiles() files: Express.Multer.File[]) {
    return this.service.apply(dto, files ?? []);
  }
}
