import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { MeetingsService } from "./meetings.service";
import { MeetingsController } from "./meetings.controller";
import { AiReportService } from "./ai-report.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import { NotificationModule } from "../notification/notification.module";
import { ASSIGN_QUEUE } from "../matching/assign-queue";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    NotificationModule,
    BullModule.registerQueue({ name: ASSIGN_QUEUE }),
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService, AiReportService],
  exports: [AiReportService],
})
export class MeetingsModule {}
