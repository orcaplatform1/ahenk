import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// KYC dosyaları diskte AES-256-GCM ile şifreli durur. Anahtar: .env KYC_ENCRYPTION_KEY (64 karakter hex = 32 bayt).
// Dosya biçimi: MAGIC (8 bayt) | IV (12 bayt) | etiket (16 bayt) | şifreli içerik. Şifreli dosyanın adı "<ad>.<uzantı>.enc".
// Çözme yalnız bellekte yapılır (yetkili admin dosya ucu); çözülmüş içerik diske yazılmaz.
// Aynı biçim backend/scripts/kyc-encrypt-existing.js tarafından da kullanılır.
const MAGIC = Buffer.from("AHKKYC01", "ascii");
const IV_LEN = 12;
const TAG_LEN = 16;
export const KYC_ENC_SUFFIX = ".enc";

function key(): Buffer {
  const hex = process.env.KYC_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("KYC_ENCRYPTION_KEY tanımlı değil ya da geçersiz (64 karakter hex)");
  return Buffer.from(hex, "hex");
}

export function encryptKyc(plain: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decryptKyc(data: Buffer): Buffer {
  if (data.length < MAGIC.length + IV_LEN + TAG_LEN || !data.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Geçersiz şifreli KYC dosyası");
  }
  const iv = data.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = data.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(MAGIC.length + IV_LEN + TAG_LEN)), decipher.final()]);
}
