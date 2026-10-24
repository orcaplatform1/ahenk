import { Controller, Post, Get, Param, Body, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { HideEmailForAdminInterceptor } from "../admin/hide-email.interceptor";
import { Request } from "express";
import { SosService } from "./sos.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Throttle } from "@nestjs/throttler";
import { UserRole } from "@prisma/client";
import { IsArray, IsNumber, IsOptional, IsString, ArrayMinSize } from "class-validator";

class CreateSosDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
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

  // Tüm masa katılımcıları 30s'de bir çağırır (masa aktifken)
  @Post(":meetingId/participant-location")
  updateParticipantLocation(@Param("meetingId") meetingId: string, @Body() dto: UpdateLocationDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.sos.updateParticipantLocation(meetingId, user.id, dto.lat, dto.lng, dto.accuracy);
  }

  @Get("admin/reports")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(HideEmailForAdminInterceptor)
  adminList() {
    return this.sos.adminListReports();
  }

  @Get("admin/reports/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(HideEmailForAdminInterceptor)
  adminDetail(@Param("id") id: string) {
    return this.sos.adminGetReport(id);
  }
}
