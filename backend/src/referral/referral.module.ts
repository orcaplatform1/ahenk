import { Module } from "@nestjs/common";
import { ReferralService } from "./referral.service";
import { ReferralController } from "./referral.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ReferralController],
  providers: [ReferralService, WhatsappNotifyService],
  exports: [ReferralService],
})
export class ReferralModule {}
