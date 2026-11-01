import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OTP_RESEND_SECONDS, OtpService } from '../auth/otp/otp.service';
import { isValidDistrict } from '../common/districts';
import { ApplyCareerDto, LANGUAGES } from './careers.dto';
import { assertCv, saveCv } from './career-cv';

const PHONE_TOKEN_TTL = 30 * 60;
const OTP_SCOPE = 'career';
const phoneKey = (phone: string) => `careerphone:${phone}`;

function parseLanguages(raw: string): { name: string; level: number }[] {
  let list: unknown;
  try { list = JSON.parse(raw); } catch { list = null; }
  if (!Array.isArray(list) || list.length === 0) throw new BadRequestException('En az bir yabancı dil seçin');
  const seen = new Set<string>();
  return list.map((item) => {
    const { name, level } = (item ?? {}) as { name?: unknown; level?: unknown };
    if (typeof name !== 'string' || !LANGUAGES.includes(name) || seen.has(name)) throw new BadRequestException('Geçersiz yabancı dil');
    if (level !== 1 && level !== 2 && level !== 3) throw new BadRequestException('Her dil için seviye seçin');
    seen.add(name);
    return { name, level };
  });
}

@Injectable()
export class CareersService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private otp: OtpService,
  ) {}

  async sendOtp(phone: string) {
    await this.otp.send(phone, OTP_SCOPE);
    return { message: 'Doğrulama kodu gönderildi', resendSeconds: OTP_RESEND_SECONDS };
  }

  async verifyOtp(phone: string, code: string) {
    await this.otp.verify(phone, code, OTP_SCOPE);
    const phoneToken = randomUUID();
    await this.redis.set(phoneKey(phone), phoneToken, PHONE_TOKEN_TTL);
    return { phoneToken };
  }

  async apply(dto: ApplyCareerDto, file?: Express.Multer.File) {
    assertCv(file);
    const languages = parseLanguages(dto.languages);
    const city = await this.prisma.city.findFirst({ where: { name: dto.city, isActive: true }, select: { id: true } });
    if (!city) throw new BadRequestException('Geçerli bir şehir seçin');
    if (!isValidDistrict(dto.city, dto.district)) throw new BadRequestException('Geçerli bir ilçe seçin');

    const stored = await this.redis.get(phoneKey(dto.phone));
    if (!stored || stored !== dto.phoneToken) {
      throw new BadRequestException('Telefon numaranızı WhatsApp koduyla doğrulayın');
    }

    const application = await this.prisma.careerApplication.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone,
        city: dto.city,
        district: dto.district,
        education: dto.education,
        languages,
        workType: dto.workType,
        salaryExpectation: dto.salaryExpectation,
        birthDate: dto.birthDate.slice(0, 10),
        linkedinOrCv: dto.linkedinOrCv,
        motivation: dto.motivation,
        hearFrom: dto.hearFrom,
        hearFromOther: dto.hearFrom === 'Diğer' ? dto.hearFromOther?.trim() || null : null,
        cvFile: saveCv(file),
        cvOriginalName: file.originalname.slice(0, 200),
      },
    });
    await this.redis.del(phoneKey(dto.phone));
    return { success: true, id: application.id };
  }
}
