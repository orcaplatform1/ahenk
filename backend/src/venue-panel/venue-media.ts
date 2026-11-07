import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { detectImageKind, ImageKind, toWebp } from "../common/image-webp";

// Mekân tanıtım fotoğrafları: /root/ahenk/uploads/venue-gallery/<anahtar>/ — MediaController herkese açık sunar
export const VENUE_GALLERY_DIR = path.join(process.cwd(), "..", "uploads", "venue-gallery");
export const VENUE_GALLERY_PREFIX = "/api/v1/media/venue-gallery";
export const VENUE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const VENUE_PHOTO_MAX_COUNT = 3;

// Başvuru herkese açık olduğundan tür, dosyanın beyan edilen MIME'ına değil ilk baytlarına göre belirlenir
export function detectImage(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

// Mekân fotoğrafı olarak kabul edilen türler (içerikten): JPEG, PNG, WebP ve iPhone HEIC/HEIF
const VENUE_PHOTO_KINDS: ImageKind[] = ["jpg", "png", "webp", "heic", "heif"];

export function venuePhotoKind(buf: Buffer): ImageKind | null {
  const kind = detectImageKind(buf);
  return kind && VENUE_PHOTO_KINDS.includes(kind) ? kind : null;
}

export function assertVenuePhotos(files: Express.Multer.File[]): void {
  for (const file of files) {
    if (!venuePhotoKind(file.buffer)) throw new BadRequestException("Fotoğraflar JPEG, PNG, WebP, HEIC veya HEIF olmalı");
  }
}

// Doğrulanmış dosyaları WebP'ye çevirip (kalite 82, boyut değişmez) diske yazar, herkese açık adreslerini döner
export async function saveVenuePhotos(key: string, files: Express.Multer.File[]): Promise<string[]> {
  const dir = path.join(VENUE_GALLERY_DIR, key);
  const webps = await Promise.all(files.map((file) => toWebp(file.buffer, venuePhotoKind(file.buffer) as ImageKind)));
  fs.mkdirSync(dir, { recursive: true });
  return webps.map((buf) => {
    const name = `g-${Date.now()}-${randomBytes(4).toString("hex")}.webp`;
    fs.writeFileSync(path.join(dir, name), buf);
    return `${VENUE_GALLERY_PREFIX}/${key}/${name}`;
  });
}

export function removeVenuePhotoDir(key: string): void {
  fs.rmSync(path.join(VENUE_GALLERY_DIR, key), { recursive: true, force: true });
}
