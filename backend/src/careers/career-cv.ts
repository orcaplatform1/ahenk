import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { detectImageKind, ImageKind, toWebp, UPLOAD_WEBP_QUALITY } from "../common/image-webp";

// Özgeçmişler kişisel veridir: MediaController'dan sunulmaz, yalnızca admin ucundan indirilir
export const CAREER_CV_DIR = path.join(process.cwd(), "..", "uploads", "career-cv");
export const CAREER_CV_MAX_BYTES = 5 * 1024 * 1024;

// Başvuru fotoğrafı (zorunlu, tek fotoğraf): kişisel veri, CV gibi yalnızca admin ucundan sunulur; WebP olarak saklanır
export const CAREER_PHOTO_DIR = path.join(process.cwd(), "..", "uploads", "career-photos");
export const CAREER_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_KINDS: ImageKind[] = ["jpg", "png", "webp", "heic", "heif"];

// Form herkese açık olduğundan tür, beyan edilen MIME'a değil ilk baytlara göre belirlenir
function detectCv(buf: Buffer, originalName: string): string | null {
  const ext = path.extname(originalName).toLowerCase();
  if (buf.length > 4 && buf.toString("latin1", 0, 5) === "%PDF-") return "pdf";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) && ext === ".doc") return "doc";
  if (buf.length > 4 && buf.toString("latin1", 0, 2) === "PK" && ext === ".docx") return "docx";
  return null;
}

export function assertCv(file?: Express.Multer.File): asserts file is Express.Multer.File {
  if (!file) throw new BadRequestException("Özgeçmiş (CV) yükleyin");
  if (file.size > CAREER_CV_MAX_BYTES) throw new BadRequestException("CV en fazla 5 MB olabilir");
  if (!detectCv(file.buffer, file.originalname)) throw new BadRequestException("CV PDF, DOC, DOCX, JPEG veya PNG olmalı");
}

export function saveCv(file: Express.Multer.File): string {
  fs.mkdirSync(CAREER_CV_DIR, { recursive: true });
  const name = `cv-${Date.now()}-${randomBytes(6).toString("hex")}.${detectCv(file.buffer, file.originalname)}`;
  fs.writeFileSync(path.join(CAREER_CV_DIR, name), file.buffer);
  return name;
}

export function assertCareerPhoto(file?: Express.Multer.File): asserts file is Express.Multer.File {
  if (!file?.buffer?.length) throw new BadRequestException("Fotoğraf yükleyin");
  if (file.size > CAREER_PHOTO_MAX_BYTES) throw new BadRequestException("Fotoğraf en fazla 10 MB olabilir");
  const kind = detectImageKind(file.buffer);
  if (!kind || !PHOTO_KINDS.includes(kind)) throw new BadRequestException("Fotoğraf JPEG, PNG, WebP, HEIC veya HEIF olmalı");
}

export async function saveCareerPhoto(file: Express.Multer.File): Promise<string> {
  const webp = await toWebp(file.buffer, detectImageKind(file.buffer)!, UPLOAD_WEBP_QUALITY);
  fs.mkdirSync(CAREER_PHOTO_DIR, { recursive: true });
  const name = `ph-${Date.now()}-${randomBytes(6).toString("hex")}.webp`;
  fs.writeFileSync(path.join(CAREER_PHOTO_DIR, name), webp);
  return name;
}
