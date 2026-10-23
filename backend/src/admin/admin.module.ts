import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { MediaController } from "./media.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentModule } from "../payment/payment.module";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [PrismaModule, PaymentModule, NotificationModule],
  controllers: [AdminController, MediaController],
  providers: [AdminService, WhatsappNotifyService],
})
export class AdminModule {}
