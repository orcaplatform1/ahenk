import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { MeetingsService } from "./meetings.service";
import { MeetingsController } from "./meetings.controller";
import { AiReportService } from "./ai-report.service";
import { BotFillProcessor, BOT_FILL_QUEUE } from "./bot-fill.processor";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    NotificationModule,
    BullModule.registerQueue({ name: BOT_FILL_QUEUE }),
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService, AiReportService, BotFillProcessor],
  exports: [AiReportService],
})
export class MeetingsModule {}
