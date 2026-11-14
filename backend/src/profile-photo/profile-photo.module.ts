import { Module } from "@nestjs/common";
import { NotificationModule } from "../notification/notification.module";
import { ProfilePhotoController } from "./profile-photo.controller";
import { ProfilePhotoService } from "./profile-photo.service";

@Module({
  imports: [NotificationModule],
  controllers: [ProfilePhotoController],
  providers: [ProfilePhotoService],
})
export class ProfilePhotoModule {}
