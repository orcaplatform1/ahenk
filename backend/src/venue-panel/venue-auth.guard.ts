import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { VENUE_COOKIE } from "../auth/auth-cookies";

// Mekân oturumu kullanıcı oturumundan ayrı: türetilmiş gizli anahtar, üye JWT'si burada geçmez (tersi de)
export function venueJwtSecret(config: ConfigService): string {
  return `${config.getOrThrow<string>("JWT_SECRET")}:venue`;
}

@Injectable()
export class VenueAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.[VENUE_COOKIE];
    if (!token) throw new UnauthorizedException("Oturum bulunamadı");

    let payload: { sub: string; tv: number };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: venueJwtSecret(this.config) });
    } catch {
      throw new UnauthorizedException("Oturum süresi doldu");
    }

    // Her istekte durum kontrolü: pasife alınan hesap ve eski oturum anında düşer
    const account = await this.prisma.venueAccount.findUnique({ where: { id: payload.sub } });
    if (!account || account.status !== "ACTIVE" || !account.venueId || account.tokenVersion !== payload.tv) {
      throw new UnauthorizedException("Oturum geçersiz");
    }
    req.venueAccount = account;
    return true;
  }
}
