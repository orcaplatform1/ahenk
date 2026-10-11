import { Controller, Get, Post, Body, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ReferralService } from "./referral.service";

class InviteDto {
  @IsString()
  phoneNumber: string;
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

  @Post("invite")
  @ApiOperation({ summary: "WhatsApp daveti gönder" })
  invite(@Req() req: Request, @Body() dto: InviteDto) {
    const user = (req as any).user;
    return this.referralService.invite(user.id, dto.phoneNumber);
  }
}
