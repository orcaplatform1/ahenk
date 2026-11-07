import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { detectImageKind, toWebp } from "../common/image-webp";

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
  if (buf.length > 5 && buf.toString("latin1", 0, 5) === "%PDF-") return "pdf";
  return detectImageKind(buf);
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

// Görseller WebP'ye çevrilip yalnızca WebP olarak saklanır (kalite 82, boyut değişmez); PDF olduğu gibi saklanır
export async function saveJantiFiles(files: Express.Multer.File[]): Promise<JantiStoredFile[]> {
  if (files.length === 0) return [];
  const prepared = await Promise.all(files.map(async (f) => {
    const kind = detectJantiFile(f.buffer) as JantiFileType;
    if (kind === "pdf") return { f, type: "pdf" as const, buf: f.buffer };
    return { f, type: "webp" as const, buf: await toWebp(f.buffer, kind) };
  }));
  fs.mkdirSync(JANTI_FILES_DIR, { recursive: true });
  return prepared.map(({ f, type, buf }) => {
    const name = `jh-${Date.now()}-${randomBytes(6).toString("hex")}.${type}`;
    fs.writeFileSync(path.join(JANTI_FILES_DIR, name), buf);
    // Çevrilen görselin indirme adı .webp uzantısıyla (ör. IMG_0001.HEIC → IMG_0001.webp)
    const base = f.originalname.slice(0, 190);
    const originalName = type === "webp" ? `${base.replace(/\.[^./\\]+$/, "") || "gorsel"}.webp` : base;
    return { file: name, originalName, type, size: buf.length };
  });
}

export function removeJantiFiles(stored: JantiStoredFile[]): void {
  for (const s of stored) fs.rmSync(path.join(JANTI_FILES_DIR, path.basename(s.file)), { force: true });
}
