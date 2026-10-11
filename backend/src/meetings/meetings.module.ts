import { Module } from "@nestjs/common";
import { MeetingsService } from "./meetings.service";
import { MeetingsController } from "./meetings.controller";
import { AiReportService } from "./ai-report.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, AiReportService],
  exports: [AiReportService],
})
export class MeetingsModule {}
