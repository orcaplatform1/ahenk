import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { OtpService } from "../auth/otp/otp.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService, OtpService],
  exports: [UsersService],
})
export class UsersModule {}
