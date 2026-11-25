import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { UserRole } from "../generated/prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RetentionService } from "./retention.service";

class ReasonDto {
  @IsString() @MaxLength(2000) reason: string;
}
class LockDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() recordId?: string;
  @IsString() @MaxLength(2000) reason: string;
}

// Admin → Veri Saklama: yalnız SUPERADMIN
@SkipThrottle()
@Controller("admin/retention")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class RetentionController {
  constructor(private retention: RetentionService) {}

  @Get("policy")
  policy() { return this.retention.policy(); }

  @Get("search")
  search(@Query("q") q: string) { return this.retention.search(q ?? ""); }

  @Get("person/:userId")
  person(@Param("userId") userId: string) { return this.retention.person(userId); }

  @Post("export/:userId")
  export(@Param("userId") userId: string, @Body() dto: ReasonDto, @CurrentUser("id") adminId: string) {
    return this.retention.exportZip(userId, adminId, dto.reason);
  }

  @Get("exports")
  exports() { return this.retention.exportHistory(); }

  @Get("locks")
  locks() { return this.retention.locks(); }

  @Post("locks")
  lock(@Body() dto: LockDto, @CurrentUser("id") adminId: string) { return this.retention.lock(dto, adminId); }

  @Patch("locks/:id/release")
  unlock(@Param("id") id: string, @Body() dto: ReasonDto, @CurrentUser("id") adminId: string) { return this.retention.unlock(id, dto.reason, adminId); }

  @Get("runs")
  runs() { return this.retention.runs(); }
}
