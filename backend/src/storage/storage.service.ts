import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type KycFileType = "id-front" | "id-back" | "liveness";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;  // 80 MB
const PRESIGNED_PUT_TTL = 15 * 60;          // 15 dakika
const PRESIGNED_GET_TTL = 60 * 60;          // 1 saat (admin görüntülemesi için)

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.bucket = this.config.get<string>("R2_BUCKET") ?? "ahenk-kyc";

    this.client = new S3Client({
      region: "auto",
      endpoint: this.config.get<string>("R2_ENDPOINT") ?? "https://placeholder.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: this.config.get<string>("R2_ACCESS_KEY_ID") ?? "placeholder",
        secretAccessKey: this.config.get<string>("R2_SECRET_ACCESS_KEY") ?? "placeholder",
      },
      requestChecksumCalculation: "when_required" as never,
      responseChecksumValidation: "when_required" as never,
    });

    this.logger.log(`R2 başlatıldı: ${this.bucket}`);
  }

  // ─── Presigned PUT URL (istemci doğrudan yükler) ─────────────────────────

  async presignedPutUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_PUT_TTL });
  }

  // ─── Presigned GET URL (admin görüntülemesi) ─────────────────────────────

  async presignedGetUrl(key: string): Promise<string> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: PRESIGNED_GET_TTL });
  }

  // ─── Nesne varlık kontrolü ────────────────────────────────────────────────

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  // ─── Nesne silme ──────────────────────────────────────────────────────────

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  // ─── KYC dosya anahtarı üretici ──────────────────────────────────────────

  buildKycKey(userId: string, type: KycFileType, mimeType: string): string {
    const ext = mimeType.split("/")[1].replace("quicktime", "mov");
    const ts = Date.now();
    return `kyc/${userId}/${ts}-${type}.${ext}`;
  }

  // ─── Mime türü doğrulama ─────────────────────────────────────────────────

  validateMimeType(
    mimeType: string,
    type: KycFileType,
  ): { valid: boolean; message?: string } {
    const isImage = type === "id-front" || type === "id-back";
    const allowed = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    if (!allowed.includes(mimeType)) {
      return {
        valid: false,
        message: isImage
          ? "Kimlik fotoğrafı için JPEG, PNG veya WebP gerekli"
          : "Liveness videosu için MP4, WebM veya MOV gerekli",
      };
    }
    return { valid: true };
  }

  validateFileSize(
    bytes: number,
    type: KycFileType,
  ): { valid: boolean; message?: string } {
    const isImage = type === "id-front" || type === "id-back";
    const max = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (bytes > max) {
      return {
        valid: false,
        message: isImage
          ? "Fotoğraf boyutu en fazla 5 MB olabilir"
          : "Video boyutu en fazla 80 MB olabilir",
      };
    }
    return { valid: true };
  }
}
