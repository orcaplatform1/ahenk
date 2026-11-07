import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JantiHaydarService } from './janti-haydar.service';
import { InstagramService } from './instagram.service';
import { JantiApplyDto, JantiSendOtpDto, JantiVerifyOtpDto } from './janti-haydar.dto';
import { JANTI_MAX_FILES, JANTI_MAX_TOTAL_BYTES } from './janti-haydar-files';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/client';

// Herkese açık teklif formu: IP bazlı sınır (dakikada 5), telefon bazlı sınır serviste (24 saatte 3 talep)
@Controller('janti-haydar')
@Throttle({ default: { ttl: 60000, limit: 5 } })
export class JantiHaydarController {
  constructor(private service: JantiHaydarService, private instagram: InstagramService) {}

  @Post('send-otp')
  @HttpCode(200)
  sendOtp(@Body() dto: JantiSendOtpDto) {
    return this.service.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyOtp(@Body() dto: JantiVerifyOtpDto) {
    return this.service.verifyOtp(dto.phone, dto.code);
  }

  // Tek dosya sınırı toplam sınıra eşit; 3 dosyanın toplamı serviste kontrol edilir
  @Post('apply')
  @UseInterceptors(FilesInterceptor('files', JANTI_MAX_FILES, { limits: { fileSize: JANTI_MAX_TOTAL_BYTES, files: JANTI_MAX_FILES } }))
  apply(@Body() dto: JantiApplyDto, @UploadedFiles() files: Express.Multer.File[]) {
    return this.service.apply(dto, files ?? []);
  }

  // Instagram istatistikleri (sunucuda 1 saat önbellek); yapılandırılmamışsa null
  @Get('instagram')
  @SkipThrottle()
  async instagramStats() {
    return { stats: await this.instagram.stats() };
  }
}

@SkipThrottle()
@Controller('admin/janti-haydar')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
export class JantiHaydarAdminController {
  constructor(private service: JantiHaydarService) {}

  @Get()
  list() {
    return this.service.list();
  }

  // ?download=1 → indir; yoksa tarayıcıda görüntüle
  @Get(':id/files/:index')
  async file(@Param('id') id: string, @Param('index', ParseIntPipe) index: number, @Query('download') download: string | undefined, @Res() res: Response) {
    const { filePath, name, mime } = await this.service.filePath(id, index);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (download === '1') return res.download(filePath, name);
    res.type(mime);
    res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
    return res.sendFile(filePath);
  }
}
