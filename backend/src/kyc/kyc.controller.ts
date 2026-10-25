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
import { HideEmailForAdminInterceptor } from "../admin/hide-email.interceptor";
import { AdminAction, reasonTr } from "../admin/admin-action-log";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from "@nestjs/swagger";
import { KycStatus } from "@prisma/client";
import { KycService } from "./kyc.service";
import { ReviewKycDto, SetIdentityNumberDto } from "./dto/review-kyc.dto";
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
      { limits: { fileSize: 100 * 1024 * 1024, files: 3 } },
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
  @UseInterceptors(HideEmailForAdminInterceptor)
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
  @UseInterceptors(HideEmailForAdminInterceptor)
  @ApiOperation({ summary: "[Admin] Tek başvuruyu getir" })
  adminGetOne(@Param("id") id: string) {
    return this.kycService.adminGetOne(id);
  }

  // ─── Admin: TC ekle (TC girilmeden onaylanmış eski başvurular) ────────────

  @AdminAction("KYC_IDENTITY_NUMBER", async (c) => {
    const kyc = await c.db.kycSubmission.findUnique({ where: { id: c.params.id }, select: { userId: true } });
    return { text: `${await c.userName(kyc?.userId)} kullanıcısının TC kimlik numarasını girdi`, targetUserId: kyc?.userId };
  })
  @Patch("admin/:id/identity-number")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] Onaylı başvuruya TC kimlik no ekle" })
  adminSetIdentityNumber(@Param("id") id: string, @Body() dto: SetIdentityNumberDto) {
    return this.kycService.setIdentityNumber(id, dto.identityNumber);
  }

  // ─── Admin: İncele ────────────────────────────────────────────────────────

  @AdminAction("KYC_REVIEW", async (c) => {
    const kyc = await c.db.kycSubmission.findUnique({ where: { id: c.params.id }, select: { userId: true } });
    const verb = { APPROVED: "onayladı", REJECTED: "reddetti", SUSPICIOUS: "şüpheli olarak işaretledi" }[String(c.body.status)] ?? "inceledi";
    return { text: `${await c.userName(kyc?.userId)} kullanıcısının KYC başvurusunu ${verb}${reasonTr(c.body.rejectReason)}`, targetUserId: kyc?.userId };
  })
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
