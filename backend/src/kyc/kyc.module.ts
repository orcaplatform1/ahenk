import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { randomUUID } from "crypto";
import * as fs from "fs";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";
import { KycGuard } from "./kyc.guard";
import { NotificationModule } from "../notification/notification.module";
import { BullModule } from "@nestjs/bull";
import { ASSIGN_QUEUE } from "../matching/assign-queue";
import { KYC_TMP_DIR } from "./kyc.service";

@Module({
  imports: [
    NotificationModule,
    BullModule.registerQueue({ name: ASSIGN_QUEUE }),
    // Dosyalar RAM'e değil geçici klasöre akarak yazılır; doğrulama sonrası kullanıcı klasörüne taşınır
    MulterModule.register({
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          fs.mkdirSync(KYC_TMP_DIR, { recursive: true });
          cb(null, KYC_TMP_DIR);
        },
        filename: (_req, _file, cb) => cb(null, randomUUID()),
      }),
    }),
  ],
  controllers: [KycController],
  providers: [KycService, KycGuard],
  exports: [KycService, KycGuard],
})
export class KycModule {}
