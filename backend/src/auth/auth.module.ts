import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtRefreshStrategy } from "./strategies/jwt-refresh.strategy";
import { OtpService } from "./otp/otp.service";
import { WhatsappService } from "./whatsapp/whatsapp.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // Seçenekler signAsync'te dinamik verilir
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, OtpService, WhatsappService],
  exports: [AuthService, JwtStrategy, OtpService],
})
export class AuthModule {}
