import { BadRequestException, Body, CallHandler, Controller, ExecutionContext, HttpCode, Injectable, NestInterceptor, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PartnershipsService } from './partnerships.service';
import { ApplyPartnershipDto, PartnershipSendOtpDto, PartnershipVerifyOtpDto } from './partnerships.dto';
import { Throttle } from '@nestjs/throttler';
import { VENUE_PHOTO_MAX_BYTES, VENUE_PHOTO_MAX_COUNT } from '../venue-panel/venue-media';

// Birden fazla dosyada multer'ın İngilizce hatası ("Too many files" / "Unexpected file field - photos") Türkçe mesaja çevrilir;
// FilesInterceptor'dan önce sıralanır, onun hatasını yakalar
@Injectable()
class SinglePhotoErrorInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(catchError((err: unknown) => {
      const msg = err instanceof BadRequestException ? String((err.getResponse() as { message?: unknown }).message ?? err.message) : '';
      if (/^(Too many files|Unexpected (file )?field)/.test(msg)) return throwError(() => new BadRequestException('Yalnızca 1 fotoğraf yükleyebilirsin.'));
      return throwError(() => err);
    }));
  }
}

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
  @UseInterceptors(SinglePhotoErrorInterceptor, FilesInterceptor('photos', VENUE_PHOTO_MAX_COUNT, { limits: { fileSize: VENUE_PHOTO_MAX_BYTES, files: VENUE_PHOTO_MAX_COUNT } }))
  apply(@Body() dto: ApplyPartnershipDto, @UploadedFiles() files: Express.Multer.File[]) {
    return this.service.apply(dto, files ?? []);
  }
}
