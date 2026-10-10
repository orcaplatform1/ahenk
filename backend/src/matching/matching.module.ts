import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { MatchingService } from "./matching.service";
import { MatchingController } from "./matching.controller";
import { MatchingProcessor } from "./matching.processor";
import { MatchingScheduler } from "./matching.scheduler";
import { MATCHING_QUEUE } from "./matching.constants";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    BullModule.registerQueue({ name: MATCHING_QUEUE }),
  ],
  controllers: [MatchingController],
  providers: [MatchingService, MatchingProcessor, MatchingScheduler],
  exports: [MatchingService],
})
export class MatchingModule {}
