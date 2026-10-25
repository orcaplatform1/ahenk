import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyPartnershipDto } from './partnerships.dto';

@Injectable()
export class PartnershipsService {
  constructor(private prisma: PrismaService) {}

  async apply(dto: ApplyPartnershipDto) {
    const application = await this.prisma.partnershipApplication.create({
      data: {
        businessName: dto.businessName,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        city: dto.city,
        venueType: dto.venueType,
        capacity: dto.capacity,
        description: dto.description,
        websiteOrSocial: dto.websiteOrSocial,
      },
    });
    return { success: true, id: application.id };
  }
}
