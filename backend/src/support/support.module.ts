import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { VenueAuthGuard } from "../venue-panel/venue-auth.guard";
import { SupportService } from "./support.service";
import { SupportAiService } from "./support-ai.service";
import { SupportAgentController, SupportManageController, SupportMemberController, SupportVenueController } from "./support.controller";

// Canlı destek (CLAUDE.md CANLI DESTEK). Literal yollu controller'lar önce: "admin/live-support/manage"
@Module({
  imports: [PrismaModule, NotificationModule, JwtModule.register({})],
  controllers: [SupportVenueController, SupportMemberController, SupportManageController, SupportAgentController],
  providers: [SupportService, SupportAiService, VenueAuthGuard],
  exports: [SupportService],
})
export class SupportModule {}
