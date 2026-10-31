import { VenuePanelModule } from "../venue-panel/venue-panel.module";
import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { MediaController } from "./media.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentModule } from "../payment/payment.module";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { NotificationModule } from "../notification/notification.module";
import { KycModule } from "../kyc/kyc.module";
import { BullModule } from "@nestjs/bull";
import { ASSIGN_QUEUE } from "../matching/assign-queue";
import { MatchingModule } from "../matching/matching.module";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AdminActionInterceptor } from "./admin-action-log";

@Module({
  imports: [PrismaModule, PaymentModule, NotificationModule, KycModule, MatchingModule, VenuePanelModule, BullModule.registerQueue({ name: ASSIGN_QUEUE })],
  controllers: [AdminController, MediaController],
  // ADMIN işlem kaydı tüm controller'larda @AdminAction etiketli uç noktalar için çalışır
  providers: [AdminService, WhatsappNotifyService, { provide: APP_INTERCEPTOR, useClass: AdminActionInterceptor }],
})
export class AdminModule {}
