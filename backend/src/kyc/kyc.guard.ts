import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { KycStatus } from "../generated/prisma/client";

/**
 * Abonelik satın alımı gibi KYC gerektiren endpoint'lere eklenir.
 * Kayıt, OCEAN testi ve dashboard KYC gerektirmez.
 *
 * Kullanım: @UseGuards(JwtAuthGuard, KycGuard)
 */
@Injectable()
export class KycGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.id) return false;

    const kyc = await this.prisma.kycSubmission.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });

    if (kyc?.status === KycStatus.APPROVED) return true;

    const hint =
      !kyc
        ? "Bu işlem için kimlik doğrulaması (KYC) gereklidir. Lütfen önce KYC başvurusu yap."
        : kyc.status === KycStatus.PENDING
          ? "KYC başvurun inceleniyor. Onaylanınca bu işlemi yapabilirsin."
          : kyc.status === KycStatus.REJECTED
            ? "KYC başvurun reddedildi. Lütfen yeniden başvur."
            : "KYC başvurun şüpheli olarak işaretlendi. Lütfen destek ile iletişime geç.";

    throw new ForbiddenException(hint);
  }
}
