import { Controller, Get, HttpCode, HttpStatus, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminAction } from "../admin/admin-action-log";
import { ProfilePhotoService } from "./profile-photo.service";
import { PROFILE_PHOTO_MAX_BYTES } from "./profile-photo.util";

@ApiTags("ProfilePhoto")
@Controller()
export class ProfilePhotoController {
  constructor(private service: ProfilePhotoService) {}

  @Get("users/me/profile-photo")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Onaylı profil fotoğrafı ve onay bekleyen var mı" })
  mine(@CurrentUser("id") userId: string) {
    return this.service.mine(userId);
  }

  @Post("users/me/profile-photo")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("photo", { limits: { fileSize: PROFILE_PHOTO_MAX_BYTES } }))
  @ApiOperation({ summary: "Profil fotoğrafı yükle (yalnız KYC onaylı; admin onayına düşer)" })
  upload(@CurrentUser("id") userId: string, @UploadedFile() file?: Express.Multer.File) {
    return this.service.upload(userId, file);
  }

  // Onaylı fotoğraflar herkese açık (masa detay kartı, admin)
  @Get("media/profile-photos/:userId/:file")
  async publicFile(@Param("userId") userId: string, @Param("file") file: string, @Res() res: Response) {
    const fp = await this.service.publicFile(userId, file);
    res.set("Cache-Control", "public, max-age=86400");
    return res.sendFile(fp);
  }

  @Get("admin/profile-photos")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] Onay bekleyen profil fotoğrafları" })
  adminList() {
    return this.service.adminList();
  }

  @Get("admin/profile-photos/:id/file")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  async adminFile(@Param("id") id: string, @Res() res: Response) {
    const fp = await this.service.adminFile(id);
    res.set({ "Content-Type": "image/webp", "Cache-Control": "no-store" });
    return res.sendFile(fp);
  }

  @AdminAction("PROFILE_PHOTO_APPROVE", async (c) => {
    const row = await c.db.profilePhoto.findUnique({ where: { id: c.params.id }, select: { userId: true } });
    return { text: `${await c.userName(row?.userId)} kullanıcısının profil fotoğrafını onayladı`, targetUserId: row?.userId };
  })
  @Post("admin/profile-photos/:id/approve")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  approve(@Param("id") id: string) {
    return this.service.approve(id);
  }

  @AdminAction("PROFILE_PHOTO_REJECT", async (c) => {
    // Kayıt silindiği için kullanıcı kimliği yanıttan alınır
    const userId = (c.result as { userId?: string } | undefined)?.userId;
    return { text: `${await c.userName(userId)} kullanıcısının profil fotoğrafını reddetti`, targetUserId: userId };
  })
  @Post("admin/profile-photos/:id/reject")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  reject(@Param("id") id: string) {
    return this.service.reject(id);
  }
}
