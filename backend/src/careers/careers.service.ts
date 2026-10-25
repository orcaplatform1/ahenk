import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyCareerDto } from './careers.dto';

@Injectable()
export class CareersService {
  constructor(private prisma: PrismaService) {}

  async apply(dto: ApplyCareerDto) {
    const application = await this.prisma.careerApplication.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        city: dto.city,
        linkedinOrCv: dto.linkedinOrCv,
        motivation: dto.motivation,
        hearFrom: dto.hearFrom,
      },
    });
    return { success: true, id: application.id };
  }
}
