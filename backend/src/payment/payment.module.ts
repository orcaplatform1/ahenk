import { Module } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { IyzicoService } from "./iyzico/iyzico.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [PaymentController],
  providers: [PaymentService, IyzicoService],
  exports: [PaymentService],
})
export class PaymentModule {}
