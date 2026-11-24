import { IsE164Phone } from "../common/phone";
import { Controller, Get, Post, Body, Param, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsEnum, Matches } from "class-validator";
import { MeetingType } from "../generated/prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReferralService } from "./referral.service";

class InviteDto {
  @IsE164Phone()
  phoneNumber: string;
}

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

  @Post("invite")
  @ApiOperation({ summary: "WhatsApp daveti gönder" })
  invite(@Req() req: Request, @Body() dto: InviteDto) {
    const user = (req as any).user;
    return this.referralService.invite(user.id, dto.phoneNumber);
  }
}
