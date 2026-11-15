import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { OtpService } from "../auth/otp/otp.service";
import { WhatsappService } from "../auth/whatsapp/whatsapp.service";
import { NotificationModule } from "../notification/notification.module";
import { AccountDeletionService } from "./account-deletion.service";
import { LoginGuardService } from "../auth/login-guard.service";

@Module({
  imports: [NotificationModule],
  controllers: [UsersController],
  providers: [UsersService, OtpService, WhatsappService, AccountDeletionService, LoginGuardService],
  exports: [UsersService, AccountDeletionService],
})
export class UsersModule {}
