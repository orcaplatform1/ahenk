import { BadRequestException } from "@nestjs/common";
import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import sharp from "sharp";

// Yüklenen görseller sunucuda WebP'ye çevrilip yalnızca WebP olarak saklanır (kalite 82, yeniden boyutlandırma yok).
// Tür, dosya adına/uzantısına değil ilk baytlarına (imzasına) göre belirlenir.
// HEIC/HEIF (iPhone): sharp'ın hazır paketi HEVC çözemez; sistemdeki libheif + libde265 (heif-dec, libheif-examples) ile çözülür.
export const WEBP_QUALITY = 82;
const HEIF_DEC = "/usr/bin/heif-dec";
const HEIF_TIMEOUT_MS = 30_000;
const run = promisify(execFile);

export type ImageKind = "jpg" | "png" | "webp" | "gif" | "bmp" | "tiff" | "heic" | "heif" | "avif";

export function detectImageKind(buf: Buffer): ImageKind | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (buf.length > 6 && (buf.toString("latin1", 0, 6) === "GIF87a" || buf.toString("latin1", 0, 6) === "GIF89a")) return "gif";
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

// HEIC/HEIF → PNG (geçici klasör, iş bitince silinir); dönüşüm yönü (irot/imir) heif-dec tarafından uygulanır
async function decodeHeif(buf: Buffer): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ahenk-heif-"));
  try {
    const input = path.join(dir, "in.heic");
    const output = path.join(dir, "out.png");
    fs.writeFileSync(input, buf);
    await run(HEIF_DEC, [input, output], { timeout: HEIF_TIMEOUT_MS });
    return fs.readFileSync(output);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Görseli WebP'ye çevirir. Hareketli GIF/WebP hareketli WebP olur. Boyut değişmez; yalnızca EXIF yönü uygulanır.
// Bozuk/okunamayan dosya 400 döner (sunucu hatası değil).
export async function toWebp(buf: Buffer, kind: ImageKind): Promise<Buffer> {
  try {
    if (kind === "heic" || kind === "heif") {
      return await sharp(await decodeHeif(buf)).webp({ quality: WEBP_QUALITY }).toBuffer();
    }
    if (kind === "gif" || kind === "webp") {
      const meta = await sharp(buf).metadata();
      if ((meta.pages ?? 1) > 1) return await sharp(buf, { animated: true }).webp({ quality: WEBP_QUALITY }).toBuffer();
    }
    return await sharp(buf).rotate().webp({ quality: WEBP_QUALITY }).toBuffer();
  } catch {
    throw new BadRequestException("Görsel işlenemedi; dosya bozuk olabilir, başka bir görsel deneyin");
  }
}
