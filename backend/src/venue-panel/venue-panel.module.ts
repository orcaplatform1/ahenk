import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationModule } from "../notification/notification.module";
import { VenuePanelController } from "./venue-panel.controller";
import { VenuePanelService } from "./venue-panel.service";
import { VenueAssignmentService } from "./venue-assignment.service";
import { VenueAuthGuard } from "./venue-auth.guard";

@Module({
  imports: [PrismaModule, AuthModule, NotificationModule, JwtModule.register({})],
  controllers: [VenuePanelController],
  providers: [VenuePanelService, VenueAssignmentService, VenueAuthGuard],
  exports: [VenueAssignmentService],
})
export class VenuePanelModule {}
