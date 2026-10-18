import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from "@nestjs/swagger";
import { KycStatus } from "@prisma/client";
import { KycService } from "./kyc.service";
import { ReviewKycDto } from "./dto/review-kyc.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("KYC")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("kyc")
export class KycController {
  constructor(private kycService: KycService) {}

  // ─── Kullanıcı: Dosya yükle + başvur ─────────────────────────────────────

  @Post("upload")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Kimlik fotoğrafları ve liveness videosunu yükle, başvur" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "idFront",  maxCount: 1 },
        { name: "idBack",   maxCount: 1 },
        { name: "liveness", maxCount: 1 },
      ],
      { limits: { fileSize: 80 * 1024 * 1024 } },
    ),
  )
  upload(
    @CurrentUser("id") userId: string,
    @UploadedFiles() files: {
      idFront?:  Express.Multer.File[];
      idBack?:   Express.Multer.File[];
      liveness?: Express.Multer.File[];
    },
  ) {
    return this.kycService.uploadAndSubmit(userId, files);
  }

  // ─── Kullanıcı: Durum ─────────────────────────────────────────────────────

  @Get("status")
  @ApiOperation({ summary: "Kendi KYC durumunu gör" })
  myStatus(@CurrentUser("id") userId: string) {
    return this.kycService.getMyStatus(userId);
  }

  // ─── Admin: Listele ───────────────────────────────────────────────────────

  @Get("admin")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] KYC başvurularını listele" })
  @ApiQuery({ name: "status", enum: KycStatus, required: false })
  @ApiQuery({ name: "page",   type: Number,    required: false })
  @ApiQuery({ name: "limit",  type: Number,    required: false })
  adminList(
    @Query("status") status?: KycStatus,
    @Query("page")   page?:   number,
    @Query("limit")  limit?:  number,
  ) {
    return this.kycService.adminList(status, page, limit);
  }

  // ─── Admin: Dosya görüntüle ───────────────────────────────────────────────

  @Get("admin/file/:submissionId/:type")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] KYC dosyasını görüntüle (front | back | liveness)" })
  adminFile(
    @Param("submissionId") submissionId: string,
    @Param("type")         type: string,
    @Res()                 res: Response,
  ) {
    return this.kycService.serveAdminFile(submissionId, type, res);
  }

  // ─── Admin: Tek başvuru ───────────────────────────────────────────────────

  @Get("admin/:id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] Tek başvuruyu getir" })
  adminGetOne(@Param("id") id: string) {
    return this.kycService.adminGetOne(id);
  }

  // ─── Admin: İncele ────────────────────────────────────────────────────────

  @Patch("admin/:id/review")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] Başvuruyu onayla / reddet / şüpheli işaretle" })
  adminReview(
    @Param("id")           id: string,
    @CurrentUser("id")     reviewerId: string,
    @Body()                dto: ReviewKycDto,
  ) {
    return this.kycService.adminReview(id, reviewerId, dto);
  }
}
