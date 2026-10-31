import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";

// Mekân tanıtım fotoğrafları: /root/ahenk/uploads/venue-gallery/<anahtar>/ — MediaController herkese açık sunar
export const VENUE_GALLERY_DIR = path.join(process.cwd(), "..", "uploads", "venue-gallery");
export const VENUE_GALLERY_PREFIX = "/api/v1/media/venue-gallery";
export const VENUE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const VENUE_PHOTO_MAX_COUNT = 10;

// Başvuru herkese açık olduğundan tür, dosyanın beyan edilen MIME'ına değil ilk baytlarına göre belirlenir
function detectImage(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

export function assertVenuePhotos(files: Express.Multer.File[]): void {
  for (const file of files) {
    if (!detectImage(file.buffer)) throw new BadRequestException("Fotoğraflar JPEG, PNG veya WebP olmalı");
  }
}

// Doğrulanmış dosyaları diske yazar, herkese açık adreslerini döner
export function saveVenuePhotos(key: string, files: Express.Multer.File[]): string[] {
  const dir = path.join(VENUE_GALLERY_DIR, key);
  fs.mkdirSync(dir, { recursive: true });
  return files.map((file) => {
    const name = `g-${Date.now()}-${randomBytes(4).toString("hex")}.${detectImage(file.buffer)}`;
    fs.writeFileSync(path.join(dir, name), file.buffer);
    return `${VENUE_GALLERY_PREFIX}/${key}/${name}`;
  });
}

export function removeVenuePhotoDir(key: string): void {
  fs.rmSync(path.join(VENUE_GALLERY_DIR, key), { recursive: true, force: true });
}
