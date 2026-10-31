import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OTP_RESEND_SECONDS, OtpService } from '../auth/otp/otp.service';
import { ApplyPartnershipDto } from './partnerships.dto';
import { isValidDistrict } from '../common/districts';
import { assertVenuePhotos, removeVenuePhotoDir, saveVenuePhotos } from '../venue-panel/venue-media';

const PHONE_TOKEN_TTL = 30 * 60; // Üye kaydıyla aynı: doğrulama 30 dk geçerli
const phoneKey = (phone: string) => `venuephone:${phone}`;

@Injectable()
export class PartnershipsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private otp: OtpService,
  ) {}

  private async assertPhoneFree(phone: string) {
    const used = await this.prisma.venueAccount.findFirst({
      where: { phone, status: { in: ['PENDING', 'ACTIVE'] } },
      select: { id: true },
    });
    if (used) throw new ConflictException('Bu telefon numarasıyla kayıtlı bir mekân var');
  }

  async sendOtp(phone: string) {
    await this.assertPhoneFree(phone);
    await this.otp.send(phone);
    return { message: 'Doğrulama kodu gönderildi', resendSeconds: OTP_RESEND_SECONDS };
  }

  async verifyOtp(phone: string, code: string) {
    await this.otp.verify(phone, code);
    const phoneToken = randomUUID();
    await this.redis.set(phoneKey(phone), phoneToken, PHONE_TOKEN_TTL);
    return { phoneToken };
  }

  async apply(dto: ApplyPartnershipDto, files: Express.Multer.File[]) {
    if (files.length === 0) throw new BadRequestException('En az 1 mekân fotoğrafı yükleyin');
    assertVenuePhotos(files);
    if (!isValidDistrict(dto.city, dto.district)) throw new BadRequestException('Geçerli bir ilçe seçin');

    const stored = await this.redis.get(phoneKey(dto.phone));
    if (!stored || stored !== dto.phoneToken) {
      throw new BadRequestException('Telefon numaranızı WhatsApp koduyla doğrulayın');
    }
    await this.assertPhoneFree(dto.phone);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.venueAccount.findUnique({ where: { email }, select: { id: true, status: true } });
    // Reddedilen mekân aynı e-postayla yeniden başvurabilir
    if (existing && existing.status !== 'REJECTED') {
      throw new ConflictException('Bu e-posta ile kayıtlı bir mekân var');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const photoKey = randomBytes(12).toString('hex');
    const photos = saveVenuePhotos(photoKey, files);

    try {
      const application = await this.prisma.$transaction(async (tx) => {
        const created = await tx.partnershipApplication.create({
          data: {
            businessName: dto.businessName,
            contactName: dto.contactName,
            email,
            phone: dto.phone,
            city: dto.city,
            venueType: dto.venueType,
            capacity: dto.capacity,
            description: dto.description,
            websiteOrSocial: dto.websiteOrSocial,
            address: dto.address,
            district: dto.district,
            locationUrl: dto.locationUrl,
            alcoholStatus: dto.alcoholStatus,
            referenceCode: dto.referenceCode?.trim() || null,
            photos,
          },
        });
        const account = { applicationId: created.id, phone: dto.phone, passwordHash, status: 'PENDING' as const, registeredAt: new Date() };
        if (existing) await tx.venueAccount.update({ where: { id: existing.id }, data: account });
        else await tx.venueAccount.create({ data: { ...account, email } });
        return created;
      });
      await this.redis.del(phoneKey(dto.phone));
      return { success: true, id: application.id };
    } catch (err) {
      removeVenuePhotoDir(photoKey);
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu e-posta ile kayıtlı bir mekân var');
      }
      throw err;
    }
  }
}
