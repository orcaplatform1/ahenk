// Dosya türü uzantıya/beyan edilen MIME'a göre değil, ilk baytlarına (imzasına) göre belirlenir — sunucudaki kontrolle aynı.
export type FileKind = 'jpg' | 'png' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'heic' | 'heif' | 'avif' | 'pdf';

function startsWith(b: Uint8Array, sig: number[], at = 0) {
  return sig.every((v, i) => b[at + i] === v);
}
function ascii(b: Uint8Array, from: number, to: number) {
  return String.fromCharCode(...Array.from(b.slice(from, to)));
}

export async function detectFileKind(file: File): Promise<FileKind | null> {
  const b = new Uint8Array(await file.slice(0, 256).arrayBuffer());
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return 'gif';
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf';
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff';
  if (b.length > 14 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b.length > 16 && ascii(b, 4, 8) === 'ftyp') {
    const size = Math.min(((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0, b.length);
    const brands = [ascii(b, 8, 12)];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(b, i, i + 4));
    if (brands.some((x) => x === 'avif' || x === 'avis')) return 'avif';
    if (brands.some((x) => ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(x))) return 'heic';
    if (brands.some((x) => x === 'mif1' || x === 'msf1')) return 'heif';
  }
  return null;
}

// Mekân fotoğrafı: JPEG, PNG, WebP ve iPhone HEIC/HEIF (sunucuda WebP'ye çevrilir).
// capture özniteliği verilmez: iPhone'da seçici galeri, kamera ve dosyalar seçeneklerini birlikte sunar.
export const VENUE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
const VENUE_KINDS: FileKind[] = ['jpg', 'png', 'webp', 'heic', 'heif'];

export async function isVenuePhoto(file: File): Promise<boolean> {
  const kind = await detectFileKind(file);
  return !!kind && VENUE_KINDS.includes(kind);
}

// Tarayıcıların çoğu HEIC/HEIF önizleyemez
export async function canPreview(file: File): Promise<boolean> {
  const kind = await detectFileKind(file);
  return kind !== 'heic' && kind !== 'heif';
}
