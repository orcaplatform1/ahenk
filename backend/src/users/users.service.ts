import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { VenuePreference } from "@prisma/client";

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

  async updateVenuePreference(userId: string, venuePreference: VenuePreference) {
    await this.prisma.profile.update({
      where: { userId },
      data: { venuePreference },
    });
    return { ok: true };
  }

  async getProfile(userId: string) {
    return this.prisma.profile.findUnique({
      where: { userId },
      select: {
        firstName: true, lastName: true, gender: true, bio: true,
        city: true, primaryCity: true, secondaryCity: true,
        venuePreference: true, topicPreferences: true, venueCategories: true,
        isPioneer: true, isPublic: true, avatarUrl: true,
      },
    });
  }
}
