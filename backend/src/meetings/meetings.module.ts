import { Module } from "@nestjs/common";
import { MeetingsService } from "./meetings.service";
import { MeetingsController } from "./meetings.controller";
import { AiReportService } from "./ai-report.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [PrismaModule, ConfigModule, NotificationModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, AiReportService],
  exports: [AiReportService],
})
export class MeetingsModule {}
