import { Controller, Get, Post, Body, Param, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { MeetingType } from "../generated/prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReferralService } from "./referral.service";
import { PrismaService } from "../prisma/prisma.service";
import { parseReferralCode } from "./referral-code";

class ClaimRewardDto {
  @IsEnum(MeetingType)
  type: MeetingType;
}

@ApiTags("referral")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("referral")
export class ReferralController {
  constructor(private referralService: ReferralService) {}

  @Get("my-stats")
  @ApiOperation({ summary: "Davet istatistiklerini getir" })
  getMyStats(@Req() req: Request) {
    const user = (req as any).user;
    return this.referralService.getMyStats(user.id);
  }

  // Kazanılan ücretsiz masa hakkının türünü seç (Grup / Baş Başa / Kankamla)
  @Post("rewards/:id/claim")
  @ApiOperation({ summary: "Davet ödülünün türünü seç" })
  claimReward(@Req() req: Request, @Param("id") id: string, @Body() dto: ClaimRewardDto) {
    const user = (req as any).user;
    return this.referralService.claimReward(user.id, id, dto.type);
  }
}

// Davet linki (https://ahenk.co/davet/<KOD>): kod geçerli mi (rakam ve böyle bir kod var mı). Giriş gerektirmez; yalnız
// { valid } döner, kullanıcıya ait başka bilgi dönmez.
@ApiTags("referral")
@Controller("invite")
export class InviteCodeController {
  constructor(private prisma: PrismaService) {}

  @Get(":code")
  @ApiOperation({ summary: "Davet kodu geçerli mi" })
  async check(@Param("code") raw: string) {
    const code = parseReferralCode(raw);
    if (code == null) return { valid: false };
    const u = await this.prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    return { valid: !!u };
  }
}
