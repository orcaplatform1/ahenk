import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";
import { NotificationScheduler } from "./notification.scheduler";
import { FcmService } from "./fcm/fcm.service";
import { WhatsappNotifyService } from "./whatsapp-notify.service";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
  imports: [PrismaModule, PaymentModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationScheduler, FcmService, WhatsappNotifyService],
  exports: [NotificationService, WhatsappNotifyService, FcmService],
})
export class NotificationModule {}
