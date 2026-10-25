import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { UsersService } from "../../users/users.service";
import { ACCESS_COOKIE } from "../auth-cookies";

export interface JwtPayload {
  sub: string;   // userId
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      // Önce Authorization: Bearer (uygulama istemcileri), yoksa HttpOnly çerez (web)
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => req?.cookies?.[ACCESS_COOKIE] ?? null,
      ]),
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Oturum geçersiz");
    }
    return user;
  }
}
