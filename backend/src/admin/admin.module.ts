import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentModule } from "../payment/payment.module";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { StorageService } from "../storage/storage.service";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [PrismaModule, PaymentModule, NotificationModule],
  controllers: [AdminController],
  providers: [AdminService, WhatsappNotifyService, StorageService],
})
export class AdminModule {}
