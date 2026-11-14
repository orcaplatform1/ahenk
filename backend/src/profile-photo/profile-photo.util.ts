import * as path from "path";
import { ProfilePhotoStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// Profil fotoğrafları: /root/ahenk/uploads/profile-photos/<userId>/<dosya>.webp
export const PROFILE_PHOTO_DIR = path.join(process.cwd(), "..", "uploads", "profile-photos");
export const PROFILE_PHOTO_PREFIX = "/api/v1/media/profile-photos";
export const PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

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
