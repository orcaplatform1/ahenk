import { Module } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { IyzicoService } from "./iyzico/iyzico.service";
import { PrismaModule } from "../prisma/prisma.module";
import { BullModule } from "@nestjs/bull";
import { ASSIGN_QUEUE } from "../matching/assign-queue";
import { NotificationModule } from "../notification/notification.module";
import { PricingService } from "./pricing.service";
import { WinbackService } from "./winback.service";
import { PrimeService } from "./prime.service";
import { StoreService } from "./store.service";

@Module({
  imports: [PrismaModule, NotificationModule, BullModule.registerQueue({ name: ASSIGN_QUEUE })],
  controllers: [PaymentController],
  providers: [PaymentService, IyzicoService, PricingService, WinbackService, PrimeService, StoreService],
  exports: [PaymentService, PricingService, WinbackService, PrimeService],
})
export class PaymentModule {}
