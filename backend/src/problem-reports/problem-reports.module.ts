import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationModule } from "../notification/notification.module";
import { AdminProblemReportsController, ProblemReportsController } from "./problem-reports.controller";
import { ProblemReportsService } from "./problem-reports.service";

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [ProblemReportsController, AdminProblemReportsController],
  providers: [ProblemReportsService],
})
export class ProblemReportsModule {}
