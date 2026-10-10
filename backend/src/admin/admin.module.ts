import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentModule } from "../payment/payment.module";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";

@Module({
  imports: [PrismaModule, PaymentModule],
  controllers: [AdminController],
  providers: [AdminService, WhatsappNotifyService],
})
export class AdminModule {}
