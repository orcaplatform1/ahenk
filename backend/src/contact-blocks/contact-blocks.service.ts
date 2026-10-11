import { Injectable, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const MAX_BLOCKS = 50;

@Injectable()
export class ContactBlocksService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const blocks = await this.prisma.contactBlock.findMany({
      where: { userId },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { count: blocks.length, items: blocks };
  }

  async sync(userId: string, hashedPhones: string[]) {
    const existing = await this.prisma.contactBlock.count({ where: { userId } });

    const unique = [...new Set(hashedPhones)];
    const newCount = unique.length;

    if (existing + newCount > MAX_BLOCKS) {
      throw new BadRequestException(
        `En fazla ${MAX_BLOCKS} numara engellenebilir. Mevcut: ${existing}, Eklenecek: ${newCount}`,
      );
    }

    const created = await Promise.all(
      unique.map((hashedPhone) =>
        this.prisma.contactBlock.upsert({
          where: { userId_hashedPhone: { userId, hashedPhone } },
          update: {},
          create: { userId, hashedPhone },
        }),
      ),
    );

    return { synced: created.length };
  }

  async remove(userId: string, blockId: string) {
    const block = await this.prisma.contactBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new BadRequestException("Kayıt bulunamadı");
    if (block.userId !== userId) throw new ForbiddenException("Bu kayıt size ait değil");
    await this.prisma.contactBlock.delete({ where: { id: blockId } });
    return { deleted: true };
  }
}
