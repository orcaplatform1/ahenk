import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { KycStatus, ProfilePhotoStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { detectImageKind, ImageKind, toWebp } from "../common/image-webp";
import { PROFILE_PHOTO_DIR, photoSizes, profilePhotoUrl, smallPhotoName } from "./profile-photo.util";

const PHOTO_KINDS: ImageKind[] = ["jpg", "png", "webp", "heic", "heif"];
export const KYC_REQUIRED_MESSAGE = "Profil fotoğrafı kimlik doğrulamasından sonra yüklenebilir.";
export const PHOTO_REJECTED_MESSAGE = "Yüklediğin fotoğraf kimliğindeki fotoğrafla eşleşmiyor.";

@Injectable()
export class ProfilePhotoService {
  constructor(private prisma: PrismaService, private notifications: NotificationService) {}

  private filePath(userId: string, fileName: string) {
    return path.join(PROFILE_PHOTO_DIR, userId, fileName);
  }

  // Büyük (1080) ve küçük (200) dosya birlikte silinir
  private removeFile(userId: string, fileName: string) {
    fs.rmSync(this.filePath(userId, fileName), { force: true });
    fs.rmSync(this.filePath(userId, smallPhotoName(fileName)), { force: true });
  }

  // Kullanıcı: yükle (yalnız KYC onaylıysa). Önceki onay bekleyen fotoğraf varsa dosya + kayıt silinir; onaylı fotoğraf onaya kadar kalır
  async upload(userId: string, file?: Express.Multer.File) {
    const kyc = await this.prisma.kycSubmission.findUnique({ where: { userId }, select: { status: true } });
    if (kyc?.status !== KycStatus.APPROVED) throw new ForbiddenException(KYC_REQUIRED_MESSAGE);
    if (!file?.buffer?.length) throw new BadRequestException("Fotoğraf seçilmedi");
    const kind = detectImageKind(file.buffer);
    if (!kind || !PHOTO_KINDS.includes(kind)) throw new BadRequestException("Fotoğraf JPEG, PNG, WebP, HEIC veya HEIF olmalı");
    const { large, small } = await photoSizes(await toWebp(file.buffer, kind));
    const dir = path.join(PROFILE_PHOTO_DIR, userId);
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `p-${Date.now()}-${randomBytes(6).toString("hex")}.webp`;
    fs.writeFileSync(path.join(dir, fileName), large);
    fs.writeFileSync(path.join(dir, smallPhotoName(fileName)), small);

    const oldPending = await this.prisma.profilePhoto.findMany({ where: { userId, status: ProfilePhotoStatus.PENDING } });
    await this.prisma.$transaction([
      this.prisma.profilePhoto.deleteMany({ where: { id: { in: oldPending.map((p) => p.id) } } }),
      this.prisma.profilePhoto.create({ data: { userId, fileName } }),
    ]);
    oldPending.forEach((p) => this.removeFile(userId, p.fileName));
    return { pending: true };
  }

  // Kullanıcı: onaylı fotoğraf adresi + onay bekleyen var mı
  async mine(userId: string) {
    const rows = await this.prisma.profilePhoto.findMany({ where: { userId }, select: { fileName: true, status: true } });
    const approved = rows.find((r) => r.status === ProfilePhotoStatus.APPROVED);
    return { photoUrl: approved ? profilePhotoUrl(userId, approved.fileName) : null, pending: rows.some((r) => r.status === ProfilePhotoStatus.PENDING) };
  }

  // Herkese açık sunum: yalnız onaylı kayıt; büyük (p-…webp) ya da küçük (p-….s.webp) dosya
  async publicFile(userId: string, fileName: string): Promise<string> {
    const m = /^(p-\d+-[a-f0-9]{12})(\.s)?\.webp$/.exec(fileName);
    if (!/^[a-z0-9]+$/i.test(userId) || !m) throw new NotFoundException();
    const row = await this.prisma.profilePhoto.findFirst({ where: { userId, fileName: `${m[1]}.webp`, status: ProfilePhotoStatus.APPROVED }, select: { id: true } });
    const fp = this.filePath(userId, fileName);
    if (!row || !fs.existsSync(fp)) throw new NotFoundException();
    return fp;
  }

  // Admin: onay bekleyenler (yüklenen fotoğraf + KYC kimlik ön yüzü)
  async adminList() {
    const rows = await this.prisma.profilePhoto.findMany({
      where: { status: ProfilePhotoStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, userId: true, createdAt: true,
        user: { select: { profile: { select: { firstName: true, lastName: true, gender: true } }, kyc: { select: { id: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      createdAt: r.createdAt,
      firstName: r.user.profile?.firstName ?? "",
      lastName: r.user.profile?.lastName ?? "",
      gender: r.user.profile?.gender ?? null,
      photoUrl: `/api/v1/admin/profile-photos/${r.id}/file`,
      idFrontUrl: r.user.kyc ? `/api/v1/kyc/admin/file/${r.user.kyc.id}/front` : null,
    }));
  }

  async adminFile(id: string): Promise<string> {
    const row = await this.prisma.profilePhoto.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Fotoğraf bulunamadı");
    const fp = this.filePath(row.userId, row.fileName);
    if (!fs.existsSync(fp)) throw new NotFoundException("Fotoğraf bulunamadı");
    return fp;
  }

  // Onay: yeni fotoğraf geçerli olur; önceki onaylı fotoğraf dosya + kayıt silinir
  async approve(id: string) {
    const row = await this.prisma.profilePhoto.findUnique({ where: { id } });
    if (!row || row.status !== ProfilePhotoStatus.PENDING) throw new NotFoundException("Onay bekleyen fotoğraf bulunamadı");
    const old = await this.prisma.profilePhoto.findMany({ where: { userId: row.userId, status: ProfilePhotoStatus.APPROVED } });
    await this.prisma.$transaction([
      this.prisma.profilePhoto.deleteMany({ where: { id: { in: old.map((o) => o.id) } } }),
      this.prisma.profilePhoto.update({ where: { id }, data: { status: ProfilePhotoStatus.APPROVED, reviewedAt: new Date() } }),
    ]);
    old.forEach((o) => this.removeFile(o.userId, o.fileName));
    return { approved: true, userId: row.userId };
  }

  // Ret: yeni fotoğraf dosya + kayıt silinir; önceki onaylı kalır; kullanıcıya bildirim
  async reject(id: string) {
    const row = await this.prisma.profilePhoto.findUnique({ where: { id } });
    if (!row || row.status !== ProfilePhotoStatus.PENDING) throw new NotFoundException("Onay bekleyen fotoğraf bulunamadı");
    await this.prisma.profilePhoto.delete({ where: { id } });
    this.removeFile(row.userId, row.fileName);
    await this.notifications.sendToUser(row.userId, {
      title: "Profil fotoğrafı",
      body: PHOTO_REJECTED_MESSAGE,
      data: { event: "PROFILE_PHOTO_REJECTED" },
    });
    return { rejected: true, userId: row.userId };
  }
}
