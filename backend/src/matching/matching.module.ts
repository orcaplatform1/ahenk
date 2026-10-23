import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { MatchingService } from "./matching.service";
import { MatchingController } from "./matching.controller";
import { MatchingScheduler } from "./matching.scheduler";
import { MATCHING_QUEUE } from "./matching.constants";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { MeetingsModule } from "../meetings/meetings.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    MeetingsModule,
    ConfigModule,
    BullModule.registerQueue({ name: MATCHING_QUEUE }),
  ],
  controllers: [MatchingController],
  providers: [MatchingService, MatchingScheduler],
  exports: [MatchingService],
})
export class MatchingModule {}
