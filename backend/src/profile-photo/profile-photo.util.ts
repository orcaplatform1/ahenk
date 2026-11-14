import * as path from "path";
import sharp from "sharp";
import { WEBP_QUALITY } from "../common/image-webp";
import { ProfilePhotoStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Profil fotoğrafları: /root/ahenk/uploads/profile-photos/<userId>/<dosya>.webp
export const PROFILE_PHOTO_DIR = path.join(process.cwd(), "..", "uploads", "profile-photos");
export const PROFILE_PHOTO_PREFIX = "/api/v1/media/profile-photos";
export const PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

// İki boyut: büyük (tam ekran görünüm) uzun kenar 1080 px — kayıttaki dosya adı; küçük (alt menü, liste, küçük daireler) uzun kenar
// 200 px — aynı adın ".s.webp" uzantılısı (p-<zaman>-<rastgele>.s.webp). İstemci küçük adresi büyük adresten türetir.
export const PHOTO_LARGE_PX = 1080;
export const PHOTO_SMALL_PX = 200;
export const smallPhotoName = (fileName: string) => fileName.replace(/\.webp$/, ".s.webp");
const resized = (webp: Buffer, px: number) =>
  sharp(webp).resize({ width: px, height: px, fit: "inside", withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer();
export async function photoSizes(webp: Buffer): Promise<{ large: Buffer; small: Buffer }> {
  const [large, small] = await Promise.all([resized(webp, PHOTO_LARGE_PX), resized(webp, PHOTO_SMALL_PX)]);
  return { large, small };
}

// Onaylı fotoğrafın herkese açık adresi (yalnız APPROVED kayıtlar sunulur)
export const profilePhotoUrl = (userId: string, fileName: string) => `${PROFILE_PHOTO_PREFIX}/${userId}/${fileName}`;

// Kullanıcı kimliği → onaylı fotoğraf adresi
export async function approvedPhotoMap(prisma: PrismaService, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.profilePhoto.findMany({
    where: { userId: { in: ids }, status: ProfilePhotoStatus.APPROVED },
    select: { userId: true, fileName: true },
  });
  return new Map(rows.map((r) => [r.userId, profilePhotoUrl(r.userId, r.fileName)]));
}

export async function approvedPhotoUrl(prisma: PrismaService, userId: string): Promise<string | null> {
  return (await approvedPhotoMap(prisma, [userId])).get(userId) ?? null;
}
