import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { ProblemReportPlatform, UserRole, UserStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { detectImage, VENUE_PHOTO_MAX_BYTES } from "../venue-panel/venue-media";
import { CreateProblemReportDto } from "./problem-reports.dto";

// Sorun bildirimi görselleri gizli saklanır (yalnızca admin ucu sunar): /root/ahenk/uploads/problem-reports/<id>/
export const PROBLEM_REPORT_DIR = path.join(process.cwd(), "..", "uploads", "problem-reports");
// Mevcut görsel yükleme altyapısının boyut limiti
export const PROBLEM_REPORT_IMAGE_MAX_BYTES = VENUE_PHOTO_MAX_BYTES;
// Web ve mobil: galeriden en fazla 3 görsel
export const PROBLEM_REPORT_MAX_IMAGES_WEB = 3;
export const PROBLEM_REPORT_MAX_IMAGES_MOBILE = 3;

const PLATFORM_LABEL: Record<ProblemReportPlatform, string> = { IOS: "iOS", ANDROID: "Android", WEB: "Web" };

const userSelect = {
  id: true,
  profile: { select: { firstName: true, lastName: true } },
} as const;

@Injectable()
export class ProblemReportsService {
  private readonly logger = new Logger(ProblemReportsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  async create(userId: string, dto: CreateProblemReportDto, files: Express.Multer.File[] = []) {
    const description = dto.description.trim();
    if (!description) throw new BadRequestException("Açıklama zorunludur");
    const max = dto.platform === ProblemReportPlatform.WEB ? PROBLEM_REPORT_MAX_IMAGES_WEB : PROBLEM_REPORT_MAX_IMAGES_MOBILE;
    if (files.length > max) throw new BadRequestException(`En fazla ${max} görsel eklenebilir`);
    const kinds = files.map((f) => detectImage(f.buffer));
    if (kinds.some((k) => !k)) throw new BadRequestException("Görseller JPG, PNG veya WebP olmalı");

    const report = await this.prisma.problemReport.create({
      data: {
        userId,
        platform: dto.platform,
        screen: dto.screen.trim(),
        appVersion: dto.appVersion?.trim() || null,
        description,
      },
      include: { user: { select: userSelect } },
    });

    if (files.length) {
      const dir = path.join(PROBLEM_REPORT_DIR, report.id);
      fs.mkdirSync(dir, { recursive: true });
      const names = files.map((file, i) => {
        const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${kinds[i]}`;
        fs.writeFileSync(path.join(dir, name), file.buffer);
        return name;
      });
      await this.prisma.problemReport.update({ where: { id: report.id }, data: { images: names } });
    }

    await this.notifyAdmins(report.id, {
      name: `${report.user.profile?.firstName ?? ""} ${report.user.profile?.lastName ?? ""}`.trim() || "Kullanıcı",
      createdAt: report.createdAt,
      platform: report.platform,
      screen: report.screen,
      description,
    }).catch((err: unknown) => this.logger.error(`Sorun bildirimi push'u gönderilemedi: ${err}`));

    return { id: report.id, createdAt: report.createdAt };
  }

  // Tüm ADMIN ve SUPERADMIN'lere push: dokununca admin panelde bildirimin detayı açılır
  private async notifyAdmins(
    reportId: string,
    r: { name: string; createdAt: Date; platform: ProblemReportPlatform; screen: string; description: string },
  ) {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] }, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    const time = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }).format(r.createdAt);
    const body = `${r.name} · ${time} · ${PLATFORM_LABEL[r.platform]} · ${r.screen}: ${r.description.slice(0, 80)}`;
    const link = `${process.env.APP_URL ?? "https://ahenk.co"}/admin/sorun-bildirimleri?id=${reportId}`;
    for (const a of admins) {
      await this.notifications.sendToUser(a.id, {
        title: "Yeni sorun bildirimi",
        body,
        data: { type: "PROBLEM_REPORT", reportId, link },
      });
    }
  }

  list() {
    return this.prisma.problemReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true, platform: true, screen: true, description: true, createdAt: true,
        user: { select: userSelect },
      },
    });
  }

  async detail(id: string) {
    const report = await this.prisma.problemReport.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!report) throw new NotFoundException("Sorun bildirimi bulunamadı");
    return report;
  }

  async imagePath(id: string, name: string) {
    const report = await this.prisma.problemReport.findUnique({ where: { id }, select: { images: true } });
    const safe = path.basename(name);
    if (!report || !report.images.includes(safe)) throw new NotFoundException("Görsel bulunamadı");
    const filePath = path.join(PROBLEM_REPORT_DIR, id, safe);
    if (!fs.existsSync(filePath)) throw new NotFoundException("Görsel bulunamadı");
    return filePath;
  }
}
