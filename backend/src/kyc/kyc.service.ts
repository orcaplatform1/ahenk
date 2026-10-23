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
import convertHeic = require("heic-convert");

const UPLOAD_DIR = path.join(process.cwd(), "..", "uploads", "kyc");
export const KYC_TMP_DIR = path.join(UPLOAD_DIR, ".tmp");

const MAX_IMAGE = 50 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

const IMAGE_KINDS = ["jpg", "png", "webp", "heic"];
const VIDEO_KINDS = ["mp4", "mov", "webm"];
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

// Tür, istemcinin bildirdiği mimetype'tan değil dosyanın ilk byte'larından belirlenir
function detectKind(filePath: string): string | null {
  const head = Buffer.alloc(16);
  const fd = fs.openSync(filePath, "r");
  try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }

  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "webm";
  if (head.toString("ascii", 4, 8) === "ftyp") {
    const brand = head.toString("ascii", 8, 12);
    if (HEIC_BRANDS.includes(brand)) return "heic";
    if (brand === "qt  ") return "mov";
    if (brand.startsWith("avi")) return null; // AVIF görsel, video değil
    return "mp4";
  }
  return null;
}

const RESUBMITTABLE: KycStatus[] = [KycStatus.REJECTED, KycStatus.SUSPICIOUS];

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // HEIC çevirme RAM/CPU yoğun: aynı anda en fazla 1 çevirme çalışır
  private heicQueue: Promise<unknown> = Promise.resolve();

  private heicToJpeg(srcPath: string): Promise<string> {
    const run = async () => {
      const outPath = `${srcPath}.jpg`;
      try {
        const output = await convertHeic({ buffer: fs.readFileSync(srcPath), format: "JPEG", quality: 0.92 });
        fs.writeFileSync(outPath, Buffer.from(output));
      } catch {
        throw new BadRequestException("HEIC fotoğraf okunamadı");
      }
      return outPath;
    };
    const job = this.heicQueue.then(run, run);
    this.heicQueue = job.catch(() => {});
    return job;
  }

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

    let existing: Awaited<ReturnType<typeof this.prisma.kycSubmission.findUnique>>;
    let frontPath: string, backPath: string, livenessPath: string;

    try {
      const frontKind = detectKind(front.path);
      const backKind  = detectKind(back.path);
      const videoKind = detectKind(video.path);
      if (!frontKind || !IMAGE_KINDS.includes(frontKind)) throw new BadRequestException("Kimlik ön yüzü için JPEG, PNG, WebP veya HEIC gerekli");
      if (!backKind  || !IMAGE_KINDS.includes(backKind))  throw new BadRequestException("Kimlik arka yüzü için JPEG, PNG, WebP veya HEIC gerekli");
      if (!videoKind || !VIDEO_KINDS.includes(videoKind)) throw new BadRequestException("Liveness için MP4, MOV veya WebM gerekli");
      if (front.size > MAX_IMAGE) throw new BadRequestException("Fotoğraf en fazla 50 MB olabilir");
      if (back.size  > MAX_IMAGE) throw new BadRequestException("Fotoğraf en fazla 50 MB olabilir");
      if (video.size > MAX_VIDEO) throw new BadRequestException("Video en fazla 100 MB olabilir");

      existing = await this.prisma.kycSubmission.findUnique({ where: { userId } });
      if (existing && !RESUBMITTABLE.includes(existing.status)) {
        throw new ConflictException(
          existing.status === KycStatus.PENDING
            ? "KYC başvurunuz inceleniyor"
            : "KYC başvurunuz onaylanmış",
        );
      }

      // HEIC → JPEG (admin panelinde tarayıcı HEIC gösteremez)
      const frontExt = frontKind === "heic" ? "jpg" : frontKind;
      const backExt  = backKind  === "heic" ? "jpg" : backKind;
      const tmpFront = frontKind === "heic" ? await this.heicToJpeg(front.path) : front.path;
      const tmpBack  = backKind  === "heic" ? await this.heicToJpeg(back.path)  : back.path;

      // Kullanıcı dizini
      const userDir = path.join(UPLOAD_DIR, userId);
      fs.mkdirSync(userDir, { recursive: true });

      // Eski dosyaları temizle
      if (existing) {
        for (const f of [existing.idFrontKey, existing.idBackKey, existing.livenessKey]) {
          try { fs.unlinkSync(f); } catch {}
        }
      }

      frontPath    = path.join(userDir, `id-front.${frontExt}`);
      backPath     = path.join(userDir, `id-back.${backExt}`);
      livenessPath = path.join(userDir, `liveness.${videoKind}`);

      fs.renameSync(tmpFront, frontPath);
      fs.renameSync(tmpBack, backPath);
      fs.renameSync(video.path, livenessPath);
    } finally {
      // Taşınmayan / dönüştürülen geçici dosyalar silinir
      for (const f of [front.path, back.path, video.path, `${front.path}.jpg`, `${back.path}.jpg`]) {
        try { fs.unlinkSync(f); } catch {}
      }
    }

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
