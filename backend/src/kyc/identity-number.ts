import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// TC kimlik no: 11 hane, ilk hane 0 değil, 10. ve 11. haneler resmi algoritmayla doğrulanır
export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

// AES-256-GCM; anahtar IDENTITY_ENC_KEY (64 hex karakter). Biçim: iv.tag.veri (base64)
function key(hex: string | undefined): Buffer {
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("IDENTITY_ENC_KEY tanımlı değil ya da 64 hex karakter değil");
  return Buffer.from(hex, "hex");
}

export function encryptIdentityNumber(plain: string, keyHex: string | undefined): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keyHex), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptIdentityNumber(enc: string, keyHex: string | undefined): string {
  const [iv, tag, data] = enc.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(keyHex), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
