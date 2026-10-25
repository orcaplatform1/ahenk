import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ASSIGN_QUEUE } from "../matching/assign-queue";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { KankaController } from "./kanka.controller";
import { KankaService } from "./kanka.service";

@Module({
  imports: [PrismaModule, NotificationModule, BullModule.registerQueue({ name: ASSIGN_QUEUE })],
  controllers: [KankaController],
  providers: [KankaService, WhatsappNotifyService],
  exports: [KankaService],
})
export class KankaModule {}
