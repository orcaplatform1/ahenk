import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";
import { FcmService } from "./fcm/fcm.service";
import { WhatsappNotifyService } from "./whatsapp-notify.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, FcmService, WhatsappNotifyService],
  exports: [NotificationService, WhatsappNotifyService, FcmService],
})
export class NotificationModule {}
