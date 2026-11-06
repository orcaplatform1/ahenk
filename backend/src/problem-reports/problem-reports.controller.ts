import { Body, Controller, Get, Param, Post, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import { UserRole } from "../generated/prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CreateProblemReportDto } from "./problem-reports.dto";
import {
  PROBLEM_REPORT_IMAGE_MAX_BYTES,
  PROBLEM_REPORT_MAX_IMAGES_MOBILE,
  ProblemReportsService,
} from "./problem-reports.service";

// Kullanıcı: sorun bildirimi gönder (giriş zorunlu)
@Controller("problem-reports")
@UseGuards(JwtAuthGuard)
export class ProblemReportsController {
  constructor(private service: ProblemReportsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor("images", PROBLEM_REPORT_MAX_IMAGES_MOBILE, { limits: { fileSize: PROBLEM_REPORT_IMAGE_MAX_BYTES } }))
  create(@Body() dto: CreateProblemReportDto, @Req() req: Request, @UploadedFiles() files?: Express.Multer.File[]) {
    const user = req.user as { id: string };
    return this.service.create(user.id, dto, files ?? []);
  }
}

// Admin: sorun bildirimleri (ADMIN ve SUPERADMIN)
@Controller("admin/problem-reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
export class AdminProblemReportsController {
  constructor(private service: ProblemReportsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.service.detail(id);
  }

  // Görseller gizli: yalnızca admin oturumuyla sunulur
  @Get(":id/images/:name")
  async image(@Param("id") id: string, @Param("name") name: string, @Res() res: Response) {
    const filePath = await this.service.imagePath(id, name);
    res.set("Cache-Control", "private, no-store");
    return res.sendFile(filePath);
  }
}
