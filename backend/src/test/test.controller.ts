import { AdminAction } from "../admin/admin-action-log";
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TestService } from "./test.service";
import { SubmitTestDto } from "./dto/submit-test.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("Test")
@Controller("test")
export class TestController {
  constructor(private testService: TestService) {}

  @Get("questions")
  @ApiOperation({ summary: "19 soruyu 6 bölüm halinde getir (oturum gerekmez)" })
  getQuestions() {
    return this.testService.getQuestions();
  }

  @Post("submit")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Tüm cevapları gönder, OCEAN skoru hesapla ve kaydet" })
  submit(@CurrentUser("id") userId: string, @Body() dto: SubmitTestDto) {
    return this.testService.submit(userId, dto);
  }

  @Get("result")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Kendi OCEAN sonucunu gör" })
  result(@CurrentUser("id") userId: string) {
    return this.testService.getMyResult(userId);
  }

  @AdminAction("TEST_LOCK_RESET", async (c) => ({ text: `${await c.userName(c.params.userId)} kullanıcısının kişilik testi kilidini açtı`, targetUserId: c.params.userId }))
  @Patch("admin/:userId/reset-lock")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Kullanıcının 180 günlük test kilidini aç" })
  adminResetLock(@Param("userId") userId: string) {
    return this.testService.adminResetLock(userId);
  }
}
