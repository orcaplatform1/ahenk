import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from "@nestjs/common";
import { MatchingService } from "./matching.service";
import { UpdateBotNameDto, SetBotStatusDto } from "./dto/update-bot.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { IsString, IsOptional, IsNumber, Min, Max } from "class-validator";

class CreateBotDto {
  @IsString() firstName: string;
  @IsString() lastName: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100) openness?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) conscientiousness?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) extraversion?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) agreeableness?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) neuroticism?: number;
}

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
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  listBots() {
    return this.matchingService.listBots();
  }

  @Post("admin/bots")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  createBot(@Body() dto: CreateBotDto) {
    const { firstName, lastName, ...ocean } = dto;
    return this.matchingService.createBot(firstName, lastName, ocean);
  }

  @Patch("admin/bots/:id/name")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  updateBotName(@Param("id") id: string, @Body() dto: UpdateBotNameDto) {
    return this.matchingService.updateBotName(id, dto.firstName, dto.lastName);
  }

  @Patch("admin/bots/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setBotStatus(@Param("id") id: string, @Body() dto: SetBotStatusDto) {
    return this.matchingService.setBotStatus(id, dto.active);
  }

  @Delete("admin/bots/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  deleteBot(@Param("id") id: string) {
    return this.matchingService.deleteBot(id);
  }

  @Post("admin/run-matching")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  runMatching() {
    return this.matchingService.runHourlyMatching();
  }
}
