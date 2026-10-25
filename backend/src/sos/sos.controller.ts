import { Controller, Post, Get, Patch, Param, Body, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { HideEmailForAdminInterceptor } from "../admin/hide-email.interceptor";
import { AdminAction } from "../admin/admin-action-log";
import { Request } from "express";
import { SosService, THREAT_LABELS } from "./sos.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Throttle } from "@nestjs/throttler";
import { UserRole } from "@prisma/client";
import { IsArray, IsNumber, IsOptional, IsIn, ArrayMinSize } from "class-validator";

class CreateSosDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(Object.keys(THREAT_LABELS), { each: true, message: "Geçersiz tehdit türü" })
  threats: string[];

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;
}

class UpdateLocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;
}

@Controller("sos")
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(private sos: SosService) {}

  @Post(":meetingId/report")
  @Throttle({ default: { ttl: 300000, limit: 5 } })
  create(@Param("meetingId") meetingId: string, @Body() dto: CreateSosDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.sos.createReport(user.id, meetingId, dto.threats, dto.lat, dto.lng, dto.accuracy);
  }

  @Post("reports/:reportId/location")
  updateLocation(@Param("reportId") reportId: string, @Body() dto: UpdateLocationDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.sos.updateLocation(reportId, user.id, dto.lat, dto.lng, dto.accuracy);
  }

  // Sayfa yenilenince açık talep geri yüklenir
  @Get("meetings/:meetingId/my-report")
  myOpenReport(@Param("meetingId") meetingId: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.sos.myOpenReport(user.id, meetingId);
  }

  // Tüm masa katılımcıları 30s'de bir çağırır (acil yardım süresinde)
  @Post(":meetingId/participant-location")
  updateParticipantLocation(@Param("meetingId") meetingId: string, @Body() dto: UpdateLocationDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.sos.updateParticipantLocation(meetingId, user.id, dto.lat, dto.lng, dto.accuracy);
  }

  @Get("admin/reports")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(HideEmailForAdminInterceptor)
  adminList(@Req() req: Request) {
    return this.sos.adminListReports(req.user as { id: string; role: UserRole });
  }

  @Get("admin/reports/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(HideEmailForAdminInterceptor)
  adminDetail(@Param("id") id: string, @Req() req: Request) {
    return this.sos.adminGetReport(id, req.user as { id: string; role: UserRole });
  }

  @AdminAction("SOS_CLAIM", async (c) => {
    const r = await c.db.sosReport.findUnique({ where: { id: c.params.id }, select: { userId: true } });
    return { text: `${await c.userName(r?.userId)} kullanıcısının acil yardım talebini üstlendi`, targetUserId: r?.userId };
  })
  @Patch("admin/reports/:id/claim")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  claim(@Param("id") id: string, @Req() req: Request) {
    return this.sos.claimReport(id, req.user as { id: string; role: UserRole });
  }

  @AdminAction("SOS_RESOLVE", async (c) => {
    const r = await c.db.sosReport.findUnique({ where: { id: c.params.id }, select: { userId: true } });
    return { text: `${await c.userName(r?.userId)} kullanıcısının acil yardım talebini çözüldü olarak işaretledi`, targetUserId: r?.userId };
  })
  @Patch("admin/reports/:id/resolve")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  resolve(@Param("id") id: string, @Req() req: Request) {
    return this.sos.resolveReport(id, req.user as { id: string; role: UserRole });
  }
}
