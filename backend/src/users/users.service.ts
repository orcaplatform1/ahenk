import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OtpService } from "../auth/otp/otp.service";
import { VenuePreference } from "@prisma/client";
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

  async saveCities(userId: string, primaryCityId: string) {
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
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeCity: activeCityId },
    });
    return { ok: true };
  }

  async requestPhoneChange(userId: string, newPhone: string) {
    const existing = await this.prisma.user.findUnique({ where: { phone: newPhone } });
    if (existing && existing.id !== userId) throw new ConflictException("Bu telefon numarası kullanılmaktadır.");
    await this.otpService.send(newPhone);
    return { ok: true };
  }

  async verifyPhoneChange(userId: string, newPhone: string, code: string) {
    await this.otpService.verify(newPhone, code);
    await this.prisma.user.update({ where: { id: userId }, data: { phone: newPhone } });
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

  async resetAllActiveCities() {
    await this.prisma.user.updateMany({ data: { activeCity: null } });
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
