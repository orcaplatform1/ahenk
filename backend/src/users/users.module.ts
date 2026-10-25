import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { OtpService } from "../auth/otp/otp.service";
import { WhatsappService } from "../auth/whatsapp/whatsapp.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService, OtpService, WhatsappService],
  exports: [UsersService],
})
export class UsersModule {}
