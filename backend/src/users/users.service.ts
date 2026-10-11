import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  async saveCities(userId: string, primaryCityId: string, secondaryCityId?: string) {
    await this.prisma.profile.update({
      where: { userId },
      data: {
        primaryCity: primaryCityId,
        secondaryCity: secondaryCityId ?? null,
      },
    });
    return { ok: true };
  }
}
