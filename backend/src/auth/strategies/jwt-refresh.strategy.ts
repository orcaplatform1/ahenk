import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { UsersService } from "../../users/users.service";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.["refresh_token"] ?? null,
      ]),
      secretOrKey: config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      passReqToCallback: true,
      ignoreExpiration: false,
    });
  }

  async validate(req: Request, payload: { sub: string; email: string; jti: string }) {
    const rawToken = req.cookies?.["refresh_token"];
    if (!rawToken) throw new UnauthorizedException("Refresh token bulunamadı");

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Oturum geçersiz");
    }

    // jti ile DB'deki token'ı eşleştirmek için sub + jti dön
    return { ...user, refreshTokenJti: payload.jti };
  }
}
