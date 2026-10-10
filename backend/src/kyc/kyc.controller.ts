import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseEnumPipe,
  Optional,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { KycStatus } from "@prisma/client";
import { KycService } from "./kyc.service";
import { RequestUploadDto } from "./dto/request-upload.dto";
import { SubmitKycDto } from "./dto/submit-kyc.dto";
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

  // ─── Kullanıcı endpoint'leri ──────────────────────────────────────────────

  @Post("request-upload")
  @ApiOperation({ summary: "R2'ye doğrudan yükleme için imzalı URL al (15 dk geçerli)" })
  requestUpload(@CurrentUser("id") userId: string, @Body() dto: RequestUploadDto) {
    return this.kycService.requestUploadUrls(userId, dto);
  }

  @Post("submit")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Dosyalar R2'ye yüklendikten sonra KYC başvurusunu gönder" })
  submit(@CurrentUser("id") userId: string, @Body() dto: SubmitKycDto) {
    return this.kycService.submit(userId, dto);
  }

  @Get("status")
  @ApiOperation({ summary: "Kendi KYC durumunu gör" })
  myStatus(@CurrentUser("id") userId: string) {
    return this.kycService.getMyStatus(userId);
  }

  // ─── Admin endpoint'leri ──────────────────────────────────────────────────

  @Get("admin")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] KYC başvurularını listele" })
  @ApiQuery({ name: "status", enum: KycStatus, required: false })
  @ApiQuery({ name: "page", type: Number, required: false })
  @ApiQuery({ name: "limit", type: Number, required: false })
  adminList(
    @Query("status") status?: KycStatus,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.kycService.adminList(status, page, limit);
  }

  @Get("admin/:id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] Tek başvuruyu imzalı URL'lerle getir (1 saat geçerli)" })
  adminGetOne(@Param("id") id: string) {
    return this.kycService.adminGetOne(id);
  }

  @Patch("admin/:id/review")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiOperation({ summary: "[Admin] Başvuruyu onayla / reddet / şüpheli işaretle" })
  adminReview(
    @Param("id") id: string,
    @CurrentUser("id") reviewerId: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kycService.adminReview(id, reviewerId, dto);
  }
}
