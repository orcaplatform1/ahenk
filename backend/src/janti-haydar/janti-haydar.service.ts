import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OTP_RESEND_SECONDS, OtpService } from '../auth/otp/otp.service';
import { JantiApplyDto } from './janti-haydar.dto';
import { assertJantiFiles, JANTI_FILES_DIR, JANTI_MIME, JantiStoredFile, removeJantiFiles, saveJantiFiles } from './janti-haydar-files';

const OTP_SCOPE = 'janti';
const PHONE_TOKEN_TTL = 30 * 60; // Üye kaydıyla aynı: doğrulama 30 dk geçerli
const phoneKey = (phone: string) => `jantiphone:${phone}`;
// Telefon bazlı sınır: aynı numaradan 24 saatte en fazla 3 talep
const PHONE_LIMIT = 3;
const PHONE_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class JantiHaydarService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private otp: OtpService,
  ) {}

  private async assertPhoneQuota(phone: string) {
    const recent = await this.prisma.jantiHaydarRequest.count({
      where: { phone, createdAt: { gte: new Date(Date.now() - PHONE_WINDOW_MS) } },
    });
    if (recent >= PHONE_LIMIT) {
      throw new HttpException('Bu numarayla çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async sendOtp(phone: string) {
    await this.assertPhoneQuota(phone);
    await this.otp.send(phone, OTP_SCOPE);
    return { message: 'Doğrulama kodu gönderildi', resendSeconds: OTP_RESEND_SECONDS };
  }

  async verifyOtp(phone: string, code: string) {
    await this.otp.verify(phone, code, OTP_SCOPE);
    const phoneToken = randomUUID();
    await this.redis.set(phoneKey(phone), phoneToken, PHONE_TOKEN_TTL);
    return { phoneToken };
  }

  async apply(dto: JantiApplyDto, files: Express.Multer.File[]) {
    // Bal küpü doluysa bot: kayıt yapılmaz, bota başarılı yanıt verilir
    if (dto.company?.trim()) return { success: true };

    assertJantiFiles(files);
    const stored = await this.redis.get(phoneKey(dto.phone));
    if (!stored || stored !== dto.phoneToken) {
      throw new BadRequestException('Telefon numaranızı WhatsApp koduyla doğrulayın');
    }
    await this.assertPhoneQuota(dto.phone);

    const saved = await saveJantiFiles(files);
    try {
      const created = await this.prisma.jantiHaydarRequest.create({
        data: {
          fullName: dto.fullName.trim(),
          phone: dto.phone,
          adTypes: dto.adTypes,
          storyOwner: dto.storyOwner,
          websiteOrSocial: dto.websiteOrSocial?.trim() || null,
          message: dto.message.trim(),
          files: saved as unknown as object,
        },
      });
      await this.redis.del(phoneKey(dto.phone));
      return { success: true, id: created.id };
    } catch (err) {
      removeJantiFiles(saved);
      throw err;
    }
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async list() {
    return this.prisma.jantiHaydarRequest.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async filePath(id: string, index: number) {
    const r = await this.prisma.jantiHaydarRequest.findUnique({ where: { id }, select: { files: true } });
    const list = (Array.isArray(r?.files) ? r?.files : []) as unknown as JantiStoredFile[];
    const f = list[index];
    if (!f) throw new NotFoundException('Dosya bulunamadı');
    const filePath = path.join(JANTI_FILES_DIR, path.basename(f.file));
    if (!fs.existsSync(filePath)) throw new NotFoundException('Dosya bulunamadı');
    return { filePath, name: f.originalName || f.file, mime: JANTI_MIME[f.type] ?? 'application/octet-stream' };
  }
}
