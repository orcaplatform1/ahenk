import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Abonelik satın alımı gibi test tamamlanmasını gerektiren endpoint'lere eklenir.
 * Kayıt ve dashboard test gerektirmez.
 *
 * Kullanım: @UseGuards(JwtAuthGuard, TestCompletedGuard)
 */
@Injectable()
export class TestCompletedGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.id) return false;

    const score = await this.prisma.oceanScore.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (score) return true;

    throw new ForbiddenException(
      "Bu işlem için kişilik testini tamamlaman gerekiyor. Lütfen önce testi yap.",
    );
  }
}
