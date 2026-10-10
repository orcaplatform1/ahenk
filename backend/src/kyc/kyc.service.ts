import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { NotificationService } from "../notification/notification.service";
import { RequestUploadDto } from "./dto/request-upload.dto";
import { SubmitKycDto } from "./dto/submit-kyc.dto";
import { ReviewKycDto } from "./dto/review-kyc.dto";
import { KycStatus } from "@prisma/client";

// Başvuru tekrar gönderilebilir durumlar
const RESUBMITTABLE: KycStatus[] = [KycStatus.REJECTED, KycStatus.SUSPICIOUS];

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationService,
  ) {}

  // ─── Presigned URL al ─────────────────────────────────────────────────────

  async requestUploadUrls(userId: string, dto: RequestUploadDto) {
    const existing = await this.prisma.kycSubmission.findUnique({ where: { userId } });

    if (existing && !RESUBMITTABLE.includes(existing.status)) {
      throw new ConflictException(
        existing.status === KycStatus.PENDING
          ? "KYC başvurunuz inceleniyor, lütfen bekleyin"
          : "KYC başvurunuz onaylanmış",
      );
    }

    const idFrontKey = this.storage.buildKycKey(userId, "id-front", dto.idFrontMime);
    const idBackKey = this.storage.buildKycKey(userId, "id-back", dto.idBackMime);
    const livenessKey = this.storage.buildKycKey(userId, "liveness", dto.livenessMime);

    const [idFrontUrl, idBackUrl, livenessUrl] = await Promise.all([
      this.storage.presignedPutUrl(idFrontKey, dto.idFrontMime, dto.idFrontSize),
      this.storage.presignedPutUrl(idBackKey, dto.idBackMime, dto.idBackSize),
      this.storage.presignedPutUrl(livenessKey, dto.livenessMime, dto.livenessSize),
    ]);

    return {
      idFront: { uploadUrl: idFrontUrl, key: idFrontKey },
      idBack: { uploadUrl: idBackUrl, key: idBackKey },
      liveness: { uploadUrl: livenessUrl, key: livenessKey },
      expiresInSeconds: 15 * 60,
    };
  }

  // ─── KYC başvurusu gönder ─────────────────────────────────────────────────

  async submit(userId: string, dto: SubmitKycDto) {
    // Anahtarların userId ile eşleştiğini doğrula
    this.assertKeysOwnedByUser(userId, dto);

    // R2'de gerçekten var mı?
    const [frontExists, backExists, livenessExists] = await Promise.all([
      this.storage.exists(dto.idFrontKey),
      this.storage.exists(dto.idBackKey),
      this.storage.exists(dto.livenessKey),
    ]);

    if (!frontExists || !backExists || !livenessExists) {
      throw new UnprocessableEntityException(
        "Dosyalar henüz yüklenmemiş, önce tüm dosyaları yükleyin",
      );
    }

    const existing = await this.prisma.kycSubmission.findUnique({ where: { userId } });

    if (existing) {
      if (!RESUBMITTABLE.includes(existing.status)) {
        throw new ConflictException(
          existing.status === KycStatus.PENDING
            ? "KYC başvurunuz zaten inceleniyor"
            : "KYC başvurunuz zaten onaylanmış",
        );
      }

      // Eski dosyaları R2'den sil
      await Promise.allSettled([
        this.storage.delete(existing.idFrontKey),
        this.storage.delete(existing.idBackKey),
        this.storage.delete(existing.livenessKey),
      ]);

      return this.prisma.kycSubmission.update({
        where: { userId },
        data: {
          idFrontKey: dto.idFrontKey,
          idBackKey: dto.idBackKey,
          livenessKey: dto.livenessKey,
          status: KycStatus.PENDING,
          reviewedById: null,
          reviewedAt: null,
          rejectReason: null,
          adminNote: null,
          submittedAt: new Date(),
        },
      });
    }

    return this.prisma.kycSubmission.create({
      data: {
        userId,
        idFrontKey: dto.idFrontKey,
        idBackKey: dto.idBackKey,
        livenessKey: dto.livenessKey,
      },
    });
  }

  // ─── Kendi KYC durumunu gör ───────────────────────────────────────────────

  async getMyStatus(userId: string) {
    const kyc = await this.prisma.kycSubmission.findUnique({ where: { userId } });
    if (!kyc) return { status: null, message: "Henüz KYC başvurusu yapılmadı" };

    return {
      status: kyc.status,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      // Ret/şüphe nedeni kullanıcıya gösterilir
      rejectReason: kyc.status !== KycStatus.APPROVED ? kyc.rejectReason : null,
    };
  }

  // ─── Admin: Listele ───────────────────────────────────────────────────────

  async adminList(status?: KycStatus, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.kycSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: "asc" },
        include: {
          user: { select: { id: true, email: true, profile: true } },
          reviewedBy: { select: { id: true, email: true } },
        },
      }),
      this.prisma.kycSubmission.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Admin: Tek başvuru + imzalı URL'ler ─────────────────────────────────

  async adminGetOne(id: string) {
    const kyc = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, phone: true, profile: true } },
        reviewedBy: { select: { id: true, email: true } },
      },
    });
    if (!kyc) throw new NotFoundException("KYC başvurusu bulunamadı");

    const [idFrontUrl, idBackUrl, livenessUrl] = await Promise.all([
      this.storage.presignedGetUrl(kyc.idFrontKey),
      this.storage.presignedGetUrl(kyc.idBackKey),
      this.storage.presignedGetUrl(kyc.livenessKey),
    ]);

    return {
      ...kyc,
      signedUrls: { idFrontUrl, idBackUrl, livenessUrl, expiresInSeconds: 3600 },
    };
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
        reviewedAt: new Date(),
        rejectReason: dto.rejectReason ?? null,
        adminNote: dto.adminNote ?? null,
      },
    });

    // Bildirim gönder (fire-and-forget)
    this.notifications
      .notifyKycReviewed(kyc.userId, dto.status, dto.rejectReason)
      .catch(() => {});

    return updated;
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private assertKeysOwnedByUser(userId: string, dto: SubmitKycDto) {
    const keys = [dto.idFrontKey, dto.idBackKey, dto.livenessKey];
    for (const key of keys) {
      if (!key.startsWith(`kyc/${userId}/`)) {
        throw new BadRequestException("Dosya anahtarları size ait değil");
      }
    }
  }
}
