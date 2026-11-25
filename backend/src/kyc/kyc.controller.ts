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
  Req,
} from "@nestjs/common";
import { HideEmailForAdminInterceptor } from "../admin/hide-email.interceptor";
import { AdminAction, reasonTr } from "../admin/admin-action-log";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { clientPlatform, recordAgreements } from "../common/agreement-consent";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from "@nestjs/swagger";
import { KycStatus } from "../generated/prisma/client";
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
  constructor(private kycService: KycService, private prisma: PrismaService) {}

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
  async upload(
    @CurrentUser("id") userId: string,
    @UploadedFiles() files: {
      idFront?:  Express.Multer.File[];
      idBack?:   Express.Multer.File[];
      liveness?: Express.Multer.File[];
    },
    // Belge türü (ID_CARD | DRIVER_LICENSE | PASSPORT | RESIDENCE_PERMIT); numara istenmez, saklanmaz. Pasaportta yalnız fotoğraflı
    // sayfa (idFront), diğerlerinde ön (idFront) + arka yüz (idBack)
    @Body("idType") idType?: string,
    // Biyometrik açık rıza onay kutusu (canlılık videosundan önce işaretlenir): "true" ise AgreementConsent'e acik_riza_biyometrik kaydı
    @Body("biometricConsent") biometricConsent?: string,
    @Req() req?: Request,
  ) {
    const result = await this.kycService.uploadAndSubmit(userId, files, idType);
    if (biometricConsent === "true") {
      await recordAgreements(this.prisma, userId, ["acik_riza_biyometrik"], req?.ip, clientPlatform(req?.headers), null);
    }
    return result;
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
