import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Matches } from "class-validator";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { KankaService } from "./kanka.service";

class KankaInviteDto {
  @Matches(/^\+90[5][0-9]{9}$/, { message: "Geçerli bir telefon numarası girin (+905XXXXXXXXX)" })
  phone: string;
}

type AuthedRequest = Request & { user: { id: string } };

@ApiTags("Kanka")
@Controller("kanka")
export class KankaController {
  constructor(private kanka: KankaService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Aktif kanka, bekleyen davetler ve Kankamla paket durumu" })
  me(@Req() req: AuthedRequest) {
    return this.kanka.getMine(req.user.id);
  }

  @Post("invite")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Telefon numarasıyla kanka daveti (48 saat geçerli; link her zaman döner)" })
  invite(@Req() req: AuthedRequest, @Body() dto: KankaInviteDto) {
    return this.kanka.invite(req.user.id, dto.phone);
  }

  @Post("invites/:id/accept")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  accept(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.kanka.accept(req.user.id, id);
  }

  @Post("invites/:id/decline")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  decline(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.kanka.decline(req.user.id, id);
  }

  @Post("unlink")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Kankalıktan çık (kilitli haftada / masa sürerken olmaz)" })
  unlink(@Req() req: AuthedRequest) {
    return this.kanka.unlink(req.user.id);
  }

  // Davet linki sayfası (oturumsuz): sadece geçerlilik + davet edenin baş harfleri
  @Get("link/:token")
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  byToken(@Param("token") token: string) {
    return this.kanka.inviteByToken(token);
  }
}
