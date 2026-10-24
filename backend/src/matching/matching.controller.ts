import { AdminAction } from "../admin/admin-action-log";
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from "@nestjs/common";
import { MatchingService } from "./matching.service";
import { BotDto, SetBotStatusDto } from "./dto/update-bot.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("matching")
export class MatchingController {
  constructor(private matchingService: MatchingService) {}

  @Get("pool-status")
  @UseGuards(JwtAuthGuard)
  getPoolStatus(@Request() req: any) {
    return this.matchingService.getPoolStatus(req.user.id);
  }

  @Get("admin/bots")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  listBots() {
    return this.matchingService.listBots();
  }

  @Post("admin/bots")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  createBot(@Body() dto: BotDto) {
    return this.matchingService.createBot(dto);
  }

  @Patch("admin/bots/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  updateBot(@Param("id") id: string, @Body() dto: BotDto) {
    return this.matchingService.updateBot(id, dto);
  }

  @Patch("admin/bots/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  setBotStatus(@Param("id") id: string, @Body() dto: SetBotStatusDto) {
    return this.matchingService.setBotStatus(id, dto.active);
  }

  @Delete("admin/bots/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPERADMIN)
  deleteBot(@Param("id") id: string) {
    return this.matchingService.deleteBot(id);
  }

  @AdminAction("MATCHING_SCAN", () => "Eşleştirme taramasını elle başlattı")
  @Post("admin/run-matching")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  runMatching() {
    return this.matchingService.requestScan();
  }
}
