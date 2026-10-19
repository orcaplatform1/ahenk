import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  StreamableFile,
} from "@nestjs/common";
import { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { ReviewKycDto } from "./dto/review-kyc.dto";
import { KycStatus, ReferralStatus } from "@prisma/client";

const UPLOAD_DIR = path.join(process.cwd(), "..", "uploads", "kyc");

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 80 * 1024 * 1024;

const RESUBMITTABLE: KycStatus[] = [KycStatus.REJECTED, KycStatus.SUSPICIOUS];

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // ─── Dosya yükle + başvuru oluştur ───────────────────────────────────────

  async uploadAndSubmit(
    userId: string,
    files: {
      idFront?: Express.Multer.File[];
      idBack?: Express.Multer.File[];
      liveness?: Express.Multer.File[];
    },
  ) {
    const front = files.idFront?.[0];
    const back = files.idBack?.[0];
    const video = files.liveness?.[0];

    if (!front || !back || !video) {
      throw new BadRequestException("idFront, idBack ve liveness dosyaları zorunlu");
    }

    if (!ALLOWED_IMAGE.includes(front.mimetype)) throw new BadRequestException("Kimlik ön yüzü için JPEG, PNG veya WebP gerekli");
    if (!ALLOWED_IMAGE.includes(back.mimetype))  throw new BadRequestException("Kimlik arka yüzü için JPEG, PNG veya WebP gerekli");
    if (!ALLOWED_VIDEO.includes(video.mimetype)) throw new BadRequestException("Liveness için MP4, WebM veya MOV gerekli");
    if (front.size > MAX_IMAGE) throw new BadRequestException("Fotoğraf en fazla 5 MB olabilir");
    if (back.size  > MAX_IMAGE) throw new BadRequestException("Fotoğraf en fazla 5 MB olabilir");
    if (video.size > MAX_VIDEO) throw new BadRequestException("Video en fazla 80 MB olabilir");

    const existing = await this.prisma.kycSubmission.findUnique({ where: { userId } });
    if (existing && !RESUBMITTABLE.includes(existing.status)) {
      throw new ConflictException(
        existing.status === KycStatus.PENDING
          ? "KYC başvurunuz inceleniyor"
          : "KYC başvurunuz onaylanmış",
      );
    }

    // Kullanıcı dizini
    const userDir = path.join(UPLOAD_DIR, userId);
    fs.mkdirSync(userDir, { recursive: true });

    // Eski dosyaları temizle
    if (existing) {
      for (const f of [existing.idFrontKey, existing.idBackKey, existing.livenessKey]) {
        try { fs.unlinkSync(f); } catch {}
      }
    }

    const extOf = (mime: string) => mime.split("/")[1].replace("quicktime", "mov");
    const frontPath    = path.join(userDir, `id-front.${extOf(front.mimetype)}`);
    const backPath     = path.join(userDir, `id-back.${extOf(back.mimetype)}`);
    const livenessPath = path.join(userDir, `liveness.${extOf(video.mimetype)}`);

    fs.writeFileSync(frontPath, front.buffer);
    fs.writeFileSync(backPath,  back.buffer);
    fs.writeFileSync(livenessPath, video.buffer);

    if (existing) {
      return this.prisma.kycSubmission.update({
        where: { userId },
        data: {
          idFrontKey: frontPath,
          idBackKey:  backPath,
          livenessKey: livenessPath,
          status: KycStatus.PENDING,
          reviewedById: null,
          reviewedAt:   null,
          rejectReason: null,
          adminNote:    null,
          submittedAt:  new Date(),
        },
      });
    }

    return this.prisma.kycSubmission.create({
      data: {
        userId,
        idFrontKey:  frontPath,
        idBackKey:   backPath,
        livenessKey: livenessPath,
      },
    });
  }

  // ─── Kendi KYC durumu ─────────────────────────────────────────────────────

  async getMyStatus(userId: string) {
    const kyc = await this.prisma.kycSubmission.findUnique({ where: { userId } });
    if (!kyc) return { status: null, message: "Henüz KYC başvurusu yapılmadı" };
    return {
      status: kyc.status,
      submittedAt: kyc.submittedAt,
      reviewedAt:  kyc.reviewedAt,
      rejectReason: kyc.status !== KycStatus.APPROVED ? kyc.rejectReason : null,
    };
  }

  // ─── Admin: Listele ───────────────────────────────────────────────────────

  async adminList(status?: KycStatus, page: number | string = 1, limit: number | string = 20) {
    const where = status ? { status } : {};
    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const l = Math.max(1, parseInt(String(limit), 10) || 20);

    const [items, total] = await Promise.all([
      this.prisma.kycSubmission.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        orderBy: { submittedAt: "asc" },
        include: {
          user: { select: { id: true, email: true, phone: true, profile: true } },
          reviewedBy: { select: { id: true, email: true } },
        },
      }),
      this.prisma.kycSubmission.count({ where }),
    ]);

    const itemsWithUrls = items.map((item) => ({
      ...item,
      idFrontUrl:   `/api/v1/kyc/admin/file/${item.id}/front`,
      idBackUrl:    `/api/v1/kyc/admin/file/${item.id}/back`,
      livenessUrl:  `/api/v1/kyc/admin/file/${item.id}/liveness`,
    }));

    return { items: itemsWithUrls, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  // ─── Admin: Tek başvuru ───────────────────────────────────────────────────

  async adminGetOne(id: string) {
    const kyc = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, phone: true, profile: true } },
        reviewedBy: { select: { id: true, email: true } },
      },
    });
    if (!kyc) throw new NotFoundException("KYC başvurusu bulunamadı");

    return {
      ...kyc,
      fileUrls: {
        idFront:  `/api/v1/kyc/admin/file/${id}/front`,
        idBack:   `/api/v1/kyc/admin/file/${id}/back`,
        liveness: `/api/v1/kyc/admin/file/${id}/liveness`,
      },
    };
  }

  // ─── Admin: Dosya sun ─────────────────────────────────────────────────────

  async serveAdminFile(submissionId: string, type: string, res: Response) {
    const kyc = await this.prisma.kycSubmission.findUnique({ where: { id: submissionId } });
    if (!kyc) throw new NotFoundException("KYC başvurusu bulunamadı");

    const fileMap: Record<string, string> = {
      front:    kyc.idFrontKey,
      back:     kyc.idBackKey,
      liveness: kyc.livenessKey,
    };

    const filePath = fileMap[type];
    if (!filePath) throw new BadRequestException("Geçersiz dosya tipi (front | back | liveness)");
    if (!fs.existsSync(filePath)) throw new NotFoundException("Dosya bulunamadı");

    const ext  = path.extname(filePath).toLowerCase();
    const mime = ext === ".mp4" ? "video/mp4"
               : ext === ".webm" ? "video/webm"
               : ext === ".mov"  ? "video/quicktime"
               : ext === ".png"  ? "image/png"
               : ext === ".webp" ? "image/webp"
               : "image/jpeg";

    res.set({ "Content-Type": mime, "Cache-Control": "no-store" });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  // ─── Admin: İncele ────────────────────────────────────────────────────────

  async adminReview(id: string, reviewerId: string, dto: ReviewKycDto) {
    const kyc = await this.prisma.kycSubmission.findUnique({ where: { id } });
    if (!kyc) throw new NotFoundException("KYC başvurusu bulunamadı");

    if (kyc.status === KycStatus.APPROVED && dto.status === KycStatus.APPROVED) {
      throw new BadRequestException("Bu başvuru zaten onaylanmış");
    }

    const updated = await this.prisma.kycSubmission.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedById: reviewerId,
        reviewedAt:   new Date(),
        rejectReason: dto.rejectReason ?? null,
        adminNote:    dto.adminNote ?? null,
      },
    });

    this.notifications
      .notifyKycReviewed(kyc.userId, dto.status, dto.rejectReason)
      .catch(() => {});

    if (dto.status === KycStatus.APPROVED) {
      this.prisma.referral.updateMany({
        where: { referredId: kyc.userId, status: ReferralStatus.REGISTERED },
        data:  { status: ReferralStatus.KYC_APPROVED },
      }).catch(() => {});
    }

    return updated;
  }
}
