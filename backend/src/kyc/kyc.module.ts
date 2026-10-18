import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";
import { KycGuard } from "./kyc.guard";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [
    NotificationModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [KycController],
  providers: [KycService, KycGuard],
  exports: [KycService, KycGuard],
})
export class KycModule {}
