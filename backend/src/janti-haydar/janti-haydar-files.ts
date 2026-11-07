import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";

// Janti Haydar teklif formu dosyaları kişisel/ticari veridir: MediaController'dan sunulmaz, yalnızca admin ucundan
export const JANTI_FILES_DIR = path.join(process.cwd(), "..", "uploads", "janti-haydar");
export const JANTI_MAX_FILES = 3;
export const JANTI_MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 3 dosyanın toplamı en fazla 10 MB

export type JantiFileType = "jpg" | "png" | "webp" | "heic" | "heif" | "gif" | "avif" | "bmp" | "tiff" | "pdf";

export const JANTI_MIME: Record<JantiFileType, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  pdf: "application/pdf",
};

export interface JantiStoredFile {
  file: string; // disk adı
  originalName: string;
  type: JantiFileType;
  size: number;
}

// Form herkese açık olduğundan tür, beyan edilen MIME'a ya da uzantıya değil dosyanın ilk baytlarına göre belirlenir
export function detectJantiFile(buf: Buffer): JantiFileType | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (buf.length > 6 && (buf.toString("latin1", 0, 6) === "GIF87a" || buf.toString("latin1", 0, 6) === "GIF89a")) return "gif";
  if (buf.length > 5 && buf.toString("latin1", 0, 5) === "%PDF-") return "pdf";
  if (buf.length > 4 && (buf.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || buf.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a])))) return "tiff";
  if (buf.length > 14 && buf[0] === 0x42 && buf[1] === 0x4d) return "bmp";
  // HEIC / HEIF / AVIF: ISO-BMFF "ftyp" kutusu; ana marka ve uyumlu markalara bakılır
  if (buf.length > 16 && buf.toString("latin1", 4, 8) === "ftyp") {
    const boxSize = Math.min(buf.readUInt32BE(0), buf.length, 256);
    const brands = [buf.toString("latin1", 8, 12)];
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(buf.toString("latin1", i, i + 4));
    if (brands.some((b) => b === "avif" || b === "avis")) return "avif";
    if (brands.some((b) => ["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(b))) return "heic";
    if (brands.some((b) => b === "mif1" || b === "msf1")) return "heif";
  }
  return null;
}

export function assertJantiFiles(files: Express.Multer.File[]): void {
  if (files.length > JANTI_MAX_FILES) throw new BadRequestException("En fazla 3 dosya yükleyebilirsiniz");
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > JANTI_MAX_TOTAL_BYTES) throw new BadRequestException("Dosyaların toplam boyutu en fazla 10 MB olabilir");
  for (const f of files) {
    if (!detectJantiFile(f.buffer)) {
      throw new BadRequestException("Dosyalar JPG, JPEG, PNG, WEBP, HEIC, HEIF, GIF, AVIF, BMP, TIFF veya PDF olmalı");
    }
  }
}

export function saveJantiFiles(files: Express.Multer.File[]): JantiStoredFile[] {
  if (files.length === 0) return [];
  fs.mkdirSync(JANTI_FILES_DIR, { recursive: true });
  return files.map((f) => {
    const type = detectJantiFile(f.buffer) as JantiFileType;
    const name = `jh-${Date.now()}-${randomBytes(6).toString("hex")}.${type}`;
    fs.writeFileSync(path.join(JANTI_FILES_DIR, name), f.buffer);
    return { file: name, originalName: f.originalname.slice(0, 200), type, size: f.size };
  });
}

export function removeJantiFiles(stored: JantiStoredFile[]): void {
  for (const s of stored) fs.rmSync(path.join(JANTI_FILES_DIR, path.basename(s.file)), { force: true });
}
