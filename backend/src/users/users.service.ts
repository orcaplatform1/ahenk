import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OtpService } from "../auth/otp/otp.service";
import { VenuePreference, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private otpService: OtpService,
  ) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        kyc: { select: { status: true } },
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      include: { profile: true },
    });
  }

  // Sadece aktif şehir seçilebilir (pasif şehirler kayıtta ve profilde listelenmez)
  private async assertActiveCity(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { isActive: true } });
    if (!city?.isActive) throw new BadRequestException("Bu şehir şu an aktif değil");
  }

  async saveCities(userId: string, primaryCityId: string) {
    await this.assertActiveCity(primaryCityId);
    await this.prisma.profile.update({
      where: { userId },
      data: { primaryCity: primaryCityId },
    });
    return { ok: true };
  }

  async updateVenuePreference(userId: string, venuePreference: VenuePreference) {
    await this.prisma.profile.update({
      where: { userId },
      data: { venuePreference },
    });
    return { ok: true };
  }

  async updateActiveCity(userId: string, activeCityId: string | null) {
    if (activeCityId) await this.assertActiveCity(activeCityId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeCity: activeCityId },
    });
    return { ok: true };
  }

  async requestPhoneChange(userId: string, newPhone: string) {
    const existing = await this.prisma.user.findUnique({ where: { phone: newPhone } });
    if (existing && existing.id === userId) throw new BadRequestException("Bu numara zaten hesabınızda kayıtlı.");
    if (existing) throw new ConflictException("Bu telefon numarası kullanılmaktadır.");
    await this.otpService.send(newPhone);
    return { ok: true };
  }

  async verifyPhoneChange(userId: string, newPhone: string, code: string) {
    // Kod gönderildikten sonra numara başka hesaba geçmiş olabilir → kod harcanmadan kontrol
    const existing = await this.prisma.user.findUnique({ where: { phone: newPhone } });
    if (existing && existing.id !== userId) throw new ConflictException("Bu telefon numarası kullanılmaktadır.");
    await this.otpService.verify(newPhone, code);
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { phone: newPhone } });
    } catch (e) {
      // Kontrol ile kayıt arasında aynı numara alınmışsa (unique ihlali)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Bu telefon numarası kullanılmaktadır.");
      }
      throw e;
    }
    return { ok: true };
  }

  async changeEmail(userId: string, newEmail: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new BadRequestException("Şifre bulunamadı.");
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException("Şifrenizi yanlış girdiniz.");
    const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== userId) throw new ConflictException("Bu e-posta adresi kullanılmaktadır.");
    await this.prisma.user.update({ where: { id: userId }, data: { email: newEmail } });
    return { ok: true };
  }

  async getProfile(userId: string) {
    return this.prisma.profile.findUnique({
      where: { userId },
      select: {
        firstName: true, lastName: true, gender: true, bio: true,
        city: true, primaryCity: true,
        venuePreference: true, topicPreferences: true, venueCategories: true,
        isPioneer: true, isPublic: true, avatarUrl: true,
      },
    });
  }
}
